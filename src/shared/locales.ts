/**
 * Sprint 27 US-206/207 — the 13 languages requested for this app. Kept in
 * `shared/` since both main (locale detection/persistence) and renderer
 * (language picker, useT) need the same list and codes.
 */
export const SUPPORTED_LOCALES = [
  'en', 'ar', 'es', 'fr', 'it', 'ja', 'ko', 'pt-BR', 'ru', 'tr', 'vi', 'zh-Hans', 'zh-Hant'
] as const

export type LocaleCode = typeof SUPPORTED_LOCALES[number]

export const LOCALE_LABELS: Record<LocaleCode, string> = {
  en: 'English',
  ar: 'العربية',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  'pt-BR': 'Português (Brasil)',
  ru: 'Русский',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文'
}

/** Right-to-left languages — used to set `dir="rtl"` at the document root. */
export const RTL_LOCALES: ReadonlySet<LocaleCode> = new Set(['ar'])
