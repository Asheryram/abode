/**
 * Pure decisions behind the design-system components, kept apart so they can
 * be unit tested without a browser. No component re-implements these.
 */
import type { ISODate } from '../contracts'

// ── Trust ───────────────────────────────────────────────────────────────────

export type TrustKind = 'agency' | 'owner' | 'unverified'

export interface VerificationSummary {
  /** What the API says was verified (TRU-015). */
  kind: TrustKind
  /** Last day the verification is valid, in the property's calendar. */
  validUntil?: ISODate
}

/**
 * The badge to show. An expired verification shows as unverified (TRU-024),
 * never as the badge it used to earn.
 */
export function resolveTrust(summary: VerificationSummary | undefined, today: ISODate): TrustKind {
  if (!summary || summary.kind === 'unverified') return 'unverified'
  if (summary.validUntil && summary.validUntil < today) return 'unverified'
  return summary.kind
}

// ── Hold countdown ──────────────────────────────────────────────────────────

/**
 * Seconds left on a hold. `remainingAtReceipt` is the time the API returned
 * (BOOK-016); `elapsedMs` is how long ago the client received it, measured
 * with a monotonic clock. The client never trusts its own wall clock for this.
 */
export function secondsLeft(remainingAtReceipt: number, elapsedMs: number): number {
  return Math.max(0, Math.ceil(remainingAtReceipt - elapsedMs / 1000))
}

export const formatClock = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Screen readers hear the countdown only at these moments, not every second
 * (FE-NFR-004): every 5 minutes, then at 2 and 1 minutes left.
 */
export function shouldAnnounce(seconds: number): boolean {
  if (seconds <= 0) return true
  if (seconds % 60 !== 0) return false
  const minutes = seconds / 60
  return minutes <= 2 || minutes % 5 === 0
}

// ── Live location freshness ─────────────────────────────────────────────────

export type Freshness = 'live' | 'stale' | 'unavailable'

/** TRK-031, TRK-034: an old position is marked stale, never shown as current. */
export function freshness(ageSeconds: number | null, staleAfterSeconds: number): Freshness {
  if (ageSeconds === null) return 'unavailable'
  return ageSeconds > staleAfterSeconds ? 'stale' : 'live'
}

export function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.round(minutes / 60)} h`
}
