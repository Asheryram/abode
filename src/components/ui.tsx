import { CircleAlert, LoaderCircle, Minus, Plus, type LucideIcon } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../contracts'
import { initials } from '../lib/format'

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

// ── Buttons ─────────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/50',
  dark: 'bg-ink text-white hover:bg-black disabled:bg-ink/40',
  secondary: 'border border-ink/15 bg-white text-ink hover:border-ink/40 hover:bg-stone-50 disabled:text-ink/40',
  ghost: 'text-ink hover:bg-stone-100 disabled:text-ink/40',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
}
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-lg',
  md: 'h-11 px-5 text-sm rounded-xl',
  lg: 'h-13 px-6 text-base rounded-xl',
}

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', extra?: string) =>
  cx(
    'inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    extra,
  )

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export function Button({ variant, size, loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

// ── Feedback ────────────────────────────────────────────────────────────────

export function Spinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cx('flex items-center justify-center py-16 text-muted', className)}>
      <LoaderCircle className="size-6 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <CircleAlert className="size-8 text-red-500" aria-hidden />
      <p className="font-medium">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
        <Icon className="size-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <p className="text-sm text-muted">{body}</p>}
      {action}
    </div>
  )
}

export function InlineError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">
      <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'green' | 'amber' | 'red'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700',
    green: 'bg-brand-50 text-brand-800',
    amber: 'bg-accent-100 text-accent-700',
    red: 'bg-red-50 text-red-700',
  }
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>
}

// ── Avatar ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['bg-brand-700', 'bg-accent-700', 'bg-sky-700', 'bg-rose-700', 'bg-violet-700', 'bg-stone-700']

export function Avatar({ name, id, size = 'md' }: { name: string; id: string; size?: 'sm' | 'md' | 'lg' }) {
  const hash = [...id].reduce((h, c) => h + c.charCodeAt(0), 0)
  const sizes = { sm: 'size-8 text-xs', md: 'size-11 text-sm', lg: 'size-16 text-xl' }
  return (
    <span
      aria-hidden
      className={cx('grid shrink-0 place-items-center rounded-full font-semibold text-white', sizes[size], AVATAR_COLORS[hash % AVATAR_COLORS.length])}
    >
      {initials(name)}
    </span>
  )
}

// ── Form controls ───────────────────────────────────────────────────────────

const inputBase =
  'w-full rounded-xl border border-ink/20 bg-white px-3.5 text-[15px] text-ink placeholder:text-ink/40 transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-stone-50'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
}

export function TextField({ label, hint, error, className, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={hint || error ? `${id}-hint` : undefined}
        className={cx(inputBase, 'h-12', error && 'border-red-500')}
        {...rest}
      />
      {(error || hint) && (
        <p id={`${id}-hint`} className={cx('mt-1.5 text-xs', error ? 'text-red-700' : 'text-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function TextArea({ label, hint, error, className, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        aria-describedby={hint || error ? `${id}-hint` : undefined}
        className={cx(inputBase, 'min-h-32 py-3 leading-relaxed', error && 'border-red-500')}
        {...rest}
      />
      {(error || hint) && (
        <p id={`${id}-hint`} className={cx('mt-1.5 text-xs', error ? 'text-red-700' : 'text-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function SelectField({
  label,
  options,
  className,
  ...rest
}: { label: string; options: string[]; className?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <select id={id} className={cx(inputBase, 'h-12 appearance-none')} {...rest}>
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A − 3 + counter. */
export function Counter({
  label,
  hint,
  value,
  min = 0,
  max = 50,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min?: number
  max?: number
  onChange(v: number): void
}) {
  const btn =
    'grid size-9 place-items-center rounded-full border border-ink/25 text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/20'
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label.toLowerCase()}`}>
          <Minus className="size-4" />
        </button>
        <span className="w-6 text-center tabular-nums" aria-live="polite" aria-label={`${value} ${label.toLowerCase()}`}>
          {value}
        </span>
        <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label.toLowerCase()}`}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

// ── Dialogs ─────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose(): void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          'max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl outline-none sm:rounded-3xl',
          wide ? 'sm:max-w-4xl' : 'sm:max-w-md',
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  error?: string
  onConfirm(): void
  onClose(): void
}) {
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title}>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-2 text-muted">{body}</div>
      {error && (
        <div className="mt-4">
          <InlineError>{error}</InlineError>
        </div>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Keep it
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
      {children}
    </Link>
  )
}
