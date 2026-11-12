import { Link } from 'react-router-dom'
import { BRAND } from '../config'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 text-brand-700" aria-label={`${BRAND} home`}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path d="M8 15.5 16 8l8 7.5V24a1 1 0 0 1-1 1h-4.5v-5.5h-5V25H9a1 1 0 0 1-1-1z" fill="#fff" />
        <circle cx="16" cy="15" r="1.8" fill="var(--color-accent-500)" />
      </svg>
      {!compact && <span className="text-xl font-extrabold tracking-tight">{BRAND.toLowerCase()}</span>}
    </Link>
  )
}
