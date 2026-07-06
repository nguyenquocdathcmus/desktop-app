import { nativeImage, NativeImage } from 'electron'

/**
 * Sprint 23 US-179 — macOS menu bar icons need to be small (16-22pt) monochrome
 * "template" images so the OS can invert them for dark/light menu bar
 * automatically; the existing 512px app icon (build/icon.png) downscaled
 * would be unreadable at that size. Rather than adding an image-processing
 * dependency or a new asset pipeline for one icon, this draws the shape
 * directly as an RGBA buffer — a circle outline (idle) or filled circle (recording).
 */
function drawCircleRGBA(size: number, filled: boolean): Buffer {
  const buf = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 1
  const innerR = outerR - 1.6
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const idx = (y * size + x) * 4
      const isEdge = filled ? dist <= outerR : dist <= outerR && dist >= innerR
      // Template images are alpha-only black — macOS recolors them for the
      // current menu bar appearance (light/dark) and tint (blue when active).
      buf[idx] = 0
      buf[idx + 1] = 0
      buf[idx + 2] = 0
      buf[idx + 3] = isEdge ? 255 : 0
    }
  }
  return buf
}

export function createTrayIcon(recording: boolean): NativeImage {
  const size = 18 // @1x; Electron/macOS handles @2x scaling for template images
  const img = nativeImage.createFromBuffer(drawCircleRGBA(size, recording), { width: size, height: size })
  img.setTemplateImage(true)
  return img
}
