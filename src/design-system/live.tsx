/**
 * Time-sensitive components: the hold countdown and live location display.
 */
import { CircleAlert, LocateFixed, LocateOff, Navigation, Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatAge, formatClock, freshness, secondsLeft, shouldAnnounce } from './logic'
import { Button, cx } from './primitives'
import { ds } from './strings'

// ── Hold countdown ──────────────────────────────────────────────────────────

/**
 * Counts down a hold from the time the API returned (BOOK-016), using a
 * monotonic clock, so a wrong phone clock cannot change it. The visible
 * timer ticks every second; screen readers are told only at set moments.
 */
export function HoldCountdown({ remainingSeconds, onExpire }: { remainingSeconds: number; onExpire?: () => void }) {
  const receivedAt = useRef(performance.now())
  const [left, setLeft] = useState(remainingSeconds)
  const [announcement, setAnnouncement] = useState('')
  const expired = useRef(false)

  useEffect(() => {
    receivedAt.current = performance.now()
    expired.current = false
    setLeft(remainingSeconds)
  }, [remainingSeconds])

  useEffect(() => {
    const tick = () => {
      const s = secondsLeft(remainingSeconds, performance.now() - receivedAt.current)
      setLeft(s)
      if (shouldAnnounce(s)) setAnnouncement(s === 0 ? ds.countdown.expired : ds.countdown.srMinutes(s / 60))
      if (s === 0 && !expired.current) {
        expired.current = true
        onExpire?.()
      }
    }
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [remainingSeconds, onExpire])

  const urgent = left > 0 && left <= 120
  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold',
        left === 0
          ? 'border-danger-border bg-danger-bg text-danger-fg'
          : urgent
            ? 'border-warning-border bg-warning-bg text-warning-fg'
            : 'border-info-border bg-info-bg text-info-fg',
      )}
    >
      <Timer className="size-4 shrink-0" aria-hidden />
      <span aria-hidden className="tabular-nums">
        {left === 0 ? ds.countdown.expired : ds.countdown.held(formatClock(left))}
      </span>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}

// ── Live location ───────────────────────────────────────────────────────────

/**
 * Shows how fresh a shared position is (TRK-031 to TRK-034). Pass
 * `ageSeconds = null` when location is unavailable, denied or off.
 */
export function LocationFreshness({
  ageSeconds,
  staleAfterSeconds = 60,
  lowAccuracy = false,
}: {
  ageSeconds: number | null
  staleAfterSeconds?: number
  lowAccuracy?: boolean
}) {
  const state = freshness(ageSeconds, staleAfterSeconds)
  if (state === 'unavailable') {
    return (
      <p className="flex items-center gap-2 text-sm text-neutral-fg">
        <LocateOff className="size-4 shrink-0" aria-hidden />
        {ds.location.unavailable}
      </p>
    )
  }
  const age = formatAge(ageSeconds ?? 0)
  return (
    <p className={cx('flex flex-wrap items-center gap-2 text-sm', state === 'stale' ? 'text-stale' : 'text-live')}>
      {state === 'stale' ? <CircleAlert className="size-4 shrink-0" aria-hidden /> : <LocateFixed className="size-4 shrink-0" aria-hidden />}
      <span className={cx(state === 'stale' && 'font-semibold')}>
        {state === 'stale' ? ds.location.stale(age) : ds.location.updated(age)}
      </span>
      {lowAccuracy && (
        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning-fg">{ds.location.lowAccuracy}</span>
      )}
    </p>
  )
}

/** ETA as a range with its basis, never a promise (TRK-033). */
export function EtaRange({ minMinutes, maxMinutes, basis }: { minMinutes: number; maxMinutes: number; basis: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 font-semibold">
        <Navigation className="size-4 text-live" aria-hidden />
        {ds.location.eta(minMinutes, maxMinutes)}
      </p>
      <p className="mt-0.5 text-xs text-muted">{ds.location.etaBasis(basis)}</p>
    </div>
  )
}

/**
 * Shown on every screen while the user is sharing location (TRK-023): that it
 * is on, who can see it, when it stops, and a one-tap stop (TRK-021).
 */
export function SharingBanner({
  visibleTo,
  stopsAt,
  onStop,
  stopping,
}: {
  visibleTo: string[]
  /** Already formatted with its time zone named, e.g. "15:40 GMT". */
  stopsAt: string
  onStop(): void
  stopping?: boolean
}) {
  return (
    <div role="region" aria-label={ds.sharing.active} className="sticky top-0 z-40 bg-live text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-start gap-2.5">
          <span className="relative mt-1.5 flex size-2.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-white" />
          </span>
          <div className="text-sm">
            <p className="font-semibold">{ds.sharing.active}</p>
            <p className="text-white/90">
              {ds.sharing.with(visibleTo.join(', '))} · {ds.sharing.until(stopsAt)}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onStop} loading={stopping}>
          {ds.sharing.stop}
        </Button>
      </div>
    </div>
  )
}
