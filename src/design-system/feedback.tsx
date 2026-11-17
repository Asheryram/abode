import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from './primitives'
import type { Tone } from './marketplace'
import { ds } from './strings'

const ALERT: Record<Exclude<Tone, 'neutral'>, { icon: LucideIcon; cls: string }> = {
  info: { icon: Info, cls: 'border-info-border bg-info-bg text-info-fg' },
  success: { icon: CircleCheck, cls: 'border-success-border bg-success-bg text-success-fg' },
  warning: { icon: TriangleAlert, cls: 'border-warning-border bg-warning-bg text-warning-fg' },
  danger: { icon: CircleAlert, cls: 'border-danger-border bg-danger-bg text-danger-fg' },
}

/**
 * A message box. `danger` interrupts screen readers; the others wait politely.
 * `reference` shows the API correlation ID for support (FE-GLB-010).
 */
export function Alert({
  tone,
  title,
  children,
  reference,
}: {
  tone: keyof typeof ALERT
  title: string
  children?: ReactNode
  reference?: string
}) {
  const { icon: Icon, cls } = ALERT[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-xl border px-4 py-3', cls)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5">{children}</div>}
        {reference && <p className="mt-1.5 font-mono text-xs">{ds.alert.reference(reference)}</p>}
      </div>
    </div>
  )
}

/**
 * Back office only: shows the environment and payment mode on every page,
 * with no way to close it (ADM-033, PAY-011). Renders nothing in production
 * with live payments.
 */
export function EnvironmentBanner({ environment, paymentMode }: { environment: string; paymentMode: 'live' | 'sandbox' | 'fake' }) {
  if (environment === 'production' && paymentMode === 'live') return null
  return (
    <div className="sticky top-0 z-50 bg-warning-fg px-4 py-1.5 text-center text-xs font-bold tracking-wide text-white uppercase">
      {ds.environment.label(environment, paymentMode)}
    </div>
  )
}
