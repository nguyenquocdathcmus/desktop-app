import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { authService } from '../auth/AuthService'
import { loadAuthBillingConfig } from '../config/env'

/** Sprint 30 — extracted from billing-handlers.ts so both the IPC layer and
 *  entitlements.ts can read subscription state without importing each other
 *  (billing-handlers needs getEntitlements for its IPC handler; entitlements
 *  needs this fetch — keeping fetch here breaks the cycle). */

export type SubscriptionInfo =
  | { signedIn: false }
  | { signedIn: true; plan: 'free' | 'pro'; status: string; currentPeriodEnd: number | null }
  /** Sprint 29 BUG-03 — a real Supabase query error (stale token, network
   *  failure, RLS misconfiguration) is now surfaced distinctly from "no
   *  subscription row" instead of being silently folded into `plan: 'free'`.
   *  AccountPanel keeps showing the last known plan rather than flashing
   *  "Free" on a transient error — see AccountPanel.tsx. */
  | { signedIn: true; error: string }

/** Sprint 30 US-222 — how long past current_period_end an 'active' row is
 *  still honored. Covers the normal case where Paddle renews and the webhook
 *  moves the period forward; if the webhook has gone silent (secret rotated,
 *  destination disabled) the plan degrades to Free instead of staying Pro
 *  forever on stale data. */
const PERIOD_END_GRACE_MS = 3 * 24 * 60 * 60 * 1000

/** A per-request client scoped to one user's access token (so RLS applies
 *  as that user, never the service role) — see AuthService.ts for why the
 *  `realtime.transport` option is required on this Electron version. */
export function userScopedClient(token: string) {
  const config = loadAuthBillingConfig()
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket }
  })
}

/** Reads the current user's `subscriptions` row using THEIR OWN access
 *  token (not the service role key) — RLS (subscriptions_select_own, see
 *  migration 20260705101032) means this can only ever return that one row,
 *  even if the query had no WHERE clause. A fresh client per call is
 *  intentional: the access token can change between calls (refresh), and
 *  this is a low-frequency read (Settings panel open), not a hot path. */
export async function fetchSubscription(): Promise<SubscriptionInfo> {
  if (authService.status.state !== 'signedIn') return { signedIn: false }
  // Sprint 29 BUG-03 — was authService.getAccessToken(), a sync read with no
  // expiry check; getValidAccessToken() refreshes first if the stored token
  // is stale, so this never sends an access token Supabase will reject.
  const token = await authService.getValidAccessToken()
  if (!token) return { signedIn: false }

  const client = userScopedClient(token)

  const { data, error } = await client
    .from('subscriptions')
    .select('status, current_period_end')
    .maybeSingle()

  // Sprint 29 BUG-03 — previously ignored `error` entirely and fell through
  // to the "no row" branch below, which returns `plan: 'free'` — a real
  // Supabase/network error looked identical to "this user has never
  // subscribed," silently downgrading a Pro user's displayed plan.
  if (error) return { signedIn: true, error: error.message }

  if (!data || data.status === 'canceled') {
    return { signedIn: true, plan: 'free', status: data?.status ?? 'canceled', currentPeriodEnd: null }
  }
  const currentPeriodEnd = data.current_period_end ? new Date(data.current_period_end).getTime() : null
  let isActive = data.status === 'active' || data.status === 'trialing'
  // Sprint 30 US-222 — an 'active' row whose billing period lapsed more than
  // the grace window ago means the webhook stopped delivering (a renewal
  // always pushes current_period_end forward) — stop honoring it.
  if (isActive && currentPeriodEnd !== null && Date.now() > currentPeriodEnd + PERIOD_END_GRACE_MS) {
    isActive = false
  }
  return {
    signedIn: true,
    plan: isActive ? 'pro' : 'free',
    status: data.status,
    currentPeriodEnd
  }
}
