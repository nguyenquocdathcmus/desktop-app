import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { loadAuthBillingConfig } from '../config/env'
import { saveSession, readSession, clearSession, type StoredSession } from './sessionStore'

export type AuthStatus =
  | { state: 'signedOut' }
  | { state: 'signedIn'; user: { id: string; email: string } }

/** Sprint 28 US-213 — the Supabase JS client's PKCE flow reads/writes the
 *  code_verifier through its configured `storage` adapter (see
 *  node_modules/@supabase/auth-js GoTrueClient — `getCodeChallengeAndMethod`
 *  and `_exchangeCodeForSession` both go through `this.storage`), not a
 *  parameter you can pass around yourself. There's no `localStorage` in the
 *  main process, so this is a trivial in-memory Map standing in for it —
 *  it only needs to survive the few seconds between opening the system
 *  browser and the `recordscreen://auth-callback` deep link firing. */
class MemoryStorage {
  private map = new Map<string, string>()
  getItem(key: string): string | null { return this.map.get(key) ?? null }
  setItem(key: string, value: string): void { this.map.set(key, value) }
  removeItem(key: string): void { this.map.delete(key) }
}

/**
 * Thin wrapper around the Supabase JS client, run entirely in the main
 * process. Renderer never touches the Supabase client or a raw token
 * directly — it goes through IPC (auth-handlers.ts) and only ever sees
 * `AuthStatus`, matching the existing RecordingSession pattern (status
 * object + subscribable callbacks) rather than inventing a new shape.
 *
 * Multiple callback subscribers: RecordingSession.onStatusChange had a real
 * bug (Sprint 23) where a second `.onStatusChange()` caller silently
 * overwrote the first because it was a single optional field. Using an array
 * from the start here avoids repeating that mistake once more than one
 * consumer (e.g. main-process billing gate + renderer broadcaster) subscribes.
 */
class AuthService {
  private client: SupabaseClient
  private _status: AuthStatus = { state: 'signedOut' }
  private _listeners: Array<(status: AuthStatus) => void> = []

  constructor() {
    const config = loadAuthBillingConfig()
    this.client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        storage: new MemoryStorage(),
        persistSession: false, // we persist ourselves via safeStorage, not the storage adapter above
        autoRefreshToken: false, // we drive refresh explicitly (see restoreSession)
        detectSessionInUrl: false
      },
      // supabase-js always constructs a RealtimeClient in its constructor
      // (even though this app never subscribes to a realtime channel), and
      // that client throws immediately on Node < 22 / older Electron
      // (Chromium's bundled Node) without a WebSocket constructor supplied —
      // verified by hitting this exact crash running AuthService against
      // this Electron version's bundled Node before adding the `ws` package
      // here. `ws` costs nothing at runtime since no channel is ever opened.
      realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket }
    })
  }

  get status(): AuthStatus {
    return this._status
  }

  onStatusChange(cb: (status: AuthStatus) => void): void {
    this._listeners.push(cb)
  }

  private setStatus(status: AuthStatus): void {
    this._status = status
    for (const cb of this._listeners) cb(status)
  }

  /** Called once at app startup — restores a previously saved session
   *  (if any) and refreshes it if the access token has expired, so the user
   *  doesn't have to sign in again every launch. */
  async restoreSession(): Promise<void> {
    const stored = readSession()
    if (!stored) return

    if (Date.now() < stored.expiresAt - 60_000) {
      this.setStatus({ state: 'signedIn', user: { id: stored.userId, email: stored.email } })
      return
    }

    const refreshed = await this.refreshStoredSession(stored)
    if (!refreshed) this.setStatus({ state: 'signedOut' })
  }

  /** Sprint 29 BUG-03 — shared by restoreSession() (app boot) and
   *  getValidAccessToken() (every subsequent billing call). Returns the new
   *  access token on success, or null (and clears the stored session) if the
   *  refresh token itself is no longer valid — e.g. it was revoked, or the
   *  user hasn't opened the app in longer than Supabase's refresh token
   *  lifetime. */
  private async refreshStoredSession(stored: StoredSession): Promise<string | null> {
    const { data, error } = await this.client.auth.refreshSession({ refresh_token: stored.refreshToken })
    if (error || !data.session) {
      clearSession()
      return null
    }
    this.persistAndSetSignedIn(data.session)
    return data.session.access_token
  }

  private persistAndSetSignedIn(session: { access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string } }): void {
    const stored: StoredSession = {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ? session.expires_at * 1000 : Date.now() + 3600_000,
      userId: session.user.id,
      email: session.user.email ?? ''
    }
    saveSession(stored)
    this.setStatus({ state: 'signedIn', user: { id: stored.userId, email: stored.email } })
  }

  async signUpWithPassword(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { data, error } = await this.client.auth.signUp({ email, password })
    if (error) return { ok: false, error: error.message }
    // Email confirmation may be required (depends on Supabase project
    // settings) — in that case data.session is null until the user confirms.
    if (data.session) this.persistAndSetSignedIn(data.session)
    return { ok: true }
  }

  async signInWithPassword(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password })
    if (error || !data.session) return { ok: false, error: error?.message ?? 'Sign-in failed' }
    this.persistAndSetSignedIn(data.session)
    return { ok: true }
  }

  /** Sprint 28 US-213 — builds the URL to open in the system browser for an
   *  OAuth provider. `skipBrowserRedirect` stops the SDK from trying
   *  `window.location` (no DOM in main); it still generates and stores the
   *  PKCE verifier via MemoryStorage above, which `exchangeCodeForSession`
   *  reads back once `recordscreen://auth-callback` delivers the code. */
  async buildOAuthUrl(provider: 'google' | 'github'): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: 'recordscreen://auth-callback', skipBrowserRedirect: true }
    })
    if (error || !data.url) return { ok: false, error: error?.message ?? 'Could not start OAuth sign-in' }
    return { ok: true, url: data.url }
  }

  async completeOAuthFromCallback(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { data, error } = await this.client.auth.exchangeCodeForSession(code)
    if (error || !data.session) return { ok: false, error: error?.message ?? 'OAuth exchange failed' }
    this.persistAndSetSignedIn(data.session)
    return { ok: true }
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut().catch(() => {})
    clearSession()
    this.setStatus({ state: 'signedOut' })
  }

  /** Sprint 29 BUG-03 — used to be `getAccessToken()`, a synchronous read
   *  that returned whatever was on disk with no expiry check. Supabase access
   *  tokens are short-lived (~1h) and `autoRefreshToken: false` means nothing
   *  else in this app refreshes them in the background — restoreSession()
   *  only runs once, at app boot. Any billing call made more than ~1h into
   *  an app session (easy for a screen-recording app left open) sent a stale
   *  token, which Supabase silently rejects at the RLS layer; billing-handlers
   *  only destructured `data` (never checked `error`), so a Pro subscriber
   *  saw themselves downgraded to "Free" with no error shown anywhere.
   *  Now async: refreshes first if the stored token is within 60s of expiry
   *  or already past it, same threshold restoreSession() uses. */
  async getValidAccessToken(): Promise<string | null> {
    const stored = readSession()
    if (!stored) return null
    if (Date.now() < stored.expiresAt - 60_000) return stored.accessToken
    return this.refreshStoredSession(stored)
  }

  getSupabaseClient(): SupabaseClient {
    return this.client
  }
}

export const authService = new AuthService()
