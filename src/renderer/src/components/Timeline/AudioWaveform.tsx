import { useEffect, useRef, useState } from 'react'

interface Props {
  videoPath: string
  /** Detected silence regions (Sprint 9) — rendered as red-tinted spans so the
   *  user sees what auto-cut will remove before applying it. */
  silenceRegions?: { start: number; end: number; selected: boolean }[]
  duration?: number
}

export function AudioWaveform({ videoPath, silenceRegions = [], duration = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!videoPath) return
    const canvas = canvasRef.current
    if (!canvas) return

    setLoading(true)

    // Decode audio from video via Web Audio API
    const audioCtx = new AudioContext()
    fetch(`file://${videoPath}`)
      .then((r) => r.arrayBuffer())
      .then((buf) => audioCtx.decodeAudioData(buf))
      .then((decoded) => {
        const data = decoded.getChannelData(0)
        drawWaveform(canvas, data)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        // Silent fail — waveform is non-critical
      })
      .finally(() => audioCtx.close())
  }, [videoPath])

  return (
    <div className="relative h-10 bg-[var(--bg-secondary)] rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
      {duration > 0 && silenceRegions.map((r, i) => (
        <div
          key={`${r.start}-${i}`}
          className={`absolute top-0 h-full pointer-events-none ${r.selected ? 'bg-red-500/25' : 'bg-red-500/10'}`}
          style={{
            left: `${(r.start / duration) * 100}%`,
            width: `${((r.end - r.start) / duration) * 100}%`
          }}
        />
      ))}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] text-[var(--text-secondary)]">Loading waveform…</span>
        </div>
      )}
    </div>
  )
}

function drawWaveform(canvas: HTMLCanvasElement, data: Float32Array) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = canvas.offsetWidth || 800
  const H = canvas.offsetHeight || 40
  canvas.width = W
  canvas.height = H

  ctx.clearRect(0, 0, W, H)

  const samplesPerPixel = Math.floor(data.length / W)
  const midY = H / 2

  ctx.fillStyle = '#4f46e5'

  for (let x = 0; x < W; x++) {
    let max = 0
    const start = x * samplesPerPixel
    const end = start + samplesPerPixel
    for (let i = start; i < end && i < data.length; i++) {
      max = Math.max(max, Math.abs(data[i]))
    }
    const height = Math.max(1, max * midY)
    ctx.fillRect(x, midY - height, 1, height * 2)
  }
}
