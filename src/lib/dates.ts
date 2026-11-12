import type { ISODate } from '../contracts'

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar day as `YYYY-MM-DD`. Never goes through UTC, so no off-by-one at midnight. */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isISODate(s: string | null | undefined): s is ISODate {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return toISODate(parseISODate(s)) === s
}

export function today(): ISODate {
  return toISODate(new Date())
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Whole days from `a` to `b`. Rounded, because a DST shift makes a day 23 or 25 hours. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}

/**
 * Do two stays clash? Check-out day is free, so one guest can leave on the
 * morning the next one arrives.
 */
export function staysOverlap(aIn: ISODate, aOut: ISODate, bIn: ISODate, bOut: ISODate): boolean {
  return aIn < bOut && bIn < aOut
}

/** Every night of a stay: check-in up to, but not including, check-out. */
export function nightsOf(checkIn: ISODate, checkOut: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d)
  return out
}

const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const longFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

export const formatShort = (s: ISODate) => shortFmt.format(parseISODate(s))
export const formatLong = (s: ISODate) => longFmt.format(parseISODate(s))
export const formatMonth = (d: Date) => monthFmt.format(d)

/** "12 – 15 Nov 2026", or "28 Nov – 2 Dec 2026" across months. */
export function formatStay(checkIn: ISODate, checkOut: ISODate): string {
  const a = parseISODate(checkIn)
  const b = parseISODate(checkOut)
  if (a.getFullYear() !== b.getFullYear()) return `${formatLong(checkIn)} – ${formatLong(checkOut)}`
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${formatLong(checkOut)}`
  return `${formatShort(checkIn)} – ${formatLong(checkOut)}`
}

/** A stay being picked in the calendar. Either end may still be missing. */
export interface DateRange {
  start?: ISODate
  end?: ISODate
}
