import { useEffect, useRef, useState } from 'react'
import type { RecordingStatus } from '../../../../shared/ipc-types'

export function WebcamFloat() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    async function start() {
      try {
        // Read deviceId from URL hash e.g. #webcam?deviceId=xxx
        const params = new URLSearchParams(window.location.hash.replace(/^#webcam\??/, ''))
        const deviceId = params.get('deviceId')

        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 640 } } : { width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
          setReady(true)
        }
      } catch {
        setError(true)
      }
    }
    start()
    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Record webcam video to disk in lockstep with the screen recording lifecycle
  useEffect(() => {
    const unsubscribe = window.api.onRecordingStatus((status: RecordingStatus) => {
      const stream = streamRef.current
      if (status.state === 'recording' && stream && !recorderRef.current) {
        chunksRef.current = []
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9' : 'video/webm'
        const recorder = new MediaRecorder(stream, { mimeType })
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        recorder.start(200)
        recorderRef.current = recorder
      } else if (status.state === 'paused' && recorderRef.current?.state === 'recording') {
        // Mirror the screen capture's pause so the webcam track doesn't keep
        // accumulating frames the screen recording drops — otherwise the two
        // tracks drift out of sync once recording resumes.
        recorderRef.current.pause()
      } else if (status.state === 'recording' && recorderRef.current?.state === 'paused') {
        recorderRef.current.resume()
      } else if (status.state === 'processing' && recorderRef.current) {
        const recorder = recorderRef.current
        recorderRef.current = null
        if (recorder.state !== 'inactive') {
          recorder.onstop = async () => {
            if (chunksRef.current.length === 0) return
            const blob = new Blob(chunksRef.current, { type: 'video/webm' })
            const buf = await blob.arrayBuffer()
            await window.api.saveWebcamVideo(new Uint8Array(buf))
          }
          recorder.stop()
        }
      }
    })
    return unsubscribe
  }, [])

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-transparent select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="relative w-full h-full rounded-xl overflow-hidden ring-2 ring-white/20 shadow-2xl bg-black">
        {/* Mirror the video like a selfie cam */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)', opacity: ready ? 1 : 0, transition: 'opacity 0.3s' }}
          muted
          playsInline
          autoPlay
        />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <span className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        )}
        {error && (
          <button
            onClick={() => window.api.openPrivacySettings('camera')}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 hover:bg-black/90 transition-colors cursor-pointer"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Camera access denied — click to open System Settings"
          >
            <span className="text-2xl">📷</span>
            <span className="text-[9px] text-white/70 px-2 text-center leading-tight">Tap to enable access</span>
          </button>
        )}

        {/* Drag hint — subtle overlay, no-drag area for close button */}
        <div
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center cursor-pointer hover:bg-red-500/80 transition-colors text-white text-[10px] leading-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => window.api.closeWebcamWindow?.()}
          title="Close"
        >
          ×
        </div>
      </div>
    </div>
  )
}
