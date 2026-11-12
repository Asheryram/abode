import { Search } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { addDays, today } from '../lib/dates'
import { cx } from './ui'

export interface SearchValues {
  location: string
  checkIn: string
  checkOut: string
  guests: number
}

const POPULAR = ['Accra', 'Kumasi', 'Cape Coast', 'Takoradi', 'Busua', 'Aburi', 'Ada Foah', 'Kokrobite', 'Tamale', 'Akosombo']

export function SearchBar({ initial, onSearch }: { initial: SearchValues; onSearch(v: SearchValues): void }) {
  const [v, setV] = useState(initial)
  const ids = useId()
  // Back/forward changes the URL; follow it.
  useEffect(() => setV(initial), [initial.location, initial.checkIn, initial.checkOut, initial.guests]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof SearchValues>(k: K, value: SearchValues[K]) => setV((s) => ({ ...s, [k]: value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearch(v)
  }

  const minOut = v.checkIn ? addDays(v.checkIn, 1) : addDays(today(), 1)
  const cell = 'flex flex-col justify-center gap-0.5 px-5 py-2.5 md:py-3'
  const label = 'text-xs font-bold'
  const input = 'w-full bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none'

  return (
    <form
      onSubmit={submit}
      role="search"
      className="flex flex-col divide-y divide-line rounded-3xl border border-line bg-white shadow-[0_6px_24px_rgba(0,0,0,0.08)] md:flex-row md:items-center md:divide-x md:divide-y-0 md:rounded-full"
    >
      <div className={cx(cell, 'md:flex-[1.4] md:pl-7')}>
        <label htmlFor={`${ids}-where`} className={label}>
          Where
        </label>
        <input
          id={`${ids}-where`}
          list={`${ids}-places`}
          value={v.location}
          onChange={(e) => set('location', e.target.value)}
          placeholder="Search destinations"
          className={input}
          autoComplete="off"
        />
        <datalist id={`${ids}-places`}>
          {POPULAR.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <div className="grid grid-cols-2 divide-x divide-line md:flex md:flex-[1.6]">
        <div className={cx(cell, 'md:flex-1')}>
          <label htmlFor={`${ids}-in`} className={label}>
            Check in
          </label>
          <input
            id={`${ids}-in`}
            type="date"
            min={today()}
            value={v.checkIn}
            onChange={(e) => {
              const checkIn = e.target.value
              setV((s) => ({ ...s, checkIn, checkOut: s.checkOut && checkIn && s.checkOut <= checkIn ? '' : s.checkOut }))
            }}
            className={input}
          />
        </div>
        <div className={cx(cell, 'md:flex-1')}>
          <label htmlFor={`${ids}-out`} className={label}>
            Check out
          </label>
          <input
            id={`${ids}-out`}
            type="date"
            min={minOut}
            value={v.checkOut}
            onChange={(e) => set('checkOut', e.target.value)}
            className={input}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 py-2 pr-2 pl-5 md:flex-1">
        <div className="flex flex-1 flex-col gap-0.5">
          <label htmlFor={`${ids}-who`} className={label}>
            Guests
          </label>
          <select
            id={`${ids}-who`}
            value={v.guests}
            onChange={(e) => set('guests', Number(e.target.value))}
            className={cx(input, 'appearance-none')}
          >
            <option value={0}>Add guests</option>
            {Array.from({ length: 16 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} {i === 0 ? 'guest' : 'guests'}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="flex h-12 items-center gap-2 rounded-full bg-brand-700 px-5 font-semibold text-white transition-colors hover:bg-brand-800"
        >
          <Search className="size-4" strokeWidth={2.5} aria-hidden />
          <span>Search</span>
        </button>
      </div>
    </form>
  )
}
