import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { useAccountPanelStore } from '../../store/useAccountPanelStore'
import type { SubscriptionInfo } from '../../../../main/ipc/billing-handlers'

/** Sprint 28 follow-up — Profile/Account is its own toolbar button + dialog,
 *  separate from SettingsPanel (gear icon, language/appearance only). Split
 *  out per user feedback that a single gear icon covering both "app config"
 *  and "am I logged in" was confusing — bumping into it should immediately
 *  show sign-in state, not require digging through a general settings panel.
 *  Content below was previously AccountSection.tsx, embedded inside
 *  SettingsPanel; the sign-in/account/billing logic itself is unchanged. */
export function AccountPanel() {
  const { open, closePanel } = useAccountPanelStore()
  const { status, busy, error, signUp, signIn, signInWithOAuth, signOut, clearError } = useAuthStore()
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [billingBusy, setBillingBusy] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  // Refetch on every panel open, not just on sign-in state changes: the
  // component stays mounted while hidden, so without `open` in the deps the
  // subscription shown is a snapshot from sign-in time — a user who upgrades
  // (payment completes in the browser, webhook updates Supabase) and reopens
  // this panel would still see their pre-payment plan until app restart.
  useEffect(() => {
    if (!open) return
    if (status.state !== 'signedIn') { setSubscription(null); return }
    window.api.getSubscriptionStatus().then(setSubscription).catch(() => {})
  }, [open, status.state])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') closePanel() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, closePanel])

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    if (mode === 'signIn') signIn(email, password)
    else signUp(email, password)
  }

  // Sprint 30 US-223 — after checkout opens in the browser, poll until the
  // Paddle webhook lands in Supabase so the panel flips to Pro on its own —
  // no closing/reopening required. Bounded (3 min) so an abandoned checkout
  // doesn't poll forever.
  const upgradePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => {
    if (upgradePollRef.current) clearInterval(upgradePollRef.current)
  }, [])

  async function handleUpgrade() {
    setBillingBusy(true)
    setBillingError(null)
    const result = await window.api.createCheckoutUrl()
    if (!result.ok) setBillingError(result.error)
    else {
      if (upgradePollRef.current) clearInterval(upgradePollRef.current)
      let attempts = 0
      upgradePollRef.current = setInterval(async () => {
        attempts++
        const sub = await window.api.getSubscriptionStatus().catch(() => null)
        const isPro = !!sub && sub.signedIn && 'plan' in sub && sub.plan === 'pro'
        if (isPro && sub) setSubscription(sub)
        if ((isPro || attempts >= 36) && upgradePollRef.current) {
          clearInterval(upgradePollRef.current)
          upgradePollRef.current = null
        }
      }, 5_000)
    }
    setBillingBusy(false)
  }

  async function handleManageBilling() {
    setBillingBusy(true)
    setBillingError(null)
    const result = await window.api.openBillingPortal()
    if (!result.ok) setBillingError(result.error)
    setBillingBusy(false)
  }

  // Sprint 29 BUG-03 — 'plan' in the SubscriptionInfo union only exists on
  // the success variant; a fetch error (stale token, network) must NOT fall
  // through to "Nâng cấp lên Pro" for an actual Pro subscriber just because
  // the check failed transiently.
  const subscriptionError = subscription?.signedIn && 'error' in subscription ? subscription.error : null
  const plan = subscription?.signedIn && 'plan' in subscription ? subscription.plan : null

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && closePanel()}
    >
      <div role="dialog" aria-modal="true" aria-label="Tài khoản" className="w-[380px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Tài khoản</h2>
          <button onClick={closePanel} aria-label="Close" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm px-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors">✕</button>
        </div>

        {status.state === 'signedIn' ? (
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs text-[var(--text-secondary)] truncate">{status.user.email}</span>
              <button
                onClick={signOut}
                disabled={busy}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors shrink-0"
              >
                Đăng xuất
              </button>
            </div>

            <div className="rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">Gói hiện tại</span>
                <span className={`text-xs font-semibold ${plan === 'pro' ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>
                  {plan === 'pro' ? 'Pro' : plan === 'free' ? 'Free' : '—'}
                </span>
              </div>
              <div className="mt-2">
                {subscriptionError ? (
                  <button
                    disabled
                    className="w-full text-xs font-medium bg-[var(--bg-tertiary)] opacity-40 text-[var(--text-primary)] rounded-md px-3 py-1.5"
                  >
                    Không kiểm tra được gói — thử lại sau
                  </button>
                ) : plan === 'pro' ? (
                  <button
                    onClick={handleManageBilling}
                    disabled={billingBusy}
                    className="w-full text-xs font-medium bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 text-[var(--text-primary)] rounded-md px-3 py-1.5 transition-colors"
                  >
                    {billingBusy ? '…' : 'Quản lý thanh toán'}
                  </button>
                ) : (
                  <button
                    onClick={handleUpgrade}
                    disabled={billingBusy}
                    className="w-full text-xs font-medium bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white rounded-md px-3 py-1.5 transition-colors"
                  >
                    {billingBusy ? '…' : 'Nâng cấp lên Pro'}
                  </button>
                )}
              </div>
              {billingError && <p className="text-[10px] text-amber-400/90 mt-1.5 leading-relaxed">{billingError}</p>}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">
              Đăng nhập để dùng các tính năng trả phí. App vẫn hoạt động đầy đủ ở chế độ offline không cần tài khoản.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-indigo-500/50"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-indigo-500/50"
              />
              {error && <p className="text-[10px] text-amber-400/90 leading-relaxed">{error}</p>}
              <button
                type="submit"
                disabled={busy || !email || !password}
                className="w-full text-xs font-medium bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white rounded-md px-3 py-2 transition-colors"
              >
                {busy ? '…' : mode === 'signIn' ? 'Đăng nhập' : 'Tạo tài khoản'}
              </button>
            </form>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => signInWithOAuth('google')}
                disabled={busy}
                className="flex-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 text-[var(--text-primary)] rounded-md px-3 py-1.5 transition-colors"
              >
                Google
              </button>
              <button
                onClick={() => signInWithOAuth('github')}
                disabled={busy}
                className="flex-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 text-[var(--text-primary)] rounded-md px-3 py-1.5 transition-colors"
              >
                GitHub
              </button>
            </div>

            <button
              onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); clearError() }}
              className="w-full text-center text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-2 transition-colors"
            >
              {mode === 'signIn' ? 'Chưa có tài khoản? Tạo mới' : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
