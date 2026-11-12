import { CURRENCY_SYMBOL } from '../config'

const number = new Intl.NumberFormat('en-GH', { maximumFractionDigits: 0 })

export const money = (amount: number) => `${CURRENCY_SYMBOL}${number.format(Math.round(amount))}`

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

export const memberSince = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(iso))

export const formatRating = (r: number) => r.toFixed(2).replace(/0$/, '')
