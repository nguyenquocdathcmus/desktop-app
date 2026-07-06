import { useLocaleStore } from '../store/useLocaleStore'
import { STRINGS_BY_LOCALE } from '../strings'
import { en } from '../strings/en'

/**
 * Sprint 13 US-112 (single-locale lookup) → Sprint 27 US-206 (13 locales,
 * still deliberately NOT a full i18n library — no plurals engine, no ICU
 * message format, just dot-path lookup + `{token}` interpolation, which is
 * all this app's string set actually needs).
 *
 * `path` is a dot-path into the active locale's string tree (e.g.
 * "controlBar.undo"). Falls back to English if the active locale is missing
 * the key (a locale file failing to have every key is a type error at
 * compile time — see strings/index.ts — but this is a defensive runtime
 * fallback in case that ever slips through). Returns the path itself if not
 * found in English either, which fails loudly/visibly in dev.
 */
export function useT() {
  const locale = useLocaleStore((s) => s.locale)
  const strings = STRINGS_BY_LOCALE[locale] ?? en

  return function t(path: string, vars?: Record<string, string | number>): string {
    const parts = path.split('.')

    const lookup = (tree: unknown): string | undefined => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = tree
      for (const part of parts) {
        value = value?.[part]
      }
      return typeof value === 'string' ? value : undefined
    }

    const raw = lookup(strings) ?? lookup(en) ?? path
    if (!vars) return raw
    return raw.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`))
  }
}
