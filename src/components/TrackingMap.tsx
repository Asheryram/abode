/**
 * A stylised map of the agent's trip. It draws no real streets: the maps
 * provider is not chosen yet (DEP-04), and the shape is enough to show
 * progress. When live location stops, the dot disappears immediately (TRK-022).
 */
import type { TrackingView } from '../contracts'
import { cx } from '../design-system'

const ROUTE = [
  { x: 0.08, y: 0.82 },
  { x: 0.28, y: 0.74 },
  { x: 0.4, y: 0.52 },
  { x: 0.62, y: 0.48 },
  { x: 0.74, y: 0.3 },
  { x: 0.88, y: 0.2 },
]

export function TrackingMap({ tracking, stale, className }: { tracking?: TrackingView; stale?: boolean; className?: string }) {
  const W = 600
  const H = 320
  const path = ROUTE.map((p, i) => `${i ? 'L' : 'M'}${p.x * W} ${p.y * H}`).join(' ')
  const dest = ROUTE[ROUTE.length - 1]
  const pos = tracking?.sharing ? tracking.position : null
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={pos ? 'Map showing the agent’s position on the way to the property' : 'Map of the property area. Live position is not being shared.'} className={cx('w-full rounded-2xl border border-line bg-[var(--color-neutral-bg)]', className)}>
      <g stroke="var(--color-line)" strokeWidth="10" fill="none">
        <path d={`M0 ${H * 0.6} L${W} ${H * 0.35}`} />
        <path d={`M${W * 0.3} 0 L${W * 0.45} ${H}`} />
        <path d={`M${W * 0.7} 0 L${W * 0.6} ${H}`} />
      </g>
      <path d={path} fill="none" stroke="var(--color-brand-300)" strokeWidth="5" strokeDasharray="2 10" strokeLinecap="round" />
      <g transform={`translate(${dest.x * W} ${dest.y * H})`}>
        <circle r="16" fill="var(--color-brand-700)" />
        <path d="M-7 1 0-6l7 7v6h-4V3h-6v4h-4z" fill="white" />
      </g>
      {pos && (
        <g transform={`translate(${pos.x * W} ${pos.y * H})`} opacity={stale ? 0.45 : 1}>
          {!stale && <circle r="22" fill="var(--color-live)" opacity="0.18" className="motion-safe:animate-ping" />}
          {tracking?.lowAccuracy && <circle r="34" fill="var(--color-warning-bg)" stroke="var(--color-warning-border)" strokeDasharray="4 4" opacity="0.8" />}
          <circle r="10" fill={stale ? 'var(--color-stale)' : 'var(--color-live)'} stroke="white" strokeWidth="3" />
        </g>
      )}
    </svg>
  )
}
