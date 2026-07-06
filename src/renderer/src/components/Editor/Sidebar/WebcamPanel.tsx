import { useProjectStore } from '../../../store/useProjectStore'

/** Only shown when this recording has a webcam track. Face tracking (Sprint 11)
 *  previously had no UI toggle anywhere in the app; face blur (Sprint 19 US-157)
 *  is added alongside it here rather than leaving a second untoggleable setting. */
export function WebcamPanel() {
  const { project, setWebcam } = useProjectStore()
  if (!project?.manifest.webcamPath || !project.webcam) return null

  const wc = project.webcam

  return (
    <div className="panel">
      <p className="label mb-3">Webcam</p>
      <div className="flex flex-col gap-2">
        <Row label="Follow face (auto-frame)">
          <Toggle value={wc.faceTracking} onChange={(v) => setWebcam({ faceTracking: v })} />
        </Row>
        <Row label="Blur face (anonymize)">
          <Toggle value={!!wc.faceBlur} onChange={(v) => setWebcam({ faceBlur: v })} />
        </Row>
        <Row label="Mirror">
          <Toggle value={!!wc.mirror} onChange={(v) => setWebcam({ mirror: v })} />
        </Row>
      </div>
      {wc.faceBlur && (
        <p className="text-[10px] text-[var(--text-secondary)] mt-2 leading-relaxed">
          Blurs the area around the detected face in both preview and export — the rest of the webcam frame stays visible.
        </p>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-7 h-4 rounded-full transition-colors ${value ? 'bg-indigo-500' : 'bg-[var(--bg-hover)]'}`}
    >
      <span
        className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${value ? 'left-3.5' : 'left-0.5'}`}
      />
    </button>
  )
}
