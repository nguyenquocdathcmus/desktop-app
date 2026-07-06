import { Component, type ReactNode } from 'react'

interface Props {
  /** Shown in the fallback UI so a bug report (or just the user) knows which
   *  part of the app broke — "Editor crashed" reads very differently from a
   *  blank screen with no context. */
  name: string
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Sprint 12 US-100 — before this, a single uncaught exception anywhere in the
 * render tree unmounted the whole React root and left a blank window with no
 * way back short of restarting the app (losing any in-progress edit). Each
 * major surface (HomeScreen, Editor, RecordingControls) gets its own boundary
 * so a crash in one doesn't take down windows/subtrees that were working fine.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error(`[ErrorBoundary:${this.props.name}]`, error, info.componentStack)
  }

  private reload = () => {
    this.setState({ error: null })
  }

  private reportIssue = () => {
    const detail = encodeURIComponent(
      `Crashed in: ${this.props.name}\n\n${this.state.error?.stack ?? this.state.error?.message ?? 'unknown error'}`
    )
    window.api.getAppVersion().then((version) => {
      window.open(
        `mailto:feedback@example.com?subject=${encodeURIComponent(`Record Screen crash — ${this.props.name}`)}&body=${detail}%0A%0AVersion: ${version}`
      )
    })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[var(--bg-primary)] text-center px-8 h-full">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl">
          ⚠
        </div>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1">{this.props.name} ran into a problem</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-sm">
            This part of the app hit an unexpected error. Your other windows and unsaved work elsewhere are unaffected.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={this.reload} className="btn-primary">Reload</button>
          <button onClick={this.reportIssue} className="btn-ghost">Report issue</button>
        </div>
        <details className="text-[10px] text-[var(--text-secondary)] max-w-md mt-2">
          <summary className="cursor-pointer hover:text-[var(--text-secondary)]">Show details</summary>
          <pre className="text-left whitespace-pre-wrap mt-2 p-2 rounded bg-black/30 max-h-32 overflow-y-auto">
            {this.state.error?.stack ?? this.state.error?.message}
          </pre>
        </details>
      </div>
    )
  }
}
