/**
 * Sprint 13 US-115 — a single command registry the command palette (⌘K) reads
 * from. Actions are registered by whichever component owns the relevant store
 * action, so this file has no store imports itself — it's just the list of
 * "things you can do" and a way to run them.
 */
export interface Command {
  id: string
  label: string
  group: 'Playback' | 'Editing' | 'Export' | 'Timeline'
  run: () => void
  /** Human-readable key combo, e.g. "⌘Z" — shown in the shortcuts overlay
   *  (Sprint 17 US-138). Omitted for commands with no fixed keybinding. */
  keys?: string
}

let commands: Command[] = []
const listeners = new Set<() => void>()

export function registerCommands(newCommands: Command[]): () => void {
  commands = [...commands, ...newCommands]
  listeners.forEach((l) => l())
  return () => {
    commands = commands.filter((c) => !newCommands.includes(c))
    listeners.forEach((l) => l())
  }
}

export function getCommands(): Command[] {
  return commands
}

export function subscribeCommands(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
