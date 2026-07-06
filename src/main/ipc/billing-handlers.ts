import { IpcMain } from 'electron'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { authService } from '../auth/AuthService'
import { loadAuthBillingConfig } from '../config/env'
import { createCheckoutUrl, createPortalUrl } from '../billing/PaddleService'

export type SubscriptionInfo =
  | { signedIn: false }
  | { signedIn: true; plan: 'free' | 'pro'; status: string; currentPeriodEnd: number | null }
  /** Sprint 29 BUG-03 — a real Supabase query error (stale token, network
   *  failure, RLS misconfiguration) is now surfaced distinctly from "no
   *  subscription row" instead of being silently folded into `plan: 'free'`.
   *  AccountPanel keeps showing the last known plan rather than flashing
   *  "Free" on a transient error — see AccountPanel.tsx. */
  | { signedIn: true; error: string }

/** A per-request client scoped to one user's access token (so RLS applies
 *  as that user, never the service role) — see AuthService.ts for why the
 *  `realtime.transport` option is required on this Electron version. */
function userScopedClient(token: string) {
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
async function fetchSubscription(): Promise<SubscriptionInfo> {
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
  const isActive = data.status === 'active' || data.status === 'trialing'
  return {
    signedIn: true,
    plan: isActive ? 'pro' : 'free',
    status: data.status,
    currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end).getTime() : null
  }
}

export function registerBillingHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('billing:get-subscription', (): Promise<SubscriptionInfo> => fetchSubscription())

  ipcMain.handle('billing:create-checkout-url', async () => {
    if (authService.status.state !== 'signedIn') return { ok: false, error: 'Bạn cần đăng nhập trước khi nâng cấp.' }
    const { user } = authService.status
    const result = await createCheckoutUrl(user.id, user.email)
    if (result.ok) {
      const { shell } = await import('electron')
      shell.openExternal(result.url)
    }
    return result
  })

  ipcMain.handle('billing:open-portal', async () => {
    if (authService.status.state !== 'signedIn') return { ok: false, error: 'Bạn cần đăng nhập trước.' }
    const token = await authService.getValidAccessToken()
    if (!token) return { ok: false, error: 'Phiên đăng nhập đã hết hạn.' }
    const client = userScopedClient(token)
    const { data, error } = await client.from('subscriptions').select('paddle_customer_id').maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data?.paddle_customer_id) return { ok: false, error: 'Chưa có thông tin thanh toán để quản lý.' }
    const result = await createPortalUrl(data.paddle_customer_id)
    if (result.ok) {
      const { shell } = await import('electron')
      shell.openExternal(result.url)
    }
    return result
  })
}
