import { Luggage } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SafeImage } from '../components/SafeImage'
import { Badge, Button, buttonClass, ConfirmDialog, cx, EmptyState, ErrorState, Spinner } from '../components/ui'
import { errorMessage, type Trip } from '../contracts'
import { useToast } from '../context/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { formatStay, today } from '../lib/dates'
import { money, plural } from '../lib/format'
import { api } from '../services/api'

type Tab = 'upcoming' | 'past' | 'cancelled'

function tabOf(t: Trip): Tab {
  if (t.status === 'cancelled') return 'cancelled'
  return t.checkOut > today() ? 'upcoming' : 'past'
}

export default function TripsPage() {
  const [params] = useSearchParams()
  const justBooked = params.get('booked')
  const toast = useToast()
  const { data, error, reload, setData } = useAsync(() => api.bookings.myTrips(), [])
  const [tab, setTab] = useState<Tab>('upcoming')
  const [cancelling, setCancelling] = useState<Trip | null>(null)
  const [busy, setBusy] = useState(false)
  const [cancelError, setCancelError] = useState('')

  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (!data) return <Spinner label="Loading your trips" />

  const groups: Record<Tab, Trip[]> = { upcoming: [], past: [], cancelled: [] }
  for (const t of data) groups[tabOf(t)].push(t)
  groups.past.reverse() // most recent first

  const doCancel = async () => {
    if (!cancelling) return
    setBusy(true)
    setCancelError('')
    try {
      const updated = await api.bookings.cancel(cancelling.id)
      setData(data.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
      toast('Your booking is cancelled')
      setCancelling(null)
    } catch (e) {
      setCancelError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const list = groups[tab]

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Trips</h1>

      <div role="tablist" className="mt-6 flex gap-2 border-b border-line">
        {(['upcoming', 'past', 'cancelled'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cx(
              '-mb-px border-b-2 px-3 pb-3 text-sm font-semibold capitalize transition-colors',
              tab === t ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t} <span className="text-muted">({groups[t].length})</span>
          </button>
        ))}
      </div>

      <div className="mt-8">
        {list.length === 0 ? (
          <EmptyState
            icon={Luggage}
            title={tab === 'upcoming' ? 'No trips booked… yet' : tab === 'past' ? 'No past trips' : 'No cancelled trips'}
            body={tab === 'upcoming' ? 'Time to dust off your bags and start planning your next adventure.' : undefined}
            action={
              tab === 'upcoming' && (
                <Link to="/" className={buttonClass('primary')}>
                  Start searching
                </Link>
              )
            }
          />
        ) : (
          <ul className="space-y-4">
            {list.map((t) => {
              const ongoing = t.status === 'confirmed' && t.checkIn <= today() && t.checkOut > today()
              const canCancel = t.status === 'confirmed' && t.checkIn > today()
              return (
                <li
                  key={t.id}
                  className={cx(
                    'flex flex-col overflow-hidden rounded-2xl border bg-white sm:flex-row',
                    t.id === justBooked ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-line',
                  )}
                >
                  <Link to={`/listings/${t.listingId}`} className="shrink-0 sm:w-56">
                    <SafeImage src={t.listing.photos[0]} alt="" className="aspect-[16/10] size-full sm:aspect-auto" />
                  </Link>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-muted">{t.listing.location.city}</p>
                        <Link to={`/listings/${t.listingId}`} className="text-lg font-semibold hover:underline">
                          {t.listing.title}
                        </Link>
                      </div>
                      {t.id === justBooked && <Badge tone="green">Just booked</Badge>}
                      {ongoing && <Badge tone="amber">Happening now</Badge>}
                      {t.status === 'cancelled' && <Badge tone="red">Cancelled</Badge>}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-muted">Dates</dt>
                        <dd className="font-medium">{formatStay(t.checkIn, t.checkOut)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Guests</dt>
                        <dd className="font-medium">{plural(t.guests, 'guest')}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Total paid</dt>
                        <dd className="font-medium">{money(t.total)}</dd>
                      </div>
                    </dl>
                    <p className="text-xs text-muted">Booking ref {t.id.toUpperCase()}</p>
                    {canCancel && (
                      <div className="mt-auto flex justify-end">
                        <Button variant="secondary" size="sm" onClick={() => (setCancelError(''), setCancelling(t))}>
                          Cancel booking
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel this booking?"
        body={cancelling && <>Your stay at {cancelling.listing.title}, {formatStay(cancelling.checkIn, cancelling.checkOut)}, will be cancelled and the dates freed up for other guests.</>}
        confirmLabel="Cancel booking"
        danger
        busy={busy}
        error={cancelError}
        onConfirm={doCancel}
        onClose={() => setCancelling(null)}
      />
    </div>
  )
}
