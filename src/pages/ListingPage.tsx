import { Grip, MapPin, Share, Star } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BookingWidget } from '../components/BookingWidget'
import { Calendar } from '../components/Calendar'
import { FavoriteButton } from '../components/FavoriteButton'
import { AMENITY_ICONS } from '../components/icons'
import { SafeImage } from '../components/SafeImage'
import { Avatar, Badge, Button, buttonClass, ErrorState, Modal, Spinner } from '../components/ui'
import { amenityLabel, AMENITIES, propertyTypeLabel } from '../config'
import { ApiError, type ISODate, type ListingDetail } from '../contracts'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { diffDays, formatShort, formatStay, isISODate, nightsOf, today, type DateRange } from '../lib/dates'
import { formatRating, memberSince, money, plural } from '../lib/format'
import { api } from '../services/api'
import { NotFoundPage } from './NotFoundPage'

export default function ListingPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  // Re-fetch when the viewer changes: an owner sees more than a guest does.
  const { data, error, reload } = useAsync(() => api.listings.get(id), [id, user?.id])

  if (error instanceof ApiError && error.code === 'NOT_FOUND') return <NotFoundPage message="This place isn’t available. It may have been unlisted by its host." />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (!data) return <Spinner label="Loading this place" />
  return <ListingView key={data.listing.id} detail={data} />
}

/** Dates from the URL, if they are real, in the future and free. */
function rangeFromUrl(params: URLSearchParams, blocked: ReadonlySet<ISODate>): DateRange {
  const start = params.get('checkIn')
  const end = params.get('checkOut')
  if (!isISODate(start) || !isISODate(end) || start < today() || start >= end) return {}
  if (nightsOf(start, end).some((n) => blocked.has(n))) return {}
  return { start, end }
}

function ListingView({ detail }: { detail: ListingDetail }) {
  const { listing, host, reviews, bookedNights } = detail
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const blocked = useMemo(() => new Set(bookedNights), [bookedNights])
  const [range, setRange] = useState<DateRange>(() => rangeFromUrl(params, blocked))
  const [guests, setGuests] = useState(() => Math.min(Math.max(Number(params.get('guests')) || 1, 1), listing.maxGuests))
  const [gallery, setGallery] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  const isOwner = user?.id === listing.hostId
  const nights = range.start && range.end ? diffDays(range.start, range.end) : 0
  const { city, region, address } = listing.location
  const hostFirst = host.name.split(' ')[0]

  const reserve = () => {
    if (!range.start || !range.end) return
    const q = new URLSearchParams({ checkIn: range.start, checkOut: range.end, guests: String(guests) })
    navigate(`/book/${listing.id}?${q}`)
  }

  const share = async () => {
    const url = window.location.href.split('?')[0]!
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('Link copied')
      }
    } catch {
      /* The user closed the share sheet. */
    }
  }

  const placeHeading =
    listing.placeType === 'entire'
      ? `Entire ${propertyTypeLabel(listing.propertyType).toLowerCase()} in ${city}`
      : listing.placeType === 'private-room'
        ? `Private room in ${city}`
        : `Shared room in ${city}`

  const specs = [
    plural(listing.maxGuests, 'guest'),
    plural(listing.bedrooms, 'bedroom'),
    plural(listing.beds, 'bed'),
    plural(listing.bathrooms, 'bath'),
  ].join(' · ')

  const photos = listing.photos

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-28 sm:px-6 md:pt-8 lg:px-8 lg:pb-16">
      {isOwner && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-100 px-5 py-3.5">
          <p className="text-sm">
            <span className="font-semibold">This is your listing.</span>{' '}
            {listing.status === 'listed' ? 'This is what guests see.' : <>It’s <Badge tone="amber">{listing.status}</Badge>, so guests can’t see it yet.</>}
          </p>
          <Link to={`/host/listings/${listing.id}/edit`} className={buttonClass('dark', 'sm')}>
            Edit listing
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{listing.title}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[15px]">
            {listing.rating !== null ? (
              <>
                <Star className="size-4 fill-current" aria-hidden />
                <span className="font-semibold">{formatRating(listing.rating)}</span>
                <span className="text-muted">·</span>
                <a href="#reviews" className="font-semibold underline underline-offset-4">
                  {plural(listing.reviewCount, 'review')}
                </a>
              </>
            ) : (
              <Badge tone="green">New</Badge>
            )}
            <span className="text-muted">·</span>
            <span className="text-muted">
              {city}, {region}
            </span>
          </p>
        </div>
        <div className="-ml-3 flex gap-1">
          <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-stone-100">
            <Share className="size-4" aria-hidden /> Share
          </button>
          {!isOwner && <FavoriteButton listingId={listing.id} variant="inline" />}
        </div>
      </div>

      {/* Photos: swipe on phones, a mosaic from md up. */}
      <div className="relative mt-5 md:mt-6">
        <div className="scrollbar-none -mx-4 flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto sm:mx-0 sm:rounded-2xl md:hidden">
          {photos.map((src, i) => (
            <SafeImage key={i} src={src} alt={`Photo ${i + 1} of ${listing.title}`} className="h-full w-full shrink-0 snap-center" />
          ))}
        </div>
        <div className="hidden h-[440px] gap-2 overflow-hidden rounded-2xl md:grid md:grid-cols-4 md:grid-rows-2">
          {photos.slice(0, 5).map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setGallery(true)}
              className={
                i === 0
                  ? photos.length === 1
                    ? 'col-span-4 row-span-2'
                    : 'col-span-2 row-span-2'
                  : photos.length < 5
                    ? 'col-span-2'
                    : ''
              }
            >
              <SafeImage src={src} alt={`Photo ${i + 1} of ${listing.title}`} className="size-full transition-[filter] hover:brightness-90" />
            </button>
          ))}
        </div>
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => setGallery(true)}
            className="absolute right-3 bottom-3 inline-flex items-center gap-2 rounded-lg border border-ink bg-white px-3.5 py-1.5 text-sm font-semibold shadow-sm"
          >
            <Grip className="size-4" aria-hidden /> Show all {photos.length} photos
          </button>
        )}
      </div>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 divide-y divide-line">
          <section className="pb-8">
            <h2 className="text-xl font-semibold md:text-2xl">{placeHeading}</h2>
            <p className="mt-1 text-muted">{specs}</p>
            <div className="mt-6 flex items-center gap-4 rounded-2xl border border-line p-4">
              <Avatar name={host.name} id={host.id} />
              <div>
                <p className="font-semibold">Hosted by {host.name}</p>
                <p className="text-sm text-muted">Hosting since {memberSince(host.createdAt)}</p>
              </div>
            </div>
          </section>

          <section className="py-8">
            <h2 className="sr-only">About this place</h2>
            <p className="leading-relaxed whitespace-pre-line">{listing.description}</p>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">What this place offers</h2>
            {listing.amenities.length ? (
              <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {AMENITIES.filter((a) => listing.amenities.includes(a.id)).map((a) => {
                  const Icon = AMENITY_ICONS[a.id]
                  return (
                    <li key={a.id} className="flex items-center gap-4">
                      <Icon className="size-6 text-ink/80" strokeWidth={1.5} aria-hidden />
                      {amenityLabel(a.id)}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-3 text-muted">The host hasn’t listed any amenities yet.</p>
            )}
          </section>

          <section ref={calendarRef} className="scroll-mt-28 py-8">
            <h2 className="text-xl font-semibold">
              {nights > 0 ? `${plural(nights, 'night')} in ${city}` : range.start ? 'Pick your checkout date' : 'Pick your check-in date'}
            </h2>
            <p className="mt-1 mb-6 text-sm text-muted">
              {range.start && range.end ? formatStay(range.start, range.end) : 'Crossed-out days are already booked.'}
            </p>
            <Calendar range={range} onChange={setRange} blocked={blocked} />
          </section>

          <section id="reviews" className="scroll-mt-28 py-8">
            {reviews.length ? (
              <>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <Star className="size-5 fill-current" aria-hidden />
                  {formatRating(listing.rating ?? 0)} · {plural(reviews.length, 'review')}
                </h2>
                <ul className="mt-6 grid gap-8 md:grid-cols-2">
                  {reviews.map((r) => (
                    <li key={r.id}>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.authorName} id={r.id} size="sm" />
                        <div>
                          <p className="font-semibold">{r.authorName}</p>
                          <p className="text-xs text-muted">{memberSince(r.createdAt)}</p>
                        </div>
                      </div>
                      <p className="mt-1.5 flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className={i < r.rating ? 'size-3 fill-current' : 'size-3 text-ink/20'} aria-hidden />
                        ))}
                      </p>
                      <p className="mt-2 leading-relaxed">{r.comment}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold">No reviews yet</h2>
                <p className="mt-1 text-muted">Be one of the first guests to stay here.</p>
              </>
            )}
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Where you’ll be</h2>
            <p className="mt-3 flex items-start gap-2">
              <MapPin className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
              <span>
                {address}, {city}, {region}, {listing.location.country}
              </span>
            </p>
            <p className="mt-1 ml-7 text-sm text-muted">The host shares directions after you book.</p>
          </section>

          <section className="pt-8">
            <h2 className="text-xl font-semibold">Meet your host</h2>
            <div className="mt-5 flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-[0_6px_24px_rgba(0,0,0,0.08)] sm:flex-row">
              <div className="flex shrink-0 flex-col items-center gap-2 sm:w-40">
                <Avatar name={host.name} id={host.id} size="lg" />
                <p className="text-lg font-bold">{hostFirst}</p>
                <p className="text-xs text-muted">Host since {new Date(host.createdAt).getFullYear()}</p>
              </div>
              <div className="flex-1">
                <dl className="flex gap-8">
                  <div>
                    <dd className="text-xl font-bold">{host.reviewCount}</dd>
                    <dt className="text-xs text-muted">Reviews</dt>
                  </div>
                  <div>
                    <dd className="text-xl font-bold">{host.listingCount}</dd>
                    <dt className="text-xs text-muted">{host.listingCount === 1 ? 'Listing' : 'Listings'}</dt>
                  </div>
                </dl>
                {host.bio && <p className="mt-4 leading-relaxed">{host.bio}</p>}
              </div>
            </div>
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <BookingWidget
              listing={listing}
              range={range}
              onRangeChange={setRange}
              guests={guests}
              onGuestsChange={setGuests}
              blocked={blocked}
              onReserve={reserve}
              disabledReason={isOwner ? 'You can’t book your own place.' : listing.status !== 'listed' ? 'This place isn’t taking bookings.' : undefined}
            />
          </div>
        </aside>
      </div>

      {/* Phones and tablets: a reserve bar pinned to the bottom, over the tab bar. */}
      {!isOwner && listing.status === 'listed' && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div>
              <p>
                <span className="font-bold">{money(listing.pricePerNight)}</span> <span className="text-muted">night</span>
              </p>
              {range.start && range.end ? (
                <p className="text-sm font-semibold underline underline-offset-2">
                  {formatShort(range.start)} – {formatShort(range.end)} · {plural(guests, 'guest')}
                </p>
              ) : (
                <p className="text-sm text-muted">Add dates for prices</p>
              )}
            </div>
            {range.start && range.end ? (
              <Button size="lg" onClick={reserve}>
                Reserve
              </Button>
            ) : (
              <Button size="lg" onClick={() => calendarRef.current?.scrollIntoView({ behavior: 'smooth' })}>
                Check availability
              </Button>
            )}
          </div>
        </div>
      )}

      <Modal open={gallery} onClose={() => setGallery(false)} title="All photos" wide>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{plural(photos.length, 'photo')}</h2>
          <Button variant="secondary" size="sm" onClick={() => setGallery(false)}>
            Close
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {photos.map((src, i) => (
            <SafeImage key={i} src={src} alt={`Photo ${i + 1} of ${listing.title}`} className={i % 3 === 0 ? 'aspect-[3/2] w-full rounded-xl sm:col-span-2' : 'aspect-square w-full rounded-xl'} />
          ))}
        </div>
      </Modal>
    </div>
  )
}
