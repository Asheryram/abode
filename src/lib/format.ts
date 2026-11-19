/** Text formatting shared by screens. Money is formatted only by the design system. */

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

export const formatRating = (r: number) => r.toFixed(2).replace(/0$/, '')

/** Ghana's time zone. Every time shown names its zone (FE-GLB-005). */
export const TIME_ZONE = 'Africa/Accra'

const dateTime = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE, timeZoneName: 'short' })
const timeOnly = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE, timeZoneName: 'short' })
const dateOnly = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE })

/** "Sat 21 Nov, 10:00 GMT" */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
/** "10:00 GMT" */
export const formatTime = (iso: string) => timeOnly.format(new Date(iso))
/** "21 Nov 2026" */
export const formatDate = (iso: string) => dateOnly.format(new Date(iso))

/** "5 min ago", "3 h ago", or the date. */
export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`
  return formatDate(iso)
}

/** A value for <input type="datetime-local"> from an ISO time, in Ghana time (GMT, no daylight saving). */
export const toLocalInput = (iso: string) => new Date(iso).toISOString().slice(0, 16)
/** Back from <input type="datetime-local"> (Ghana time = UTC) to ISO. */
export const fromLocalInput = (v: string) => new Date(`${v}:00Z`).toISOString()
