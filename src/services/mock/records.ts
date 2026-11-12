/**
 * How the mock "server" stores things. Private to the mock: screens never see
 * these, only the contract types the API returns.
 */
import type { Booking, Listing, Review, User } from '../../contracts'

export interface UserRecord extends User {
  passwordHash: string
}

/** Rating and review count are worked out from reviews on every read, never stored. */
export type ListingRecord = Omit<Listing, 'rating' | 'reviewCount'>

export interface Tables {
  users: UserRecord[]
  listings: ListingRecord[]
  bookings: Booking[]
  reviews: Review[]
  /** userId → saved listing ids */
  wishlists: Record<string, string[]>
  /** token → userId */
  sessions: Record<string, string>
}
