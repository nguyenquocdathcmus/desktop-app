/**
 * Sprint 18 US-146/147/148 — thin call-site wrapper. The actual opt-in gate
 * lives in the main process (`analytics-handlers.ts`); this just gives call
 * sites a single import instead of reaching into `window.api` directly,
 * so instrumentation reads as intent ("track this happened") rather than
 * IPC plumbing.
 */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>): void {
  window.api.trackEvent(name, props)
}
