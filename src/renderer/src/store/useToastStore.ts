import { create } from 'zustand'

export type ToastKind = 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  actionLabel?: string
  onAction?: () => void
}

interface ToastStore {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  push: (toast) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    // Auto-dismiss after 6s unless it carries an action the user might need time to click
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, toast.onAction ? 10_000 : 6_000)
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))
