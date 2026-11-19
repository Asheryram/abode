/** Listing pieces used on the public site, the portal and the back office. */
import { BedDouble, Bath, Heart, Ruler, Star, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/auth'
import { useSaved } from '../app/saved'
import { intentLabel, propertyTypeLabel } from '../config'
import type { ListingSummary, Photo, SearchResult } from '../contracts'
import { cx, Modal, Money, PriceTag, PromotedLabel, TrustBadge } from '../design-system'
import { today } from '../lib/dates'
import { formatRating, plural } from '../lib/format'
import { SafeImage } from './SafeImage'

export function SaveButton({ listingId, className }: { listingId: string; className?: string }) {
  const { user } = useAuth()
  const { ids, toggle } = useSaved()
  const navigate = useNavigate()
  const location = useLocation()
  const saved = ids.has(listingId)
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!user) navigate('/login', { state: { from: location } })
        else void toggle(listingId)
      }}
      className={cx('grid size-9 place-items-center rounded-full bg-white/90 shadow-sm transition-transform hover:scale-110', className)}
    >
      <Heart className={cx('size-[18px]', saved ? 'fill-danger-solid text-danger-solid' : 'text-ink')} aria-hidden />
    </button>
  )
}

/** Key facts for a listing, chosen by intent. */
export function ListingFacts({ l, className }: { l: ListingSummary; className?: string }) {
  const facts: { icon: typeof BedDouble; text: string }[] = []
  if (l.bedrooms !== undefined && l.propertyType !== 'land') facts.push({ icon: BedDouble, text: l.bedrooms === 0 ? 'Studio' : plural(l.bedrooms, 'bed') })
  if (l.bathrooms) facts.push({ icon: Bath, text: plural(l.bathrooms, 'bath') })
  if (l.maxGuests) facts.push({ icon: Users, text: plural(l.maxGuests, 'guest') })
  if (l.areaSqm) facts.push({ icon: Ruler, text: `${new Intl.NumberFormat('en-GH').format(l.areaSqm)} m²` })
  return (
    <div className={cx('flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted', className)}>
      {facts.map((f) => (
        <span key={f.text} className="inline-flex items-center gap-1">
          <f.icon className="size-3.5" aria-hidden />
          {f.text}
        </span>
      ))}
    </div>
  )
}

export function ListingCard({ l, query }: { l: SearchResult; query?: string }) {
  return (
    <Link to={`/listings/${l.id}${query ?? ''}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl">
        <SafeImage src={l.photo?.url} alt={l.photo?.alt ?? l.title} className="aspect-[4/3] w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">{l.promoted && <PromotedLabel />}</div>
          <SaveButton listingId={l.id} />
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold">{l.title}</h3>
          {l.rating !== undefined && l.reviewCount > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-sm">
              <Star className="size-3.5 fill-ink" aria-hidden />
              {formatRating(l.rating)}
              <span className="sr-only">out of 5 from {l.reviewCount} reviews</span>
            </span>
          )}
        </div>
        <p className="text-sm text-muted">
          {propertyTypeLabel(l.propertyType)} · {l.locationText}
        </p>
        <ListingFacts l={l} />
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {l.stayTotal && l.nights ? (
            <span>
              <Money amount={l.stayTotal} className="font-bold" /> <span className="text-sm text-muted">total for {plural(l.nights, 'night')}</span>
            </span>
          ) : (
            <PriceTag amount={l.price} basis={l.basis} size="sm" />
          )}
          <TrustBadge verification={l.verification} today={today()} />
        </div>
      </div>
    </Link>
  )
}

export function ListingRow({ l, right, to }: { l: ListingSummary; right?: React.ReactNode; to?: string }) {
  const body = (
    <div className="flex items-center gap-4">
      <SafeImage src={l.photo?.url} alt="" className="size-16 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{l.title}</p>
        <p className="truncate text-sm text-muted">
          {intentLabel(l.intent)} · {l.locationText}
        </p>
      </div>
      {right}
    </div>
  )
  return to ? (
    <Link to={to} className="block rounded-2xl border border-line bg-white p-3 hover:border-ink/40">
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl border border-line bg-white p-3">{body}</div>
  )
}

export function PhotoGallery({ photos, title }: { photos: Photo[]; title: string }) {
  const [open, setOpen] = useState(false)
  const shown = photos.slice(0, 5)
  if (!photos.length) return <SafeImage alt={title} className="aspect-[16/9] w-full rounded-2xl" />
  return (
    <>
      <div className="relative grid gap-2 overflow-hidden rounded-2xl md:grid-cols-4 md:grid-rows-2">
        {shown.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setOpen(true)} className={cx('overflow-hidden', i === 0 ? 'md:col-span-2 md:row-span-2' : 'hidden md:block')}>
            <SafeImage src={p.url} alt={p.alt} className={cx('w-full transition-transform hover:scale-[1.02]', i === 0 ? 'aspect-[4/3] md:h-full' : 'aspect-[4/3]')} />
          </button>
        ))}
        <button type="button" onClick={() => setOpen(true)} className="absolute right-3 bottom-3 rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm font-semibold shadow-sm">
          Show all {photos.length} photos
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={`Photos of ${title}`} wide>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className="rounded-lg px-3 py-1.5 font-semibold hover:bg-stone-100" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
        <div className="space-y-4">
          {photos.map((p) => (
            <figure key={p.id}>
              <SafeImage src={p.url} alt={p.alt} className="w-full rounded-xl" />
              <figcaption className="mt-1 text-sm text-muted">{p.room ? `${p.room}: ` : ''}{p.alt}</figcaption>
            </figure>
          ))}
        </div>
      </Modal>
    </>
  )
}
