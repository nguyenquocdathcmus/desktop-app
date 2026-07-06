import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Sprint 21 US-169 — verifies tokenStore.ts round-trips through
 * safeStorage.encrypt/decryptString and never lands plaintext on disk. Real
 * macOS Keychain-backed encryption can't run in this test environment, so
 * `safeStorage` is mocked with a reversible transform — the property under
 * test is "the file never contains the raw token string", which the mock
 * still genuinely exercises (a passthrough mock would defeat the test).
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

describe('tokenStore', () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'token-store-test-'))
  })

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('saves and reads back a token unchanged', async () => {
    const { saveToken, readToken } = await import('../../src/main/publish/tokenStore')
    saveToken('youtube', { accessToken: 'secret-token-value', accountLabel: 'test@example.com' })
    const result = readToken('youtube')
    expect(result?.accessToken).toBe('secret-token-value')
    expect(result?.accountLabel).toBe('test@example.com')
  })

  it('never stores the raw token string in the file on disk', async () => {
    const { saveToken } = await import('../../src/main/publish/tokenStore')
    const secret = 'super-secret-oauth-token-xyz123'
    saveToken('youtube', { accessToken: secret })
    const filePath = join(userDataDir, 'publish-tokens.enc.json')
    expect(existsSync(filePath)).toBe(true)
    const raw = readFileSync(filePath, 'utf-8')
    expect(raw).not.toContain(secret)
  })

  it('removeToken deletes the file entirely when it was the only provider', async () => {
    const { saveToken, removeToken } = await import('../../src/main/publish/tokenStore')
    saveToken('dropbox', { accessToken: 'x' })
    const filePath = join(userDataDir, 'publish-tokens.enc.json')
    expect(existsSync(filePath)).toBe(true)
    removeToken('dropbox')
    expect(existsSync(filePath)).toBe(false)
  })

  it('removeToken only removes the target provider, keeping others', async () => {
    const { saveToken, removeToken, readToken } = await import('../../src/main/publish/tokenStore')
    saveToken('youtube', { accessToken: 'yt-token' })
    saveToken('dropbox', { accessToken: 'db-token' })
    removeToken('youtube')
    expect(readToken('youtube')).toBeNull()
    expect(readToken('dropbox')?.accessToken).toBe('db-token')
  })

  it('listConnectedProviders reflects saved and removed tokens', async () => {
    const { saveToken, removeToken, listConnectedProviders } = await import('../../src/main/publish/tokenStore')
    expect(listConnectedProviders()).toEqual([])
    saveToken('googleDrive', { accessToken: 'g' })
    expect(listConnectedProviders()).toEqual(['googleDrive'])
    removeToken('googleDrive')
    expect(listConnectedProviders()).toEqual([])
  })
})
