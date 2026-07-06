import { IpcMain, app, clipboard, nativeImage } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

interface PresetsFile {
  presets: { name: string; state: unknown }[]
  defaultName: string | null
}

function presetsPath(): string {
  return join(app.getPath('userData'), 'presets.json')
}

function readPresets(): PresetsFile {
  try {
    return JSON.parse(readFileSync(presetsPath(), 'utf-8'))
  } catch {
    return { presets: [], defaultName: null }
  }
}

function writePresets(data: PresetsFile): void {
  writeFileSync(presetsPath(), JSON.stringify(data, null, 2))
}

export function registerPresetsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('presets:list', (): PresetsFile => readPresets())

  ipcMain.handle('presets:save', (_, { name, state }: { name: string; state: unknown }) => {
    const data = readPresets()
    const existing = data.presets.findIndex((p) => p.name === name)
    if (existing !== -1) data.presets[existing] = { name, state }
    else data.presets.push({ name, state })
    writePresets(data)
  })

  ipcMain.handle('presets:delete', (_, { name }: { name: string }) => {
    const data = readPresets()
    data.presets = data.presets.filter((p) => p.name !== name)
    if (data.defaultName === name) data.defaultName = null
    writePresets(data)
  })

  ipcMain.handle('presets:set-default', (_, { name }: { name: string | null }) => {
    const data = readPresets()
    data.defaultName = name
    writePresets(data)
  })
}

// ── Templates (Sprint 15 US-124/130) ────────────────────────────────────────
// Same storage shape/pattern as presets, but a template captures edit
// structure (segments/zoom/annotations/scenes as 0-1 fractions of duration),
// not just style — see captureTemplate()/applyTemplate() in useProjectStore.ts.

interface TemplatesFile {
  templates: { name: string; template: unknown }[]
}

function templatesPath(): string {
  return join(app.getPath('userData'), 'templates.json')
}

function readTemplates(): TemplatesFile {
  try {
    return JSON.parse(readFileSync(templatesPath(), 'utf-8'))
  } catch {
    return { templates: [] }
  }
}

function writeTemplates(data: TemplatesFile): void {
  writeFileSync(templatesPath(), JSON.stringify(data, null, 2))
}

export function registerTemplatesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('templates:list', (): TemplatesFile => readTemplates())

  ipcMain.handle('templates:save', (_, { name, template }: { name: string; template: unknown }) => {
    const data = readTemplates()
    const existing = data.templates.findIndex((t) => t.name === name)
    if (existing !== -1) data.templates[existing] = { name, template }
    else data.templates.push({ name, template })
    writeTemplates(data)
  })

  ipcMain.handle('templates:delete', (_, { name }: { name: string }) => {
    const data = readTemplates()
    data.templates = data.templates.filter((t) => t.name !== name)
    writeTemplates(data)
  })
}

export function registerShareHandlers(ipcMain: IpcMain): void {
  // Copy an exported file to the clipboard so it can be pasted straight into
  // Slack/Finder/iMessage. macOS pasteboard wants a file URL under this type.
  ipcMain.handle('share:copy-file', (_, { path }: { path: string }): { ok: boolean } => {
    try {
      if (!existsSync(path)) return { ok: false }
      clipboard.writeBuffer('public.file-url', Buffer.from(`file://${encodeURI(path)}`))
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })

  // Drag the exported file out of the app (onto Desktop, Slack, etc.)
  ipcMain.on('share:start-drag', (event, { path }: { path: string }) => {
    if (!existsSync(path)) return
    // A 1×1 transparent image is enough — macOS renders its own file badge.
    const icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    )
    event.sender.startDrag({ file: path, icon })
  })
}
