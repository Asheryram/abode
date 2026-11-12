import { CalendarCheck, Camera, ClipboardList, Eye, House, PencilLine, Plus, Rocket, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SafeImage } from '../../components/SafeImage'
import { Avatar, Badge, Button, buttonClass, ConfirmDialog, cx, EmptyState, ErrorState, Spinner } from '../../components/ui'
import { BRAND } from '../../config'
import { errorMessage, type Listing, type ListingStatus, type Reservation } from '../../contracts'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { diffDays, formatStay, today } from '../../lib/dates'
import { money, plural } from '../../lib/format'
import { api } from '../../services/api'

/** What the host takes home: everything but the platform's service fee. */
const payout = (r: Reservation) => r.total - r.serviceFee

export default function HostDashboard() {
  const listings = useAsync(() => api.hosting.myListings(), [])
  const reservations = useAsync(() => api.hosting.reservations(), [])

  const error = listings.error ?? reservations.error
  if (error && (!listings.data || !reservations.data)) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          listings.reload()
          reservations.reload()
        }}
      />
    )
  }
  if (!listings.data || !reservations.data) return <Spinner label="Loading your hosting dashboard" />
  if (listings.data.length === 0) return <HostOnboarding />

  return (
    <Dashboard
      listings={listings.data}
      reservations={reservations.data}
      onListingsChange={listings.setData}
    />
  )
}

function HostOnboarding() {
  const steps = [
    { icon: ClipboardList, title: 'Tell us about your place', body: 'What kind of place it is, where it is, and how many guests it fits.' },
    { icon: Camera, title: 'Make it stand out', body: 'Add a few photos, a title and a description that sells it.' },
    { icon: Rocket, title: 'Set a price and publish', body: 'Choose your nightly rate, check everything over and go live.' },
  ]
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 md:py-20 lg:grid-cols-2 lg:px-8">
      <div>
        <p className="font-semibold text-brand-700">Hosting on {BRAND}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-balance md:text-5xl">
          Your place could be earning while you’re away
        </h1>
        <p className="mt-4 text-lg text-muted">
          List a spare room, an apartment or a whole house. You set the price and the rules, and it’s free to list.
        </p>
        <Link to="/host/listings/new" className={buttonClass('primary', 'lg', 'mt-8')}>
          <Plus className="size-5" aria-hidden /> Get started
        </Link>
      </div>
      <ol className="space-y-6">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="flex gap-5 rounded-3xl border border-line bg-white p-6">
            <span className="text-2xl font-bold text-brand-700">{i + 1}</span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-muted">{body}</p>
            </div>
            <Icon className="size-10 shrink-0 text-brand-600" strokeWidth={1.25} aria-hidden />
          </li>
        ))}
      </ol>
    </div>
  )
}

type Tab = 'reservations' | 'listings'
type ResFilter = 'upcoming' | 'past' | 'cancelled'

function Dashboard({
  listings,
  reservations,
  onListingsChange,
}: {
  listings: Listing[]
  reservations: Reservation[]
  onListingsChange(l: Listing[]): void
}) {
  const { user } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'listings' ? 'listings' : 'reservations'
  const [filter, setFilter] = useState<ResFilter>('upcoming')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Listing | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const t = today()
  const confirmed = reservations.filter((r) => r.status === 'confirmed')
  const upcoming = confirmed.filter((r) => r.checkOut > t)
  const past = confirmed.filter((r) => r.checkOut <= t).reverse()
  const cancelled = reservations.filter((r) => r.status === 'cancelled')
  const shown = { upcoming, past, cancelled }[filter]

  const stats = [
    { label: 'Live listings', value: String(listings.filter((l) => l.status === 'listed').length) },
    { label: 'Upcoming stays', value: String(upcoming.length) },
    { label: 'Earned so far', value: money(past.reduce((s, r) => s + payout(r), 0)) },
    { label: 'Coming in', value: money(upcoming.reduce((s, r) => s + payout(r), 0)) },
  ]

  const setStatus = async (l: Listing, status: ListingStatus) => {
    setBusyId(l.id)
    try {
      const updated = await api.hosting.setListingStatus(l.id, status)
      onListingsChange(listings.map((x) => (x.id === updated.id ? updated : x)))
      toast(status === 'listed' ? 'Your place is live again' : 'Unlisted. Guests can’t book it now.')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    setBusyId(deleting.id)
    setDeleteError('')
    try {
      await api.hosting.deleteListing(deleting.id)
      onListingsChange(listings.filter((l) => l.id !== deleting.id))
      toast('Listing deleted')
      setDeleting(null)
    } catch (e) {
      setDeleteError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted">Hosting dashboard</p>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name.split(' ')[0]}</h1>
        </div>
        <Link to="/host/listings/new" className={buttonClass('primary')}>
          <Plus className="size-4" aria-hidden /> New listing
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-white p-5">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div role="tablist" className="mt-10 flex gap-2 border-b border-line">
        {(
          [
            ['reservations', `Reservations (${upcoming.length})`],
            ['listings', `Your listings (${listings.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setParams(id === 'reservations' ? {} : { tab: id }, { replace: true })}
            className={cx(
              '-mb-px border-b-2 px-3 pb-3 text-sm font-semibold transition-colors',
              tab === id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'reservations' ? (
        <section className="mt-6">
          <div className="mb-5 flex gap-2">
            {(['upcoming', 'past', 'cancelled'] as ResFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cx(
                  'rounded-full border px-4 py-1.5 text-sm font-semibold capitalize',
                  filter === f ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink/40',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={filter === 'upcoming' ? 'No upcoming guests' : `No ${filter} reservations`}
              body={filter === 'upcoming' ? 'New bookings show up here the moment a guest confirms.' : undefined}
            />
          ) : (
            <ul className="space-y-3">
              {shown.map((r) => (
                <ReservationRow key={r.id} r={r} />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="mt-6">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <li key={l.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
                <div className="relative">
                  <SafeImage src={l.photos[0]} alt="" className="aspect-[3/2] w-full" />
                  <span className="absolute top-3 left-3">
                    <Badge tone={l.status === 'listed' ? 'green' : l.status === 'draft' ? 'amber' : 'neutral'}>
                      {l.status === 'listed' ? 'Live' : l.status === 'draft' ? 'Draft' : 'Unlisted'}
                    </Badge>
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="line-clamp-1 font-semibold">{l.title || 'Untitled listing'}</p>
                  <p className="text-sm text-muted">
                    {l.location.city || 'No location yet'} · {l.pricePerNight ? `${money(l.pricePerNight)} night` : 'No price yet'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/host/listings/${l.id}/edit`} className={buttonClass('secondary', 'sm')}>
                      <PencilLine className="size-4" aria-hidden /> {l.status === 'draft' ? 'Finish' : 'Edit'}
                    </Link>
                    {l.status !== 'draft' && (
                      <Link to={`/listings/${l.id}`} className={buttonClass('ghost', 'sm')} aria-label={`View ${l.title}`}>
                        <Eye className="size-4" aria-hidden /> View
                      </Link>
                    )}
                    {l.status === 'listed' && (
                      <Button variant="ghost" size="sm" loading={busyId === l.id} onClick={() => setStatus(l, 'unlisted')}>
                        Unlist
                      </Button>
                    )}
                    {l.status === 'unlisted' && (
                      <Button variant="ghost" size="sm" loading={busyId === l.id} onClick={() => setStatus(l, 'listed')}>
                        List again
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-red-700"
                      aria-label={`Delete ${l.title || 'listing'}`}
                      onClick={() => {
                        setDeleteError('')
                        setDeleting(l)
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
            <li>
              <Link
                to="/host/listings/new"
                className="flex h-full min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-muted transition-colors hover:border-brand-600 hover:text-brand-700"
              >
                <House className="size-8" strokeWidth={1.5} aria-hidden />
                <span className="font-semibold">List another place</span>
              </Link>
            </li>
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete this listing?"
        body={<>“{deleting?.title || 'Untitled listing'}” will be removed for good. This can’t be undone.</>}
        confirmLabel="Delete listing"
        danger
        busy={!!deleting && busyId === deleting.id}
        error={deleteError}
        onConfirm={doDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

function ReservationRow({ r }: { r: Reservation }) {
  const t = today()
  const inDays = diffDays(t, r.checkIn)
  let when = ''
  if (r.status === 'confirmed') {
    if (r.checkIn <= t && r.checkOut > t) when = 'Staying now'
    else if (inDays === 0) when = 'Arrives today'
    else if (inDays === 1) when = 'Arrives tomorrow'
    else if (inDays > 1 && inDays <= 14) when = `Arrives in ${inDays} days`
  }
  return (
    <li className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={r.guest.name} id={r.guest.id} />
          <div className="min-w-0">
            <p className="font-semibold">
              {r.guest.name} {when && <Badge tone={when === 'Staying now' ? 'amber' : 'green'}>{when}</Badge>}
              {r.status === 'cancelled' && <Badge tone="red">Cancelled</Badge>}
            </p>
            <p className="truncate text-sm text-muted">{r.listing.title}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-sm sm:w-[26rem]">
          <div>
            <dt className="text-muted">Dates</dt>
            <dd className="font-medium">{formatStay(r.checkIn, r.checkOut)}</dd>
          </div>
          <div>
            <dt className="text-muted">Guests</dt>
            <dd className="font-medium">{plural(r.guests, 'guest')}</dd>
          </div>
          <div>
            <dt className="text-muted">You earn</dt>
            <dd className="font-medium">{money(payout(r))}</dd>
          </div>
        </dl>
      </div>
      {(r.messageToHost || r.guest.phone) && r.status === 'confirmed' && (
        <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
          {r.guest.phone && (
            <p>
              <span className="text-muted">Phone: </span>
              <a href={`tel:${r.guest.phone.replace(/\s/g, '')}`} className="font-medium text-brand-700 hover:underline">
                {r.guest.phone}
              </a>
            </p>
          )}
          {r.messageToHost && <p className="text-muted">“{r.messageToHost}”</p>}
        </div>
      )}
    </li>
  )
}
