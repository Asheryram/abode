// Checks every text/background token pair against WCAG 2.2 AA.
// Reads the hex values straight from src/styles/tokens.css, so the check
// cannot drift from the tokens. Run with: npm run check:contrast
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
)

// [foreground, background, minimum ratio]. 4.5 = normal text, 3 = large text or UI parts.
const PAIRS = [
  ['ink', 'canvas', 4.5],
  ['muted', 'canvas', 4.5],
  ['muted', '#ffffff', 4.5],
  ['#ffffff', 'brand-700', 4.5],
  ['brand-700', '#ffffff', 4.5],
  ['brand-700', 'canvas', 4.5],
  ['success-fg', 'success-bg', 4.5],
  ['warning-fg', 'warning-bg', 4.5],
  ['danger-fg', 'danger-bg', 4.5],
  ['#ffffff', 'danger-solid', 4.5],
  ['info-fg', 'info-bg', 4.5],
  ['neutral-fg', 'neutral-bg', 4.5],
  ['promoted-fg', 'promoted-bg', 4.5],
  ['trust-agency-fg', 'trust-agency-bg', 4.5],
  ['trust-owner-fg', 'trust-owner-bg', 4.5],
  ['live', '#ffffff', 4.5],
  ['#ffffff', 'live', 4.5],
  ['#ffffff', 'warning-fg', 4.5],
  ['stale', '#ffffff', 4.5],
  ['stale', 'warning-bg', 4.5],
  // accent-700 is not a text colour on accent-100 (3.5:1). Use warning-fg on warning-bg.
]

const hex = (v) => (v.startsWith('#') ? v : tokens[v])
const lum = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

let failed = 0
for (const [fg, bg, min] of PAIRS) {
  const a = hex(fg)
  const b = hex(bg)
  if (!a || !b) {
    console.error(`✗ unknown token in pair ${fg} on ${bg}`)
    failed++
    continue
  }
  const r = ratio(a, b)
  const ok = r >= min
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${fg} on ${bg}: ${r.toFixed(2)} (needs ${min})`)
}
if (failed) {
  console.error(`\n${failed} pair(s) fail WCAG AA.`)
  process.exit(1)
}
console.log('\nAll pairs pass WCAG AA.')
