import { create } from 'zustand'
import type { Entitlements, EntitlementLimits } from '../../../main/billing/entitlements'

/** Sprint 30 follow-up — renderer-side mirror of main's entitlements, so
 *  synchronous store actions (add zoom/annotation/chapter/note/blur) can
 *  gate without an async IPC round trip per click. Purely cosmetic/UX:
 *  main re-checks everything at export/recording time regardless.
 *
 *  Defaults to the FREE limits until the first fetch answers — the safe
 *  direction (a Pro user sees locks for a few hundred ms; a Free user can
 *  never act in the gap). */

const FREE_DEFAULTS: EntitlementLimits = {
  maxExportShortSide: 720,
  maxRecordingSeconds: 300,
  audioAllowed: false,
  webcamAllowed: false,
  transcriptAllowed: false,
  zoomAllowed: false,
  cursorFxAllowed: false,
  annotationsAllowed: false,
  chaptersAllowed: false,
  notesAllowed: false,
  blurAllowed: false
}

interface EntitlementsStore {
  plan: 'free' | 'pro'
  limits: EntitlementLimits
  ready: boolean
  refresh: () => Promise<void>
}

export const useEntitlementsStore = create<EntitlementsStore>((set) => ({
  plan: 'free',
  limits: FREE_DEFAULTS,
  ready: false,

  refresh: async () => {
    try {
      const ent: Entitlements = await window.api.getEntitlements()
      set({ plan: ent.plan, limits: ent.limits, ready: true })
    } catch {
      set({ ready: true })
    }
  }
}))
