import { LayoutGrid, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ListingCard, ListingCardSkeleton, ListingGrid } from '../components/ListingCard'
import { SearchBar, type SearchValues } from '../components/SearchBar'
import { Button, cx, EmptyState, ErrorState } from '../components/ui'
import { PROPERTY_ICONS } from '../components/icons'
import { PROPERTY_TYPES } from '../config'
import type { ListingSearchQuery, PropertyType } from '../contracts'
import { useAsync } from '../hooks/useAsync'
import { diffDays, isISODate } from '../lib/dates'
import { money, plural } from '../lib/format'
import { api } from '../services/api'

const PRICE_CAPS = [500, 1000, 2000, 3000]

/** The URL is the state: searches can be shared, bookmarked and go back. */
function readQuery(params: URLSearchParams): ListingSearchQuery {
  const checkIn = params.get('checkIn')
  const checkOut = params.get('checkOut')
  const datesOk = isISODate(checkIn) && isISODate(checkOut) && checkIn < checkOut
  const type = params.get('type')
  const guests = Number(params.get('guests'))
  const maxPrice = Number(params.get('maxPrice'))
  return {
    location: params.get('location')?.trim() || undefined,
    checkIn: datesOk ? checkIn : undefined,
    checkOut: datesOk ? checkOut : undefined,
    guests: Number.isInteger(guests) && guests > 0 ? guests : undefined,
    type: PROPERTY_TYPES.some((t) => t.id === type) ? (type as PropertyType) : undefined,
    maxPrice: maxPrice > 0 ? maxPrice : undefined,
  }
}

export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const key = params.toString()
  const query = useMemo(() => readQuery(new URLSearchParams(key)), [key])
  const { data, error, loading, reload } = useAsync(() => api.listings.search(query), [key])

  const update = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '' || v === 0) next.delete(k)
      else next.set(k, String(v))
    }
    setParams(next)
  }

  const initial: SearchValues = {
    location: query.location ?? '',
    checkIn: query.checkIn ?? '',
    checkOut: query.checkOut ?? '',
    guests: query.guests ?? 0,
  }

  const nights = query.checkIn && query.checkOut ? diffDays(query.checkIn, query.checkOut) : undefined
  const carry = new URLSearchParams()
  if (query.checkIn && query.checkOut) {
    carry.set('checkIn', query.checkIn)
    carry.set('checkOut', query.checkOut)
  }
  if (query.guests) carry.set('guests', String(query.guests))
  const linkSearch = carry.size ? `?${carry}` : ''

  const searching = !!(query.location || query.checkIn || query.guests || query.type || query.maxPrice)

  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-canvas">
        <div className="mx-auto max-w-5xl px-4 pt-8 pb-8 sm:px-6 md:pt-14 lg:px-8">
          {!searching && (
            <div className="mb-7 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight text-balance md:text-5xl">Find a place that feels like home</h1>
              <p className="mx-auto mt-3 max-w-xl text-muted md:text-lg">
                Beach houses, city apartments and quiet cabins across Ghana, from hosts who know the area.
              </p>
            </div>
          )}
          <SearchBar
            initial={initial}
            onSearch={(v) => update({ location: v.location.trim(), checkIn: v.checkIn, checkOut: v.checkIn ? v.checkOut : '', guests: v.guests })}
          />
        </div>
      </section>

      <div className="sticky top-16 z-30 border-b border-line bg-canvas/95 backdrop-blur md:top-20">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div className="scrollbar-none -mb-px flex flex-1 gap-6 overflow-x-auto md:gap-9">
            {[{ id: undefined, plural: 'All', icon: LayoutGrid }, ...PROPERTY_TYPES.map((t) => ({ ...t, icon: PROPERTY_ICONS[t.id] }))].map(
              ({ id, plural: label, icon: Icon }) => {
                const active = query.type === id
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => update({ type: id })}
                    aria-pressed={active}
                    className={cx(
                      'flex shrink-0 flex-col items-center gap-1.5 border-b-2 pt-3 pb-2.5 text-xs font-semibold transition-colors',
                      active ? 'border-ink text-ink' : 'border-transparent text-muted hover:border-ink/20 hover:text-ink',
                    )}
                  >
                    <Icon className="size-6" strokeWidth={1.6} aria-hidden />
                    {label}
                  </button>
                )
              },
            )}
          </div>
          <label className="hidden shrink-0 sm:block">
            <span className="sr-only">Maximum price per night</span>
            <select
              value={query.maxPrice ?? ''}
              onChange={(e) => update({ maxPrice: e.target.value })}
              className="h-10 rounded-xl border border-line bg-white px-3 text-sm font-semibold"
            >
              <option value="">Any price</option>
              {PRICE_CAPS.map((p) => (
                <option key={p} value={p}>
                  Up to {money(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" aria-busy={loading}>
        {error && !data ? (
          <ErrorState error={error} onRetry={reload} />
        ) : !data ? (
          <ListingGrid>
            {Array.from({ length: 8 }, (_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </ListingGrid>
        ) : data.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No places match your search"
            body="Try other dates, fewer guests, or a wider area."
            action={
              <Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>
                Clear all filters
              </Button>
            }
          />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {searching ? plural(data.length, 'place') : 'Stays across Ghana'}
                {query.location && <span className="text-muted"> matching “{query.location}”</span>}
              </h2>
              {searching && (
                <button type="button" onClick={() => setParams(new URLSearchParams())} className="text-sm font-semibold underline underline-offset-4">
                  Clear search
                </button>
              )}
            </div>
            <div className={cx('transition-opacity', loading && 'opacity-50')}>
              <ListingGrid>
                {data.map((l) => (
                  <ListingCard key={l.id} listing={l} nights={nights} linkSearch={linkSearch} />
                ))}
              </ListingGrid>
            </div>
          </>
        )}
      </section>
    </>
  )
}
