import type { PublishProvider } from './tokenStore'

/**
 * Sprint 21 US-165/166/167 — OAuth client credentials. BLOCKED: these must be
 * real client IDs/secrets registered in the Google Cloud Console (YouTube
 * Data API v3 + Drive API, sharing one OAuth client per the doc's "one
 * consent flow for both" plan) and the Dropbox App Console. No such
 * credentials exist in this environment — every function below throws a
 * clearly-labeled "not configured" error instead of silently no-op'ing, so a
 * developer wiring in real credentials gets a compile-time-obvious list of
 * what to replace (search this file for "REPLACE_ME").
 */
export const GOOGLE_OAUTH_CLIENT_ID = 'REPLACE_ME_GOOGLE_CLIENT_ID'
export const GOOGLE_OAUTH_CLIENT_SECRET = 'REPLACE_ME_GOOGLE_CLIENT_SECRET'
export const DROPBOX_OAUTH_CLIENT_ID = 'REPLACE_ME_DROPBOX_APP_KEY'

/** Scopes the real OAuth consent request would use — youtube and googleDrive
 *  share one Google OAuth client (see connectProvider) so both are requested
 *  together, avoiding a second consent prompt later. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/drive.file'
]

function isConfigured(clientId: string): boolean {
  return !clientId.startsWith('REPLACE_ME')
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: PublishProvider) {
    super(`${provider} is not configured — no OAuth client credentials are set. See src/main/publish/providers.ts.`)
    this.name = 'ProviderNotConfiguredError'
  }
}

/**
 * Opens the OAuth consent flow for Google (YouTube + Drive share one client,
 * per the doc's plan to avoid asking for consent twice) or Dropbox.
 * BLOCKED — throws until real credentials are set above. The intended
 * implementation (documented, not built): a loopback local HTTP server
 * (Google's recommended pattern for installed/desktop apps, avoiding a
 * custom protocol handler racing with the app's own `recordscreen://` deep
 * link from Sprint 15) that receives the redirect with an auth code, then
 * exchanges it server-side (main process) for access+refresh tokens.
 */
export async function connectProvider(provider: PublishProvider): Promise<{ accountLabel: string }> {
  if (provider === 'dropbox') {
    if (!isConfigured(DROPBOX_OAUTH_CLIENT_ID)) throw new ProviderNotConfiguredError(provider)
  } else {
    if (!isConfigured(GOOGLE_OAUTH_CLIENT_ID)) throw new ProviderNotConfiguredError(provider)
    // Real implementation would open a BrowserWindow / loopback server here,
    // requesting consent for GOOGLE_SCOPES above.
  }
  throw new ProviderNotConfiguredError(provider)
}

export interface UploadProgress {
  bytesSent: number
  totalBytes: number
}

export interface UploadResult {
  url: string
}

/**
 * BLOCKED — real implementation would use the YouTube Data API v3 resumable
 * upload endpoint (videos.insert with uploadType=resumable), setting
 * privacyStatus='unlisted' by default per the doc, title from the recording
 * name (Sprint 10), and description from the chapter list text (reusing
 * Sprint 15 US-129's exact formatting function, not new logic).
 */
export async function uploadToYouTube(
  _filePath: string,
  _meta: { title: string; description: string },
  _onProgress: (p: UploadProgress) => void
): Promise<UploadResult> {
  throw new ProviderNotConfiguredError('youtube')
}

/** BLOCKED — real implementation would use the Drive API v3 resumable upload
 *  (files.create with uploadType=resumable), then files.get with
 *  fields=webViewLink for the shareable link returned to the UI. */
export async function uploadToGoogleDrive(
  _filePath: string,
  _onProgress: (p: UploadProgress) => void
): Promise<UploadResult> {
  throw new ProviderNotConfiguredError('googleDrive')
}

/** BLOCKED — real implementation would use the Dropbox API v2
 *  /files/upload_session/* endpoints (chunked, resumable for large 4K
 *  exports per US-171), then /sharing/create_shared_link_with_settings. */
export async function uploadToDropbox(
  _filePath: string,
  _onProgress: (p: UploadProgress) => void
): Promise<UploadResult> {
  throw new ProviderNotConfiguredError('dropbox')
}
