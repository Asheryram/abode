/**
 * Money as the API sends it: an integer in the currency's minor unit plus an
 * ISO 4217 code (PLT-019). GH₵ 450.00 arrives as { amountMinor: 45000, currency: 'GHS' }.
 *
 * Rules (FE-GLB-001, FE-GLB-004):
 *   - The client never adds, multiplies or rounds money. It only displays it.
 *   - No floating-point maths: the minor-unit integer is turned into a decimal
 *     string by moving the decimal point, then handed to Intl as a string.
 */

export interface MoneyAmount {
  /** Integer in the currency's minor unit, e.g. pesewas for GHS. */
  amountMinor: number
  /** ISO 4217 code, e.g. 'GHS'. */
  currency: string
}

/** How a price is charged. Always shown beside a headline price (PROP-012). */
export type PriceBasis =
  | 'total'
  | 'per_night'
  | 'per_month'
  | 'per_annum'
  | 'per_sqm_per_annum'

/**
 * Minor-unit digits per currency (PLT-020). Do not assume two decimals.
 * The API should eventually send this; until then this table is the fallback.
 */
const MINOR_DIGITS: Record<string, number> = {
  GHS: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  NGN: 2,
  KES: 2,
  ZAR: 2,
  XOF: 0,
  JPY: 0,
  KWD: 3,
  BHD: 3,
}

export function minorDigits(currency: string): number {
  const digits = MINOR_DIGITS[currency.toUpperCase()]
  if (digits === undefined) throw new Error(`Unknown currency ${currency}: add it to MINOR_DIGITS`)
  return digits
}

/** 45000 with 2 digits → "450.00". Pure string work, no division. */
export function toDecimalString(amountMinor: number, digits: number): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error(`Money must be an integer in minor units, got ${amountMinor}`)
  }
  const negative = amountMinor < 0
  const raw = String(Math.abs(amountMinor)).padStart(digits + 1, '0')
  const whole = digits === 0 ? raw : raw.slice(0, -digits)
  const fraction = digits === 0 ? '' : `.${raw.slice(-digits)}`
  return `${negative ? '-' : ''}${whole}${fraction}`
}

export interface FormatOptions {
  locale?: string
  /** Hide ".00" when the amount is whole, e.g. on search cards. */
  hideZeroFraction?: boolean
}

/** Formats an amount for display, e.g. "GH₵450.00". */
export function formatMoney(amount: MoneyAmount, options: FormatOptions = {}): string {
  const { locale = 'en-GH', hideZeroFraction = false } = options
  const digits = minorDigits(amount.currency)
  const decimal = toDecimalString(amount.amountMinor, digits)
  const isWhole = digits === 0 || /\.0+$/.test(decimal)
  const shownDigits = hideZeroFraction && isWhole ? 0 : digits
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: amount.currency,
    minimumFractionDigits: shownDigits,
    maximumFractionDigits: shownDigits,
  })
  // Intl accepts a decimal string and formats it exactly (no float conversion).
  return formatter.format(decimal as unknown as number)
}
