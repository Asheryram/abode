import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListingCard } from '../../components/listing'
import { GHANA_REGIONS, INTENTS } from '../../config'
import type { Intent } from '../../contracts'
import { Button, cx, ErrorState, SelectField, Spinner, TextField } from '../../design-system'
import { useAsync } from '../../hooks/useAsync'
import { addDays, today } from '../../lib/dates'
import { api } from '../../services/api'

export function SearchForm({ initial, compact }: { initial?: { intent?: Intent; q?: string; region?: string; checkIn?: string; checkOut?: string; guests?: number }; compact?: boolean }) {
  const navigate = useNavigate()
  const [intent, setIntent] = useState<Intent>(initial?.intent ?? 'short_stay')
  const [q, setQ] = useState(initial?.q ?? '')
  const [region, setRegion] = useState(initial?.region ?? '')
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? '')
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? '')
  const [guests, setGuests] = useState(initial?.guests ?? 2)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const p = new URLSearchParams({ intent })
    if (q.trim()) p.set('q', q.trim())
    if (region) p.set('region', region)
    if (intent === 'short_stay' && checkIn && checkOut) {
      p.set('checkIn', checkIn)
      p.set('checkOut', checkOut)
      p.set('guests', String(guests))
    }
    navigate(`/search?${p}`)
  }

  return (
    <form onSubmit={submit} className={cx('rounded-3xl border border-line bg-white p-4 shadow-sm', compact ? '' : 'sm:p-5')}>
      <div role="tablist" aria-label="What are you looking for?" className="mb-4 flex gap-1 overflow-x-auto">
        {INTENTS.map((i) => (
          <button key={i.id} type="button" role="tab" aria-selected={intent === i.id} onClick={() => setIntent(i.id)} className={cx('shrink-0 rounded-full px-4 py-2 text-sm font-semibold', intent === i.id ? 'bg-ink text-white' : 'text-muted hover:bg-stone-100 hover:text-ink')}>
            {i.label}
          </button>
        ))}
      </div>
      <div className={cx('grid gap-3', intent === 'short_stay' ? 'md:grid-cols-[2fr_1fr_1fr_0.8fr_auto]' : 'md:grid-cols-[2fr_1.2fr_auto]')}>
        <TextField label="Where" placeholder="Area, town or city" value={q} onChange={(e) => setQ(e.target.value)} />
        {intent === 'short_stay' ? (
          <>
            <TextField label="Check in" type="date" min={today()} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (!checkOut || checkOut <= e.target.value) setCheckOut(addDays(e.target.value, 2)) }} />
            <TextField label="Check out" type="date" min={checkIn ? addDays(checkIn, 1) : today()} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            <TextField label="Guests" type="number" min={1} max={16} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} />
          </>
        ) : (
          <SelectField label="Region" value={region} onChange={(e) => setRegion(e.target.value)} options={GHANA_REGIONS} placeholder="Anywhere in Ghana" />
        )}
        <div className="flex items-end">
          <Button type="submit" size="lg" className="w-full md:w-auto">
            <Search className="size-4" aria-hidden /> Search
          </Button>
        </div>
      </div>
    </form>
  )
}

export function HomePage() {
  const { data, error, loading, reload } = useAsync(() => api.pub.featured(), [])
  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-canvas">
        <div className="mx-auto max-w-5xl px-4 pt-12 pb-10 text-center sm:px-6 sm:pt-16">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Find your place in Ghana</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted">Short stays, homes to rent or buy, and commercial space, from verified owners, hosts and agencies.</p>
          <div className="mt-8 text-left">
            <SearchForm />
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        {loading && !data && <Spinner />}
        {error ? <ErrorState error={error} onRetry={reload} /> : null}
        {data &&
          INTENTS.map((i) => (
            <section key={i.id}>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold sm:text-2xl">{i.label}</h2>
                  <p className="text-muted">{i.hint}</p>
                </div>
                <Link to={`/search?intent=${i.id}`} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">
                  See all
                </Link>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {data[i.id].map((l) => (
                  <ListingCard key={l.id} l={l} />
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  )
}
