/**
 * Every operation the frontend needs from the backend.
 *
 * Both the mock (`services/mock`) and the real HTTP client (`services/http`)
 * are declared as `AbodeApi`, so neither can drift from this file without a
 * compile error. Screens only ever call `api.*` from `services/api.ts`.
 *
 * Who is calling is never a parameter: the server works it out from the
 * bearer token, as it must, or anyone could pass someone else's id.
 *
 * Each operation's HTTP method and path is in `routes.ts`.
 */
import type { Booking, Listing, ListingStatus, Reservation, Trip, User } from './models'
import type {
  CreateBookingRequest,
  ListingInput,
  ListingSearchQuery,
  LoginRequest,
  SignupRequest,
  UpdateProfileRequest,
} from './requests'
import type { AuthSession, ListingDetail, UploadedPhoto } from './responses'

export interface AbodeApi {
  auth: {
    signup(body: SignupRequest): Promise<AuthSession>
    login(body: LoginRequest): Promise<AuthSession>
    /** The current user. Rejects with `UNAUTHORIZED` if the token is missing or expired. */
    me(): Promise<User>
    logout(): Promise<void>
    updateProfile(body: UpdateProfileRequest): Promise<User>
  }

  listings: {
    /** Live listings only, newest first. */
    search(query: ListingSearchQuery): Promise<Listing[]>
    /** Live listings for everyone; the host also gets their own drafts and unlisted places. */
    get(id: string): Promise<ListingDetail>
  }

  hosting: {
    /** All of the current user's listings, in any status, most recently edited first. */
    myListings(): Promise<Listing[]>
    /** One of the current user's listings, in any status. For the edit screen. */
    getListing(id: string): Promise<Listing>
    /** Anything but a draft must pass the publish rules, or `BAD_REQUEST`. */
    createListing(body: ListingInput): Promise<Listing>
    updateListing(id: string, body: ListingInput): Promise<Listing>
    setListingStatus(id: string, status: ListingStatus): Promise<Listing>
    /** `CONFLICT` while the place has upcoming stays. */
    deleteListing(id: string): Promise<void>
    /** Bookings on any of the current user's listings, by check-in date. */
    reservations(): Promise<Reservation[]>
  }

  bookings: {
    /** `CONFLICT` if any night was taken in the meantime. Payment is out of scope for now. */
    create(body: CreateBookingRequest): Promise<Booking>
    /** The current user's bookings as a guest, by check-in date. */
    myTrips(): Promise<Trip[]>
    /** Only before check-in. */
    cancel(id: string): Promise<Booking>
  }

  wishlist: {
    ids(): Promise<string[]>
    /** Saved places that are still live. */
    list(): Promise<Listing[]>
    add(listingId: string): Promise<string[]>
    remove(listingId: string): Promise<string[]>
  }

  uploads: {
    /** Sent as `multipart/form-data` with the image in a field named `file`. */
    photo(file: Blob): Promise<UploadedPhoto>
  }
}
