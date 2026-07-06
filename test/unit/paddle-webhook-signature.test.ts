import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifyPaddleWebhookSignature } from '../../src/main/billing/PaddleService'

/**
 * Sprint 28 US-218 — verifies the HMAC-SHA256 "ts=...;h1=..." signature
 * format against real crypto (not mocked), matching Paddle's documented
 * scheme: https://developer.paddle.com/webhooks/signature-verification.
 * The Edge Function (paddle-webhook/index.ts) reimplements the same
 * algorithm with Web Crypto since Deno can't import Node's `crypto` —
 * these tests pin the reference behavior both must agree on.
 */
function sign(rawBody: string, secret: string, ts = '1700000000'): string {
  const h1 = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex')
  return `ts=${ts};h1=${h1}`
}

describe('verifyPaddleWebhookSignature', () => {
  const secret = 'whsec_test_secret'
  const body = JSON.stringify({ event_type: 'subscription.activated', data: { id: 'sub_1' } })

  it('accepts a correctly signed payload', () => {
    expect(verifyPaddleWebhookSignature(body, sign(body, secret), secret)).toBe(true)
  })

  it('rejects a payload signed with the wrong secret', () => {
    expect(verifyPaddleWebhookSignature(body, sign(body, 'wrong_secret'), secret)).toBe(false)
  })

  it('rejects a tampered body (signature no longer matches)', () => {
    const signature = sign(body, secret)
    const tamperedBody = JSON.stringify({ event_type: 'subscription.activated', data: { id: 'sub_EVIL' } })
    expect(verifyPaddleWebhookSignature(tamperedBody, signature, secret)).toBe(false)
  })

  it('rejects a malformed header missing h1', () => {
    expect(verifyPaddleWebhookSignature(body, 'ts=1700000000', secret)).toBe(false)
  })

  it('rejects a malformed header missing ts', () => {
    expect(verifyPaddleWebhookSignature(body, 'h1=deadbeef', secret)).toBe(false)
  })

  it('rejects an empty signature header', () => {
    expect(verifyPaddleWebhookSignature(body, '', secret)).toBe(false)
  })

  it('rejects a signature of the wrong length without throwing', () => {
    expect(verifyPaddleWebhookSignature(body, 'ts=1700000000;h1=abcd', secret)).toBe(false)
  })
})
