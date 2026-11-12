/**
 * A pretend backend that runs in the browser, implementing the contract in
 * `src/contracts`. Data is kept in IndexedDB and each call waits a moment,
 * like a real round trip, so loading states show up.
 *
 * It enforces the same rules the real server must: who is calling comes from
 * the token, hosts only touch their own listings, dates can't double-book.
 */
import {
  ApiError,
  type AbodeApi,
  type Booking,
  type HostProfile,
  type Listing,
  type ListingInput,
  type Review,
  type User,
} from '../../contracts'
import { isISODate, nightsOf, staysOverlap, today } from '../../lib/dates'
import { publishProblems } from '../../lib/listingRules'
import { quoteStay } from '../../lib/pricing'
import { tokenStore } from '../tokenStore'
import { kvClear, kvGet, kvSet } from './db'
import type { ListingRecord, Tables, UserRecord } from './records'
import { buildSeed, SEED_VERSION } from './seed'

// ── Plumbing ────────────────────────────────────────────────────────────────

const latency = () => new Promise((r) => setTimeout(r, 200 + Math.random() * 250))

/** Not `crypto.randomUUID`, which is missing outside HTTPS, e.g. on a phone over the LAN. */
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

/**
 * NOT real security. A real server hashes passwords with something slow like
 * bcrypt. This only keeps plain-text passwords out of browser storage.
 */
function mockHash(email: string, password: string): string {
  const input = `${email.toLowerCase()}::${password}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

let seeding: Promise<void> | null = null

function ensureSeeded(): Promise<void> {
  seeding ??= (async () => {
    if ((await kvGet<number>('seedVersion')) === SEED_VERSION) return
    await kvClear()
    const seed: Tables = { ...buildSeed(mockHash), sessions: {} }
    for (const key of Object.keys(seed) as (keyof Tables)[]) await kvSet(key, seed[key])
    await kvSet('seedVersion', SEED_VERSION)
  })().catch((e) => {
    seeding = null
    throw e
  })
  return seeding
}

const EMPTY: { [K in keyof Tables]: () => Tables[K] } = {
  users: () => [],
  listings: () => [],
  bookings: () => [],
  reviews: () => [],
  wishlists: () => ({}),
  sessions: () => ({}),
}

async function read<K extends keyof Tables>(name: K): Promise<Tables[K]> {
  await ensureSeeded()
  return (await kvGet<Tables[K]>(name)) ?? EMPTY[name]()
}

const write = <K extends keyof Tables>(name: K, value: Tables[K]) => kvSet(name, value)

const toUser = ({ passwordHash: _hidden, ...u }: UserRecord): User => u

function withRating(l: ListingRecord, reviews: Review[]): Listing {
  const mine = reviews.filter((r) => r.listingId === l.id)
  const rating = mine.length ? mine.reduce((s, r) => s + r.rating, 0) / mine.length : null
  return { ...l, rating, reviewCount: mine.length }
}

const confirmedFor = (bookings: Booking[], listingId: string) =>
  bookings.filter((b) => b.listingId === listingId && b.status === 'confirmed')

/** Who the token belongs to, or null. What a real server's auth middleware does. */
async function viewerId(): Promise<string | null> {
  const token = tokenStore.get()
  if (!token) return null
  return (await read('sessions'))[token] ?? null
}

async function requireViewer(): Promise<string> {
  const id = await viewerId()
  if (!id) throw new ApiError('UNAUTHORIZED', 'Please log in to continue.')
  return id
}

async function startSession(user: UserRecord) {
  const token = uid('tok')
  await write('sessions', { ...(await read('sessions')), [token]: user.id })
  return { token, user: toUser(user) }
}

async function ownListing(hostId: string, id: string): Promise<ListingRecord> {
  const listing = (await read('listings')).find((l) => l.id === id)
  if (!listing || listing.hostId !== hostId) throw new ApiError('NOT_FOUND', 'Listing not found.')
  return listing
}

function assertPublishable(input: ListingInput) {
  if (input.status === 'draft') return
  const problems = publishProblems(input)
  if (problems.length) throw new ApiError('BAD_REQUEST', problems[0]!)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── The API ─────────────────────────────────────────────────────────────────

export const mockApi: AbodeApi = {
  auth: {
    async signup(body) {
      await latency()
      const name = body.name.trim()
      const email = body.email.trim().toLowerCase()
      if (name.length < 2) throw new ApiError('BAD_REQUEST', 'Please enter your full name.')
      if (!EMAIL_RE.test(email)) throw new ApiError('BAD_REQUEST', 'That email address doesn’t look right.')
      if (body.password.length < 8) throw new ApiError('BAD_REQUEST', 'Your password needs at least 8 characters.')

      const users = await read('users')
      if (users.some((u) => u.email === email)) {
        throw new ApiError('CONFLICT', 'An account with this email already exists. Try logging in.')
      }
      const user: UserRecord = {
        id: uid('usr'),
        name,
        email,
        passwordHash: mockHash(email, body.password),
        createdAt: new Date().toISOString(),
      }
      await write('users', [...users, user])
      return startSession(user)
    },

    async login(body) {
      await latency()
      const email = body.email.trim().toLowerCase()
      const user = (await read('users')).find((u) => u.email === email)
      if (!user || user.passwordHash !== mockHash(email, body.password)) {
        throw new ApiError('UNAUTHORIZED', 'Email or password is incorrect.')
      }
      return startSession(user)
    },

    async me() {
      const id = await requireViewer()
      const user = (await read('users')).find((u) => u.id === id)
      if (!user) throw new ApiError('UNAUTHORIZED', 'Please log in to continue.')
      return toUser(user)
    },

    async logout() {
      const token = tokenStore.get()
      if (!token) return
      const { [token]: _gone, ...rest } = await read('sessions')
      await write('sessions', rest)
    },

    async updateProfile(body) {
      await latency()
      const id = await requireViewer()
      if (body.name.trim().length < 2) throw new ApiError('BAD_REQUEST', 'Please enter your full name.')
      const users = await read('users')
      const i = users.findIndex((u) => u.id === id)
      if (i < 0) throw new ApiError('UNAUTHORIZED', 'Please log in to continue.')
      const updated: UserRecord = {
        ...users[i]!,
        name: body.name.trim(),
        phone: body.phone?.trim() || undefined,
        bio: body.bio?.trim() || undefined,
      }
      users[i] = updated
      await write('users', users)
      return toUser(updated)
    },
  },

  listings: {
    async search(query) {
      await latency()
      const [listings, bookings, reviews] = await Promise.all([read('listings'), read('bookings'), read('reviews')])
      const q = query.location?.trim().toLowerCase()
      const { checkIn, checkOut } = query
      const hasDates = isISODate(checkIn) && isISODate(checkOut) && checkIn < checkOut

      return listings
        .filter((l) => l.status === 'listed')
        .filter((l) => !query.type || l.propertyType === query.type)
        .filter((l) => !query.guests || l.maxGuests >= query.guests)
        .filter((l) => !query.maxPrice || l.pricePerNight <= query.maxPrice)
        .filter((l) => {
          if (!q) return true
          const { address, city, region, country } = l.location
          return [address, city, region, country, l.title].join(' ').toLowerCase().includes(q)
        })
        .filter(
          (l) =>
            !hasDates ||
            !confirmedFor(bookings, l.id).some((b) => staysOverlap(checkIn, checkOut, b.checkIn, b.checkOut)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((l) => withRating(l, reviews))
    },

    async get(id) {
      await latency()
      const [listings, bookings, reviews, users, viewer] = await Promise.all([
        read('listings'),
        read('bookings'),
        read('reviews'),
        read('users'),
        viewerId(),
      ])
      const listing = listings.find((l) => l.id === id)
      // A host can preview their own drafts and unlisted places. Everyone else gets a 404.
      if (!listing || (listing.status !== 'listed' && listing.hostId !== viewer)) {
        throw new ApiError('NOT_FOUND', 'This place isn’t available.')
      }
      const host = users.find((u) => u.id === listing.hostId)
      if (!host) throw new ApiError('NOT_FOUND', 'This place isn’t available.')

      const liveIds = new Set(listings.filter((l) => l.hostId === host.id && l.status === 'listed').map((l) => l.id))
      const hostProfile: HostProfile = {
        id: host.id,
        name: host.name,
        bio: host.bio,
        createdAt: host.createdAt,
        listingCount: liveIds.size,
        reviewCount: reviews.filter((r) => liveIds.has(r.listingId)).length,
      }

      return {
        listing: withRating(listing, reviews),
        host: hostProfile,
        reviews: reviews.filter((r) => r.listingId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        bookedNights: confirmedFor(bookings, id)
          .filter((b) => b.checkOut > today())
          .flatMap((b) => nightsOf(b.checkIn, b.checkOut)),
      }
    },
  },

  hosting: {
    async myListings() {
      await latency()
      const hostId = await requireViewer()
      const [listings, reviews] = await Promise.all([read('listings'), read('reviews')])
      return listings
        .filter((l) => l.hostId === hostId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((l) => withRating(l, reviews))
    },

    async getListing(id) {
      await latency()
      const listing = await ownListing(await requireViewer(), id)
      return withRating(listing, await read('reviews'))
    },

    async createListing(body) {
      await latency()
      const hostId = await requireViewer()
      assertPublishable(body)
      const now = new Date().toISOString()
      const listing: ListingRecord = { ...body, id: uid('lst'), hostId, createdAt: now, updatedAt: now }
      await write('listings', [...(await read('listings')), listing])
      return withRating(listing, [])
    },

    async updateListing(id, body) {
      await latency()
      const hostId = await requireViewer()
      assertPublishable(body)
      const listings = await read('listings')
      const i = listings.findIndex((l) => l.id === id && l.hostId === hostId)
      if (i < 0) throw new ApiError('NOT_FOUND', 'Listing not found.')
      const { id: _id, hostId: _host, createdAt } = listings[i]!
      const updated: ListingRecord = { ...body, id, hostId, createdAt, updatedAt: new Date().toISOString() }
      listings[i] = updated
      await write('listings', listings)
      return withRating(updated, await read('reviews'))
    },

    async setListingStatus(id, status) {
      const hostId = await requireViewer()
      const { id: _id, hostId: _host, createdAt: _c, updatedAt: _u, ...input } = await ownListing(hostId, id)
      return mockApi.hosting.updateListing(id, { ...input, status })
    },

    async deleteListing(id) {
      await latency()
      const hostId = await requireViewer()
      await ownListing(hostId, id)
      const upcoming = confirmedFor(await read('bookings'), id).filter((b) => b.checkOut > today())
      if (upcoming.length) {
        throw new ApiError(
          'CONFLICT',
          `This place has ${upcoming.length} upcoming stay${upcoming.length === 1 ? '' : 's'}. Unlist it instead so nobody new can book.`,
        )
      }
      await write(
        'listings',
        (await read('listings')).filter((l) => l.id !== id),
      )
    },

    async reservations() {
      await latency()
      const hostId = await requireViewer()
      const [listings, bookings, users, reviews] = await Promise.all([
        read('listings'),
        read('bookings'),
        read('users'),
        read('reviews'),
      ])
      const mine = new Map(listings.filter((l) => l.hostId === hostId).map((l) => [l.id, l]))
      return bookings
        .filter((b) => mine.has(b.listingId))
        .flatMap((b) => {
          const guest = users.find((u) => u.id === b.guestId)
          if (!guest) return []
          return [
            {
              ...b,
              listing: withRating(mine.get(b.listingId)!, reviews),
              guest: { id: guest.id, name: guest.name, phone: guest.phone },
            },
          ]
        })
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    },
  },

  bookings: {
    async create(body) {
      await latency()
      const guestId = await requireViewer()
      const [listings, bookings] = await Promise.all([read('listings'), read('bookings')])
      const listing = listings.find((l) => l.id === body.listingId && l.status === 'listed')
      if (!listing) throw new ApiError('NOT_FOUND', 'This place is no longer taking bookings.')
      if (listing.hostId === guestId) throw new ApiError('FORBIDDEN', 'You can’t book your own place.')
      if (!isISODate(body.checkIn) || !isISODate(body.checkOut) || body.checkIn >= body.checkOut) {
        throw new ApiError('BAD_REQUEST', 'Choose a check-in date and a later check-out date.')
      }
      if (body.checkIn < today()) throw new ApiError('BAD_REQUEST', 'Check-in can’t be in the past.')
      if (!Number.isInteger(body.guests) || body.guests < 1 || body.guests > listing.maxGuests) {
        throw new ApiError('BAD_REQUEST', `This place fits up to ${listing.maxGuests} guests.`)
      }
      const clash = confirmedFor(bookings, listing.id).some((b) =>
        staysOverlap(body.checkIn, body.checkOut, b.checkIn, b.checkOut),
      )
      if (clash) throw new ApiError('CONFLICT', 'Someone just booked some of those nights. Please pick other dates.')

      const q = quoteStay(listing, body.checkIn, body.checkOut)
      const booking: Booking = {
        id: uid('bkg'),
        listingId: listing.id,
        guestId,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        guests: body.guests,
        nights: q.nights,
        pricePerNight: q.pricePerNight,
        cleaningFee: q.cleaningFee,
        serviceFee: q.serviceFee,
        total: q.total,
        paymentMethod: body.paymentMethod,
        messageToHost: body.messageToHost?.trim() || undefined,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      }
      await write('bookings', [...bookings, booking])
      return booking
    },

    async myTrips() {
      await latency()
      const guestId = await requireViewer()
      const [listings, bookings, reviews] = await Promise.all([read('listings'), read('bookings'), read('reviews')])
      return bookings
        .filter((b) => b.guestId === guestId)
        .flatMap((b) => {
          const listing = listings.find((l) => l.id === b.listingId)
          return listing ? [{ ...b, listing: withRating(listing, reviews) }] : []
        })
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    },

    async cancel(id) {
      await latency()
      const guestId = await requireViewer()
      const bookings = await read('bookings')
      const b = bookings.find((x) => x.id === id && x.guestId === guestId)
      if (!b) throw new ApiError('NOT_FOUND', 'Booking not found.')
      if (b.status === 'cancelled') return b
      if (b.checkIn <= today()) throw new ApiError('BAD_REQUEST', 'This stay has already started, so it can’t be cancelled here.')
      b.status = 'cancelled'
      await write('bookings', bookings)
      return b
    },
  },

  wishlist: {
    async ids() {
      const userId = await requireViewer()
      return (await read('wishlists'))[userId] ?? []
    },

    async list() {
      await latency()
      const userId = await requireViewer()
      const [all, listings, reviews] = await Promise.all([read('wishlists'), read('listings'), read('reviews')])
      return (all[userId] ?? [])
        .map((id) => listings.find((l) => l.id === id && l.status === 'listed'))
        .filter((l): l is ListingRecord => !!l)
        .map((l) => withRating(l, reviews))
    },

    async add(listingId) {
      const userId = await requireViewer()
      const all = await read('wishlists')
      const current = all[userId] ?? []
      const next = current.includes(listingId) ? current : [...current, listingId]
      await write('wishlists', { ...all, [userId]: next })
      return next
    },

    async remove(listingId) {
      const userId = await requireViewer()
      const all = await read('wishlists')
      const next = (all[userId] ?? []).filter((x) => x !== listingId)
      await write('wishlists', { ...all, [userId]: next })
      return next
    },
  },

  uploads: {
    /** A real server stores the file and returns its URL. Here the image itself becomes the URL. */
    async photo(file) {
      await requireViewer()
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new ApiError('BAD_REQUEST', 'That photo could not be read.'))
        reader.readAsDataURL(file)
      })
      return { url }
    },
  },
}

/** Wipe everything this browser has stored and start again from the sample data. Mock only. */
export async function resetMockData(): Promise<void> {
  await kvClear()
  seeding = null
  tokenStore.set(null)
}
