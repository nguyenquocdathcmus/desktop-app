import { writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export interface CursorSample {
  /** Source-video seconds */
  t: number
  /** Normalized 0-1 within the source frame */
  x: number
  y: number
}

function assTime(sec: number): string {
  const s = Math.max(0, sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = Math.floor(s % 60)
  const cs = Math.floor((s % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

/**
 * Generates an ASS subtitle file that draws a macOS-style arrow cursor moving
 * along the recorded cursor path. libass interpolates each consecutive sample
 * pair via \move, giving smooth motion without thousands of ffmpeg expression
 * branches. The overlay is applied to the SOURCE frames (before trim/speed/zoom),
 * so splicing, speed ramps, and zoompan all "just work" on the burned-in cursor.
 *
 * @param timeShift subtracted from every timestamp — pass inPoint when the
 *   export uses `-ss` input seeking (which rebases pts to 0 at the seek point).
 */
export function generateCursorAss(
  samples: CursorSample[],
  sourceW: number,
  sourceH: number,
  scale: number,
  timeShift: number = 0
): string | null {
  if (samples.length < 2 || sourceW <= 0 || sourceH <= 0) return null

  // Arrow glyph as an ASS vector path (viewbox ~21×35 units). \fscx/\fscy scale
  // it relative to source resolution so it matches the native cursor size at 1×.
  const ARROW = 'm 0 0 l 0 30 l 7 23 l 12 35 l 16 33 l 11 22 l 21 22'
  const baseScale = (sourceH / 900) * 100 * Math.max(0.5, Math.min(3, scale))
  const fsc = baseScale.toFixed(0)

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${Math.round(sourceW)}`,
    `PlayResY: ${Math.round(sourceH)}`,
    'WrapStyle: 2',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Cursor,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,1,7,0,0,0,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ].join('\n')

  const lines: string[] = []
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i]
    const b = samples[i + 1]
    const t0 = a.t - timeShift
    const t1 = b.t - timeShift
    if (t1 <= 0 || t1 <= t0) continue

    const x0 = (a.x * sourceW).toFixed(1)
    const y0 = (a.y * sourceH).toFixed(1)
    const x1 = (b.x * sourceW).toFixed(1)
    const y1 = (b.y * sourceH).toFixed(1)

    lines.push(
      `Dialogue: 0,${assTime(t0)},${assTime(t1)},Cursor,,0,0,0,,` +
      `{\\move(${x0},${y0},${x1},${y1})\\an7\\fscx${fsc}\\fscy${fsc}\\p1}${ARROW}{\\p0}`
    )
  }
  if (lines.length === 0) return null

  const filePath = join(tmpdir(), `cursor-${Date.now()}.ass`)
  writeFileSync(filePath, `${header}\n${lines.join('\n')}\n`, 'utf-8')
  return filePath
}
