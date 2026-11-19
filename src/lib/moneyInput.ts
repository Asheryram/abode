/**
 * Turning what a person types in a price box into integer minor units, and
 * back. String work only, never floating-point maths (FE-GLB-004).
 */
import { toDecimalString } from '../design-system/money'

/** "1,250.5" → 125050. Returns null when it isn't a valid amount. */
export function parseMinor(input: string, digits = 2): number | null {
  const clean = input.replace(/[,\s]/g, '').replace(/^GH₵|^GHS/i, '')
  if (!/^\d+(\.\d+)?$/.test(clean)) return null
  const [whole, frac = ''] = clean.split('.')
  if (frac.length > digits) return null
  return Number(whole + frac.padEnd(digits, '0'))
}

/** 125050 → "1250.50" for an input box. */
export const minorToInput = (minor: number | undefined, digits = 2) => (minor === undefined || minor === 0 ? '' : toDecimalString(minor, digits))
