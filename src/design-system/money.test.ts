import { describe, expect, it } from 'vitest'
import { formatMoney, minorDigits, toDecimalString } from './money'

describe('toDecimalString', () => {
  it('moves the decimal point without floating-point maths', () => {
    expect(toDecimalString(45000, 2)).toBe('450.00')
    expect(toDecimalString(5, 2)).toBe('0.05')
    expect(toDecimalString(0, 2)).toBe('0.00')
    expect(toDecimalString(-1999, 2)).toBe('-19.99')
    expect(toDecimalString(1500, 0)).toBe('1500')
    expect(toDecimalString(1234, 3)).toBe('1.234')
  })

  it('keeps cents exact where float division would not', () => {
    // 0.1 + 0.2 style errors: 29 / 100 is fine, but 1.005 * 100 is not.
    expect(toDecimalString(100500, 2)).toBe('1005.00')
    expect(toDecimalString(9007199254740991, 2)).toBe('90071992547409.91')
  })

  it('refuses anything that is not an integer in minor units', () => {
    expect(() => toDecimalString(450.5, 2)).toThrow()
    expect(() => toDecimalString(Number.NaN, 2)).toThrow()
  })
})

describe('minorDigits', () => {
  it('does not assume two decimals', () => {
    expect(minorDigits('GHS')).toBe(2)
    expect(minorDigits('XOF')).toBe(0)
    expect(minorDigits('KWD')).toBe(3)
  })

  it('fails loudly on an unknown currency', () => {
    expect(() => minorDigits('ZZZ')).toThrow(/Unknown currency/)
  })
})

describe('formatMoney', () => {
  it('formats cedis from pesewas', () => {
    const out = formatMoney({ amountMinor: 45000, currency: 'GHS' })
    expect(out).toContain('450.00')
    expect(out).toMatch(/GH₵|GHS/)
  })

  it('groups thousands', () => {
    expect(formatMoney({ amountMinor: 123456789, currency: 'GHS' })).toContain('1,234,567.89')
  })

  it('can hide a zero fraction for search cards, but never a real one', () => {
    expect(formatMoney({ amountMinor: 45000, currency: 'GHS' }, { hideZeroFraction: true })).not.toContain('.00')
    expect(formatMoney({ amountMinor: 45050, currency: 'GHS' }, { hideZeroFraction: true })).toContain('450.50')
  })

  it('formats currencies with no minor unit', () => {
    expect(formatMoney({ amountMinor: 1500, currency: 'XOF' })).toMatch(/1,500|1 500|1 500/)
  })
})
