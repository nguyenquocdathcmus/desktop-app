import { IpcMain } from 'electron'
import { authService } from '../auth/AuthService'
import { createCheckoutUrl, createPortalUrl } from '../billing/PaddleService'
import { getEntitlements, invalidateEntitlements } from '../billing/entitlements'
import { fetchSubscription, userScopedClient, type SubscriptionInfo } from '../billing/subscription'

// Sprint 30 — fetchSubscription/SubscriptionInfo moved to billing/subscription.ts
// so entitlements.ts can read plan state without importing this IPC module
// (which imports entitlements back — would be a cycle). Type re-exported so
// preload/renderer imports keep working unchanged.
export type { SubscriptionInfo } from '../billing/subscription'

export function registerBillingHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('billing:get-subscription', (): Promise<SubscriptionInfo> => fetchSubscription())

  ipcMain.handle('billing:create-checkout-url', async () => {
    if (authService.status.state !== 'signedIn') return { ok: false, error: 'Bạn cần đăng nhập trước khi nâng cấp.' }

    // Sprint 30 US-223 — a user clicking Upgrade on a second machine (or a
    // stale panel) while already subscribed would create a SECOND Paddle
    // subscription billing them twice, with only one visible in our
    // one-row-per-user table. Refuse instead.
    const current = await fetchSubscription()
    if (current.signedIn && 'plan' in current && current.plan === 'pro') {
      return { ok: false, error: 'Bạn đã có gói Pro — không cần thanh toán lại. Dùng "Quản lý thanh toán" để xem chi tiết.' }
    }

    const { user } = authService.status
    const result = await createCheckoutUrl(user.id, user.email)
    if (result.ok) {
      // The user is about to pay in the browser — drop the cached plan so the
      // first entitlement check after the webhook lands sees Pro immediately.
      invalidateEntitlements()
      const { shell } = await import('electron')
      shell.openExternal(result.url)
    }
    return result
  })

  // Sprint 30 US-220 — renderer-facing read of plan + limits, used to draw
  // locks/upsell hints. Enforcement happens separately in each handler.
  ipcMain.handle('billing:get-entitlements', () => getEntitlements())

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
