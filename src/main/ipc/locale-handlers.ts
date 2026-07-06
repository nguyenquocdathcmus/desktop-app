import { IpcMain, app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { SUPPORTED_LOCALES, type LocaleCode } from '../../shared/locales'

function localePath(): string {
  return join(app.getPath('userData'), 'locale.json')
}

/** Sprint 27 US-207 — defaults to the OS locale if it's one of the 13
 *  supported languages, else falls back to English rather than guessing. */
function detectDefaultLocale(): LocaleCode {
  const osLocale = app.getLocale() // e.g. "en-US", "pt-BR", "zh-Hans-CN"
  const normalized = osLocale.toLowerCase()

  // Exact/prefix match against supported codes (handles "pt-BR" -> "pt-BR",
  // "zh-Hans-CN" -> "zh-Hans", "ar-SA" -> "ar", etc.)
  for (const code of SUPPORTED_LOCALES) {
    if (normalized === code.toLowerCase() || normalized.startsWith(code.toLowerCase() + '-')) {
      return code
    }
  }
  // Bare language match (e.g. OS reports "fr" with no region)
  const bareLang = normalized.split('-')[0]
  const match = SUPPORTED_LOCALES.find((code) => code.toLowerCase().split('-')[0] === bareLang)
  return match ?? 'en'
}

export function registerLocaleHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('locale:get', (): LocaleCode => {
    try {
      if (existsSync(localePath())) {
        const saved = JSON.parse(readFileSync(localePath(), 'utf-8')).locale
        if (SUPPORTED_LOCALES.includes(saved)) return saved
      }
    } catch { /* fall through to detection */ }
    return detectDefaultLocale()
  })

  ipcMain.on('locale:set', (_, locale: LocaleCode) => {
    if (!SUPPORTED_LOCALES.includes(locale)) return
    try { writeFileSync(localePath(), JSON.stringify({ locale })) } catch { /* best effort */ }
  })
}
