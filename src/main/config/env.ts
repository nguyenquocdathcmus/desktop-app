import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/**
 * Sprint 28 — minimal .env loader for auth/billing config, mirroring the
 * existing `.env.signing` pattern (a plain KEY="value" file, sourced by
 * `package.json`'s package:signed script) rather than adding a dependency
 * like dotenv for four config values. Loaded once at startup in main/index.ts,
 * before registerAuthHandlers/registerBillingHandlers need these values.
 */

interface AuthBillingConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  paddleEnv: 'sandbox' | 'production'
  paddleApiKey: string
  paddleWebhookSecret: string
  paddleProPriceId: string
}

// Same fixed local values `supabase start` always prints for the Docker
// stack — verified stable across restarts on this machine (derived from the
// project's local seed config, not randomly generated per-run) — safe to
// ship as a default since they only ever work against 127.0.0.1, never a
// real remote project. See .env.auth.example. Uses the new
// sb_publishable_.../sb_secret_... key format (Supabase CLI ≥2.7x) rather
// than the older anon/service_role JWTs — supabase-js accepts either.
const LOCAL_DEFAULTS: AuthBillingConfig = {
  supabaseUrl: 'http://127.0.0.1:54331',
  supabaseAnonKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  paddleEnv: 'sandbox',
  paddleApiKey: '',
  paddleWebhookSecret: '',
  paddleProPriceId: ''
}

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const raw = readFileSync(path, 'utf-8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      out[key] = value
    }
  } catch {
    // No .env.auth — fall back to defaults entirely.
  }
  return out
}

let cached: AuthBillingConfig | null = null

/** Reads `.env.auth` from the project root in dev, or next to the packaged
 *  app in production. Missing file/keys fall back to LOCAL_DEFAULTS field by
 *  field, so a partially-filled file (e.g. Supabase configured, Paddle not
 *  yet) still works for the parts that are set. */
export function loadAuthBillingConfig(): AuthBillingConfig {
  if (cached) return cached

  const isDev = process.env.NODE_ENV === 'development'
  // Sprint 29 — this was '../../../.env.auth' (3 levels up), which from the
  // built out/main/index.js lands one directory ABOVE the project root
  // entirely (out/main -> out -> <root> -> <root's parent>). existsSync()
  // on that wrong path silently failed, so this always fell back to
  // LOCAL_DEFAULTS regardless of what was in .env.auth — confirmed by
  // running the exact join() call against the real build output path.
  // Only 2 levels up (out/main -> out -> <root>) reaches the real file.
  const envPath = isDev
    ? join(__dirname, '../../.env.auth')
    : join(process.resourcesPath ?? app.getAppPath(), '.env.auth')

  const parsed = existsSync(envPath) ? parseEnvFile(envPath) : {}

  cached = {
    supabaseUrl: parsed.SUPABASE_URL || LOCAL_DEFAULTS.supabaseUrl,
    supabaseAnonKey: parsed.SUPABASE_ANON_KEY || LOCAL_DEFAULTS.supabaseAnonKey,
    paddleEnv: (parsed.PADDLE_ENV as 'sandbox' | 'production') || LOCAL_DEFAULTS.paddleEnv,
    paddleApiKey: parsed.PADDLE_API_KEY || LOCAL_DEFAULTS.paddleApiKey,
    paddleWebhookSecret: parsed.PADDLE_WEBHOOK_SECRET || LOCAL_DEFAULTS.paddleWebhookSecret,
    paddleProPriceId: parsed.PADDLE_PRO_PRICE_ID || LOCAL_DEFAULTS.paddleProPriceId
  }
  return cached
}

/** Test-only escape hatch — clears the module-level cache so a test can call
 *  loadAuthBillingConfig() again after changing process.env/mocking fs. */
export function _resetAuthBillingConfigCacheForTests(): void {
  cached = null
}
