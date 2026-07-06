import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

/**
 * Sprint 28 US-212 — persisted Supabase session (access + refresh token),
 * encrypted at rest via `safeStorage` (macOS Keychain-backed). Same pattern
 * as `src/main/publish/tokenStore.ts` for OAuth tokens — a real secret that
 * grants API access on this user's behalf, unlike the plaintext-JSON
 * preference files used elsewhere in the app.
 */
export interface StoredSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  userId: string
  email: string
}

function sessionPath(): string {
  return join(app.getPath('userData'), 'auth-session.enc.json')
}

export function saveSession(session: StoredSession): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level encryption is unavailable — refusing to store the session in plaintext.')
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(session)).toString('base64')
  writeFileSync(sessionPath(), encrypted)
}

export function readSession(): StoredSession | null {
  try {
    if (!existsSync(sessionPath())) return null
    const encrypted = readFileSync(sessionPath(), 'utf-8')
    const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    return JSON.parse(decrypted)
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    unlinkSync(sessionPath())
  } catch {
    /* already gone — fine */
  }
}
