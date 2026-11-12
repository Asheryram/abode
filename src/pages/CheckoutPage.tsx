import { ChevronLeft, CreditCard, ShieldCheck, Smartphone, Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PriceBreakdown } from '../components/BookingWidget'
import { SafeImage } from '../components/SafeImage'
import { Button, buttonClass, cx, ErrorState, InlineError, Spinner, TextArea } from '../components/ui'
import { propertyTypeLabel } from '../config'
import { ApiError, errorMessage, type ListingDetail, type PaymentMethod } from '../contracts'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { formatStay, isISODate, nightsOf, today } from '../lib/dates'
import { formatRating, plural } from '../lib/format'
import { quoteStay } from '../lib/pricing'
import { api, usingMockApi } from '../services/api'
import { NotFoundPage } from './NotFoundPage'

export default function CheckoutPage() {
  const { id = '' } = useParams()
  const { data, error, reload } = useAsync(() => api.listings.get(id), [id])
  if (error instanceof ApiError && error.code === 'NOT_FOUND') return <NotFoundPage message="This place isn’t taking bookings any more." />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (!data) return <Spinner label="Loading your booking" />
  return <Checkout detail={data} />
}

function Checkout({ detail }: { detail: ListingDetail }) {
  const { listing, bookedNights } = detail
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [method, setMethod] = useState<PaymentMethod>('momo')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const checkIn = params.get('checkIn')
  const checkOut = params.get('checkOut')
  const guests = Number(params.get('guests')) || 1
  const back = `/listings/${listing.id}?${params}`

  // The URL can be edited by hand, so check it before showing a price.
  let problem = ''
  if (!isISODate(checkIn) || !isISODate(checkOut) || checkIn >= checkOut) problem = 'Those dates aren’t valid.'
  else if (checkIn < today()) problem = 'Check-in is in the past.'
  else if (nightsOf(checkIn, checkOut).some((n) => bookedNights.includes(n))) problem = 'Some of those nights have just been booked.'
  else if (guests < 1 || guests > listing.maxGuests) problem = `This place fits up to ${listing.maxGuests} guests.`
  else if (user?.id === listing.hostId) problem = 'You can’t book your own place.'

  if (problem) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Let’s fix your dates</h1>
        <p className="mt-2 text-muted">{problem} Please pick again on the listing.</p>
        <Link to={`/listings/${listing.id}`} className={buttonClass('primary', 'md', 'mt-6')}>
          Back to the listing
        </Link>
      </div>
    )
  }

  const quote = quoteStay(listing, checkIn!, checkOut!)

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      const booking = await api.bookings.create({
        listingId: listing.id,
        checkIn: checkIn!,
        checkOut: checkOut!,
        guests,
        paymentMethod: method,
        messageToHost: message,
      })
      toast('You’re booked! Your host has been notified.')
      navigate(`/trips?booked=${booking.id}`, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const methods: { id: PaymentMethod; label: string; hint: string; icon: typeof Smartphone }[] = [
    { id: 'momo', label: 'Mobile Money', hint: 'MTN MoMo, Telecel Cash or AirtelTigo Money', icon: Smartphone },
    { id: 'card', label: 'Debit or credit card', hint: 'Visa or Mastercard', icon: CreditCard },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-12 lg:px-8">
      <div className="flex items-center gap-2">
        <Link to={back} className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-stone-100" aria-label="Back to the listing">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Confirm and pay</h1>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-20">
        <div className="order-2 divide-y divide-line lg:order-1">
          <section className="pb-8">
            <h2 className="text-xl font-semibold">Your trip</h2>
            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">Dates</p>
                <p className="text-muted">{formatStay(checkIn!, checkOut!)}</p>
              </div>
              <Link to={back} className="font-semibold underline underline-offset-4">
                Edit
              </Link>
            </div>
            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">Guests</p>
                <p className="text-muted">{plural(guests, 'guest')}</p>
              </div>
              <Link to={back} className="font-semibold underline underline-offset-4">
                Edit
              </Link>
            </div>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Pay with</h2>
            <fieldset className="mt-5 space-y-3">
              <legend className="sr-only">Payment method</legend>
              {methods.map(({ id, label, hint, icon: Icon }) => (
                <label
                  key={id}
                  className={cx(
                    'flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-colors',
                    method === id ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-ink/40',
                  )}
                >
                  <input type="radio" name="method" value={id} checked={method === id} onChange={() => setMethod(id)} className="sr-only" />
                  <Icon className="size-6 shrink-0" strokeWidth={1.5} aria-hidden />
                  <span className="flex-1">
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-sm text-muted">{hint}</span>
                  </span>
                  <span className={cx('size-5 rounded-full border-2', method === id ? 'border-[6px] border-ink' : 'border-ink/30')} aria-hidden />
                </label>
              ))}
            </fieldset>
            {usingMockApi && (
              <p className="mt-3 text-sm text-muted">Demo build: no payment details are collected and no money is taken.</p>
            )}
          </section>

          <section className="py-8">
            <TextArea
              label="Message the host (optional)"
              hint="Let them know what brings you here and when you expect to arrive."
              value={message}
              maxLength={500}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Hi! We’re visiting ${listing.location.city} for…`}
            />
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Cancellation policy</h2>
            <p className="mt-2 text-muted">Free cancellation any time before check-in on {formatStay(checkIn!, checkOut!).split(' – ')[0]}.</p>
          </section>

          <section className="pt-8">
            {error && (
              <div className="mb-4">
                <InlineError>{error}</InlineError>
              </div>
            )}
            <Button size="lg" className="w-full sm:w-auto" onClick={confirm} loading={busy}>
              Confirm and pay
            </Button>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <ShieldCheck className="size-3.5" aria-hidden />
              By confirming you agree to the house rules and the cancellation policy.
            </p>
          </section>
        </div>

        <aside className="order-1 lg:order-2">
          <div className="rounded-3xl border border-line bg-white p-6 lg:sticky lg:top-28">
            <div className="flex gap-4 border-b border-line pb-6">
              <SafeImage src={listing.photos[0]} alt="" className="size-28 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <p className="text-xs text-muted">{propertyTypeLabel(listing.propertyType)} in {listing.location.city}</p>
                <p className="mt-0.5 line-clamp-2 font-semibold">{listing.title}</p>
                {listing.rating !== null && (
                  <p className="mt-1 flex items-center gap-1 text-xs">
                    <Star className="size-3 fill-current" aria-hidden />
                    {formatRating(listing.rating)} <span className="text-muted">({listing.reviewCount})</span>
                  </p>
                )}
              </div>
            </div>
            <h2 className="mt-6 mb-4 text-lg font-semibold">Price details</h2>
            <PriceBreakdown quote={quote} />
          </div>
        </aside>
      </div>
    </div>
  )
}
