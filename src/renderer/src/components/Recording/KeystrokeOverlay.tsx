import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRecordingStore } from '../../store/useRecordingStore'

interface Keystroke {
  id: number
  display: string
  t: number
}

let nextId = 0

export function KeystrokeOverlay() {
  const { status } = useRecordingStore()
  const [keystrokes, setKeystrokes] = useState<Keystroke[]>([])

  const isRecording = status.state === 'recording'

  // Listen for keystroke events from cursor-tracker stdout
  // In production, these come via IPC from the CursorProcess
  // For now we hook into a custom IPC channel
  useEffect(() => {
    if (!isRecording) {
      setKeystrokes([])
      return
    }

    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) return // only show modifiers combos

      const parts: string[] = []
      if (e.ctrlKey) parts.push('⌃')
      if (e.altKey) parts.push('⌥')
      if (e.shiftKey) parts.push('⇧')
      if (e.metaKey) parts.push('⌘')
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
      parts.push(key)

      const display = parts.join('')
      const id = nextId++
      setKeystrokes((prev) => [...prev.slice(-3), { id, display, t: Date.now() }])

      // Auto-remove after 1.5s
      setTimeout(() => {
        setKeystrokes((prev) => prev.filter((k) => k.id !== id))
      }, 1500)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isRecording])

  if (!isRecording) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col-reverse gap-2 z-50 pointer-events-none">
      <AnimatePresence>
        {keystrokes.map((k) => (
          <motion.div
            key={k.id}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            className="px-4 py-2 rounded-xl bg-black/80 text-white text-sm font-mono font-semibold border border-white/10 backdrop-blur-sm shadow-xl"
          >
            {k.display}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
