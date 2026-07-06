import { spawn } from 'child_process'
import { binPath } from '../binPath'

/** A suggested blur region produced by the heuristic — same shape family as
 *  BlurRegion (Sprint 19), minus `id`/`intensity` which the caller fills in
 *  when the user accepts the suggestion. */
export interface NotificationCandidate {
  startTime: number
  endTime: number
  x: number
  y: number
  width: number
  height: number
  /** 0-1 heuristic confidence — currently derived from how cleanly the region
   *  matches all 3 signature traits (corner, persistence window, disappearance). */
  confidence: number
}

interface FrameSample {
  t: number
  /** Downsampled grayscale luma, row-major, `sampleW * sampleH` bytes. */
  luma: Buffer
}

const SAMPLE_W = 64
const SAMPLE_H = 36

/**
 * Sprint 19 US-154 / Sprint 22 US-174 — macOS notification banners have a
 * distinctive signature: they appear in the top-right corner, hold roughly
 * still for 3-5 seconds, then disappear — all without user-driven cursor
 * activity in that region. This is a plain frame-diff heuristic (no ML): we
 * sample luma at low resolution at a fixed interval, find regions confined to
 * the top-right quadrant whose pixel values change sharply once (appear),
 * stay stable, then change sharply again (disappear) within the expected
 * duration window.
 *
 * Sprint 19 shipped this as Blocked because there was no real notification
 * footage to measure false-positive rate against — an unverified heuristic
 * here is worse than no feature (false sense of "nothing was missed"). Sprint
 * 22 supplies both synthetic fixtures (scripts/generate-notification-fixtures.sh)
 * and real captured footage to actually measure precision/recall before this
 * is wired into the UI.
 */
export class NotificationDetector {
  private get ffmpegBin(): string {
    return binPath('ffmpeg')
  }

  /** Extract 1 grayscale frame/second at SAMPLE_W x SAMPLE_H via ffmpeg, decoded from its raw rawvideo stdout. */
  private async sampleFrames(videoPath: string): Promise<FrameSample[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y', '-i', videoPath,
        '-vf', `fps=1,scale=${SAMPLE_W}:${SAMPLE_H}:flags=area,format=gray`,
        '-f', 'rawvideo',
        '-'
      ]
      const proc = spawn(this.ffmpegBin, args)
      const chunks: Buffer[] = []
      let stderr = ''
      proc.stdout.on('data', (c: Buffer) => chunks.push(c))
      proc.stderr.on('data', (c: Buffer) => { stderr += c.toString() })
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`ffmpeg sampling failed: ${stderr.slice(-400)}`))
        const raw = Buffer.concat(chunks)
        const frameSize = SAMPLE_W * SAMPLE_H
        const frames: FrameSample[] = []
        for (let i = 0; i * frameSize < raw.length; i++) {
          frames.push({ t: i, luma: raw.subarray(i * frameSize, (i + 1) * frameSize) })
        }
        resolve(frames)
      })
    })
  }

  /** Per-cell (8x8 downsample grid) absolute luma delta between two frames, normalized 0-1. */
  private cellDiff(a: Buffer, b: Buffer): number[][] {
    const cols = 8
    const rows = 8
    const cellW = SAMPLE_W / cols
    const cellH = SAMPLE_H / rows
    const diff: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let sum = 0
        let count = 0
        const y0 = Math.floor(row * cellH)
        const y1 = Math.floor((row + 1) * cellH)
        const x0 = Math.floor(col * cellW)
        const x1 = Math.floor((col + 1) * cellW)
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const idx = y * SAMPLE_W + x
            sum += Math.abs(a[idx] - b[idx])
            count++
          }
        }
        diff[row][col] = count > 0 ? sum / count / 255 : 0
      }
    }
    return diff
  }

  /**
   * Analyze a video for notification-shaped transient regions. Returns
   * candidates the caller presents to the user for 1-click confirmation —
   * never auto-applied (Sprint 19 US-154 spec).
   */
  async detect(videoPath: string): Promise<NotificationCandidate[]> {
    const frames = await this.sampleFrames(videoPath)
    if (frames.length < 4) return []

    const CHANGE_THRESHOLD = 0.12 // normalized luma delta counted as "this cell changed"
    const MIN_DURATION_S = 2
    const MAX_DURATION_S = 7 // generous margin around the documented 3-5s

    // Top-right quadrant only, in the 8x8 cell grid (cols 5-7, rows 0-2).
    const CORNER_COLS = [5, 6, 7]
    const CORNER_ROWS = [0, 1, 2]

    const candidates: NotificationCandidate[] = []
    // For each corner cell, track a simple state machine: stable -> appeared -> stable -> disappeared.
    for (const row of CORNER_ROWS) {
      for (const col of CORNER_COLS) {
        let appearedAt: number | null = null
        let stableSinceAppear = 0
        for (let i = 1; i < frames.length; i++) {
          const diff = this.cellDiff(frames[i - 1].luma, frames[i].luma)
          const changed = diff[row][col] > CHANGE_THRESHOLD
          if (appearedAt === null) {
            if (changed) {
              appearedAt = frames[i].t
              stableSinceAppear = 0
            }
          } else {
            if (changed) {
              // Second sharp change: either the banner disappearing, or noise.
              const duration = frames[i].t - appearedAt
              if (duration >= MIN_DURATION_S && duration <= MAX_DURATION_S && stableSinceAppear >= 1) {
                candidates.push({
                  startTime: appearedAt,
                  endTime: frames[i].t,
                  x: col / 8,
                  y: row / 8,
                  width: 1 / 8,
                  height: 1 / 8,
                  confidence: Math.min(1, stableSinceAppear / duration)
                })
              }
              appearedAt = null
              stableSinceAppear = 0
            } else {
              stableSinceAppear++
            }
          }
        }
      }
    }

    return mergeAdjacentCandidates(candidates)
  }
}

/** Neighboring corner cells that fire in the same time window almost always
 *  belong to the same banner (a notification is bigger than 1 grid cell) —
 *  merge them into a single bounding box instead of surfacing N overlapping
 *  suggestions for what a human sees as one event. */
function mergeAdjacentCandidates(candidates: NotificationCandidate[]): NotificationCandidate[] {
  const sorted = [...candidates].sort((a, b) => a.startTime - b.startTime)
  const merged: NotificationCandidate[] = []
  for (const c of sorted) {
    const overlap = merged.find(
      (m) => Math.abs(m.startTime - c.startTime) <= 1 && Math.abs(m.endTime - c.endTime) <= 1
    )
    if (overlap) {
      const x0 = Math.min(overlap.x, c.x)
      const y0 = Math.min(overlap.y, c.y)
      const x1 = Math.max(overlap.x + overlap.width, c.x + c.width)
      const y1 = Math.max(overlap.y + overlap.height, c.y + c.height)
      overlap.x = x0
      overlap.y = y0
      overlap.width = x1 - x0
      overlap.height = y1 - y0
      overlap.confidence = Math.max(overlap.confidence, c.confidence)
    } else {
      merged.push({ ...c })
    }
  }
  return merged
}
