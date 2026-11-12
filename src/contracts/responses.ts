/** What the backend sends back, where it is more than a single model. */
import type { HostProfile, ISODate, Listing, Review, User } from './models'

/** Returned by signup and login. The client sends `token` back as `Authorization: Bearer <token>`. */
export interface AuthSession {
  token: string
  user: User
}

/** Everything the listing page needs, in one round trip. */
export interface ListingDetail {
  listing: Listing
  host: HostProfile
  /** Newest first. */
  reviews: Review[]
  /** Future nights already booked, so the calendar can block them. */
  bookedNights: ISODate[]
}

export interface UploadedPhoto {
  /** Absolute URL to store on the listing. */
  url: string
}
