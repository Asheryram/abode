/** What the frontend sends to the backend. */
import type { ISODate, Listing, PaymentMethod, PropertyType } from './models'

export interface SignupRequest {
  name: string
  email: string
  /** At least 8 characters. */
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface UpdateProfileRequest {
  name: string
  phone?: string
  bio?: string
}

/** Sent as query-string parameters. Every field is optional. */
export interface ListingSearchQuery {
  /** Free text matched against city, region, address and title. */
  location?: string
  /** Only places free for this whole stay. Needs both dates. */
  checkIn?: ISODate
  checkOut?: ISODate
  /** Only places that fit at least this many guests. */
  guests?: number
  type?: PropertyType
  maxPrice?: number
}

/** The fields a host fills in. Everything else on a Listing is set by the server. */
export type ListingInput = Omit<Listing, 'id' | 'hostId' | 'rating' | 'reviewCount' | 'createdAt' | 'updatedAt'>

export interface CreateBookingRequest {
  listingId: string
  checkIn: ISODate
  checkOut: ISODate
  guests: number
  paymentMethod: PaymentMethod
  messageToHost?: string
}
