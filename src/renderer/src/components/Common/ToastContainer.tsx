import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore } from '../../store/useToastStore'

const KIND_STYLES: Record<string, string> = {
  error: 'border-red-500/40 bg-red-500/10 text-red-200',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  info: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200'
}

const KIND_ICON: Record<string, string> = {
  error: '⚠️',
  warning: '⚠️',
  info: 'ℹ️'
}

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-xl backdrop-blur-md max-w-sm ${KIND_STYLES[t.kind]}`}
          >
            <span className="shrink-0">{KIND_ICON[t.kind]}</span>
            <span className="flex-1">{t.message}</span>
            {t.onAction && t.actionLabel && (
              <button
                onClick={() => { t.onAction?.(); dismiss(t.id) }}
                className="shrink-0 rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-[11px] font-medium transition-colors"
              >
                {t.actionLabel}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-white/40 hover:text-[var(--text-primary)]/80 transition-colors"
              title="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
