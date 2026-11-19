/** RATE-016 to 026: per-date prices and closed dates, changed in bulk. */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useToast } from '../../context/ToastContext'
import type { CalendarDay, ISODate } from '../../contracts'
import { Button, Card, cx, ErrorAlert, ErrorState, formatMoney, PageHeader, Spinner, TextField } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { addDays, formatMonth, parseISODate, toISODate, today } from '../../lib/dates'
import { parseMinor } from '../../lib/moneyInput'
import { api } from '../../services/api'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthGridStart(month: Date): ISODate {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  return toISODate(new Date(first.getFullYear(), first.getMonth(), 1 - offset))
}

export function AvailabilityPage() {
  const { id = '' } = useParams()
  const toast = useToast()
  const [month, setMonth] = useState(() => parseISODate(today()))
  const from = monthGridStart(month)
  const listing = useAsync(() => api.portal.listing(id), [id])
  const days = useAsync(() => api.portal.calendar(id, from, 42), [id, from])
  const [selected, setSelected] = useState<Set<ISODate>>(new Set())
  const [anchor, setAnchor] = useState<ISODate | null>(null)
  const [note, setNote] = useState('')
  const [price, setPrice] = useState('')
  const action = useAction()

  if ((listing.loading && !listing.data) || (days.loading && !days.data)) return <Spinner />
  if (listing.error || days.error) return <ErrorState error={listing.error ?? days.error} />
  const l = listing.data!.listing
  const thisMonth = month.getMonth()

  const pick = (d: CalendarDay, shift: boolean) => {
    if (d.date < today()) return
    const next = new Set(selected)
    if (shift && anchor) {
      const [a, b] = anchor < d.date ? [anchor, d.date] : [d.date, anchor]
      for (let x = a; x <= b; x = addDays(x, 1)) next.add(x)
    } else if (next.has(d.date)) next.delete(d.date)
    else next.add(d.date)
    setAnchor(d.date)
    setSelected(next)
  }

  const apply = (fn: () => Promise<void>, message: string) =>
    void action.run(async () => {
      await fn()
      toast(message)
      setSelected(new Set())
      days.reload()
    })
  const dates = [...selected].sort()

  return (
    <div>
      <Link to={`/portal/listings/${id}`} className="text-sm font-semibold text-brand-700 hover:underline">← {l.title}</Link>
      <PageHeader title="Availability and prices" subtitle={`Base price ${formatMoney(l.price)} per night. Tap dates to select them; hold Shift to select a range.`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
            <h2 className="text-lg font-semibold">{formatMonth(month)}</h2>
            <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight className="size-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
            {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.data!.map((d) => {
              const date = parseISODate(d.date)
              const past = d.date < today()
              const sel = selected.has(d.date)
              const override = d.price.amountMinor !== l.price.amountMinor
              return (
                <button
                  key={d.date}
                  type="button"
                  disabled={past}
                  aria-pressed={sel}
                  aria-label={`${d.date}, ${d.reason ? d.reason : 'open'}, ${formatMoney(d.price)}`}
                  onClick={(e) => pick(d, e.shiftKey)}
                  className={cx(
                    'flex min-h-16 flex-col rounded-lg border p-1.5 text-left text-xs transition-colors sm:min-h-20',
                    date.getMonth() !== thisMonth && 'opacity-50',
                    past && 'cursor-not-allowed bg-stone-50 text-muted',
                    !past && d.reason === 'booked' && 'border-info-border bg-info-bg text-info-fg',
                    !past && d.reason === 'held' && 'border-warning-border bg-warning-bg text-warning-fg',
                    !past && d.reason === 'blocked' && 'border-neutral-border bg-neutral-bg text-neutral-fg line-through decoration-1',
                    !past && !d.reason && 'border-line bg-white hover:border-ink/40',
                    sel && 'ring-2 ring-brand-700 ring-offset-1',
                  )}
                >
                  <span className="font-semibold">{date.getDate()}</span>
                  <span className={cx('mt-auto tabular-nums', override && 'font-bold')}>{formatMoney(d.price, { hideZeroFraction: true })}</span>
                  {d.reason && <span className="truncate text-[10px] no-underline">{d.reason === 'blocked' ? d.note ?? 'Closed' : d.reason === 'booked' ? 'Booked' : 'Held'}</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-line bg-white" /> Open</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-info-border bg-info-bg" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-warning-border bg-warning-bg" /> Held by a guest paying now</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-neutral-border bg-neutral-bg" /> Closed by you</span>
            <span className="font-bold">Bold price = special price</span>
          </div>
        </Card>

        <Card title={dates.length ? `${dates.length} ${dates.length === 1 ? 'date' : 'dates'} selected` : 'Select dates'}>
          {!dates.length ? (
            <p className="text-muted">Tap dates in the calendar to close them, open them or set a special price.</p>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <TextField label="Note for closed dates (optional)" placeholder="e.g. Repairs" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => apply(() => api.portal.setAvailability(id, dates, false, note), 'Dates closed.')} loading={action.busy}>Close</Button>
                  <Button variant="secondary" className="flex-1" onClick={() => apply(() => api.portal.setAvailability(id, dates, true), 'Dates opened.')} loading={action.busy}>Open</Button>
                </div>
              </div>
              <div className="space-y-2 border-t border-line pt-5">
                <TextField label="Special price per night (GH₵)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    loading={action.busy}
                    onClick={() => {
                      const minor = parseMinor(price)
                      if (!minor) return action.setError(new Error('Enter a price, for example 950.'))
                      apply(() => api.portal.setPrices(id, dates, minor), 'Prices updated.')
                    }}
                  >
                    Set price
                  </Button>
                  <Button variant="ghost" className="flex-1" onClick={() => apply(() => api.portal.setPrices(id, dates, null), 'Back to the base price.')} loading={action.busy}>Use base price</Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear selection</Button>
            </div>
          )}
          {action.error ? <div className="mt-4"><ErrorAlert error={action.error} /></div> : null}
        </Card>
      </div>
    </div>
  )
}
