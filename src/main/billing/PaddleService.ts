import { createHmac, timingSafeEqual } from 'crypto'
import { loadAuthBillingConfig } from '../config/env'

/**
 * Sprint 28 US-215 — thin Paddle Billing (v2 "Billing" API, not the legacy
 * "Classic" API) wrapper. The desktop app never holds the Paddle API key's
 * write powers beyond creating a checkout link — actual subscription state
 * changes come from Paddle's webhook, handled by the Supabase Edge Function
 * in supabase-project/supabase/functions/paddle-webhook (a real server
 * endpoint with a public URL, which this desktop app is not).
 */

const PADDLE_API_BASE: Record<'sandbox' | 'production', string> = {
  sandbox: 'https://sandbox-api.paddle.com',
  production: 'https://api.paddle.com'
}

/** Sprint 28 US-215 — creates a Paddle "transaction" pre-filled with the
 *  signed-in user's id as custom_data, so the webhook can attribute the
 *  resulting subscription to the right Supabase user without asking the
 *  customer to type anything. Returns the hosted checkout URL to open in
 *  the system browser (same "open externally" pattern as OAuth sign-in). */
export async function createCheckoutUrl(userId: string, userEmail: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const config = loadAuthBillingConfig()
  if (!config.paddleApiKey || !config.paddleProPriceId) {
    return { ok: false, error: 'Paddle chưa được cấu hình — xem docs/SETUP_PADDLE.md' }
  }

  try {
    const res = await fetch(`${PADDLE_API_BASE[config.paddleEnv]}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.paddleApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{ price_id: config.paddleProPriceId, quantity: 1 }],
        customer_email: userEmail,
        custom_data: { supabase_user_id: userId }
      })
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Paddle API error (${res.status}): ${body.slice(0, 300)}` }
    }
    const json = (await res.json()) as { data?: { checkout?: { url?: string } } }
    const url = json.data?.checkout?.url
    if (!url) return { ok: false, error: 'Paddle response had no checkout URL' }
    return { ok: true, url }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Sprint 28 US-217 — Paddle's customer portal, used for the "Manage
 *  billing" button (cancel/update payment method/view invoices) — Paddle
 *  hosts this entirely, the app just needs the customer's portal URL. */
export async function createPortalUrl(paddleCustomerId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const config = loadAuthBillingConfig()
  if (!config.paddleApiKey) return { ok: false, error: 'Paddle chưa được cấu hình — xem docs/SETUP_PADDLE.md' }

  try {
    const res = await fetch(`${PADDLE_API_BASE[config.paddleEnv]}/customers/${paddleCustomerId}/portal-sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.paddleApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Paddle API error (${res.status}): ${body.slice(0, 300)}` }
    }
    const json = (await res.json()) as { data?: { urls?: { general?: { overview?: string } } } }
    const url = json.data?.urls?.general?.overview
    if (!url) return { ok: false, error: 'Paddle response had no portal URL' }
    return { ok: true, url }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Sprint 28 US-217/218 — verifies a Paddle webhook's `Paddle-Signature`
 * header. Exported standalone (not tied to Electron/fetch) so it can run
 * both here (reference implementation, unit-tested) and be ported into the
 * Deno-based Edge Function, which can't import Node's `crypto` module — the
 * Edge Function reimplements this same HMAC-SHA256 check using Web Crypto
 * (see supabase-project/supabase/functions/paddle-webhook/index.ts).
 *
 * Signature format: "ts=<unix_seconds>;h1=<hex_hmac>" — HMAC-SHA256 of
 * `${ts}:${rawBody}` keyed by the webhook secret. Verified against Paddle's
 * documented format: https://developer.paddle.com/webhooks/signature-verification
 */
export function verifyPaddleWebhookSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(';').map((p) => p.split('=') as [string, string])
  )
  const ts = parts.ts
  const h1 = parts.h1
  if (!ts || !h1) return false

  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex')

  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(h1, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
