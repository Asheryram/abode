/**
 * Components that carry the marketplace's trust and money rules. Screens use
 * these rather than formatting prices or badges themselves.
 */
import { BadgeCheck, House, Megaphone, ShieldQuestion } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ISODate } from '../contracts'
import { resolveTrust, type VerificationSummary } from './logic'
import { formatMoney, type MoneyAmount, type PriceBasis } from './money'
import { cx } from './primitives'
import { ds } from './strings'

// ── Money ───────────────────────────────────────────────────────────────────

/** An amount exactly as the server sent it. No arithmetic, ever (FE-GLB-001). */
export function Money({ amount, hideZeroFraction, className }: { amount: MoneyAmount; hideZeroFraction?: boolean; className?: string }) {
  return <span className={cx('tabular-nums', className)}>{formatMoney(amount, { hideZeroFraction })}</span>
}

/**
 * A headline price. The basis is required so no price is ever shown without
 * it (PROP-012, FE-GLB-003).
 */
export function PriceTag({
  amount,
  basis,
  size = 'md',
}: {
  amount: MoneyAmount
  basis: PriceBasis
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' }
  const basisText = ds.basis[basis]
  return (
    <span className={cx('inline-flex items-baseline gap-1', sizes[size])}>
      <Money amount={amount} hideZeroFraction className="font-bold text-ink" />
      {basisText && <span className="text-sm font-normal text-muted">{basisText}</span>}
    </span>
  )
}

export interface PriceLine {
  label: string
  amount: MoneyAmount
  /** Taxes are listed apart from fees (RATE-011). */
  kind: 'charge' | 'tax' | 'discount'
}

/**
 * The server's itemisation, shown line by line, and the server's total.
 * It deliberately does not add the lines up: the total comes from the API.
 */
export function PriceBreakdown({ lines, total, note }: { lines: PriceLine[]; total: MoneyAmount; note?: ReactNode }) {
  const charges = lines.filter((l) => l.kind !== 'tax')
  const taxes = lines.filter((l) => l.kind === 'tax')
  const row = (l: PriceLine, i: number) => (
    <div key={`${l.label}-${i}`} className="flex justify-between gap-4 py-1.5 text-[15px]">
      <dt className="text-muted">{l.label}</dt>
      <dd className={cx(l.kind === 'discount' && 'text-success-fg')}>
        <Money amount={l.amount} />
      </dd>
    </div>
  )
  return (
    <div>
      <dl>
        {charges.map(row)}
        {taxes.length > 0 && (
          <>
            <p className="mt-3 text-xs font-semibold tracking-wide text-muted uppercase">{ds.breakdown.taxes}</p>
            {taxes.map(row)}
          </>
        )}
        <div className="mt-3 flex justify-between gap-4 border-t border-line pt-3 font-bold">
          <dt>{ds.breakdown.total}</dt>
          <dd>
            <Money amount={total} />
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted">{note ?? ds.breakdown.serverNote}</p>
    </div>
  )
}

// ── Promoted ────────────────────────────────────────────────────────────────

/**
 * Paid placement label (SEA-021, ADS-012). No close button, no prop to hide
 * it, and screen readers hear that the placement is paid.
 */
export function PromotedLabel() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-promoted-bg px-2 py-0.5 text-xs font-semibold text-promoted-fg">
      <Megaphone className="size-3.5" aria-hidden />
      <span aria-hidden>{ds.promoted.label}</span>
      <span className="sr-only">{ds.promoted.srLabel}</span>
    </span>
  )
}

// ── Trust ───────────────────────────────────────────────────────────────────

/**
 * Verification badge from the API summary (TRU-022 to TRU-025). Three looks
 * that cannot be confused; an expired verification shows as unverified.
 * Every badge links to the public page that says what it does and does not mean.
 */
export function TrustBadge({
  verification,
  today,
  explainerHref = '/trust',
}: {
  verification?: VerificationSummary
  /** Today's date in the property's calendar. Injected so tests control it. */
  today: ISODate
  explainerHref?: string
}) {
  const kind = resolveTrust(verification, today)
  const looks = {
    agency: { icon: BadgeCheck, text: ds.trust.agency, cls: 'bg-trust-agency-bg text-trust-agency-fg' },
    owner: { icon: House, text: ds.trust.owner, cls: 'border border-trust-owner-border bg-trust-owner-bg text-trust-owner-fg' },
    unverified: { icon: ShieldQuestion, text: ds.trust.unverified, cls: 'bg-neutral-bg text-neutral-fg' },
  }[kind]
  const Icon = looks.icon
  return (
    <Link
      to={explainerHref}
      className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', looks.cls)}
      aria-label={`${looks.text}. ${ds.trust.learnMore}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {looks.text}
    </Link>
  )
}

// ── Status ──────────────────────────────────────────────────────────────────

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<Tone, string> = {
  neutral: 'bg-neutral-bg text-neutral-fg border-neutral-border',
  success: 'bg-success-bg text-success-fg border-success-border',
  warning: 'bg-warning-bg text-warning-fg border-warning-border',
  danger: 'bg-danger-bg text-danger-fg border-danger-border',
  info: 'bg-info-bg text-info-fg border-info-border',
}

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', TONES[tone])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  )
}

export type BookingState = keyof typeof ds.status.booking
export type ListingState = keyof typeof ds.status.listing
export type ViewingState = keyof typeof ds.status.viewing

const BOOKING_TONE: Record<BookingState, Tone> = {
  pending_payment: 'warning',
  confirmed: 'success',
  in_stay: 'info',
  completed: 'neutral',
  cancelled_by_guest: 'neutral',
  cancelled_by_host: 'danger',
  cancelled_by_platform: 'danger',
  no_show: 'danger',
  disputed: 'danger',
}

const LISTING_TONE: Record<ListingState, Tone> = {
  draft: 'neutral',
  submitted: 'info',
  in_review: 'info',
  published: 'success',
  paused: 'warning',
  expired: 'warning',
  withdrawn: 'danger',
  let_or_sold: 'neutral',
  archived: 'neutral',
}

const VIEWING_TONE: Record<ViewingState, Tone> = {
  requested: 'info',
  proposed: 'info',
  confirmed: 'success',
  agent_en_route: 'info',
  arrived: 'success',
  in_progress: 'success',
  completed: 'neutral',
  cancelled: 'neutral',
  no_show: 'danger',
}

export const BookingStatus = ({ state }: { state: BookingState }) => (
  <StatusPill tone={BOOKING_TONE[state]}>{ds.status.booking[state]}</StatusPill>
)
export const ListingStatusPill = ({ state }: { state: ListingState }) => (
  <StatusPill tone={LISTING_TONE[state]}>{ds.status.listing[state]}</StatusPill>
)
export const ViewingStatus = ({ state }: { state: ViewingState }) => (
  <StatusPill tone={VIEWING_TONE[state]}>{ds.status.viewing[state]}</StatusPill>
)

/** Pending and settled refunds must never look alike (PAY-034). */
export const RefundStatus = ({ settled }: { settled: boolean }) => (
  <StatusPill tone={settled ? 'success' : 'warning'}>{settled ? ds.status.refund.settled : ds.status.refund.pending}</StatusPill>
)
