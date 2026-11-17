/**
 * Design directions for stakeholders to compare. The colours live in
 * tokens.css; this list only names them and drives the switcher.
 * Delete this file and the switcher once a direction is chosen.
 */
export type DirectionId = 'forest' | 'coastal' | 'earth'

export interface Direction {
  id: DirectionId
  name: string
  mood: string
  font: string
  /** Primary and accent, for the switcher's swatches only. */
  swatches: [string, string]
}

export const DIRECTIONS: Direction[] = [
  { id: 'forest', name: 'Forest', mood: 'Calm, established, trustworthy', font: 'Plus Jakarta Sans', swatches: ['#0f5c4d', '#f2a541'] },
  { id: 'coastal', name: 'Coastal', mood: 'Fresh, open, professional', font: 'DM Sans', swatches: ['#14487c', '#ef7650'] },
  { id: 'earth', name: 'Earth', mood: 'Warm, local, welcoming', font: 'Outfit', swatches: ['#82361d', '#e0ad2a'] },
]

const KEY = 'abode.direction'

const isDirection = (v: string | null): v is DirectionId => DIRECTIONS.some((d) => d.id === v)

/** A link can force a direction with ?direction=coastal, so each one can be sent on its own. */
export function initialDirection(): DirectionId {
  const fromUrl = new URLSearchParams(window.location.search).get('direction')
  if (isDirection(fromUrl)) return fromUrl
  try {
    const saved = localStorage.getItem(KEY)
    if (isDirection(saved)) return saved
  } catch {
    /* Storage blocked: fall back to the default. */
  }
  return 'forest'
}

export function applyDirection(id: DirectionId) {
  const root = document.documentElement
  if (id === 'forest') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', id)
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', DIRECTIONS.find((d) => d.id === id)!.swatches[0])
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* Not remembered between visits; still applied now. */
  }
}
