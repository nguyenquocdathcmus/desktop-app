import { en, type Strings } from './en'
import { ar } from './ar'
import { es } from './es'
import { fr } from './fr'
import { it } from './it'
import { ja } from './ja'
import { ko } from './ko'
import { ptBR } from './pt-BR'
import { ru } from './ru'
import { tr } from './tr'
import { vi } from './vi'
import { zhHans } from './zh-Hans'
import { zhHant } from './zh-Hant'
import type { LocaleCode } from '../../../shared/locales'

/** Sprint 27 US-206 — one lookup table for all 13 locale string sets. Every
 *  file is typed against `Strings` (en.ts's shape), so a locale missing a
 *  key is a compile error, not a silent runtime gap. */
export const STRINGS_BY_LOCALE: Record<LocaleCode, Strings> = {
  en,
  ar,
  es,
  fr,
  it,
  ja,
  ko,
  'pt-BR': ptBR,
  ru,
  tr,
  vi,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant
}

export type { Strings }
