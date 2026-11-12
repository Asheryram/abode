import { Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ISODate, Listing } from '../contracts'
import { formatShort, type DateRange } from '../lib/dates'
import { formatRating, money, plural } from '../lib/format'
import { quoteStay } from '../lib/pricing'
import { Calendar } from './Calendar'
import { Button, Counter, cx } from './ui'

interface Props {
  listing: Listing
  range: DateRange
  onRangeChange(r: DateRange): void
  guests: number
  onGuestsChange(n: number): void
  blocked: ReadonlySet<ISODate>
  onReserve(): void
  /** Why booking is off, e.g. the viewer owns the place. */
  disabledReason?: string
}

export function BookingWidget({ listing, range, onRangeChange, guests, onGuestsChange, blocked, onReserve, disabledReason }: Props) {
  const [picking, setPicking] = useState(false)
  const [guestsOpen, setGuestsOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const quote = range.start && range.end ? quoteStay(listing, range.start, range.end) : null

  useEffect(() => {
    if (!picking && !guestsOpen) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setPicking(false)
        setGuestsOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPicking(false)
        setGuestsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [picking, guestsOpen])

  const dateBox = 'flex flex-col items-start px-3.5 py-2.5 text-left'

  return (
    <div ref={root} className="relative rounded-2xl border border-line bg-white p-6 shadow-[0_6px_24px_rgba(0,0,0,0.08)]">
      <div className="flex items-baseline justify-between gap-2">
        <p>
          <span className="text-2xl font-bold">{money(listing.pricePerNight)}</span> <span className="text-muted">night</span>
        </p>
        {listing.rating !== null && (
          <p className="flex items-center gap-1 text-sm">
            <Star className="size-3.5 fill-current" aria-hidden />
            <span className="font-semibold">{formatRating(listing.rating)}</span>
            <span className="text-muted">· {plural(listing.reviewCount, 'review')}</span>
          </p>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-ink/30">
        <div className="grid grid-cols-2 divide-x divide-ink/30">
          <button type="button" className={dateBox} onClick={() => (setPicking((p) => !p), setGuestsOpen(false))} aria-expanded={picking}>
            <span className="text-[10px] font-bold tracking-wide uppercase">Check-in</span>
            <span className={cx('text-sm', !range.start && 'text-muted')}>{range.start ? formatShort(range.start) : 'Add date'}</span>
          </button>
          <button type="button" className={dateBox} onClick={() => (setPicking((p) => !p), setGuestsOpen(false))} aria-expanded={picking}>
            <span className="text-[10px] font-bold tracking-wide uppercase">Checkout</span>
            <span className={cx('text-sm', !range.end && 'text-muted')}>{range.end ? formatShort(range.end) : 'Add date'}</span>
          </button>
        </div>
        <button
          type="button"
          className={cx(dateBox, 'w-full border-t border-ink/30')}
          onClick={() => (setGuestsOpen((o) => !o), setPicking(false))}
          aria-expanded={guestsOpen}
        >
          <span className="text-[10px] font-bold tracking-wide uppercase">Guests</span>
          <span className="text-sm">{plural(guests, 'guest')}</span>
        </button>
      </div>

      {guestsOpen && (
        <div className="absolute inset-x-6 z-20 mt-1 rounded-2xl border border-line bg-white px-5 py-2 shadow-xl">
          <Counter label="Guests" hint={`This place fits up to ${listing.maxGuests}.`} value={guests} min={1} max={listing.maxGuests} onChange={onGuestsChange} />
          <div className="flex justify-end pb-2">
            <button type="button" className="text-sm font-semibold underline underline-offset-4" onClick={() => setGuestsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {picking && (
        <div className="absolute top-24 right-0 z-20 w-[min(680px,calc(100vw-2rem))] rounded-3xl border border-line bg-white p-6 shadow-2xl">
          <p className="mb-4 font-semibold">{range.start && !range.end ? 'Now pick your checkout date' : 'Pick your check-in date'}</p>
          <Calendar
            range={range}
            blocked={blocked}
            onChange={(r) => {
              onRangeChange(r)
              if (r.start && r.end) setPicking(false)
            }}
          />
        </div>
      )}

      {disabledReason ? (
        <p className="mt-4 rounded-xl bg-stone-100 px-4 py-3 text-center text-sm text-muted">{disabledReason}</p>
      ) : (
        <Button size="lg" className="mt-4 w-full" onClick={quote ? onReserve : () => setPicking(true)}>
          {quote ? 'Reserve' : 'Check availability'}
        </Button>
      )}

      {quote && (
        <>
          <p className="mt-3 text-center text-sm text-muted">You won’t be charged yet</p>
          <PriceBreakdown quote={quote} className="mt-5" />
        </>
      )}
    </div>
  )
}

export function PriceBreakdown({ quote, className }: { quote: ReturnType<typeof quoteStay>; className?: string }) {
  return (
    <dl className={cx('space-y-3 text-[15px]', className)}>
      <div className="flex justify-between">
        <dt className="text-muted">
          {money(quote.pricePerNight)} × {plural(quote.nights, 'night')}
        </dt>
        <dd>{money(quote.subtotal)}</dd>
      </div>
      {quote.cleaningFee > 0 && (
        <div className="flex justify-between">
          <dt className="text-muted">Cleaning fee</dt>
          <dd>{money(quote.cleaningFee)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-muted">Service fee</dt>
        <dd>{money(quote.serviceFee)}</dd>
      </div>
      <div className="flex justify-between border-t border-line pt-4 font-bold">
        <dt>Total</dt>
        <dd>{money(quote.total)}</dd>
      </div>
    </dl>
  )
}
