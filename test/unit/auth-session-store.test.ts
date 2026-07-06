import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Sprint 28 US-212 — mirrors test/unit/token-store.test.ts: verifies
 * sessionStore.ts round-trips through safeStorage.encrypt/decryptString and
 * never lands a readable access/refresh token on disk. Real macOS Keychain
 * encryption can't run in this test environment, so safeStorage is mocked
 * with a reversible transform — the property under test ("the file never
 * contains the raw token string") still holds against this mock.
 */
let userDataDir: string

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(Buffer.from(s, 'utf-8').toString('base64').split('').reverse().join(''), 'utf-8'),
    decryptString: (b: Buffer) => Buffer.from(b.toString('utf-8').split('').reverse().join(''), 'base64').toString('utf-8')
  }
}))

describe('auth sessionStore', () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'auth-session-store-test-'))
  })

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('round-trips a session through save/read', async () => {
    const { saveSession, readSession } = await import('../../src/main/auth/sessionStore')
    const session = {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      expiresAt: Date.now() + 3600_000,
      userId: 'user-1',
      email: 'test@example.com'
    }
    saveSession(session)
    expect(readSession()).toEqual(session)
  })

  it('never writes the raw access or refresh token to disk in plaintext', async () => {
    const { saveSession } = await import('../../src/main/auth/sessionStore')
    saveSession({
      accessToken: 'super-secret-access-token',
      refreshToken: 'super-secret-refresh-token',
      expiresAt: Date.now() + 3600_000,
      userId: 'user-1',
      email: 'test@example.com'
    })
    const raw = readFileSync(join(userDataDir, 'auth-session.enc.json'), 'utf-8')
    expect(raw).not.toContain('super-secret-access-token')
    expect(raw).not.toContain('super-secret-refresh-token')
  })

  it('readSession returns null when no session has been saved', async () => {
    const { readSession } = await import('../../src/main/auth/sessionStore')
    expect(readSession()).toBeNull()
  })

  it('clearSession removes the file so readSession goes back to null', async () => {
    const { saveSession, readSession, clearSession } = await import('../../src/main/auth/sessionStore')
    saveSession({ accessToken: 'a', refreshToken: 'b', expiresAt: Date.now(), userId: 'u', email: 'e@x.com' })
    expect(readSession()).not.toBeNull()
    clearSession()
    expect(readSession()).toBeNull()
    expect(existsSync(join(userDataDir, 'auth-session.enc.json'))).toBe(false)
  })

  it('clearSession is a no-op (does not throw) when no session exists', async () => {
    const { clearSession } = await import('../../src/main/auth/sessionStore')
    expect(() => clearSession()).not.toThrow()
  })
})
