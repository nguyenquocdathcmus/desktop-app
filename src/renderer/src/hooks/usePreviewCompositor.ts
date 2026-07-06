import { useEffect, useRef, useCallback } from 'react'
import Konva from 'konva'
import type { BackgroundSource, ZoomEvent, CursorSettings } from '../../../shared/project-types'

export interface CompositorConfig {
  containerRef: React.RefObject<HTMLDivElement>
  videoEl: HTMLVideoElement | null
  background: BackgroundSource
  padding: number
  cornerRadius: number
  currentTime: number
  zoomEvents: ZoomEvent[]
  cursorSettings: CursorSettings
  canvasWidth: number
  canvasHeight: number
}

export interface CompositorHandle {
  stage: Konva.Stage | null
  getDataURL: () => string | null
}

// Derive CSS-style gradient string for Konva LinearGradientFill
function gradientForKonva(source: Extract<BackgroundSource, { type: 'gradient' }>): {
  colorStops: (number | string)[]
  startPoint: { x: number; y: number }
  endPoint: { x: number; y: number }
  width: number
  height: number
} {
  const rad = (source.angle * Math.PI) / 180
  const w = 1920
  const h = 1080
  const startPoint = { x: w / 2 - (Math.cos(rad) * w) / 2, y: h / 2 - (Math.sin(rad) * h) / 2 }
  const endPoint = { x: w / 2 + (Math.cos(rad) * w) / 2, y: h / 2 + (Math.sin(rad) * h) / 2 }
  const colorStops = source.stops.flatMap((s) => [s.position, s.color])
  return { colorStops, startPoint, endPoint, width: w, height: h }
}

export function usePreviewCompositor(config: CompositorConfig): CompositorHandle {
  const stageRef = useRef<Konva.Stage | null>(null)
  const bgLayerRef = useRef<Konva.Layer | null>(null)
  const videoLayerRef = useRef<Konva.Layer | null>(null)
  const animFrameRef = useRef<number>(0)
  const videoImageRef = useRef<Konva.Image | null>(null)
  const bgRectRef = useRef<Konva.Rect | null>(null)
  const clipGroupRef = useRef<Konva.Group | null>(null)

  const { containerRef, videoEl, background, padding, cornerRadius, canvasWidth, canvasHeight } = config

  // Init stage once
  useEffect(() => {
    const container = containerRef.current
    if (!container || stageRef.current) return

    const stage = new Konva.Stage({ container, width: canvasWidth, height: canvasHeight })
    stageRef.current = stage

    // Layer 1: background
    const bgLayer = new Konva.Layer()
    stage.add(bgLayer)
    bgLayerRef.current = bgLayer

    // Layer 2: video inside clipped group
    const videoLayer = new Konva.Layer()
    stage.add(videoLayer)
    videoLayerRef.current = videoLayer

    // Background rect (full canvas)
    const bgRect = new Konva.Rect({ x: 0, y: 0, width: canvasWidth, height: canvasHeight })
    bgLayer.add(bgRect)
    bgRectRef.current = bgRect

    // Clipping group for rounded corners on video
    const clipGroup = new Konva.Group({
      x: padding,
      y: padding,
      width: canvasWidth - padding * 2,
      height: canvasHeight - padding * 2,
      clipFunc: (ctx) => {
        const w = canvasWidth - padding * 2
        const h = canvasHeight - padding * 2
        const r = cornerRadius
        ctx.beginPath()
        ctx.moveTo(r, 0)
        ctx.lineTo(w - r, 0)
        ctx.arcTo(w, 0, w, r, r)
        ctx.lineTo(w, h - r)
        ctx.arcTo(w, h, w - r, h, r)
        ctx.lineTo(r, h)
        ctx.arcTo(0, h, 0, h - r, r)
        ctx.lineTo(0, r)
        ctx.arcTo(0, 0, r, 0, r)
        ctx.closePath()
      }
    })
    videoLayer.add(clipGroup)
    clipGroupRef.current = clipGroup

    // Video image node
    if (videoEl) {
      const videoImage = new Konva.Image({
        x: 0,
        y: 0,
        image: videoEl,
        width: canvasWidth - padding * 2,
        height: canvasHeight - padding * 2
      })
      clipGroup.add(videoImage)
      videoImageRef.current = videoImage
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      stage.destroy()
      stageRef.current = null
      bgLayerRef.current = null
      videoLayerRef.current = null
      videoImageRef.current = null
    }
  }, []) // intentionally only run once

  // Update background when settings change
  useEffect(() => {
    const bgRect = bgRectRef.current
    const bgLayer = bgLayerRef.current
    if (!bgRect || !bgLayer) return

    bgRect.fill('')
    bgRect.fillLinearGradientColorStops(undefined as any)

    if (background.type === 'solid') {
      bgRect.fill(background.color)
    } else if (background.type === 'gradient') {
      const g = gradientForKonva(background)
      bgRect.fillLinearGradientStartPoint(g.startPoint)
      bgRect.fillLinearGradientEndPoint(g.endPoint)
      bgRect.fillLinearGradientColorStops(g.colorStops as any)
    } else {
      // fallback
      bgRect.fill('#1a1a2e')
    }

    bgLayer.batchDraw()
  }, [background])

  // Update clip shape when padding/corner radius change
  useEffect(() => {
    const clipGroup = clipGroupRef.current
    const videoImage = videoImageRef.current
    if (!clipGroup || !videoImage) return

    const w = canvasWidth - padding * 2
    const h = canvasHeight - padding * 2

    clipGroup.setAttrs({ x: padding, y: padding, width: w, height: h })
    clipGroup.clipFunc((ctx: any) => {
      const r = cornerRadius
      ctx.beginPath()
      ctx.moveTo(r, 0)
      ctx.lineTo(w - r, 0)
      ctx.arcTo(w, 0, w, r, r)
      ctx.lineTo(w, h - r)
      ctx.arcTo(w, h, w - r, h, r)
      ctx.lineTo(r, h)
      ctx.arcTo(0, h, 0, h - r, r)
      ctx.lineTo(0, r)
      ctx.arcTo(0, 0, r, 0, r)
      ctx.closePath()
    })
    videoImage.setAttrs({ width: w, height: h })
  }, [padding, cornerRadius, canvasWidth, canvasHeight])

  // Animation loop — repaint every frame when video is playing
  useEffect(() => {
    if (!videoEl) return

    const tick = () => {
      if (videoImageRef.current && videoLayerRef.current) {
        videoImageRef.current.image(videoEl)
        videoLayerRef.current.batchDraw()
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(animFrameRef.current)
  }, [videoEl])

  const getDataURL = useCallback(() => {
    return stageRef.current?.toDataURL({ pixelRatio: 1 }) ?? null
  }, [])

  return { stage: stageRef.current, getDataURL }
}
