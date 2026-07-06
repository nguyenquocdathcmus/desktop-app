import { dirname, join } from 'path'
import { tmpdir } from 'os'
import { mkdirSync, existsSync, unlinkSync, writeFileSync, renameSync } from 'fs'
import { FFmpegWrapper } from './FFmpegWrapper'
import { generateCursorAss } from './CursorAss'
import type { ExportOptions, ExportCodec, ExportQuality } from '../../shared/ipc-types'
import type { ZoomEvent, WebcamSettings, DeviceFrame } from '../../shared/project-types'

const ffmpeg = new FFmpegWrapper()

const FONT = '/System/Library/Fonts/Helvetica.ttc'

// crf for libx264 (h264); h265 uses hardware VideoToolbox, which takes a target
// bitrate instead of crf, so its values are Mbps scaled by output resolution below.
const H264_CRF: Record<ExportQuality, number> = { low: 28, balanced: 23, high: 18, lossless: 0 }

/** Builds the -c:v / quality args for the chosen codec+quality combination.
 *  Sprint 25 US-191 — `preserveHdr` forces HEVC (VideoToolbox) regardless of
 *  the requested codec, since libx264/H.264 has no practical 10-bit path here
 *  and mixing "HDR" with H.264 would be a contradiction users can't act on. */
function buildVideoCodecArgs(codec: ExportCodec, quality: ExportQuality, width: number, height: number, preserveHdr: boolean): string[] {
  if (preserveHdr) {
    // Sprint 25 US-191 — HDR export uses libx265 (software), not
    // hevc_videotoolbox, for two reasons confirmed by running both paths
    // directly against the bundled ffmpeg binary (see
    // test/RESULTS/sprint-25-hdr-fps-verification.md):
    //   1. hevc_videotoolbox's hardware Main10 session fails outright on this
    //      environment with "Cannot create compression session: -12908" and
    //      needs -allow_sw 1 anyway, which just makes it software encoding
    //      through a hardware-oriented API.
    //   2. Neither hevc_videotoolbox NOR libx265's generic -color_primaries/
    //      -color_trc/-colorspace flags actually bake BT.2020/PQ into the
    //      HEVC bitstream's VUI parameters in this ffmpeg build — only
    //      libx265's -x265-params colorprim/transfer/colormatrix does, which
    //      is the only combination that survived a real ffprobe round-trip.
    // Slower than hardware encoding, but correctness (a file that actually
    // signals HDR to a player) matters more than speed for an opt-in feature.
    const x265Params = `colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc`
    return ['-c:v', 'libx265', '-crf', String(H264_CRF[quality] || 20), '-preset', 'fast', '-x265-params', x265Params, '-tag:v', 'hvc1']
  }
  if (codec === 'h265') {
    // hevc_videotoolbox is hardware-accelerated on Apple Silicon and takes -b:v
    // rather than crf. Scale target bitrate by pixel count so 4K doesn't get
    // squeezed into a 1080p bitrate budget.
    const megapixels = (width * height) / (1920 * 1080)
    const mbpsByQuality: Record<ExportQuality, number> = { low: 4, balanced: 8, high: 16, lossless: 40 }
    const bitrateMbps = Math.max(2, mbpsByQuality[quality] * megapixels)
    return ['-c:v', 'hevc_videotoolbox', '-b:v', `${bitrateMbps.toFixed(1)}M`, '-tag:v', 'hvc1']
  }
  return ['-c:v', 'libx264', '-crf', String(H264_CRF[quality]), '-preset', 'fast']
}

/** Kills any in-flight export ffmpeg process — used by export cancel and app quit. */
export function cancelExport(): void {
  ffmpeg.kill()
}

function hex2rgb(h: string): { r: number; g: number; b: number } {
  const c = parseInt(h.replace('#', ''), 16)
  return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 }
}

function even(n: number): number {
  return Math.round(n) & ~1
}

/** Escapes text for use inside drawtext=text='...' within filter_complex. */
function escDrawtext(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "’") // typographic apostrophe — avoids quote-escaping hell
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
}

// ─── Multi-segment splicing + timed-event remapping ─────────────────────────────

export interface Segment { start: number; end: number; speed?: number }

/** Total output duration accounting for per-segment speed multipliers. */
export function conceptualDuration(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + (s.end - s.start) / (s.speed ?? 1), 0)
}

/**
 * Re-bases range events ({startTime,endTime} in source-video seconds) onto the
 * spliced output's conceptual timeline, accounting for removed regions and
 * per-segment speed. Events spanning a boundary are clipped per-segment.
 * Shared by zoom events, annotations, and camera scenes.
 */
export function remapRangeEvents<T extends { startTime: number; endTime: number }>(
  events: T[],
  segments: Segment[]
): T[] {
  let offset = 0
  const remapped: T[] = []
  for (const seg of segments) {
    const speed = seg.speed ?? 1
    for (const e of events) {
      const overlapStart = Math.max(e.startTime, seg.start)
      const overlapEnd = Math.min(e.endTime, seg.end)
      if (overlapEnd <= overlapStart) continue
      remapped.push({
        ...e,
        startTime: offset + (overlapStart - seg.start) / speed,
        endTime: offset + (overlapEnd - seg.start) / speed
      })
    }
    offset += (seg.end - seg.start) / speed
  }
  return remapped.sort((a, b) => a.startTime - b.startTime)
}

/** Same as remapRangeEvents but for instantaneous events ({ t }). Events inside
 *  removed regions are dropped. */
export function remapPointEvents<T extends { t: number }>(events: T[], segments: Segment[]): T[] {
  let offset = 0
  const remapped: T[] = []
  segments.forEach((seg, i) => {
    const speed = seg.speed ?? 1
    // Sprint 29 (round 2) — this used to be `e.t >= seg.start && e.t <= seg.end`,
    // inclusive on both ends. splitSegmentAt() (useProjectStore.ts) produces
    // exactly two adjacent kept segments sharing one boundary value
    // (`{start: s, end: time}` and `{start: time, end: e}`), so a point event
    // sitting exactly at that shared boundary matched BOTH segments' inclusive
    // range and was emitted twice in the output — a chapter/keystroke-badge/
    // click-sound duplicated at two slightly different output timestamps.
    // Each segment now owns `[start, end)`; only the last segment in the
    // array (the true end of the source timeline) keeps its closing edge
    // inclusive, so an event exactly at the very end of the whole recording
    // still isn't silently dropped.
    const isLastSegment = i === segments.length - 1
    for (const e of events) {
      const inRange = isLastSegment ? e.t >= seg.start && e.t <= seg.end : e.t >= seg.start && e.t < seg.end
      if (inRange) {
        remapped.push({ ...e, t: offset + (e.t - seg.start) / speed })
      }
    }
    offset += (seg.end - seg.start) / speed
  })
  return remapped.sort((a, b) => a.t - b.t)
}

/** atempo only accepts 0.5–2.0 per instance — chain them for larger factors. */
export function atempoChain(speed: number): string {
  const chain: string[] = []
  let s = speed
  while (s > 2.0) { chain.push('atempo=2.0'); s /= 2.0 }
  while (s < 0.5) { chain.push('atempo=0.5'); s /= 0.5 }
  chain.push(`atempo=${s.toFixed(4)}`)
  return chain.join(',')
}

/**
 * Splices the kept segments of `srcLabel` into one continuous stream, applying
 * per-segment speed via setpts (and atempo when audio is included). Boundaries
 * are hard cuts, matching the Timeline's ripple-delete preview.
 */
export function buildConcatFilter(
  segments: Segment[],
  srcLabel: string,
  hasAudioIn: boolean,
  labelPrefix = 's'
): { parts: string[]; videoOut: string; audioOut: string | null } {
  const parts: string[] = []
  const vLabels: string[] = []
  const aLabels: string[] = []

  segments.forEach((seg, i) => {
    const speed = seg.speed ?? 1
    const vLabel = `${labelPrefix}v${i}`
    const speedV = speed !== 1 ? `,setpts=PTS/${speed.toFixed(4)}` : ''
    parts.push(`${srcLabel}trim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},setpts=PTS-STARTPTS${speedV}[${vLabel}]`)
    vLabels.push(`[${vLabel}]`)
    if (hasAudioIn) {
      const aLabel = `${labelPrefix}a${i}`
      const speedA = speed !== 1 ? `,${atempoChain(speed)}` : ''
      parts.push(`[0:a]atrim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},asetpts=PTS-STARTPTS${speedA}[${aLabel}]`)
      aLabels.push(`[${aLabel}]`)
    }
  })

  const videoOut = `${labelPrefix}pliced`
  if (hasAudioIn) {
    const interleaved = segments.map((_, i) => `${vLabels[i]}${aLabels[i]}`).join('')
    parts.push(`${interleaved}concat=n=${segments.length}:v=1:a=1[${videoOut}][${labelPrefix}plicedaud]`)
    return { parts, videoOut, audioOut: `${labelPrefix}plicedaud` }
  }
  parts.push(`${vLabels.join('')}concat=n=${segments.length}:v=1:a=0[${videoOut}]`)
  return { parts, videoOut, audioOut: null }
}

// ─── Zoom FFmpeg expression builders ────────────────────────────────────────────

// Sprint 25 US-193 audit caught a real, pre-existing bug here: these
// expressions are evaluated inside ffmpeg's `zoompan` filter, whose eval
// context exposes the current output time as the variable `time` — NOT `t`
// (the generic ffmpeg eval-context variable used by filters like `drawtext`/
// `geq`/`enable`). `between(t,...)`/`clip((t-...)` silently referenced an
// undefined variable, which `zoompan` rejects at filter-graph construction
// ("Unknown function") — meaning zoom has never actually applied during
// export for any recording with zoomEvents; the unit tests only asserted the
// (buggy) string shape, never ran it through real ffmpeg. Confirmed the fix
// by running the exact expression through the bundled ffmpeg binary directly
// (see test/RESULTS/sprint-25-hdr-fps-verification.md).
export function buildZExpr(events: ZoomEvent[]): string {
  if (events.length === 0) return '1'
  let expr = '1'
  for (const e of [...events].reverse()) {
    const t1 = e.startTime.toFixed(3)
    const t2 = e.endTime.toFixed(3)
    const dur = Math.max(0.001, e.endTime - e.startTime).toFixed(3)
    const zoom = e.zoomLevel.toFixed(4)
    const p = `clip((time-${t1})/${dur},0,1)`
    const eased = `if(lt(${p},0.5),2*pow(${p},2),-1+(4-2*${p})*${p})`
    expr = `if(between(time,${t1},${t2}),1+(${zoom}-1)*(${eased}),${expr})`
  }
  return expr
}

export function buildXExpr(events: ZoomEvent[]): string {
  if (events.length === 0) return '0'
  let expr = '0'
  for (const e of [...events].reverse()) {
    const t1 = e.startTime.toFixed(3)
    const t2 = e.endTime.toFixed(3)
    const dur = Math.max(0.001, e.endTime - e.startTime).toFixed(3)
    const cx = e.centerX.toFixed(4)
    const zoom = e.zoomLevel.toFixed(4)
    const p = `clip((time-${t1})/${dur},0,1)`
    const eased = `if(lt(${p},0.5),2*pow(${p},2),-1+(4-2*${p})*${p})`
    const z = `(1+(${zoom}-1)*(${eased}))`
    const panX = `max(0,min(iw-iw/${z},${cx}*iw-iw/(2*${z})))`
    expr = `if(between(time,${t1},${t2}),${panX},${expr})`
  }
  return expr
}

export function buildYExpr(events: ZoomEvent[]): string {
  if (events.length === 0) return '0'
  let expr = '0'
  for (const e of [...events].reverse()) {
    const t1 = e.startTime.toFixed(3)
    const t2 = e.endTime.toFixed(3)
    const dur = Math.max(0.001, e.endTime - e.startTime).toFixed(3)
    const cy = e.centerY.toFixed(4)
    const zoom = e.zoomLevel.toFixed(4)
    const p = `clip((time-${t1})/${dur},0,1)`
    const eased = `if(lt(${p},0.5),2*pow(${p},2),-1+(4-2*${p})*${p})`
    const z = `(1+(${zoom}-1)*(${eased}))`
    const panY = `max(0,min(ih-ih/${z},${cy}*ih-ih/(2*${z})))`
    expr = `if(between(time,${t1},${t2}),${panY},${expr})`
  }
  return expr
}

/**
 * Horizontal crop position for vertical/square export: keeps the crop window
 * centered on the active zoom event's focal point (the region the user zoomed
 * into is exactly the region worth keeping when cropping), else center-crop.
 */
export function buildCropXExpr(events: ZoomEvent[], inW: number, outW: number): string {
  const centerDefault = `(${inW}-${outW})/2`
  if (events.length === 0) return centerDefault
  let expr = centerDefault
  for (const e of [...events].reverse()) {
    const t1 = e.startTime.toFixed(3)
    const t2 = e.endTime.toFixed(3)
    const cx = e.centerX.toFixed(4)
    const target = `max(0,min(${inW}-${outW},${cx}*${inW}-${outW}/2))`
    expr = `if(between(t,${t1},${t2}),${target},${expr})`
  }
  return expr
}

/** Piecewise-linear expression through {t, v} samples — used for face-tracking
 *  crop paths. Capped by the caller (~40 samples) to keep the graph sane. */
function buildLerpExpr(points: { t: number; v: number }[], fallback: string): string {
  if (points.length === 0) return fallback
  if (points.length === 1) return points[0].v.toFixed(4)
  let expr = points[points.length - 1].v.toFixed(4)
  for (let i = points.length - 2; i >= 0; i--) {
    const a = points[i]
    const b = points[i + 1]
    const dt = Math.max(0.001, b.t - a.t)
    const lerp = `${a.v.toFixed(4)}+(${(b.v - a.v).toFixed(4)})*clip((t-${a.t.toFixed(3)})/${dt.toFixed(3)},0,1)`
    expr = `if(lt(t,${b.t.toFixed(3)}),${lerp},${expr})`
  }
  return expr
}

// ─── Webcam layout geometry ─────────────────────────────────────────────────────

/** Computes the top-left pixel offset for the webcam overlay within the WxH canvas. */
function webcamOffset(webcam: WebcamSettings, W: number, H: number): { x: number; y: number } {
  const margin = 32
  switch (webcam.position) {
    case 'top-left': return { x: margin, y: margin }
    case 'top-right': return { x: W - webcam.width - margin, y: margin }
    case 'bottom-left': return { x: margin, y: H - webcam.height - margin }
    case 'custom': return {
      x: Math.round((webcam.customX ?? 0.5) * W - webcam.width / 2),
      y: Math.round((webcam.customY ?? 0.5) * H - webcam.height / 2)
    }
    case 'bottom-right':
    default: return { x: W - webcam.width - margin, y: H - webcam.height - margin }
  }
}

interface WebcamVariant {
  w: number
  h: number
  x: number
  y: number
  shape: 'circle' | 'rounded-rect'
  radius: number
  enable: string | null // null = always
}

function sceneVariantGeometry(
  layout: string,
  webcam: WebcamSettings,
  W: number, H: number,
  padding: number, innerW: number, innerH: number,
  cornerRadius: number
): Omit<WebcamVariant, 'enable'> | null {
  switch (layout) {
    case 'pip': {
      const { x, y } = webcamOffset(webcam, W, H)
      return { w: webcam.width, h: webcam.height, x, y, shape: webcam.shape, radius: Math.min(24, Math.min(webcam.width, webcam.height) / 4) }
    }
    case 'camera-full':
      return { w: innerW, h: innerH, x: padding, y: padding, shape: 'rounded-rect', radius: cornerRadius }
    case 'side-by-side': {
      const w = even(innerW / 2)
      return { w, h: innerH, x: padding + innerW - w, y: padding, shape: 'rounded-rect', radius: Math.min(16, cornerRadius) }
    }
    default:
      return null // screen-only / title-card → no webcam
  }
}

/** Mask chain for a webcam variant (circle or rounded-rect alpha). */
function maskChain(v: Omit<WebcamVariant, 'enable'>): string {
  if (v.shape === 'circle') {
    const cx = v.w / 2
    const cy = v.h / 2
    const rad = Math.min(v.w, v.h) / 2
    return `geq=lum='p(X,Y)':a='if(gt(pow(X-${cx},2)+pow(Y-${cy},2),${rad * rad}),0,255)'`
  }
  const r = v.radius
  return `geq=lum='p(X,Y)':a='if(gt(pow(max(0,abs(X-${v.w / 2})-${v.w / 2}+${r}),2)+pow(max(0,abs(Y-${v.h / 2})-${v.h / 2}+${r}),2),${r * r}),0,255)'`
}

// ─── Device frame chrome ────────────────────────────────────────────────────────

function buildDeviceFrameFilter(frame: DeviceFrame, padding: number, innerW: number, innerH: number): string {
  const x0 = padding
  const y0 = padding

  if (frame === 'browser') {
    const barH = 32
    return `[composited1]drawbox=x=${x0}:y=${y0}:w=${innerW}:h=${barH}:color=0x2c2c2c:t=fill[out]`
  }

  if (frame === 'macbook') {
    const topH = 24
    const bottomH = 20
    return `[composited1]` +
      `drawbox=x=${x0}:y=${y0}:w=${innerW}:h=${topH}:color=0x1e1e1e:t=fill,` +
      `drawbox=x=${x0}:y=${y0 + innerH - bottomH}:w=${innerW}:h=${bottomH}:color=0x1e1e1e:t=fill[out]`
  }

  const topH = 28
  const bottomH = 24
  return `[composited1]` +
    `drawbox=x=${x0}:y=${y0}:w=${innerW}:h=${topH}:color=black@0.8:t=fill,` +
    `drawbox=x=${x0}:y=${y0 + innerH - bottomH}:w=${innerW}:h=${bottomH}:color=black@0.8:t=fill[out]`
}

// ─── Export video ───────────────────────────────────────────────────────────────

export async function exportVideo(
  opts: ExportOptions,
  onProgress: (pct: number, eta?: number) => void
): Promise<{ ok: true; outputPath: string } | { ok: false; error: string }> {
  let cursorAssPath: string | null = null
  try {
    mkdirSync(dirname(opts.outputPath), { recursive: true })

    const { background, padding, cornerRadius, resolution } = opts

    // Canvas by aspect ratio: height comes from the chosen resolution, width
    // follows the aspect (9:16 vertical, 1:1 square, default 16:9 unchanged).
    const aspect = opts.aspectRatio ?? '16:9'
    const H = resolution.height
    const W = aspect === '9:16' ? even(H * 9 / 16) : aspect === '1:1' ? even(H) : resolution.width
    const innerW = W - padding * 2
    const innerH = H - padding * 2

    const videoPath = opts.projectPath.endsWith('capture.mov')
      ? opts.projectPath
      : opts.projectPath.replace(/\/?$/, '/capture.mov')

    const inPoint = opts.inPoint ?? 0
    const outPoint = opts.outPoint && opts.outPoint > inPoint ? opts.outPoint : 0

    // Effective segments — a uniform basis for remapping and speed, even when the
    // project is a single continuous trim.
    const rawSegments: Segment[] = (opts.segments ?? []).filter((s) => s.end > s.start)
    const segments: Segment[] = rawSegments.length > 0
      ? rawSegments
      : [{ start: inPoint, end: outPoint > 0 ? outPoint : (opts.sourceDuration ?? 60) }]
    const isMultiSegment = segments.length >= 2
    const singleSpeed = !isMultiSegment ? (segments[0].speed ?? 1) : 1

    const trimmedDuration = conceptualDuration(segments)

    // Re-base every timed event onto the conceptual (output) timeline.
    const zoomEvents = remapRangeEvents(opts.zoomEvents ?? [], segments)
    const annotations = remapRangeEvents(opts.annotations ?? [], segments)
    const keystrokes = remapPointEvents(opts.keystrokes ?? [], segments)
    const scenes = remapRangeEvents(opts.scenes ?? [], segments)
    const blurRegions = remapRangeEvents(opts.blurRegions ?? [], segments)
    const clickTimes = remapPointEvents((opts.clickTimes ?? []).map((t) => ({ t })), segments).map((p) => p.t)
    const faceCrop = remapPointEvents(opts.faceCropPath ?? [], segments)
    const hasZoom = zoomEvents.length > 0

    const args: string[] = ['-y']

    // Input 0: source video. Single-range uses fast input seeking; multi-segment
    // reads the whole file and trims in the filtergraph.
    if (!isMultiSegment) {
      if (segments[0].start > 0) args.push('-ss', segments[0].start.toFixed(3))
      args.push('-i', videoPath)
      if (outPoint > 0) args.push('-to', (segments[0].end - segments[0].start).toFixed(3))
    } else {
      args.push('-i', videoPath)
    }

    const needsBgInput = background.type === 'blur' || background.type === 'wallpaper'
    if (needsBgInput && (background as any).screenshotPath) {
      args.push('-i', (background as any).screenshotPath)
    }
    let nextInputIdx = needsBgInput ? 2 : 1

    const webcamPath = opts.webcamPath
    const hasWebcam = !!(webcamPath && opts.webcam && existsSync(webcamPath))
    let webcamIdx = -1
    if (hasWebcam) {
      webcamIdx = nextInputIdx++
      // Keep the webcam input aligned with the main video's trim window.
      if (!isMultiSegment && segments[0].start > 0) {
        args.splice(args.length, 0, '-ss', segments[0].start.toFixed(3))
      }
      args.push('-i', webcamPath!)
    }

    const parts: string[] = []

    // ── Synthetic cursor (Sprint 10): burn onto SOURCE frames so trim/speed/zoom
    // downstream all apply to the cursor for free. Single-range -ss rebases pts,
    // so ASS timestamps shift by the trim start in that case.
    let srcLabel = '[0:v]'
    if (opts.cursorPath && opts.cursorPath.length > 1 && opts.sourceWidth && opts.sourceHeight) {
      cursorAssPath = generateCursorAss(
        opts.cursorPath,
        opts.sourceWidth,
        opts.sourceHeight,
        opts.cursorScale ?? 1,
        isMultiSegment ? 0 : segments[0].start
      )
      if (cursorAssPath) {
        parts.push(`[0:v]ass='${cursorAssPath}'[cursored]`)
        srcLabel = '[cursored]'
      }
    }

    // ── Splice / speed
    const hasSourceAudioForConcat = isMultiSegment && !!opts.hasSystemAudio
    let splicedAudioLabel: string | null = null
    let stageIn = srcLabel

    if (isMultiSegment) {
      const concat = buildConcatFilter(segments, srcLabel, hasSourceAudioForConcat)
      parts.push(...concat.parts)
      stageIn = `[${concat.videoOut}]`
      splicedAudioLabel = concat.audioOut
    } else if (singleSpeed !== 1) {
      parts.push(`${stageIn}setpts=PTS/${singleSpeed.toFixed(4)}[spedup]`)
      stageIn = '[spedup]'
    }

    // Splice webcam identically so it stays in sync after ripple deletes/speed.
    let webcamSrc = hasWebcam ? `[${webcamIdx}:v]` : ''
    if (hasWebcam && isMultiSegment) {
      const wcConcat = buildConcatFilter(segments, webcamSrc, false, 'w')
      parts.push(...wcConcat.parts)
      webcamSrc = `[${wcConcat.videoOut}]`
    } else if (hasWebcam && singleSpeed !== 1) {
      parts.push(`${webcamSrc}setpts=PTS/${singleSpeed.toFixed(4)}[wcsped]`)
      webcamSrc = '[wcsped]'
    }

    // ── Zoom / scale (+ optional aspect crop for 9:16 / 1:1)
    const sourceAspect = opts.sourceWidth && opts.sourceHeight
      ? opts.sourceWidth / opts.sourceHeight
      : 16 / 9
    const needCrop = aspect !== '16:9'
    const stageW = needCrop ? Math.max(innerW, even(innerH * sourceAspect)) : innerW

    if (hasZoom) {
      const zExpr = buildZExpr(zoomEvents)
      const xExpr = buildXExpr(zoomEvents)
      const yExpr = buildYExpr(zoomEvents)
      parts.push(`${stageIn}zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=1:s=${stageW}x${innerH}:fps=${opts.fps}[zoomed]`)
      parts.push(`[zoomed]setpts=PTS-STARTPTS[prescale]`)
    } else {
      parts.push(`${stageIn}scale=${stageW}:${innerH}:flags=lanczos[prescale]`)
    }

    if (needCrop) {
      parts.push(`[prescale]crop=${innerW}:${innerH}:x='${buildCropXExpr(zoomEvents, stageW, innerW)}':y=0[scaled]`)
    } else {
      parts.push(`[prescale]null[scaled]`)
    }

    // ── Background. `color=` is an infinite source — bound it with `d=` so the
    // graph terminates once the finite foreground ends.
    const bgDuration = (trimmedDuration + 1).toFixed(3)
    if (background.type === 'solid') {
      parts.push(`color=c=0x${background.color.replace('#', '')}:size=${W}x${H}:rate=${opts.fps}:d=${bgDuration}[bg]`)
    } else if (background.type === 'gradient') {
      const stops = background.stops
      const c0 = hex2rgb(stops[0]?.color ?? '#1a1a2e')
      const c1 = hex2rgb(stops[stops.length - 1]?.color ?? '#16213e')
      const rad = ((background.angle ?? 135) * Math.PI) / 180
      const dx = Math.cos(rad).toFixed(4)
      const dy = Math.sin(rad).toFixed(4)
      const mag = Math.max(W, H)
      parts.push(
        `color=c=black:size=${W}x${H}:rate=${opts.fps}:d=${bgDuration},geq=` +
        `r='clip(${c0.r}+((${c1.r}-${c0.r})*(X*${dx}+Y*${dy})/${mag}),0,255)':` +
        `g='clip(${c0.g}+((${c1.g}-${c0.g})*(X*${dx}+Y*${dy})/${mag}),0,255)':` +
        `b='clip(${c0.b}+((${c1.b}-${c0.b})*(X*${dx}+Y*${dy})/${mag}),0,255)'[bg]`
      )
    } else if (needsBgInput) {
      const blur = background.type === 'blur' ? (background as any).blurRadius : 0
      parts.push(`[1:v]scale=${W}:${H}:flags=lanczos${blur > 0 ? `,boxblur=${blur}` : ''}[bg]`)
    } else {
      parts.push(`color=c=0x1a1a2e:size=${W}x${H}:rate=${opts.fps}:d=${bgDuration}[bg]`)
    }

    // ── Composite: bg + video, rounded corners
    const hasDeviceFrame = opts.deviceFrame && opts.deviceFrame !== 'none'
    const needsCompositedLabel = hasWebcam || hasDeviceFrame

    if (cornerRadius > 0) {
      const r = cornerRadius
      parts.push(`[bg][scaled]overlay=${padding}:${padding}[pre]`)
      parts.push(`[pre]split[pre1][pre2]`)
      parts.push(
        `[pre2]geq=lum='255':a='if(gt(pow(max(0,abs(X-${padding}-${innerW}/2)-${innerW}/2+${r}),2)+pow(max(0,abs(Y-${padding}-${innerH}/2)-${innerH}/2+${r}),2),${r * r}),0,255)'[alpha]`
      )
      parts.push(`[pre1][alpha]alphamerge${needsCompositedLabel ? '[composited0]' : '[out]'}`)
    } else {
      parts.push(`[bg][scaled]overlay=${padding}:${padding}${needsCompositedLabel ? '[composited0]' : '[out]'}`)
    }

    // ── Webcam overlay: static PIP by default, or timed scene layouts (Sprint 11)
    if (hasWebcam) {
      const webcam = opts.webcam!

      // Shared preprocessing: mirror + optional face-tracking crop.
      let wc = webcamSrc
      const wcOps: string[] = []
      if (webcam.mirror) wcOps.push('hflip')
      if (webcam.faceTracking && faceCrop.length > 0) {
        // Crop a 70% window that follows the face center (piecewise-linear path,
        // capped to 40 samples renderer-side). Falls back to center via clamps.
        const cxExpr = buildLerpExpr(faceCrop.map((p) => ({ t: p.t, v: p.cx })), '0.5')
        const cyExpr = buildLerpExpr(faceCrop.map((p) => ({ t: p.t, v: p.cy })), '0.5')
        wcOps.push(`crop=w=iw*0.7:h=ih*0.7:x='max(0,min(iw-iw*0.7,(${cxExpr})*iw-iw*0.35))':y='max(0,min(ih-ih*0.7,(${cyExpr})*ih-ih*0.35))'`)
      }
      if (wcOps.length > 0) {
        parts.push(`${wc}${wcOps.join(',')}[wcpre]`)
        wc = '[wcpre]'
      }

      // Sprint 19 US-157 — blurs just the face-centered window (same 70%
      // crop geometry faceTracking uses to follow the face), overlaid back
      // onto the webcam frame. Anonymizes the face without hiding the whole
      // PIP the way blurring the entire webcam feed would.
      if (webcam.faceBlur && faceCrop.length > 0) {
        const cxExpr = buildLerpExpr(faceCrop.map((p) => ({ t: p.t, v: p.cx })), '0.5')
        const cyExpr = buildLerpExpr(faceCrop.map((p) => ({ t: p.t, v: p.cy })), '0.5')
        parts.push(`${wc}split=2[wcbase][wccrop]`)
        parts.push(
          `[wccrop]crop=w=iw*0.7:h=ih*0.7:` +
          `x='max(0,min(iw-iw*0.7,(${cxExpr})*iw-iw*0.35))':y='max(0,min(ih-ih*0.7,(${cyExpr})*ih-ih*0.35))',` +
          `boxblur=luma_radius=16:luma_power=1[wcblurred]`
        )
        parts.push(
          `[wcbase][wcblurred]overlay=` +
          `x='max(0,min(W-W*0.7,(${cxExpr})*W-W*0.35))':y='max(0,min(H-H*0.7,(${cyExpr})*H-H*0.35))'[wcfaceblur]`
        )
        wc = '[wcfaceblur]'
      }

      const sceneVariants: WebcamVariant[] = []
      const activeScenes = scenes.filter((s) => s.layout !== 'title-card')

      if (activeScenes.length === 0) {
        const geo = sceneVariantGeometry('pip', webcam, W, H, padding, innerW, innerH, cornerRadius)!
        sceneVariants.push({ ...geo, enable: null })
      } else {
        // Default PIP fills the gaps between scenes.
        const windows = activeScenes.map((s) => `between(t,${s.startTime.toFixed(3)},${s.endTime.toFixed(3)})`)
        const gapEnable = `not(${windows.join('+')})`
        const pipGeo = sceneVariantGeometry('pip', webcam, W, H, padding, innerW, innerH, cornerRadius)!
        sceneVariants.push({ ...pipGeo, enable: gapEnable })
        for (const s of activeScenes) {
          const geo = sceneVariantGeometry(s.layout, webcam, W, H, padding, innerW, innerH, cornerRadius)
          if (geo) sceneVariants.push({ ...geo, enable: `between(t,${s.startTime.toFixed(3)},${s.endTime.toFixed(3)})` })
        }
      }

      // Split the webcam stream once per variant, then scale+mask+overlay each.
      if (sceneVariants.length > 1) {
        parts.push(`${wc}split=${sceneVariants.length}${sceneVariants.map((_, i) => `[wcv${i}]`).join('')}`)
      } else {
        parts.push(`${wc}null[wcv0]`)
      }

      let compIn = 'composited0'
      sceneVariants.forEach((v, i) => {
        const ring = (opts.webcam!.ringWidth ?? 0) > 0 && v.enable === null
        // scale-to-cover then crop so faces aren't stretched on large layouts
        parts.push(`[wcv${i}]scale=${v.w}:${v.h}:force_original_aspect_ratio=increase,crop=${v.w}:${v.h},setsar=1,format=yuva420p,${maskChain(v)}[wcm${i}]`)

        if (ring) {
          // Colored backplate slightly larger than the webcam = ring effect.
          const rw = opts.webcam!.ringWidth!
          const rc = (opts.webcam!.ringColor ?? '#ffffff').replace('#', '')
          const bw = v.w + rw * 2
          const bh = v.h + rw * 2
          const plate: Omit<WebcamVariant, 'enable'> = { ...v, w: bw, h: bh }
          parts.push(`color=c=0x${rc}:size=${bw}x${bh}:rate=${opts.fps}:d=${bgDuration},format=yuva420p,${maskChain(plate)}[ring${i}]`)
          parts.push(`[${compIn}][ring${i}]overlay=${v.x - rw}:${v.y - rw}[compr${i}]`)
          compIn = `compr${i}`
        }

        const enablePart = v.enable ? `:enable='${v.enable}'` : ''
        const outLabel = i === sceneVariants.length - 1
          ? (hasDeviceFrame ? 'composited1' : 'out')
          : `compw${i}`
        parts.push(`[${compIn}][wcm${i}]overlay=${v.x}:${v.y}${enablePart}[${outLabel}]`)
        compIn = outLabel
      })
    } else if (hasDeviceFrame) {
      parts.push(`[composited0]null[composited1]`)
    }

    if (hasDeviceFrame) {
      parts.push(buildDeviceFrameFilter(opts.deviceFrame!, padding, innerW, innerH))
    }

    // ── Text overlays appended after the base graph: title cards, annotations,
    // keystroke badges (Sprint 9/11). Each stage renames the terminal label.
    let finalLabel = 'out'
    let textIdx = 0
    const nextLabel = () => `txt${textIdx++}`

    const titleCards = scenes.filter((s) => s.layout === 'title-card' && s.text)
    for (const tc of titleCards) {
      const en = `between(t,${tc.startTime.toFixed(3)},${tc.endTime.toFixed(3)})`
      const bgColor = background.type === 'solid' ? `0x${background.color.replace('#', '')}` : '0x1a1a2e'
      const lbl = nextLabel()
      parts.push(
        `[${finalLabel}]drawbox=x=0:y=0:w=iw:h=ih:color=${bgColor}:t=fill:enable='${en}',` +
        `drawtext=fontfile=${FONT}:text='${escDrawtext(tc.text!)}':fontsize=${Math.round(H * 0.07)}:fontcolor=white:` +
        `x=(w-text_w)/2:y=(h-text_h)/2:enable='${en}'[${lbl}]`
      )
      finalLabel = lbl
    }

    for (const a of annotations) {
      const en = `between(t,${a.startTime.toFixed(3)},${a.endTime.toFixed(3)})`
      const color = (a.color || '#ffffff').replace('#', '0x')
      const fontsize = a.style === 'heading' ? Math.round(H * 0.05) : Math.round(H * 0.032)
      const boxPart = a.style === 'pill' ? `:box=1:boxcolor=black@0.55:boxborderw=${Math.round(H * 0.012)}` : ''
      const shadowPart = a.style !== 'pill' ? ':shadowcolor=black@0.6:shadowx=2:shadowy=2' : ''
      const lbl = nextLabel()
      parts.push(
        `[${finalLabel}]drawtext=fontfile=${FONT}:text='${escDrawtext(a.text)}':fontsize=${fontsize}:fontcolor=${color}` +
        `${boxPart}${shadowPart}:x=${a.x.toFixed(4)}*w-text_w/2:y=${a.y.toFixed(4)}*h-text_h/2:enable='${en}'[${lbl}]`
      )
      finalLabel = lbl
    }

    // ── Blur regions (Sprint 19 US-155): crop the region from the current
    // composited frame, blur it, and overlay it back at the same spot only
    // while the region is active. Runs before keystroke badges so redaction
    // sits under any text overlays, not blurring the text itself.
    for (const b of blurRegions) {
      const en = `between(t,${b.startTime.toFixed(3)},${b.endTime.toFixed(3)})`
      const splitLbl = nextLabel()
      const cropLbl = nextLabel()
      const mergedLbl = nextLabel()
      parts.push(`[${finalLabel}]split=2[${splitLbl}base][${splitLbl}crop]`)
      parts.push(
        `[${splitLbl}crop]crop=${b.width.toFixed(4)}*iw:${b.height.toFixed(4)}*ih:${b.x.toFixed(4)}*iw:${b.y.toFixed(4)}*ih,` +
        `boxblur=luma_radius=${Math.round(b.intensity)}:luma_power=1[${cropLbl}]`
      )
      parts.push(
        `[${splitLbl}base][${cropLbl}]overlay=x=${b.x.toFixed(4)}*W:y=${b.y.toFixed(4)}*H:enable='${en}'[${mergedLbl}]`
      )
      finalLabel = mergedLbl
    }

    // Keystroke badges: bottom-center, 1.4s each with fade in/out.
    for (const k of keystrokes.slice(0, 30)) {
      const t0 = k.t
      const en = `between(t,${t0.toFixed(3)},${(t0 + 1.4).toFixed(3)})`
      const alpha = `if(lt(t-${t0.toFixed(3)},0.15),(t-${t0.toFixed(3)})/0.15,if(gt(t-${t0.toFixed(3)},1.1),max(0,1-(t-${t0.toFixed(3)}-1.1)/0.3),1))`
      const lbl = nextLabel()
      parts.push(
        `[${finalLabel}]drawtext=fontfile=${FONT}:text='${escDrawtext(k.display)}':fontsize=${Math.round(H * 0.038)}:` +
        `fontcolor=white:alpha='${alpha}':box=1:boxcolor=black@0.6:boxborderw=${Math.round(H * 0.012)}:` +
        `x=(w-text_w)/2:y=h-h*0.12:enable='${en}'[${lbl}]`
      )
      finalLabel = lbl
    }

    // ── Audio
    const micVol = opts.micVolume ?? 1
    const sysVol = opts.systemVolume ?? 1
    const denoise = opts.denoiseMic ? 'afftdn=nf=-25,' : ''
    const AFMT = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'

    const micPath = opts.micAudioPath
    const hasMic = !!(micPath && existsSync(micPath))
    const hasSystemAudio = !!opts.hasSystemAudio

    // Ducking needs separate sidecar tracks and a plain (single-segment, 1×)
    // timeline; anything else falls back to the normal mixed path.
    const canDuck = !!(
      opts.duckSystem && !isMultiSegment && singleSpeed === 1 &&
      opts.systemAudioPath && existsSync(opts.systemAudioPath) &&
      micPath && existsSync(micPath!)
    )

    let audLabel: string | null = null

    if (canDuck) {
      const sysIdx = nextInputIdx++
      if (segments[0].start > 0) args.push('-ss', segments[0].start.toFixed(3))
      args.push('-i', opts.systemAudioPath!)
      const micIdx = nextInputIdx++
      if (segments[0].start > 0) args.push('-ss', segments[0].start.toFixed(3))
      args.push('-i', micPath!)

      parts.push(`[${sysIdx}:a]volume=${sysVol.toFixed(2)},${AFMT},atrim=0:${trimmedDuration.toFixed(3)}[sysf]`)
      parts.push(`[${micIdx}:a]${denoise}volume=${micVol.toFixed(2)},${AFMT},atrim=0:${trimmedDuration.toFixed(3)}[micf]`)
      parts.push(`[micf]asplit=2[mca][mcb]`)
      parts.push(`[sysf][mca]sidechaincompress=threshold=0.02:ratio=8:attack=50:release=400[sysd]`)
      parts.push(`[sysd][mcb]amix=inputs=2:duration=first:normalize=0[auda]`)
      audLabel = 'auda'
    } else {
      const sourceAudioLabel = isMultiSegment
        ? (splicedAudioLabel ? `[${splicedAudioLabel}]` : null)
        : '[0:a]'

      if (hasMic) {
        const micIdx = nextInputIdx++
        args.push('-i', micPath!)
        parts.push(`[${micIdx}:a]${denoise}volume=${micVol.toFixed(2)},${AFMT}[mic]`)
        if (hasSystemAudio && sourceAudioLabel) {
          parts.push(`${sourceAudioLabel}volume=${sysVol.toFixed(2)},${AFMT}[sys]`)
          parts.push(`[sys][mic]amix=inputs=2:duration=longest:normalize=0[auda]`)
        } else {
          parts.push(`[mic]anull[auda]`)
        }
        audLabel = 'auda'
      } else if (hasSystemAudio && sourceAudioLabel) {
        // The muxed track carries mic+system pre-mixed — treat systemVolume as
        // master volume here; denoise applies if requested.
        parts.push(`${sourceAudioLabel}${denoise}volume=${sysVol.toFixed(2)},${AFMT}[auda]`)
        audLabel = 'auda'
      }
    }

    // Click sounds (Sprint 10): one lavfi sine burst, delayed per click, mixed in.
    if (opts.clickSounds && clickTimes.length > 0) {
      const capped = clickTimes.filter((t) => t >= 0 && t < trimmedDuration).slice(0, 40)
      if (capped.length > 0) {
        const clkIdx = nextInputIdx++
        args.push('-f', 'lavfi', '-t', '0.06', '-i', 'sine=frequency=1400:sample_rate=48000')
        parts.push(`[${clkIdx}:a]volume=0.35,${AFMT}[clk]`)
        if (capped.length > 1) {
          parts.push(`[clk]asplit=${capped.length}${capped.map((_, i) => `[ck${i}]`).join('')}`)
        } else {
          parts.push(`[clk]anull[ck0]`)
        }
        const delayed: string[] = []
        capped.forEach((t, i) => {
          const ms = Math.max(0, Math.round(t * 1000))
          parts.push(`[ck${i}]adelay=${ms}|${ms}[ckd${i}]`)
          delayed.push(`[ckd${i}]`)
        })
        parts.push(`${delayed.join('')}amix=inputs=${capped.length}:duration=longest:normalize=0,atrim=0:${trimmedDuration.toFixed(3)}[clicks]`)
        if (audLabel) {
          parts.push(`[${audLabel}][clicks]amix=inputs=2:duration=first:normalize=0[audf]`)
          audLabel = 'audf'
        } else {
          parts.push(`[clicks]anull[audf]`)
          audLabel = 'audf'
        }
      }
    }

    args.push('-filter_complex', parts.join(';'))
    args.push('-map', `[${finalLabel}]`)
    if (audLabel) args.push('-map', `[${audLabel}]`)

    const codec = opts.codec ?? 'h264'
    const quality = opts.quality ?? 'balanced'
    const audioBitrate = opts.audioBitrate ?? 192
    const preserveHdr = !!opts.preserveHdr

    args.push(
      ...buildVideoCodecArgs(codec, quality, W, H, preserveHdr),
      '-pix_fmt', preserveHdr ? 'p010le' : 'yuv420p',
      '-c:a', 'aac',
      '-b:a', `${audioBitrate}k`,
      '-movflags', '+faststart',
      // Hard-cap the output at the conceptual duration — the bg color source has
      // a +1s safety margin and is the overlay's primary input, so without this
      // every export would trail off with 1s of frozen last frame.
      '-t', trimmedDuration.toFixed(3)
    )

    args.push(opts.outputPath)

    if (process.env.DEBUG_FFMPEG_ARGS) console.error('FFMPEG ARGS:', JSON.stringify(args))
    await ffmpeg.run(args, trimmedDuration, (p) => onProgress(p.percent, p.eta))

    // Sprint 15 US-125 — chapter markers, muxed as a second pass (stream copy,
    // near-instant) so the main filter_complex above stays untouched. Chapters
    // are re-mapped through the same segment-offset logic as every other timed
    // event, so they land at the right point after ripple-delete/speed changes.
    if (opts.chapters && opts.chapters.length > 0) {
      const remappedChapters = remapPointEvents(opts.chapters, segments)
      await muxChapters(opts.outputPath, remappedChapters, trimmedDuration)
    }

    return { ok: true, outputPath: opts.outputPath }
  } catch (err) {
    return { ok: false, error: String(err) }
  } finally {
    if (cursorAssPath) {
      try { unlinkSync(cursorAssPath) } catch { /* temp file — best effort */ }
    }
  }
}

/**
 * Muxes chapter markers into an already-exported MP4 via a stream-copy pass
 * (ffmpeg's ffmetadata chapter format) — no re-encode, just container metadata.
 * Runs after the main export so a failure here never costs the video itself.
 */
async function muxChapters(
  outputPath: string,
  chapters: { t: number; title: string }[],
  totalDuration: number
): Promise<void> {
  const sorted = [...chapters].sort((a, b) => a.t - b.t)
  const metaPath = join(tmpdir(), `chapters-${Date.now()}.txt`)
  const tmpOut = outputPath.replace(/\.mp4$/, '.chapters-tmp.mp4')

  const lines = [';FFMETADATA1']
  sorted.forEach((c, i) => {
    const startMs = Math.round(c.t * 1000)
    const endMs = Math.round((i + 1 < sorted.length ? sorted[i + 1].t : totalDuration) * 1000)
    lines.push('[CHAPTER]', 'TIMEBASE=1/1000', `START=${startMs}`, `END=${endMs}`, `title=${c.title.replace(/[\r\n]/g, ' ')}`)
  })
  writeFileSync(metaPath, lines.join('\n') + '\n', 'utf-8')

  try {
    await ffmpeg.run([
      '-i', outputPath,
      '-i', metaPath,
      '-map_metadata', '1',
      '-c', 'copy',
      tmpOut
    ], 0, () => {})
    // Sprint 29 (round 2) — this used to unlinkSync(outputPath) BEFORE
    // renameSync(tmpOut, outputPath). If the process died or renameSync
    // itself threw (disk full, tmpOut on a different mount, EXDEV) in the
    // gap between those two calls, the completed export — already
    // successfully produced by the main filter_complex pass above — was
    // permanently gone, despite the whole export having actually succeeded.
    // renameSync alone is atomic on POSIX and silently overwrites an
    // existing destination file, so the separate unlink was both redundant
    // and the source of the data-loss window.
    renameSync(tmpOut, outputPath)
  } finally {
    try { unlinkSync(metaPath) } catch { /* temp file — best effort */ }
  }
}

export async function exportGif(
  opts: ExportOptions,
  onProgress: (pct: number, eta?: number) => void
): Promise<{ ok: true; outputPath: string } | { ok: false; error: string }> {
  try {
    mkdirSync(dirname(opts.outputPath), { recursive: true })

    const videoPath = opts.projectPath.endsWith('capture.mov')
      ? opts.projectPath
      : opts.projectPath.replace(/\/?$/, '/capture.mov')

    const inPoint = opts.inPoint ?? 0
    const outPoint = opts.outPoint && opts.outPoint > inPoint ? opts.outPoint : 0
    const gifFps = Math.min(opts.fps, 15)
    const scale = `${opts.resolution.width}:-1`
    const palettePath = opts.outputPath.replace('.gif', '-palette.png')

    const inputArgs: string[] = []
    if (inPoint > 0) inputArgs.push('-ss', inPoint.toFixed(3))
    inputArgs.push('-i', videoPath)
    if (outPoint > 0) inputArgs.push('-t', (outPoint - inPoint).toFixed(3))

    await ffmpeg.run([
      '-y', ...inputArgs,
      '-vf', `fps=${gifFps},scale=${scale}:flags=lanczos,palettegen=stats_mode=diff`,
      palettePath
    ], 10, () => {})

    await ffmpeg.run([
      '-y', ...inputArgs, '-i', palettePath,
      '-lavfi', `fps=${gifFps},scale=${scale}:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer`,
      opts.outputPath
    ], 30, (p) => onProgress(p.percent))

    return { ok: true, outputPath: opts.outputPath }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
