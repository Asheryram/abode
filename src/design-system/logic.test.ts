import { describe, expect, it } from 'vitest'
import { formatAge, formatClock, freshness, resolveTrust, secondsLeft, shouldAnnounce } from './logic'

describe('resolveTrust', () => {
  const today = '2026-11-17'

  it('shows the verified kind while in date', () => {
    expect(resolveTrust({ kind: 'agency', validUntil: '2027-01-01' }, today)).toBe('agency')
    expect(resolveTrust({ kind: 'owner', validUntil: today }, today)).toBe('owner')
  })

  it('never shows an expired badge (TRU-024)', () => {
    expect(resolveTrust({ kind: 'agency', validUntil: '2026-11-16' }, today)).toBe('unverified')
  })

  it('treats a missing summary as unverified', () => {
    expect(resolveTrust(undefined, today)).toBe('unverified')
  })
})

describe('hold countdown', () => {
  it('counts down from the server value, not the phone clock', () => {
    expect(secondsLeft(900, 0)).toBe(900)
    expect(secondsLeft(900, 1500)).toBe(899)
    expect(secondsLeft(900, 900_000)).toBe(0)
    expect(secondsLeft(900, 2_000_000)).toBe(0)
  })

  it('formats as minutes and seconds', () => {
    expect(formatClock(900)).toBe('15:00')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(0)).toBe('0:00')
  })

  it('announces to screen readers only at set moments', () => {
    expect(shouldAnnounce(600)).toBe(true) // 10 min
    expect(shouldAnnounce(540)).toBe(false) // 9 min
    expect(shouldAnnounce(120)).toBe(true) // 2 min
    expect(shouldAnnounce(60)).toBe(true) // 1 min
    expect(shouldAnnounce(59)).toBe(false)
    expect(shouldAnnounce(0)).toBe(true)
  })
})

describe('location freshness', () => {
  it('marks old positions stale and missing ones unavailable (TRK-031, TRK-034)', () => {
    expect(freshness(10, 60)).toBe('live')
    expect(freshness(61, 60)).toBe('stale')
    expect(freshness(null, 60)).toBe('unavailable')
  })

  it('formats ages', () => {
    expect(formatAge(40)).toBe('40 s')
    expect(formatAge(180)).toBe('3 min')
    expect(formatAge(7200)).toBe('2 h')
  })
})
