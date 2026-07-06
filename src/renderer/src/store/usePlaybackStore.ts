import { create } from 'zustand'

interface PlaybackStore {
  currentTime: number    // seconds
  duration: number       // seconds
  isPlaying: boolean

  setCurrentTime: (t: number) => void
  setDuration: (d: number) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (t: number) => void
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  currentTime: 0,
  duration: 0,
  isPlaying: false,

  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  seek: (t) => set({ currentTime: t })
}))
