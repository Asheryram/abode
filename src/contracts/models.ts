/**
 * The shapes the backend sends back. These are the source of truth: the mock
 * API, the HTTP client and every screen are typed against them, so changing a
 * field here makes TypeScript point at everything that has to follow.
 *
 * Field names are what the JSON on the wire should use.
 */

/** A calendar day, `YYYY-MM-DD`, no time or zone. Used for check-in/check-out. */
export type ISODate = string
/** A moment in time, full ISO 8601 with zone, e.g. `2026-11-12T09:30:00.000Z`. */
export type ISODateTime = string

/** The signed-in person's own account. Only ever returned to that person. */
export interface User {
  id: string
  name: string
  email: string
  phone?: string
  bio?: string
  createdAt: ISODateTime
}

/** What any visitor may see about a host. No email or phone. */
export interface HostProfile {
  id: string
  name: string
  bio?: string
  createdAt: ISODateTime
  /** Listings this host currently has live. */
  listingCount: number
  /** Reviews across all of this host's live listings. */
  reviewCount: number
}

/** What a host sees about a guest who has booked with them. */
export interface GuestProfile {
  id: string
  name: string
  phone?: string
}

export type PropertyType = 'house' | 'apartment' | 'villa' | 'cabin' | 'guesthouse' | 'beach'
export type PlaceType = 'entire' | 'private-room' | 'shared-room'

/**
 * - `draft`: still being written, only the host can see it.
 * - `listed`: live, guests can find and book it.
 * - `unlisted`: paused by the host. Existing bookings stand, no new ones.
 */
export type ListingStatus = 'draft' | 'listed' | 'unlisted'

export type AmenityId =
  | 'wifi'
  | 'ac'
  | 'kitchen'
  | 'parking'
  | 'pool'
  | 'tv'
  | 'washer'
  | 'generator'
  | 'water-tank'
  | 'workspace'
  | 'security'
  | 'gym'
  | 'breakfast'
  | 'beach-access'

export interface ListingLocation {
  address: string
  city: string
  region: string
  country: string
}

export interface Listing {
  id: string
  hostId: string
  status: ListingStatus
  title: string
  description: string
  propertyType: PropertyType
  placeType: PlaceType
  location: ListingLocation
  maxGuests: number
  bedrooms: number
  beds: number
  bathrooms: number
  amenities: AmenityId[]
  /** Absolute image URLs. The first one is the cover photo. */
  photos: string[]
  /** Whole cedis. */
  pricePerNight: number
  /** Whole cedis, charged once per stay. */
  cleaningFee: number
  /** Average review score from 1 to 5, computed by the server. `null` until the first review. */
  rating: number | null
  reviewCount: number
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface Review {
  id: string
  listingId: string
  authorName: string
  /** 1 to 5. */
  rating: number
  comment: string
  createdAt: ISODateTime
}

export type BookingStatus = 'confirmed' | 'cancelled'
export type PaymentMethod = 'momo' | 'card'

/**
 * A confirmed stay. Prices are copied onto the booking when it is made, so a
 * host changing their price later never changes what a guest already agreed to.
 */
export interface Booking {
  id: string
  listingId: string
  guestId: string
  checkIn: ISODate
  /** The day the guest leaves. That night is not part of the stay. */
  checkOut: ISODate
  guests: number
  nights: number
  pricePerNight: number
  cleaningFee: number
  serviceFee: number
  total: number
  paymentMethod: PaymentMethod
  messageToHost?: string
  status: BookingStatus
  createdAt: ISODateTime
}

/** A booking as the guest sees it, with the place attached. */
export interface Trip extends Booking {
  listing: Listing
}

/** A booking as the host sees it, with the place and the guest attached. */
export interface Reservation extends Booking {
  listing: Listing
  guest: GuestProfile
}
