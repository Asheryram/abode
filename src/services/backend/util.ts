/** Small helpers shared by the test backend. */

/** Not `crypto.randomUUID`, which is missing outside HTTPS, e.g. on a phone over the LAN. */
export const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/**
 * NOT real security. A real server hashes passwords with something slow like
 * Argon2. This only keeps plain-text passwords out of browser storage.
 */
export function hashPassword(email: string, password: string): string {
  const input = `${email.toLowerCase()}::${password}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

export const isoNow = () => new Date().toISOString()
export const isoIn = (ms: number) => new Date(Date.now() + ms).toISOString()
export const MIN = 60_000
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR

/** A booking reference people can read out on the phone: AB-7KQ2-M9. */
export function bookingReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const pick = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `AB-${pick(4)}-${pick(2)}`
}

/** Integer percentage of an integer amount, rounded half up. Money stays whole. */
export const percentOf = (amountMinor: number, percent: number) => Math.round((amountMinor * percent) / 100)

export const photoUrl = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

/** The test backend answers after a short wait, like a real round trip. */
export const latency = (ms = 180) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))
