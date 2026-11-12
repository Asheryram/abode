import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { propertyTypeLabel } from '../config'
import type { Listing } from '../contracts'
import { formatRating, money, plural } from '../lib/format'
import { FavoriteButton } from './FavoriteButton'
import { SafeImage } from './SafeImage'
import { cx } from './ui'

interface Props {
  listing: Listing
  /** When the search has dates, show the total for the stay too. */
  nights?: number
  /** Query string carried to the listing page, e.g. the searched dates. */
  linkSearch?: string
}

export function ListingCard({ listing, nights, linkSearch = '' }: Props) {
  const strip = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const photos = listing.photos.length ? listing.photos.slice(0, 5) : ['']

  const go = (e: React.MouseEvent, dir: 1 | -1) => {
    e.preventDefault()
    const el = strip.current
    if (el) el.scrollTo({ left: el.clientWidth * (index + dir), behavior: 'smooth' })
  }

  const { city, region } = listing.location
  const title = `${propertyTypeLabel(listing.propertyType)} in ${city}`

  return (
    <Link to={`/listings/${listing.id}${linkSearch}`} className="group block" aria-label={`${listing.title}, ${money(listing.pricePerNight)} per night`}>
      <div className="relative overflow-hidden rounded-2xl">
        <div
          ref={strip}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="scrollbar-none flex aspect-[20/19] snap-x snap-mandatory overflow-x-auto"
        >
          {photos.map((src, i) => (
            <SafeImage key={i} src={src} alt="" className="h-full w-full shrink-0 snap-center" />
          ))}
        </div>

        <div className="absolute top-2 right-2">
          <FavoriteButton listingId={listing.id} />
        </div>

        {photos.length > 1 && (
          <>
            {index > 0 && (
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={(e) => go(e, -1)}
                className="absolute top-1/2 left-2 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 opacity-0 shadow transition-opacity group-hover:opacity-100 md:grid"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            {index < photos.length - 1 && (
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={(e) => go(e, 1)}
                className="absolute top-1/2 right-2 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 opacity-0 shadow transition-opacity group-hover:opacity-100 md:grid"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1">
              {photos.map((_, i) => (
                <span key={i} className={cx('size-1.5 rounded-full transition-colors', i === index ? 'bg-white' : 'bg-white/55')} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-3 text-[15px]">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold">{title}</h3>
          {listing.rating !== null ? (
            <span className="flex shrink-0 items-center gap-1 text-sm">
              <Star className="size-3.5 fill-current" aria-hidden />
              {formatRating(listing.rating)}
              <span className="sr-only">out of 5 from {plural(listing.reviewCount, 'review')}</span>
            </span>
          ) : (
            <span className="shrink-0 text-sm font-medium text-brand-700">New</span>
          )}
        </div>
        <p className="truncate text-muted">{listing.title}</p>
        <p className="truncate text-muted">
          {region} · {plural(listing.beds, 'bed')}
        </p>
        <p className="mt-1">
          <span className="font-semibold">{money(listing.pricePerNight)}</span> <span className="text-muted">night</span>
          {nights ? <span className="text-muted"> · {money(listing.pricePerNight * nights)} total</span> : null}
        </p>
      </div>
    </Link>
  )
}

export function ListingCardSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="aspect-[20/19] rounded-2xl bg-stone-200" />
      <div className="mt-3 h-4 w-3/4 rounded bg-stone-200" />
      <div className="mt-2 h-4 w-1/2 rounded bg-stone-200" />
      <div className="mt-2 h-4 w-1/3 rounded bg-stone-200" />
    </div>
  )
}

export function ListingGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
}
