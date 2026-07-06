import { useEffect, useState } from 'react'
import { useProjectStore, captureTemplate, type ProjectTemplate } from '../../../store/useProjectStore'
import type { ProjectState } from '../../../../../shared/project-types'
import { TEMPLATE_GALLERY } from '../../../templateGallery'
import { trackEvent } from '../../../analytics'

/** The style slice of a project that a preset captures (Sprint 10). */
type PresetState = Pick<ProjectState, 'background' | 'padding' | 'cornerRadius' | 'cursorSettings' | 'deviceFrame'>

interface PresetEntry {
  name: string
  state: PresetState
}

interface TemplateEntry {
  name: string
  template: ProjectTemplate
}

export function PresetPanel() {
  const { project, setBackground, setPadding, setCornerRadius, setCursorSettings, setDeviceFrame, applyProjectTemplate } = useProjectStore()
  const [presets, setPresets] = useState<PresetEntry[]>([])
  const [defaultName, setDefaultName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')

  const [templates, setTemplates] = useState<TemplateEntry[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

  async function refreshTemplates() {
    try {
      const data = await window.api.listTemplates()
      setTemplates(data.templates as TemplateEntry[])
    } catch { /* templates are non-critical */ }
  }

  useEffect(() => { refreshTemplates() }, [])

  async function saveCurrentAsTemplate() {
    const name = newTemplateName.trim()
    if (!name || !project) return
    await window.api.saveTemplate(name, captureTemplate(project))
    setNewTemplateName('')
    setSavingTemplate(false)
    refreshTemplates()
  }

  async function refresh() {
    try {
      const data = await window.api.listPresets()
      setPresets(data.presets as PresetEntry[])
      setDefaultName(data.defaultName)
    } catch { /* presets are non-critical */ }
  }

  useEffect(() => { refresh() }, [])

  if (!project) return null

  function applyPreset(p: PresetEntry) {
    setBackground(p.state.background)
    setPadding(p.state.padding)
    setCornerRadius(p.state.cornerRadius)
    setCursorSettings(p.state.cursorSettings)
    setDeviceFrame(p.state.deviceFrame)
  }

  async function saveCurrent() {
    const name = newName.trim()
    if (!name || !project) return
    const state: PresetState = {
      background: project.background,
      padding: project.padding,
      cornerRadius: project.cornerRadius,
      cursorSettings: project.cursorSettings,
      deviceFrame: project.deviceFrame
    }
    await window.api.savePreset(name, state)
    trackEvent('feature_used_preset_saved')
    setNewName('')
    setSaving(false)
    refresh()
  }

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-2">
        <p className="label">Presets</p>
        <button
          onClick={() => setSaving(!saving)}
          className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {saving ? 'Cancel' : '+ Save current'}
        </button>
      </div>

      {saving && (
        <div className="flex gap-1 mb-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveCurrent() }}
            placeholder="Preset name…"
            className="flex-1 h-7 px-2 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
          />
          <button onClick={saveCurrent} className="px-2 rounded bg-indigo-500 hover:bg-indigo-400 text-white text-xs">✓</button>
        </div>
      )}

      {presets.length === 0 ? (
        <p className="text-[10px] text-[var(--text-secondary)] text-center py-1.5">
          No presets yet — style this project, then save it for reuse.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {presets.map((p) => (
            <div key={p.name} className="group flex items-center gap-1.5 rounded-lg bg-[var(--bg-secondary)] px-2 py-1.5">
              <button
                onClick={() => applyPreset(p)}
                className="flex-1 text-left text-[11px] text-[var(--text-primary)] hover:text-[var(--text-primary)] truncate transition-colors"
                title="Apply this preset"
              >
                {p.name}
              </button>
              <button
                onClick={async () => {
                  await window.api.setDefaultPreset(defaultName === p.name ? null : p.name)
                  refresh()
                }}
                title={defaultName === p.name ? 'Default for new recordings — click to unset' : 'Set as default for new recordings'}
                className={`text-[10px] transition-colors ${defaultName === p.name ? 'text-amber-400' : 'text-[var(--text-secondary)] hover:text-amber-400 opacity-0 group-hover:opacity-100'}`}
              >
                ★
              </button>
              <button
                onClick={async () => { await window.api.deletePreset(p.name); refresh() }}
                title="Delete preset"
                className="text-[var(--text-secondary)] hover:text-red-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Template gallery (Sprint 15 US-130) — built-in starting structures,
          available even before the user has saved any template themselves. */}
      <div className="mt-4 pt-3 border-t border-[var(--border)]">
        <p className="label mb-2" title="Built-in starting points — apply, then adjust to fit">Gallery</p>
        <div className="flex flex-col gap-1">
          {TEMPLATE_GALLERY.map((g) => (
            <button
              key={g.name}
              onClick={() => applyProjectTemplate(g.template)}
              title={g.description}
              className="text-left rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] px-2 py-1.5 transition-colors"
            >
              <div className="text-[11px] text-[var(--text-primary)]">{g.name}</div>
              <div className="text-[9.5px] text-[var(--text-secondary)] truncate">{g.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Templates (Sprint 15) — captures edit structure (segments/zoom/
          annotations/scenes as fractions of duration), not just style. */}
      <div className="mt-4 pt-3 border-t border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <p className="label" title="Captures segments, zoom, annotations and scenes — not just style">Templates</p>
          <button
            onClick={() => setSavingTemplate(!savingTemplate)}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {savingTemplate ? 'Cancel' : '+ Save current'}
          </button>
        </div>

        {savingTemplate && (
          <div className="flex gap-1 mb-2">
            <input
              autoFocus
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentAsTemplate() }}
              placeholder="Template name…"
              className="flex-1 h-7 px-2 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
            />
            <button onClick={saveCurrentAsTemplate} className="px-2 rounded bg-indigo-500 hover:bg-indigo-400 text-white text-xs">✓</button>
          </div>
        )}

        {templates.length === 0 ? (
          <p className="text-[10px] text-[var(--text-secondary)] text-center py-1.5">
            No templates yet — build out a project's structure, then save it for your next recording in the series.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {templates.map((tpl) => (
              <div key={tpl.name} className="group flex items-center gap-1.5 rounded-lg bg-[var(--bg-secondary)] px-2 py-1.5">
                <button
                  onClick={() => applyProjectTemplate(tpl.template)}
                  className="flex-1 text-left text-[11px] text-[var(--text-primary)] hover:text-[var(--text-primary)] truncate transition-colors"
                  title="Apply this template — timestamps scale to this recording's length"
                >
                  {tpl.name}
                </button>
                <button
                  onClick={async () => { await window.api.deleteTemplate(tpl.name); refreshTemplates() }}
                  title="Delete template"
                  className="text-[var(--text-secondary)] hover:text-red-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
