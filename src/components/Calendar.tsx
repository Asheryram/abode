import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ISODate } from '../contracts'
import { formatLong, formatMonth, parseISODate, toISODate, today, type DateRange } from '../lib/dates'
import { cx } from './ui'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

interface Props {
  range: DateRange
  onChange(range: DateRange): void
  /** Nights already taken. A guest can still check OUT on one of these mornings. */
  blocked?: ReadonlySet<ISODate>
  /** How many months side by side. From the second on, only shown from `md` up. */
  months?: number
}

/**
 * Pick a check-in then a check-out. Once check-in is set, days past the next
 * booked night are disabled, because the stay can't run through someone
 * else's booking.
 */
export function Calendar({ range, onChange, blocked = new Set(), months = 2 }: Props) {
  const minDate = today()
  const [view, setView] = useState(() => {
    const d = parseISODate(range.start ?? minDate)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [hover, setHover] = useState<ISODate | null>(null)

  const choosingEnd = !!range.start && !range.end

  /** The first booked night after check-in: the latest possible check-out. */
  const limit = useMemo(() => {
    if (!choosingEnd) return null
    let first: ISODate | null = null
    for (const night of blocked) if (night >= range.start! && (!first || night < first)) first = night
    return first
  }, [blocked, choosingEnd, range.start])

  const canEndOn = (d: ISODate) => choosingEnd && d > range.start! && (!limit || d <= limit)

  const isEnabled = (d: ISODate) => {
    if (d < minDate) return false
    if (canEndOn(d)) return true
    return !blocked.has(d)
  }

  const pick = (d: ISODate) => {
    if (choosingEnd && canEndOn(d)) onChange({ start: range.start, end: d })
    else onChange({ start: d })
    setHover(null)
  }

  const previewEnd = range.end ?? (hover && canEndOn(hover) ? hover : undefined)
  const firstMonth = new Date(view.getFullYear(), view.getMonth(), 1)
  const thisMonth = parseISODate(minDate)
  const atStart =
    firstMonth.getFullYear() === thisMonth.getFullYear() && firstMonth.getMonth() === thisMonth.getMonth()

  const shift = (n: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1))

  return (
    <div onMouseLeave={() => setHover(null)}>
      <div className={cx('relative grid gap-x-10 gap-y-6', months > 1 && 'md:grid-cols-2')}>
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={atStart}
          aria-label="Previous month"
          className="absolute top-0 left-0 grid size-8 place-items-center rounded-full hover:bg-stone-100 disabled:opacity-25"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="absolute top-0 right-0 grid size-8 place-items-center rounded-full hover:bg-stone-100"
        >
          <ChevronRight className="size-4" />
        </button>

        {Array.from({ length: months }, (_, m) => {
          const month = new Date(view.getFullYear(), view.getMonth() + m, 1)
          const lead = (month.getDay() + 6) % 7 // Monday first
          const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
          return (
            <div key={m} className={cx(m > 0 && 'hidden md:block')}>
              <p className="mb-3 text-center leading-8 font-semibold">{formatMonth(month)}</p>
              <div className="grid grid-cols-7 text-center text-xs font-medium text-muted">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="pb-2">
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`x${i}`} />
                ))}
                {Array.from({ length: days }, (_, i) => {
                  const iso = toISODate(new Date(month.getFullYear(), month.getMonth(), i + 1))
                  const enabled = isEnabled(iso)
                  const isStart = iso === range.start
                  const isEnd = iso === previewEnd
                  const inside = !!range.start && !!previewEnd && iso > range.start && iso < previewEnd
                  const taken = blocked.has(iso) && !canEndOn(iso)
                  return (
                    <div
                      key={iso}
                      className={cx(
                        'aspect-square p-px',
                        inside && 'bg-brand-50',
                        isStart && previewEnd && 'rounded-l-full bg-brand-50',
                        isEnd && range.start && 'rounded-r-full bg-brand-50',
                      )}
                    >
                      <button
                        type="button"
                        disabled={!enabled}
                        onClick={() => pick(iso)}
                        onMouseEnter={() => setHover(iso)}
                        aria-label={`${formatLong(iso)}${taken ? ', unavailable' : ''}`}
                        aria-pressed={isStart || isEnd}
                        className={cx(
                          'grid size-full place-items-center rounded-full text-sm font-medium transition-colors',
                          isStart || isEnd
                            ? 'bg-ink text-white'
                            : enabled
                              ? 'hover:ring-1 hover:ring-ink'
                              : 'cursor-not-allowed text-ink/25',
                          taken && 'line-through',
                        )}
                      >
                        {i + 1}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {(range.start || range.end) && (
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => onChange({})} className="text-sm font-semibold underline underline-offset-4">
            Clear dates
          </button>
        </div>
      )}
    </div>
  )
}
