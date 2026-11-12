/**
 * The real backend client: the same `AbodeApi` contract, over HTTP, driven by
 * the route table in `contracts/routes.ts`.
 *
 * Switched on by setting `VITE_API_URL` (see `services/api.ts`). It has not
 * been run against a server yet, because there isn't one. When there is, the
 * contract is the checklist: every route in ROUTES must exist and answer with
 * the matching type.
 */
import {
  ApiError,
  codeForStatus,
  ROUTES,
  type AbodeApi,
  type ApiErrorBody,
  type RouteDef,
} from '../../contracts'
import { tokenStore } from '../tokenStore'

interface CallOptions {
  params?: Record<string, string>
  query?: object
  body?: unknown
  form?: FormData
}

export function createHttpApi(baseUrl: string): AbodeApi {
  const base = baseUrl.replace(/\/+$/, '')

  async function call<T>(route: RouteDef, opts: CallOptions = {}): Promise<T> {
    const path = route.path.replace(/:(\w+)/g, (_, key: string) => {
      const value = opts.params?.[key]
      if (value === undefined) throw new Error(`Missing route parameter :${key} for ${route.path}`)
      return encodeURIComponent(value)
    })
    const url = new URL(base + path, window.location.origin)
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }

    const headers: Record<string, string> = { Accept: 'application/json' }
    const token = tokenStore.get()
    if (token && route.auth !== 'none') headers.Authorization = `Bearer ${token}`

    let body: BodyInit | undefined
    if (opts.form) {
      body = opts.form // the browser sets the multipart boundary itself
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }

    let res: Response
    try {
      res = await fetch(url, { method: route.method, headers, body })
    } catch {
      throw new ApiError('NETWORK', 'Can’t reach the server. Check your connection and try again.')
    }

    if (res.status === 204) return undefined as T
    const data: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const err = data as Partial<ApiErrorBody> | null
      throw new ApiError(
        err?.code ?? codeForStatus(res.status),
        err?.message ?? `The server answered ${res.status}. Please try again.`,
        res.status,
      )
    }
    return data as T
  }

  const R = ROUTES
  return {
    auth: {
      signup: (body) => call(R.auth.signup, { body }),
      login: (body) => call(R.auth.login, { body }),
      me: () => call(R.auth.me),
      logout: () => call(R.auth.logout),
      updateProfile: (body) => call(R.auth.updateProfile, { body }),
    },
    listings: {
      search: (query) => call(R.listings.search, { query }),
      get: (id) => call(R.listings.get, { params: { id } }),
    },
    hosting: {
      myListings: () => call(R.hosting.myListings),
      getListing: (id) => call(R.hosting.getListing, { params: { id } }),
      createListing: (body) => call(R.hosting.createListing, { body }),
      updateListing: (id, body) => call(R.hosting.updateListing, { params: { id }, body }),
      setListingStatus: (id, status) => call(R.hosting.setListingStatus, { params: { id }, body: { status } }),
      deleteListing: (id) => call(R.hosting.deleteListing, { params: { id } }),
      reservations: () => call(R.hosting.reservations),
    },
    bookings: {
      create: (body) => call(R.bookings.create, { body }),
      myTrips: () => call(R.bookings.myTrips),
      cancel: (id) => call(R.bookings.cancel, { params: { id } }),
    },
    wishlist: {
      ids: () => call(R.wishlist.ids),
      list: () => call(R.wishlist.list),
      add: (listingId) => call(R.wishlist.add, { params: { listingId } }),
      remove: (listingId) => call(R.wishlist.remove, { params: { listingId } }),
    },
    uploads: {
      photo: (file) => {
        const form = new FormData()
        form.append('file', file, 'photo.jpg')
        return call(R.uploads.photo, { form })
      },
    },
  }
}
