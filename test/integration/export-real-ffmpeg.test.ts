import './electron-stub'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, spawnSync } from 'child_process'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { exportVideo } from '../../src/main/export/Exporter'
import { binPath } from '../../src/main/binPath'
import type { ExportOptions } from '../../src/shared/ipc-types'

/**
 * Sprint 14 US-118 — automates the exact manual ffmpeg debugging cycle used
 * during Sprint 8/9 development to find two real bugs:
 *   1. A `color=` background is an infinite-duration source; with multi-segment
 *      export (no `-ss`/`-to` on the main input), the export never terminated.
 *   2. The `-t` output cap was missing, so every export trailed ~1s of frozen
 *      last frame.
 * These tests call `exportVideo()` directly (no Electron/IPC) against the
 * bundled ffmpeg binary and assert on the real output file — this is a
 * regression net for both, not just a syntax check.
 */

let workDir: string
let sourceVideo: string
let webcamVideo: string

function ffprobeDuration(path: string): number {
  const result = spawnSync(binPath('ffmpeg'), ['-i', path, '-f', 'null', '-'], { encoding: 'utf-8' })
  const match = result.stderr.match(/Duration:\s+(\d+):(\d+):(\d+\.\d+)/)
  if (!match) throw new Error(`Could not parse duration from ffprobe output:\n${result.stderr}`)
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3])
}

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'screen-studio-export-test-'))
  sourceVideo = join(workDir, 'capture.mov')

  // 10s synthetic 640x480 video + sine audio — mirrors the fixture used during
  // manual Sprint 8/9 debugging.
  await new Promise<void>((resolvePromise, reject) => {
    const proc = spawn(binPath('ffmpeg'), [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=10:size=640x480:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10',
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-c:a', 'aac', '-pix_fmt', 'yuv420p',
      sourceVideo
    ])
    proc.on('close', (code) => code === 0 ? resolvePromise() : reject(new Error(`fixture generation failed: ${code}`)))
    proc.on('error', reject)
  })

  webcamVideo = join(workDir, 'webcam.webm')
  await new Promise<void>((resolvePromise, reject) => {
    const proc = spawn(binPath('ffmpeg'), [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=4:size=320x240:rate=30',
      '-c:v', 'libvpx', '-b:v', '500k',
      webcamVideo
    ])
    proc.on('close', (code) => code === 0 ? resolvePromise() : reject(new Error(`webcam fixture generation failed: ${code}`)))
    proc.on('error', reject)
  })
}, 30_000)

afterAll(() => {
  if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true, force: true })
})

function baseOptions(outputPath: string): ExportOptions {
  return {
    projectPath: sourceVideo,
    outputPath,
    format: 'mp4',
    resolution: { width: 640, height: 480, label: 'test' },
    fps: 30,
    background: { type: 'solid', color: '#1a1a2e' },
    padding: 20,
    cornerRadius: 8,
    sourceWidth: 640,
    sourceHeight: 480
  }
}

describe('exportVideo — real ffmpeg, single segment', () => {
  it('produces a valid, correctly-trimmed output file', async () => {
    const outputPath = join(workDir, 'single.mp4')
    const opts = { ...baseOptions(outputPath), inPoint: 2, outPoint: 6 }

    const result = await exportVideo(opts, () => {})
    expect(result.ok).toBe(true)
    expect(existsSync(outputPath)).toBe(true)

    const duration = ffprobeDuration(outputPath)
    expect(duration).toBeCloseTo(4, 0) // 6 - 2 = 4s, within 0.5s tolerance
  }, 30_000)
})

describe('exportVideo — real ffmpeg, multi-segment (regression: infinite color= source)', () => {
  it('terminates and produces exactly the expected duration, not a frozen/hung output', async () => {
    const outputPath = join(workDir, 'multi.mp4')
    // 3 kept segments of 2s each, mirroring the exact scenario that hung
    // during Sprint 8 development before the `color=...:d=` fix.
    const opts: ExportOptions = {
      ...baseOptions(outputPath),
      segments: [{ start: 0, end: 2 }, { start: 4, end: 6 }, { start: 8, end: 10 }]
    }

    const result = await exportVideo(opts, () => {})
    expect(result.ok).toBe(true)
    expect(existsSync(outputPath)).toBe(true)

    // Regression check for the missing `-t` cap: previously trailed ~1s of
    // frozen last frame (7s instead of 6s) because the bg safety buffer leaked
    // into the final output duration.
    const duration = ffprobeDuration(outputPath)
    expect(duration).toBeCloseTo(6, 0) // 3 segments × 2s = 6s, within 0.5s tolerance
  }, 30_000)

  it('applies per-segment speed (setpts/atempo) without breaking termination', async () => {
    const outputPath = join(workDir, 'multi-speed.mp4')
    const opts: ExportOptions = {
      ...baseOptions(outputPath),
      segments: [{ start: 0, end: 2 }, { start: 4, end: 8, speed: 2 }] // 2s + (4s/2)=2s = 4s
    }

    const result = await exportVideo(opts, () => {})
    expect(result.ok).toBe(true)

    const duration = ffprobeDuration(outputPath)
    expect(duration).toBeCloseTo(4, 0)
  }, 30_000)
})

describe('exportVideo — blur regions (Sprint 19 US-155)', () => {
  it('produces a valid output with a blur region active for its whole active window', async () => {
    const outputPath = join(workDir, 'blur.mp4')
    const opts: ExportOptions = {
      ...baseOptions(outputPath),
      inPoint: 0,
      outPoint: 4,
      blurRegions: [{ startTime: 1, endTime: 3, x: 0.1, y: 0.1, width: 0.3, height: 0.3, intensity: 20 }]
    }

    const result = await exportVideo(opts, () => {})
    expect(result.ok).toBe(true)
    expect(existsSync(outputPath)).toBe(true)

    const duration = ffprobeDuration(outputPath)
    expect(duration).toBeCloseTo(4, 0)
  }, 30_000)

  it('does not break termination with 2 overlapping-in-time, different-position regions', async () => {
    const outputPath = join(workDir, 'blur-multi.mp4')
    const opts: ExportOptions = {
      ...baseOptions(outputPath),
      inPoint: 0,
      outPoint: 4,
      blurRegions: [
        { startTime: 0.5, endTime: 3, x: 0.05, y: 0.05, width: 0.2, height: 0.2, intensity: 12 },
        { startTime: 1, endTime: 3.5, x: 0.6, y: 0.6, width: 0.25, height: 0.25, intensity: 25 }
      ]
    }

    const result = await exportVideo(opts, () => {})
    expect(result.ok).toBe(true)
    const duration = ffprobeDuration(outputPath)
    expect(duration).toBeCloseTo(4, 0)
  }, 30_000)
})

describe('exportVideo — webcam face blur (Sprint 19 US-157)', () => {
  it('produces a valid output with faceBlur enabled and no face samples (falls back gracefully)', async () => {
    const outputPath = join(workDir, 'faceblur-nosamples.mp4')
    const opts: ExportOptions = {
      ...baseOptions(outputPath),
      inPoint: 0,
      outPoint: 3,
      webcamPath: webcamVideo,
      webcam: {
        deviceId: 'test', position: 'bottom-right', width: 200, height: 150,
        shape: 'rounded-rect', faceTracking: false, faceBlur: true
      }
    }

    const result = await exportVideo(opts, () => {})
    expect(result.ok).toBe(true)
    expect(existsSync(outputPath)).toBe(true)
    const duration = ffprobeDuration(outputPath)
    expect(duration).toBeCloseTo(3, 0)
  }, 30_000)

  it('produces a valid output with faceBlur enabled and real face-crop samples', async () => {
    const outputPath = join(workDir, 'faceblur.mp4')
    const opts: ExportOptions = {
      ...baseOptions(outputPath),
      inPoint: 0,
      outPoint: 3,
      webcamPath: webcamVideo,
      faceCropPath: [{ t: 0, cx: 0.5, cy: 0.4 }, { t: 3, cx: 0.5, cy: 0.4 }],
      webcam: {
        deviceId: 'test', position: 'bottom-right', width: 200, height: 150,
        shape: 'rounded-rect', faceTracking: false, faceBlur: true
      }
    }

    const result = await exportVideo(opts, () => {})
    expect(result.ok).toBe(true)
    const duration = ffprobeDuration(outputPath)
    expect(duration).toBeCloseTo(3, 0)
  }, 30_000)
})

describe('exportVideo — aspect ratio crop', () => {
  it('produces a 9:16 output with the requested vertical dimensions', async () => {
    const outputPath = join(workDir, 'vertical.mp4')
    const opts: ExportOptions = {
      ...baseOptions(outputPath),
      resolution: { width: 480, height: 480, label: 'test' }, // width ignored for non-16:9; height drives the canvas
      aspectRatio: '9:16',
      inPoint: 0,
      outPoint: 3
    }

    const result = await exportVideo(opts, () => {})
    expect(result.ok).toBe(true)

    const probe = spawnSync(binPath('ffmpeg'), ['-i', outputPath, '-f', 'null', '-'], { encoding: 'utf-8' })
    const dims = probe.stderr.match(/Video:.*?(\d{2,5})x(\d{2,5})/)
    expect(dims).not.toBeNull()
    const [, w, h] = dims!
    // 9:16 at height 480 => width = round(480*9/16) rounded to even = 270
    expect(Number(w)).toBeLessThan(Number(h))
  }, 30_000)
})

describe('exportVideo — zoom events (Sprint 25 US-193 regression)', () => {
  // Real bug found during Sprint 25's pipeline audit: buildZExpr/buildXExpr/
  // buildYExpr referenced `t` inside a zoompan z/x/y expression, but
  // zoompan's eval context exposes current time as `time`, not `t` (unlike
  // crop/drawtext/geq, which do use `t`). ffmpeg rejected the filter graph
  // outright ("Unknown function") — meaning zoom silently never applied for
  // ANY recording with zoomEvents, for as long as this export path has
  // existed. The unit tests never caught it because they only asserted the
  // (buggy) expression *string shape*, never ran it through real ffmpeg.
  it('actually applies without erroring when zoomEvents are present', async () => {
    const outputPath = join(workDir, 'zoom.mp4')
    const opts: ExportOptions = {
      ...baseOptions(outputPath),
      zoomEvents: [{ id: 'z1', startTime: 1, endTime: 3, zoomLevel: 2, centerX: 0.5, centerY: 0.5, easing: 'ease-in-out', isAuto: false }] as any,
      inPoint: 0,
      outPoint: 4
    }

    const result = await exportVideo(opts, () => {})
    if (!result.ok) console.error('ZOOM EXPORT ERROR:', result.error)
    expect(result.ok).toBe(true)
    expect(existsSync(outputPath)).toBe(true)

    const duration = ffprobeDuration(outputPath)
    expect(duration).toBeCloseTo(4, 0)
  }, 30_000)
})
