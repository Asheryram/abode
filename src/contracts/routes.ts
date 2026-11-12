/**
 * The HTTP route behind each operation in `AbodeApi`.
 *
 * `satisfies RouteTable` means adding an operation to the interface without a
 * route here, or a route for an operation that does not exist, will not compile.
 * This table is also the endpoint list to hand to whoever builds the backend.
 */
import type { AbodeApi } from './api'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RouteDef {
  method: HttpMethod
  /** Relative to the API base URL. `:name` segments are filled from arguments. */
  path: string
  /**
   * - `required`: send the token; the server answers 401 without it.
   * - `optional`: send it if there is one; the answer may differ for the owner.
   * - `none`: public.
   */
  auth: 'required' | 'optional' | 'none'
}

type RouteTable = { [Group in keyof AbodeApi]: { [Op in keyof AbodeApi[Group]]: RouteDef } }

export const ROUTES = {
  auth: {
    signup: { method: 'POST', path: '/auth/signup', auth: 'none' },
    login: { method: 'POST', path: '/auth/login', auth: 'none' },
    me: { method: 'GET', path: '/auth/me', auth: 'required' },
    logout: { method: 'POST', path: '/auth/logout', auth: 'required' },
    updateProfile: { method: 'PATCH', path: '/me', auth: 'required' },
  },
  listings: {
    search: { method: 'GET', path: '/listings', auth: 'none' },
    get: { method: 'GET', path: '/listings/:id', auth: 'optional' },
  },
  hosting: {
    myListings: { method: 'GET', path: '/host/listings', auth: 'required' },
    getListing: { method: 'GET', path: '/host/listings/:id', auth: 'required' },
    createListing: { method: 'POST', path: '/host/listings', auth: 'required' },
    updateListing: { method: 'PUT', path: '/host/listings/:id', auth: 'required' },
    setListingStatus: { method: 'PATCH', path: '/host/listings/:id/status', auth: 'required' },
    deleteListing: { method: 'DELETE', path: '/host/listings/:id', auth: 'required' },
    reservations: { method: 'GET', path: '/host/reservations', auth: 'required' },
  },
  bookings: {
    create: { method: 'POST', path: '/bookings', auth: 'required' },
    myTrips: { method: 'GET', path: '/me/trips', auth: 'required' },
    cancel: { method: 'POST', path: '/bookings/:id/cancel', auth: 'required' },
  },
  wishlist: {
    ids: { method: 'GET', path: '/me/wishlist/ids', auth: 'required' },
    list: { method: 'GET', path: '/me/wishlist', auth: 'required' },
    add: { method: 'PUT', path: '/me/wishlist/:listingId', auth: 'required' },
    remove: { method: 'DELETE', path: '/me/wishlist/:listingId', auth: 'required' },
  },
  uploads: {
    photo: { method: 'POST', path: '/uploads/photos', auth: 'required' },
  },
} as const satisfies RouteTable
