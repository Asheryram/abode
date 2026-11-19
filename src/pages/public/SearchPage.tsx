/** SEA-001 to SEA-024: search one intent at a time, filters in the address so results can be shared. */
import { SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ListingCard } from '../../components/listing'
import { intentLabel, PROPERTY_TYPES } from '../../config'
import type { Intent, PropertyType, SearchQuery, SearchResult } from '../../contracts'
import { Button, EmptyState, ErrorState, PageHeader, SelectField, Spinner, TextField } from '../../design-system'
import { isISODate } from '../../lib/dates'
import { plural } from '../../lib/format'
import { api } from '../../services/api'
import { SearchForm } from './HomePage'

const SORTS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
]

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const intent = (['short_stay', 'rent', 'sale', 'commercial'].includes(params.get('intent') ?? '') ? params.get('intent') : 'short_stay') as Intent
  const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined)
  const query: SearchQuery = {
    intent,
    q: params.get('q') ?? undefined,
    region: params.get('region') ?? undefined,
    propertyType: (params.get('type') as PropertyType) || undefined,
    bedrooms: num('beds'),
    minPriceMinor: num('min') !== undefined ? num('min')! * 100 : undefined,
    maxPriceMinor: num('max') !== undefined ? num('max')! * 100 : undefined,
    checkIn: isISODate(params.get('checkIn')) ? params.get('checkIn')! : undefined,
    checkOut: isISODate(params.get('checkOut')) ? params.get('checkOut')! : undefined,
    guests: num('guests'),
    sort: (params.get('sort') as SearchQuery['sort']) ?? 'recommended',
  }
  const key = params.toString()
  const [items, setItems] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let current = true
    setLoading(true)
    setError(null)
    api.pub.search(query).then(
      (r) => {
        if (!current) return
        setItems(r.items)
        setTotal(r.total)
        setCursor(r.nextCursor)
        setLoading(false)
      },
      (e) => current && (setError(e), setLoading(false)),
    )
    return () => {
      current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const more = async () => {
    if (!cursor) return
    setLoading(true)
    try {
      const r = await api.pub.search({ ...query, cursor })
      setItems((s) => [...s, ...r.items])
      setCursor(r.nextCursor)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }
  const types = PROPERTY_TYPES.filter((t) => t.intents.includes(intent))
  const stayQuery = query.checkIn && query.checkOut ? `?checkIn=${query.checkIn}&checkOut=${query.checkOut}&guests=${query.guests ?? 1}` : ''

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <SearchForm key={key} compact initial={{ intent, q: query.q, region: query.region, checkIn: query.checkIn, checkOut: query.checkOut, guests: query.guests }} />
      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-4" aria-label="Filters">
          <SelectField label="Property type" value={query.propertyType ?? ''} onChange={(e) => set('type', e.target.value)} options={types.map((t) => ({ value: t.id, label: t.label }))} placeholder="Any type" />
          {intent !== 'commercial' && <SelectField label="Bedrooms" value={params.get('beds') ?? ''} onChange={(e) => set('beds', e.target.value)} options={['1', '2', '3', '4', '5'].map((n) => ({ value: n, label: `${n}+` }))} placeholder="Any" />}
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Min price (GH₵)" type="number" min={0} inputMode="numeric" defaultValue={params.get('min') ?? ''} onBlur={(e) => set('min', e.target.value)} />
            <TextField label="Max price (GH₵)" type="number" min={0} inputMode="numeric" defaultValue={params.get('max') ?? ''} onBlur={(e) => set('max', e.target.value)} />
          </div>
          <SelectField label="Sort by" value={query.sort} onChange={(e) => set('sort', e.target.value)} options={SORTS} placeholder={false} />
          {[...params.keys()].some((k) => ['type', 'beds', 'min', 'max'].includes(k)) && (
            <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams({ intent }), { replace: true })}>Clear filters</Button>
          )}
        </aside>
        <section aria-live="polite">
          <PageHeader title={`${intentLabel(intent)}${query.q ? ` in “${query.q}”` : ''}`} subtitle={loading && !items.length ? 'Searching…' : plural(total, 'place')} />
          {error ? <ErrorState error={error} /> : null}
          {!loading && !error && !items.length && <EmptyState icon={SearchX} title="No places match" body={query.checkIn ? 'Nothing is free for those dates. Try other dates or fewer filters.' : 'Try a wider area or fewer filters.'} />}
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((l) => (
              <ListingCard key={l.id} l={l} query={stayQuery} />
            ))}
          </div>
          {loading && <Spinner />}
          {cursor && !loading && (
            <div className="mt-8 text-center">
              <Button variant="secondary" onClick={more}>Show more</Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
