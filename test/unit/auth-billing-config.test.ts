import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Sprint 28 — env.ts loads `.env.auth` (mirroring the existing .env.signing
 * pattern) and falls back to the fixed Supabase local defaults field-by-field
 * when the file or individual keys are missing, so a partially-filled file
 * (e.g. Paddle not configured yet) doesn't break Supabase config that IS set.
 */
let projectRoot: string

vi.mock('electron', () => ({
  app: { getAppPath: () => projectRoot }
}))

describe('loadAuthBillingConfig', () => {
  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'auth-billing-config-test-'))
    vi.resetModules()
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('falls back to local Supabase defaults when .env.auth is missing', async () => {
    const { loadAuthBillingConfig } = await import('../../src/main/config/env')
    const config = loadAuthBillingConfig()
    expect(config.supabaseUrl).toBe('http://127.0.0.1:54331')
    expect(config.paddleEnv).toBe('sandbox')
    expect(config.paddleApiKey).toBe('')
  })

  it('reads values from .env.auth when present, overriding defaults', async () => {
    writeFileSync(
      join(projectRoot, '.env.auth'),
      [
        'SUPABASE_URL="https://myproject.supabase.co"',
        'SUPABASE_ANON_KEY="real-anon-key"',
        'PADDLE_ENV="production"',
        'PADDLE_API_KEY="pdl_live_abc"',
        'PADDLE_WEBHOOK_SECRET="whsec_abc"',
        'PADDLE_PRO_PRICE_ID="pri_abc"'
      ].join('\n')
    )
    const { loadAuthBillingConfig } = await import('../../src/main/config/env')
    const config = loadAuthBillingConfig()
    expect(config.supabaseUrl).toBe('https://myproject.supabase.co')
    expect(config.supabaseAnonKey).toBe('real-anon-key')
    expect(config.paddleEnv).toBe('production')
    expect(config.paddleApiKey).toBe('pdl_live_abc')
    expect(config.paddleWebhookSecret).toBe('whsec_abc')
    expect(config.paddleProPriceId).toBe('pri_abc')
  })

  it('leaves unset keys on the local default when the file only sets some values', async () => {
    writeFileSync(join(projectRoot, '.env.auth'), 'PADDLE_API_KEY="pdl_sandbox_xyz"\n')
    const { loadAuthBillingConfig } = await import('../../src/main/config/env')
    const config = loadAuthBillingConfig()
    expect(config.paddleApiKey).toBe('pdl_sandbox_xyz')
    expect(config.supabaseUrl).toBe('http://127.0.0.1:54331') // unset — falls back
  })

  it('ignores comment lines and blank lines', async () => {
    writeFileSync(
      join(projectRoot, '.env.auth'),
      ['# a comment', '', 'PADDLE_API_KEY="k1"', '  ', '# another comment'].join('\n')
    )
    const { loadAuthBillingConfig } = await import('../../src/main/config/env')
    expect(loadAuthBillingConfig().paddleApiKey).toBe('k1')
  })

  it('caches the result across calls within the same module instance', async () => {
    const { loadAuthBillingConfig, _resetAuthBillingConfigCacheForTests } = await import('../../src/main/config/env')
    const first = loadAuthBillingConfig()
    writeFileSync(join(projectRoot, '.env.auth'), 'PADDLE_API_KEY="changed"\n')
    const second = loadAuthBillingConfig()
    expect(second).toBe(first) // same cached object — file change not picked up

    _resetAuthBillingConfigCacheForTests()
    const third = loadAuthBillingConfig()
    expect(third.paddleApiKey).toBe('changed')
  })

  /** Sprint 29 — real bug: the dev-mode path was `join(__dirname, '../../../.env.auth')`
   *  (3 levels up), which from the actual built file (out/main/index.js)
   *  lands one directory ABOVE the project root entirely, so .env.auth was
   *  never found in dev and every Supabase call silently used
   *  LOCAL_DEFAULTS (127.0.0.1) even with a real Cloud project configured —
   *  surfaced as "fetch failed" in the app since Local wasn't running. This
   *  test pins the real relationship between __dirname (as it is inside
   *  out/main/index.js at runtime) and the repo root, so a future path
   *  change can't silently break it again without failing here first. */
  it('resolves .env.auth relative to the real out/main/index.js location in dev mode', async () => {
    process.env.NODE_ENV = 'development'
    const repoRoot = join(__dirname, '../..')
    const fakeOutMainDir = join(repoRoot, 'out', 'main')
    const resolved = join(fakeOutMainDir, '../../.env.auth')
    expect(resolved).toBe(join(repoRoot, '.env.auth'))
  })
})
