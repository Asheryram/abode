/**
 * Page structure and form controls shared by every area of the app.
 * Screens compose these instead of styling their own.
 */
import { Check } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ApiError, errorMessage } from '../contracts'
import { Alert } from './feedback'
import { Button, cx, Modal, TextArea } from './primitives'

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm font-semibold text-brand-700">{eyebrow}</div>}
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Card({ children, className, title, actions, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode; padded?: boolean }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-white', padded && 'p-5', className)}>
      {(title || actions) && (
        <div className={cx('mb-4 flex items-center justify-between gap-3', !padded && 'px-5 pt-5')}>
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, hint, to }: { label: string; value: ReactNode; hint?: string; to?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </>
  )
  const cls = 'block rounded-2xl border border-line bg-white p-4'
  return to ? (
    <NavLink to={to} className={cx(cls, 'transition-colors hover:border-ink/40')}>
      {body}
    </NavLink>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** Tabs that are links, so each tab has its own address. */
export function TabLinks({ tabs }: { tabs: { to: string; label: string; count?: number; end?: boolean }[] }) {
  return (
    <nav className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Sections">
      <div className="flex gap-6">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => cx('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 py-3 text-sm font-semibold', isActive ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink')}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className="rounded-full bg-brand-700 px-1.5 text-xs text-white">{t.count}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** Tabs that switch content on the same page. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: NoInfer<T>; label: string }[]; onChange(v: T): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors', value === o.value ? 'bg-ink text-white' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A checkbox with its label. Never pre-ticked for consent (FE-GLB-018). */
export function Checkbox({ label, hint, error, ...rest }: { label: ReactNode; hint?: ReactNode; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
          <input id={id} type="checkbox" aria-invalid={!!error || undefined} className="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-ink/40 bg-white checked:border-brand-700 checked:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700" {...rest} />
          <Check className="pointer-events-none absolute size-3.5 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} aria-hidden />
        </span>
        <span className="text-[15px]">
          {label}
          {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
        </span>
      </label>
      {error && <p className="mt-1 ml-8 text-sm text-danger-fg">{error}</p>}
    </div>
  )
}

/** Large radio choices, for decisions that need a sentence of explanation. */
export function RadioCards<T extends string>({ label, value, options, onChange, columns = 1 }: { label: string; value: T | undefined; options: { value: NoInfer<T>; label: string; hint?: string }[]; onChange(v: T): void; columns?: 1 | 2 | 3 }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className={cx('grid gap-2', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>
        {options.map((o) => (
          <label key={o.value} className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors', value === o.value ? 'border-ink bg-stone-50' : 'border-line bg-white hover:border-ink/40')}>
            <input type="radio" name={label} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-1 size-4 accent-brand-700" />
            <span>
              <span className="block font-semibold">{o.label}</span>
              {o.hint && <span className="block text-sm text-muted">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Label–value pairs, e.g. booking facts. */
export function Facts({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cx('grid gap-x-6 gap-y-4', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-sm text-muted">{i.label}</dt>
          <dd className="mt-0.5 font-medium">{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export interface Column<T> {
  header: string
  cell(row: T): ReactNode
  className?: string
}

/** A table on wide screens that becomes stacked cards on phones. */
export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty }: { rows: T[]; columns: Column<T>[]; rowKey(row: T): string; onRowClick?(row: T): void; empty?: ReactNode }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">{empty ?? 'Nothing here yet.'}</div>
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <table className="block w-full text-left text-sm md:table">
        <thead className="hidden border-b border-line bg-stone-50 text-xs font-semibold tracking-wide text-muted uppercase md:table-header-group">
          <tr>
            {columns.map((c) => (
              <th key={`${c.header}-${columns.indexOf(c)}`} scope="col" className={cx('px-4 py-3', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block divide-y divide-line md:table-row-group">
          {rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cx('block md:table-row', onRowClick && 'cursor-pointer hover:bg-stone-50')}>
              {columns.map((c, i) => (
                <td key={`${c.header}-${i}`} className={cx('px-4 md:table-cell md:py-3', i === 0 ? 'block min-w-0 pt-3' : 'flex flex-wrap items-baseline gap-x-2 py-0.5', i === columns.length - 1 && 'pb-3', !c.header && i > 0 && 'pt-2 md:pt-3', c.className)}>
                  {i > 0 && c.header && <span className="shrink-0 text-xs text-muted md:hidden">{c.header}</span>}
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Shows an API error with its support reference (FE-GLB-010). */
export function ErrorAlert({ error, title = 'That didn’t work' }: { error: unknown; title?: string }) {
  if (!error) return null
  const ref = error instanceof ApiError ? error.correlationId : undefined
  return (
    <Alert tone="danger" title={title} reference={ref}>
      {errorMessage(error)}
    </Alert>
  )
}

/** Field-level messages from an API validation error. */
export const fieldErrors = (e: unknown): Record<string, string> => (e instanceof ApiError && e.fields ? e.fields : {})

/**
 * A privileged or consequential action that needs a written reason, which
 * goes to the audit log (ADM-004, FE-BO-004).
 */
export function ReasonDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  reasonLabel = 'Reason',
  reasonHint = 'Recorded in the audit log.',
  minLength = 5,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body?: ReactNode
  confirmLabel: string
  danger?: boolean
  reasonLabel?: string
  reasonHint?: string
  minLength?: number
  onConfirm(reason: string): Promise<unknown>
  onClose(): void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const close = () => {
    if (busy) return
    setReason('')
    setError(null)
    onClose()
  }
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
      setReason('')
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={close} title={title}>
      <h2 className="text-xl font-bold">{title}</h2>
      {body && <div className="mt-2 text-muted">{body}</div>}
      <div className="mt-4">
        <TextArea label={reasonLabel} hint={reasonHint} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </div>
      {error ? (
        <div className="mt-4">
          <ErrorAlert error={error} />
        </div>
      ) : null}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={submit} loading={busy} disabled={reason.trim().length < minLength}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

/** Demo-only hint, e.g. a test code. Clearly marked so no one mistakes it for product text. */
export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-info-border bg-info-bg px-3.5 py-2.5 text-sm text-info-fg">
      <span className="mr-1.5 rounded bg-info-fg px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">Test data</span>
      {children}
    </div>
  )
}
