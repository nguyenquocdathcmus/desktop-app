import { useEffect } from 'react'
import { useRecordingStore } from './store/useRecordingStore'
import { useProjectStore } from './store/useProjectStore'
import { usePlaybackStore } from './store/usePlaybackStore'
import { useLocaleStore } from './store/useLocaleStore'
import { useThemeStore } from './store/useThemeStore'
import { useAuthStore } from './store/useAuthStore'
import { RTL_LOCALES } from '../../shared/locales'
import { Editor } from './components/Editor/Editor'
import { RecordingControls } from './components/Recording/RecordingControls'
import { KeystrokeOverlay } from './components/Recording/KeystrokeOverlay'
import { WebcamFloat } from './components/Recording/WebcamFloat'
import { ToastContainer } from './components/Common/ToastContainer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UpdateBanner } from './components/Common/UpdateBanner'
import { SaveConflictBanner } from './components/Common/SaveConflictBanner'
import { OnboardingTour } from './components/Onboarding/OnboardingTour'
import { FeatureTour } from './components/Onboarding/FeatureTour'
import { WhatsNewPanel } from './components/Onboarding/WhatsNewPanel'
import { AnalyticsConsentDialog } from './components/Onboarding/AnalyticsConsentDialog'
import { CommandPalette } from './components/Common/CommandPalette'
import { ShortcutsOverlay } from './components/Common/ShortcutsOverlay'
import { SettingsPanel } from './components/Common/SettingsPanel'
import { AccountPanel } from './components/Common/AccountPanel'

function getView(): 'editor' | 'controls' | 'webcam' {
  const hash = window.location.hash
  if (hash === '#controls') return 'controls'
  if (hash.startsWith('#webcam')) return 'webcam'
  return 'editor'
}

const view = getView() // compute once at module level (hash doesn't change)

export default function App() {
  const { setStatus, fetchDisplays } = useRecordingStore()
  const { newProjectFromManifest, openProject } = useProjectStore()
  const { locale, initLocale } = useLocaleStore()
  const { preference: theme, initTheme } = useThemeStore()
  const { initAuth } = useAuthStore()

  // Sprint 27 US-206/207/208 — resolve the persisted/OS-detected locale once
  // at boot, then keep <html dir> in sync for the one RTL locale (Arabic).
  // Every window (editor/controls/webcam) does this independently since each
  // is its own renderer process with its own document.
  useEffect(() => {
    initLocale()
    initTheme()
    // Sprint 28 — only the editor window has a Settings panel that reads
    // auth state; controls/webcam windows don't need this subscription.
    if (view === 'editor') initAuth()
  }, [])

  useEffect(() => {
    document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'
    document.documentElement.lang = locale
  }, [locale])

  // Sprint 27 US-209 — 'system' resolves via prefers-color-scheme in CSS
  // (globals.css), so it just needs the attribute set; the actual color
  // swap for 'system' happens live if the OS theme changes without needing
  // a JS media-query listener here.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Sprint 18 US-151 — retention signal: how many days since this install
  // was last opened. No account needed; just a local timestamp + anon UUID.
  useEffect(() => {
    if (view !== 'editor') return
    window.api.getRetentionSignal().then(({ daysSinceLastOpen }) => {
      if (daysSinceLastOpen !== null) {
        window.api.trackEvent('app_reopened', { daysSinceLastOpen })
      }
    })
  }, [])

  useEffect(() => {
    if (view === 'editor') fetchDisplays()

    const unsub = window.api.onRecordingStatus((status) => {
      setStatus(status)

      if (status.state === 'done' && view === 'editor') {
        console.log('[App] Recording done, loading project from:', status.manifest.videoPath)
        newProjectFromManifest(status.manifest)
          .then(() => console.log('[App] Project loaded OK'))
          .catch((e) => console.error('[App] newProjectFromManifest failed:', e))
      }
    })

    return unsub
  }, [])

  // Sprint 15 US-127 — "Copy timestamp link" deep link handler: open the
  // project, then seek once its duration is known (video metadata loads async).
  useEffect(() => {
    if (view !== 'editor') return
    const unsub = window.api.onOpenDeepLink(async ({ projectPath, t }) => {
      await openProject(projectPath)
      const seekWhenReady = () => {
        if (usePlaybackStore.getState().duration > 0) {
          usePlaybackStore.getState().seek(t)
        } else {
          setTimeout(seekWhenReady, 200)
        }
      }
      seekWhenReady()
    })
    return unsub
  }, [])

  if (view === 'controls') {
    return (
      <>
        <ErrorBoundary name="Recording Controls">
          <RecordingControls />
        </ErrorBoundary>
        <ToastContainer />
      </>
    )
  }
  if (view === 'webcam') return <WebcamFloat />

  return (
    <>
      <Editor />
      <KeystrokeOverlay />
      <ToastContainer />
      <UpdateBanner />
      <SaveConflictBanner />
      <OnboardingTour />
      <FeatureTour />
      <WhatsNewPanel />
      <AnalyticsConsentDialog />
      <CommandPalette />
      <ShortcutsOverlay />
      <SettingsPanel />
      <AccountPanel />
    </>
  )
}
