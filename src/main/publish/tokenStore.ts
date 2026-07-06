import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

/**
 * Sprint 21 US-169 — encrypted token storage. Unlike presets.json/templates.json
 * (user preferences, fine as plaintext), OAuth tokens are real secrets, so this
 * uses Electron's `safeStorage` (backed by macOS Keychain) rather than the
 * plaintext-JSON pattern used everywhere else in the app. This module works
 * today with no real OAuth provider wired up — it's exercised directly by
 * `test/unit/token-store.test.ts` by encrypting/decrypting a fake token.
 */
export type PublishProvider = 'youtube' | 'googleDrive' | 'dropbox'

interface StoredToken {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  accountLabel?: string
}

function tokensPath(): string {
  return join(app.getPath('userData'), 'publish-tokens.enc.json')
}

function readAll(): Record<string, string> {
  try {
    if (!existsSync(tokensPath())) return {}
    return JSON.parse(readFileSync(tokensPath(), 'utf-8'))
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, string>): void {
  writeFileSync(tokensPath(), JSON.stringify(data))
}

export function saveToken(provider: PublishProvider, token: StoredToken): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level encryption is unavailable — refusing to store a token in plaintext.')
  }
  const all = readAll()
  all[provider] = safeStorage.encryptString(JSON.stringify(token)).toString('base64')
  writeAll(all)
}

export function readToken(provider: PublishProvider): StoredToken | null {
  const all = readAll()
  const encoded = all[provider]
  if (!encoded) return null
  try {
    const decrypted = safeStorage.decryptString(Buffer.from(encoded, 'base64'))
    return JSON.parse(decrypted)
  } catch {
    return null
  }
}

export function removeToken(provider: PublishProvider): void {
  const all = readAll()
  delete all[provider]
  if (Object.keys(all).length === 0) {
    if (existsSync(tokensPath())) unlinkSync(tokensPath())
  } else {
    writeAll(all)
  }
}

export function listConnectedProviders(): PublishProvider[] {
  const all = readAll()
  return (Object.keys(all) as PublishProvider[]).filter((p) => readToken(p) !== null)
}
