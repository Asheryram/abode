/**
 * Floating panel for stakeholders to switch design direction on any page.
 * Demo tooling, not product UI: remove it once a direction is chosen.
 */
import { Check, Palette, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../design-system'
import { applyDirection, DIRECTIONS, initialDirection, type DirectionId } from '../styles/directions'

export function DirectionSwitcher() {
  const [current, setCurrent] = useState<DirectionId>(initialDirection)
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => applyDirection(current), [current])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const active = DIRECTIONS.find((d) => d.id === current)!

  return (
    <div className="fixed bottom-20 left-4 z-50 md:bottom-4">
      {open ? (
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-label="Design direction"
          className="w-72 rounded-2xl border border-line bg-white p-4 shadow-2xl outline-none"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold">Design direction</p>
              <p className="text-xs text-muted">Preview only. Pick one to see it across the whole app.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-m-1 rounded-lg p-1 text-muted hover:bg-stone-100">
              <X className="size-4" />
            </button>
          </div>
          <div role="radiogroup" aria-label="Design direction" className="mt-3 space-y-2">
            {DIRECTIONS.map((d) => {
              const selected = d.id === current
              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCurrent(d.id)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                    selected ? 'border-ink bg-stone-50' : 'border-line hover:border-ink/40',
                  )}
                >
                  <span className="flex shrink-0 -space-x-1.5" aria-hidden>
                    <span className="size-6 rounded-full border-2 border-white" style={{ background: d.swatches[0] }} />
                    <span className="size-6 rounded-full border-2 border-white" style={{ background: d.swatches[1] }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{d.name}</span>
                    <span className="block text-xs text-muted">
                      {d.mood} · {d.font}
                    </span>
                  </span>
                  {selected && <Check className="size-4 shrink-0" aria-hidden />}
                </button>
              )
            })}
          </div>
          <Link
            to="/design-system"
            onClick={() => setOpen(false)}
            className="mt-3 block text-center text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
          >
            See every component →
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-line bg-white py-2 pr-4 pl-3 text-sm font-semibold shadow-lg hover:border-ink/40"
          aria-label={`Design direction: ${active.name}. Change`}
        >
          <Palette className="size-4 text-brand-700" aria-hidden />
          {active.name}
        </button>
      )}
    </div>
  )
}
