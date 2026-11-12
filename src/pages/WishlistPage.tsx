import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ListingCard, ListingCardSkeleton, ListingGrid } from '../components/ListingCard'
import { buttonClass, EmptyState, ErrorState } from '../components/ui'
import { useWishlist } from '../context/WishlistContext'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'

export default function WishlistPage() {
  const { ids } = useWishlist()
  const { data, error, reload } = useAsync(() => api.wishlist.list(), [])
  // Un-hearting a place here takes it off the page straight away.
  const saved = data?.filter((l) => ids.has(l.id))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Wishlist</h1>
      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !saved ? (
        <ListingGrid>
          {Array.from({ length: 4 }, (_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </ListingGrid>
      ) : saved.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          body="Tap the heart on any place to save it here for later."
          action={
            <Link to="/" className={buttonClass('primary')}>
              Explore stays
            </Link>
          }
        />
      ) : (
        <ListingGrid>
          {saved.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </ListingGrid>
      )}
    </div>
  )
}
