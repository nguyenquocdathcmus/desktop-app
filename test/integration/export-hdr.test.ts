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
 * Sprint 25 US-191 — verifies HDR-preserving export end to end against a real
 * 10-bit HDR source (generated directly via ffmpeg here rather than depending
 * on the `capture` binary, so this test runs in any environment with the
 * bundled ffmpeg, not just one with real HDR display hardware — capture-side
 * HDR was separately verified manually against a real Liquid Retina XDR
 * display, see test/RESULTS/sprint-25-hdr-fps-verification.md).
 *
 * Also exercises a blur region (Sprint 19 boxblur/crop/overlay filter chain)
 * on the HDR path specifically, since Sprint 25's own risk assessment flagged
 * "some ffmpeg filters assume 8-bit" as the thing most likely to silently
 * break — this proves boxblur still runs to completion on a p010le pipeline
 * rather than assuming it from filter documentation.
 */

let workDir: string
let hdrSourceVideo: string

function ffprobeInfo(path: string): string {
  const result = spawnSync(binPath('ffmpeg'), ['-i', path, '-f', 'null', '-'], { encoding: 'utf-8' })
  return result.stderr
}

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'screen-studio-hdr-export-test-'))
  hdrSourceVideo = join(workDir, 'capture.mov')

  // Real 10-bit HEVC Main10 source with BT.2020/PQ tags — same shape as what
  // capture --hdr actually produces (verified separately against real hardware).
  await new Promise<void>((resolvePromise, reject) => {
    const proc = spawn(binPath('ffmpeg'), [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=6:size=640x480:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
      '-c:v', 'libx265', '-pix_fmt', 'yuv420p10le',
      '-color_primaries', 'bt2020', '-color_trc', 'smpte2084', '-colorspace', 'bt2020nc',
      '-tag:v', 'hvc1',
      '-c:a', 'aac',
      hdrSourceVideo
    ])
    proc.on('close', (code) => code === 0 ? resolvePromise() : reject(new Error(`HDR fixture generation failed: ${code}`)))
    proc.on('error', reject)
  })
}, 30_000)

afterAll(() => {
  if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true, force: true })
})

function baseOptions(outputPath: string): ExportOptions {
  return {
    projectPath: hdrSourceVideo,
    outputPath,
    format: 'mp4',
    resolution: { width: 640, height: 480, label: 'test' },
    fps: 30,
    background: { type: 'solid', color: '#1a1a2e' },
    padding: 0,
    cornerRadius: 0,
    sourceWidth: 640,
    sourceHeight: 480
  }
}

describe('exportVideo — HDR-preserving export (Sprint 25 US-191)', () => {
  it('produces a real 10-bit HEVC Main10 output with BT.2020/PQ tags when preserveHdr is set', async () => {
    const outputPath = join(workDir, 'hdr-out.mp4')
    const opts: ExportOptions = { ...baseOptions(outputPath), preserveHdr: true }

    const result = await exportVideo(opts, () => {})
    if (!result.ok) console.error('EXPORT ERROR:', result.error)
    expect(result.ok).toBe(true)
    expect(existsSync(outputPath)).toBe(true)

    // Sprint 25 US-191 — verified against the real bundled ffmpeg binary that
    // only libx265's -x265-params colorprim/transfer/colormatrix (baked into
    // the HEVC bitstream's VUI) round-trips through ffprobe; the generic
    // -color_primaries/-color_trc/-colorspace *output* flags do not, on this
    // ffmpeg build, for either hevc_videotoolbox or libx265 (confirmed by
    // testing both directly — see test/RESULTS/sprint-25-hdr-fps-verification.md).
    const info = ffprobeInfo(outputPath)
    expect(info).toMatch(/Main 10/)
    expect(info).toMatch(/yuv420p10le|p010le/)
    expect(info).toContain('bt2020nc/bt2020/smpte2084')
  }, 30_000)

  it('still produces standard 8-bit output when preserveHdr is not set, even from an HDR source', async () => {
    const outputPath = join(workDir, 'sdr-out.mp4')
    const opts: ExportOptions = baseOptions(outputPath) // preserveHdr omitted — must default off

    const result = await exportVideo(opts, () => {})
    expect(result.ok).toBe(true)
    const info = ffprobeInfo(outputPath)
    expect(info).toContain('yuv420p')
    expect(info).not.toContain('yuv420p10le')
  }, 30_000)

  it('applies a blur region correctly on the HDR (10-bit) export path without the filter graph erroring', async () => {
    const outputPath = join(workDir, 'hdr-blur-out.mp4')
    const opts: ExportOptions = {
      ...baseOptions(outputPath),
      preserveHdr: true,
      blurRegions: [{ startTime: 1, endTime: 3, x: 0.3, y: 0.3, width: 0.3, height: 0.3, intensity: 20 }]
    }

    const result = await exportVideo(opts, () => {})
    expect(result.ok).toBe(true)
    expect(existsSync(outputPath)).toBe(true)
    const info = ffprobeInfo(outputPath)
    expect(info).toMatch(/Main 10|yuv420p10le|p010le/)
  }, 30_000)

  // Sprint 25 US-193 — the zoompan filter (Exporter.ts's zoom implementation;
  // there is no separate Metal "zoom-renderer" binary in this codebase despite
  // PLAN.md's original description — zoom is applied entirely via ffmpeg's
  // zoompan filter) is fps-agnostic (drives off event timestamps, not frame
  // counts) so no explicit 8-bit assumption to audit there; this test proves
  // it also doesn't error on the 10-bit filter graph specifically.
  it('applies a zoom event correctly on the HDR (10-bit) export path', async () => {
    const outputPath = join(workDir, 'hdr-zoom-out.mp4')
    const opts: ExportOptions = {
      ...baseOptions(outputPath),
      preserveHdr: true,
      zoomEvents: [{ startTime: 1, endTime: 3, zoomLevel: 2, centerX: 0.5, centerY: 0.5, easing: 'ease-in-out' }] as any
    }

    const result = await exportVideo(opts, () => {})
    if (!result.ok) console.error('ZOOM EXPORT ERROR:', result.error)
    expect(result.ok).toBe(true)
    expect(existsSync(outputPath)).toBe(true)
    const info = ffprobeInfo(outputPath)
    expect(info).toMatch(/Main 10|yuv420p10le|p010le/)
  }, 30_000)
})
