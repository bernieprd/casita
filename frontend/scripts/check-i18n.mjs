#!/usr/bin/env node
/**
 * Checks that every non-English locale file contains exactly the same keys
 * as the English baseline. Exits 1 (and prints missing keys) if any locale
 * is incomplete — so CI catches forgotten translations before they ship.
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = join(__dirname, '../src/locales')
const BASE_LOCALE = 'en'

function flattenKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const full = prefix ? `${prefix}.${key}` : key
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? flattenKeys(value, full)
      : [full]
  })
}

const baseFile = join(LOCALES_DIR, BASE_LOCALE, 'translation.json')
const baseKeys = new Set(flattenKeys(JSON.parse(readFileSync(baseFile, 'utf8'))))

const locales = readdirSync(LOCALES_DIR).filter(d => d !== BASE_LOCALE).sort()
let failed = false

for (const locale of locales) {
  const file = join(LOCALES_DIR, locale, 'translation.json')
  const keys = new Set(flattenKeys(JSON.parse(readFileSync(file, 'utf8'))))

  const missing = [...baseKeys].filter(k => !keys.has(k))
  const extra   = [...keys].filter(k => !baseKeys.has(k))

  if (missing.length > 0) {
    console.error(`\n❌  ${locale} — ${missing.length} key(s) missing:`)
    for (const k of missing) console.error(`     - ${k}`)
    failed = true
  }

  if (extra.length > 0) {
    // Warn but don't fail — extra keys may be intentional locale-specific overrides
    console.warn(`\n⚠️   ${locale} — ${extra.length} key(s) not in English baseline:`)
    for (const k of extra) console.warn(`     + ${k}`)
  }

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✅  ${locale} — all ${keys.size} keys present`)
  }
}

if (failed) {
  console.error(`\nAdd the missing keys above to each locale file and provide translations.`)
  process.exit(1)
} else {
  console.log(`\nAll ${locales.length} locales match the English baseline (${baseKeys.size} keys).`)
}
