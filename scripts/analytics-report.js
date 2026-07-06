#!/usr/bin/env node
/**
 * Sprint 18 US-149 — reads the local analytics-events.jsonl file (populated
 * only if the user opted in, see src/main/analytics/sink.ts) and answers the
 * 3 questions from the Sprint 18 goal. Not a hosted dashboard — this is the
 * "query mesh" this sprint asked for, sized for a single local install's
 * data. Once a real PostHog project exists, these would become saved
 * insights there instead of a script.
 *
 * Usage: node scripts/analytics-report.js [path-to-jsonl]
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const defaultPath = path.join(
  os.homedir(),
  'Library', 'Application Support', 'record-screen', 'analytics-events.jsonl'
)
const file = process.argv[2] || defaultPath

if (!fs.existsSync(file)) {
  console.log(`No analytics file found at ${file}`)
  console.log('(Expected — this only exists once a user opts in and performs actions.)')
  process.exit(0)
}

const events = fs.readFileSync(file, 'utf-8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l))

console.log(`Loaded ${events.length} events from ${file}\n`)

// Q1: recordings created vs exported
const started = events.filter((e) => e.name === 'recording_started').length
const completed = events.filter((e) => e.name === 'export_completed').length
console.log('── Recording → export ratio ──')
console.log(`recording_started: ${started}`)
console.log(`export_completed:  ${completed}`)
console.log(`ratio: ${started > 0 ? ((completed / started) * 100).toFixed(1) + '%' : 'n/a'}\n`)

// Q2: most common export config
const exportEvents = events.filter((e) => e.name === 'export_started')
function topOf(key) {
  const counts = {}
  for (const e of exportEvents) {
    const v = e.props[key]
    counts[v] = (counts[v] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}
console.log('── Most common export config ──')
for (const key of ['codec', 'quality', 'aspectRatio', 'format']) {
  const top = topOf(key)
  console.log(`${key}: ${top.map(([v, n]) => `${v} (${n})`).join(', ') || 'no data'}`)
}
console.log()

// Q3: least-used instrumented feature
const featureEvents = events.filter((e) => e.name.startsWith('feature_used_'))
const featureCounts = {}
for (const e of featureEvents) {
  featureCounts[e.name] = (featureCounts[e.name] || 0) + 1
}
const ALL_FEATURES = ['feature_used_silence_detect', 'feature_used_manual_zoom', 'feature_used_scene_added', 'feature_used_preset_saved']
console.log('── Feature usage (instrumented features only) ──')
for (const f of ALL_FEATURES) {
  console.log(`${f}: ${featureCounts[f] || 0}`)
}
const leastUsed = ALL_FEATURES.slice().sort((a, b) => (featureCounts[a] || 0) - (featureCounts[b] || 0))[0]
console.log(`\nLeast used: ${leastUsed}`)

// Bonus: funnel drop-off (US-148)
console.log('\n── Funnel ──')
const funnel = ['recording_started', 'recording_stopped', 'editor_opened', 'export_modal_opened', 'export_started', 'export_completed']
for (const step of funnel) {
  console.log(`${step}: ${events.filter((e) => e.name === step).length}`)
}
