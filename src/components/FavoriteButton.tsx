import { Heart } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWishlist } from '../context/WishlistContext'
import { cx } from './ui'

/** Heart toggle. Logged-out visitors are sent to log in and brought back. */
export function FavoriteButton({ listingId, variant = 'overlay' }: { listingId: string; variant?: 'overlay' | 'inline' }) {
  const { user } = useAuth()
  const { ids, toggle } = useWishlist()
  const navigate = useNavigate()
  const location = useLocation()
  const saved = ids.has(listingId)

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) navigate('/login', { state: { from: location } })
    else toggle(listingId)
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold underline-offset-4 hover:bg-stone-100"
      >
        <Heart className={cx('size-4', saved && 'fill-rose-500 text-rose-500')} aria-hidden />
        {saved ? 'Saved' : 'Save'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      className="grid size-9 place-items-center rounded-full transition-transform active:scale-90"
    >
      <Heart
        className={cx('size-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]', saved ? 'fill-rose-500 text-white' : 'fill-black/30 text-white')}
        strokeWidth={2}
        aria-hidden
      />
    </button>
  )
}
