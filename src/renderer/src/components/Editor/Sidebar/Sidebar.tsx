import { BackgroundPanel } from './BackgroundPanel'
import { PaddingPanel } from './PaddingPanel'
import { ZoomPanel } from './ZoomPanel'
import { CursorPanel } from './CursorPanel'
import { DeviceFramePanel } from './DeviceFramePanel'
import { PresetPanel } from './PresetPanel'
import { WebcamPanel } from './WebcamPanel'
import { TranscriptPanel } from './TranscriptPanel'

export function Sidebar() {
  return (
    <div className="w-64 flex flex-col gap-3 p-3 bg-[var(--bg-primary)] border-l border-[var(--border)] overflow-y-auto shrink-0">
      <PresetPanel />
      <BackgroundPanel />
      <PaddingPanel />
      <DeviceFramePanel />
      <WebcamPanel />
      <ZoomPanel />
      <CursorPanel />
      <TranscriptPanel />
    </div>
  )
}
