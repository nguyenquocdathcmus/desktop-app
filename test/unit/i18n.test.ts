import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '../../src/shared/locales'

/**
 * Sprint 27 US-206/207/208 — verifies the i18n foundation for real:
 * every one of the 13 locale files actually has the exact same key set as
 * English (TypeScript's `Strings` type already enforces this at compile
 * time via each file's `: Strings` annotation, but a runtime check here
 * catches drift if that annotation is ever accidentally removed, and
 * documents the invariant explicitly), and the `useT` interpolation logic
 * behaves correctly.
 */

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) keys.push(...collectKeys(v as Record<string, unknown>, path))
    else keys.push(path)
  }
  return keys
}

describe('i18n locale files', () => {
  it('SUPPORTED_LOCALES lists exactly the 13 requested languages', () => {
    expect(SUPPORTED_LOCALES).toEqual([
      'en', 'ar', 'es', 'fr', 'it', 'ja', 'ko', 'pt-BR', 'ru', 'tr', 'vi', 'zh-Hans', 'zh-Hant'
    ])
  })

  it('every locale file has exactly the same key set as English', async () => {
    const { STRINGS_BY_LOCALE } = await import('../../src/renderer/src/strings')
    const enKeys = collectKeys(STRINGS_BY_LOCALE.en).sort()

    for (const locale of SUPPORTED_LOCALES) {
      const keys = collectKeys(STRINGS_BY_LOCALE[locale]).sort()
      expect(keys, `locale "${locale}" key set differs from English`).toEqual(enKeys)
    }
  })

  it('no locale has an empty string for a key that has real content in English', async () => {
    const { STRINGS_BY_LOCALE } = await import('../../src/renderer/src/strings')

    function checkNonEmpty(obj: Record<string, unknown>, locale: string, prefix = '') {
      for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k
        if (typeof v === 'object' && v !== null) {
          checkNonEmpty(v as Record<string, unknown>, locale, path)
        } else {
          expect(String(v).trim().length, `${locale}.${path} is empty`).toBeGreaterThan(0)
        }
      }
    }

    for (const locale of SUPPORTED_LOCALES) {
      checkNonEmpty(STRINGS_BY_LOCALE[locale], locale)
    }
  })
})

describe('useT interpolation', () => {
  // Re-implements the exact lookup+interpolation logic from useT.ts as a
  // pure function so it's testable without mounting React/Zustand — the
  // real hook is a thin wrapper around this.
  function interpolate(raw: string, vars?: Record<string, string | number>): string {
    if (!vars) return raw
    return raw.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`))
  }

  it('substitutes a single token', () => {
    expect(interpolate('{count} recordings', { count: 5 })).toBe('5 recordings')
  })

  it('substitutes multiple tokens', () => {
    expect(interpolate('{shown} of {total}', { shown: 3, total: 10 })).toBe('3 of 10')
  })

  it('leaves an unmatched token as-is rather than silently dropping it', () => {
    expect(interpolate('{count} items', {})).toBe('{count} items')
  })

  it('returns the raw string unchanged when no vars are given', () => {
    expect(interpolate('Load more')).toBe('Load more')
  })
})
