/**
 * Shared machinery for the test backend: who is calling, permission checks,
 * pricing, availability, payment and tracking simulation, and turning
 * private records into the public shapes in `src/contracts`.
 *
 * Everything that decides money, inventory or access lives here, on the
 * "server" side, so screens only display results (FE-GLB-001).
 */
import {
  ApiError,
  type Booking,
  type CancellationPolicy,
  type CalendarDay,
  type ISODate,
  type ListingDetail,
  type ListingSummary,
  type ManagedListing,
  type MoneyAmount,
  type OrgRole,
  type PriceLine,
  type PublishCheck,
  type StaffRole,
  type TrackingView,
  type User,
  type Viewing,
} from '../../contracts'
import { formatMoney } from '../../design-system/money'
import { addDays, diffDays, isISODate, nightsOf, today } from '../../lib/dates'
import { buildSeed } from './seed'
import { loadDb, saveDb, type BookingRec, type DB, type ListingRec, type UserRec, type ViewingRec } from './state'
import { DAY, isoNow, latency, MIN, percentOf, uid } from './util'

// ── Database and session ────────────────────────────────────────────────────

export const getDb = () => loadDb(buildSeed)
export const commit = (db: DB) => saveDb(db)

/**
 * The test backend's stand-in for an HttpOnly session cookie. The real
 * backend sets a cookie the page cannot read (DEC-FE-04); here the browser
 * has to keep it somewhere, so it lives under a clearly named demo key.
 */
const SESSION_KEY = 'abode.demo-session'
export const session = {
  get(): string | null {
    try {
      return localStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  },
  set(id: string | null) {
    try {
      if (id) localStorage.setItem(SESSION_KEY, id)
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* Private mode: the session lasts until reload. */
    }
  },
}

/** Every call starts here: wait like a network, load the data. */
export async function begin() {
  await latency()
  const db = await getDb()
  expireHolds(db)
  return db
}

export function currentUser(db: DB): UserRec | null {
  const sid = session.get()
  if (!sid) return null
  const s = db.sessions[sid]
  if (!s) return null
  return db.users.find((u) => u.id === s.userId && !u.closed) ?? null
}

export function requireUser(db: DB): UserRec {
  const u = currentUser(db)
  if (!u) throw new ApiError('UNAUTHORIZED', 'Please sign in to continue.')
  return u
}

/** ACC-004: unverified accounts cannot message, enquire or transact. */
export function requireVerified(db: DB): UserRec {
  const u = requireUser(db)
  if (!u.emailVerified) throw new ApiError('FORBIDDEN', 'Please verify your email address first.', { reason: 'EMAIL_NOT_VERIFIED' })
  return u
}

export function requireStaff(db: DB, roles: StaffRole[]): UserRec {
  const u = requireUser(db)
  if (!u.staffRole) throw new ApiError('FORBIDDEN', 'This area is for Abode staff only.')
  if (u.staffRole !== 'platform_admin' && !roles.includes(u.staffRole)) {
    throw new ApiError('FORBIDDEN', 'Your role does not allow this action.')
  }
  return u
}

export function requireMember(db: DB, orgId: string, roles?: OrgRole[]) {
  const u = requireUser(db)
  const m = db.members.find((x) => x.orgId === orgId && x.userId === u.id)
  if (!m) throw new ApiError('FORBIDDEN', 'You are not a member of this organization.')
  if (roles && !roles.includes(m.role)) throw new ApiError('FORBIDDEN', 'Your role in this organization does not allow this.')
  const org = db.orgs.find((o) => o.id === orgId)!
  return { user: u, member: m, org }
}

export function toUser(db: DB, u: UserRec): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    mfaEnabled: u.mfaEnabled,
    staffRole: u.staffRole,
    memberships: db.members
      .filter((m) => m.userId === u.id)
      .map((m) => {
        const o = db.orgs.find((x) => x.id === m.orgId)!
        return { orgId: o.id, orgName: o.tradingName, orgKind: o.kind, role: m.role }
      }),
    consents: u.consents,
    createdAt: u.createdAt,
  }
}

export const nameOf = (db: DB, userId?: string) => db.users.find((u) => u.id === userId)?.name ?? 'Unknown'

export function audit(db: DB, actor: UserRec | string, action: string, target: string, reason?: string) {
  db.audit.unshift({ id: uid('a'), at: isoNow(), actor: typeof actor === 'string' ? actor : actor.name, action, target, reason })
}

export function notify(db: DB, userIds: string[], title: string, body: string, link?: string) {
  for (const userId of new Set(userIds)) {
    db.notifications.unshift({ id: uid('n'), userId, title, body, link, at: isoNow(), read: false })
  }
}

export const orgUsers = (db: DB, orgId: string, roles?: OrgRole[]) =>
  db.members.filter((m) => m.orgId === orgId && (!roles || roles.includes(m.role))).map((m) => m.userId)

export const money = (amountMinor: number, currency = 'GHS'): MoneyAmount => ({ amountMinor, currency })

export function findOr404<T>(item: T | undefined, what = 'That item'): T {
  if (!item) throw new ApiError('NOT_FOUND', `${what} could not be found. It may have been removed.`)
  return item
}

// ── Listings: public shapes ─────────────────────────────────────────────────

export function locationText(l: ListingRec): string {
  const { line1, area, city } = l.address
  if (l.addressDisplay === 'area_only' || !line1) return `${area}, ${city}`
  return `${line1}, ${area}, ${city}`
}

export function toSummary(db: DB, l: ListingRec): ListingSummary {
  const org = db.orgs.find((o) => o.id === l.orgId)!
  const visible = l.photos.filter((p) => p.status === 'approved')
  return {
    id: l.id,
    intent: l.intent,
    title: l.title,
    propertyType: l.propertyType,
    locationText: locationText(l),
    region: l.address.region,
    price: money(l.priceMinor, l.currency),
    basis: l.basis,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    areaSqm: l.areaSqm,
    maxGuests: l.maxGuests,
    photo: visible[0],
    rating: l.rating,
    reviewCount: l.reviewCount,
    promoted: l.promoted,
    verification: org.verification,
    orgName: org.tradingName,
  }
}

export const POLICY_TEXT: Record<CancellationPolicy, string> = {
  flexible: 'Free cancellation until 1 day before check-in. After that, the first night is not refunded.',
  moderate: 'Free cancellation until 5 days before check-in. After that, 50% of the stay is refunded.',
  strict: '50% of the stay is refunded until 7 days before check-in. After that, no refund.',
}

export function toDetail(db: DB, l: ListingRec): ListingDetail {
  const org = db.orgs.find((o) => o.id === l.orgId)!
  const agent = l.agentId ? db.users.find((u) => u.id === l.agentId) : undefined
  const licence = agent ? db.members.find((m) => m.userId === agent.id && m.orgId === l.orgId)?.licence : undefined
  return {
    ...toSummary(db, l),
    description: l.description,
    photos: l.photos.filter((p) => p.status === 'approved'),
    features: l.features,
    houseRules: l.houseRules,
    availableFrom: l.availableFrom,
    minNights: l.minNights,
    cleaningFee: l.cleaningFeeMinor !== undefined ? money(l.cleaningFeeMinor, l.currency) : undefined,
    cancellationPolicy: l.cancellationPolicy,
    cancellationText: l.cancellationPolicy ? POLICY_TEXT[l.cancellationPolicy] : undefined,
    furnished: l.furnished,
    org: { id: org.id, name: org.tradingName, kind: org.kind },
    agent: agent && org.kind === 'agency' ? { id: agent.id, name: agent.name, licenceNumber: licence?.number } : undefined,
  }
}

export function toManaged(db: DB, l: ListingRec): ManagedListing {
  settlePhotos(l)
  return {
    ...toDetail(db, l),
    photos: l.photos,
    state: l.state,
    propertyId: l.propertyId,
    address: l.address,
    addressDisplay: l.addressDisplay,
    agentId: l.agentId,
    expiresOn: l.expiresOn,
    withdrawnReason: l.withdrawnReason,
    rejectionReason: l.rejectionReason,
    history: l.history,
    stats: l.stats,
  }
}

/** New photos are "scanned" for a few seconds, then approved (PROP-031). */
export function settlePhotos(l: ListingRec) {
  for (const p of l.photos) {
    if (p.status === 'pending' && Date.now() - Date.parse(p.uploadedAt) > 5000) p.status = 'approved'
  }
}

/** PROP-020: every condition that blocks publishing, with how to fix it. */
export function publishChecks(db: DB, l: ListingRec): PublishCheck[] {
  const org = db.orgs.find((o) => o.id === l.orgId)!
  const goodPhotos = l.photos.filter((p) => p.status !== 'rejected' && p.alt.trim() && p.rightsConfirmed)
  const checks: PublishCheck[] = [
    { key: 'org', label: 'Your organization is verified', met: org.status === 'active', fix: 'Submit your verification documents in Organization.' },
    { key: 'title', label: 'Title of at least 10 characters', met: l.title.trim().length >= 10, fix: 'Add a clear title in Details.' },
    { key: 'description', label: 'Description of at least 50 characters', met: l.description.trim().length >= 50, fix: 'Describe the property in Details.' },
    { key: 'address', label: 'Street, area and city filled in', met: !!(l.address.line1 && l.address.area && l.address.city), fix: 'Complete the address in Location.' },
    { key: 'price', label: 'A price above zero', met: l.priceMinor > 0, fix: 'Set the price in Price.' },
    { key: 'photos', label: 'At least 3 photos, each with a description and rights confirmed', met: goodPhotos.length >= 3, fix: 'Add photos in Photos.' },
  ]
  if (l.intent === 'short_stay') {
    checks.push({ key: 'guests', label: 'Maximum number of guests', met: !!l.maxGuests, fix: 'Set guests in Details.' })
    checks.push({ key: 'policy', label: 'Cancellation policy chosen', met: !!l.cancellationPolicy, fix: 'Choose a policy in Price.' })
  }
  if (org.kind === 'agency') {
    const mandate = db.mandates.find((m) => m.propertyId === l.propertyId && m.status === 'active')
    checks.push({ key: 'mandate', label: 'An active mandate from the owner', met: !!mandate, fix: 'Record the owner’s mandate in Mandates.' })
    const licence = l.agentId ? db.members.find((m) => m.userId === l.agentId && m.orgId === l.orgId)?.licence : undefined
    checks.push({ key: 'agent', label: 'An assigned agent with a current licence', met: !!licence && licence.expiresOn >= today(), fix: 'Assign a licensed agent in Details.' })
  }
  return checks
}

// ── Short stays: pricing and availability ───────────────────────────────────

export const SERVICE_FEE_PERCENT = 10
export const TAX_PERCENT = 5
export const HOLD_SECONDS = 600
const QUOTE_MS = 15 * MIN

export function expireHolds(db: DB) {
  const now = Date.now()
  for (const h of db.holds) if (h.status === 'active' && h.expiresAt <= now) h.status = 'expired'
}

/** Nights not available, and why: confirmed or pending bookings, live holds, owner blocks. */
export function takenNights(db: DB, l: ListingRec, exceptUserId?: string): Map<ISODate, 'booked' | 'held' | 'blocked'> {
  const taken = new Map<ISODate, 'booked' | 'held' | 'blocked'>()
  for (const [d] of Object.entries(l.blocks)) taken.set(d, 'blocked')
  for (const b of db.bookings) {
    if (b.listingId !== l.id || !['pending_payment', 'confirmed', 'in_stay'].includes(b.state)) continue
    for (const n of nightsOf(b.checkIn, b.checkOut)) taken.set(n, 'booked')
  }
  for (const h of db.holds) {
    if (h.listingId !== l.id || h.status !== 'active' || h.userId === exceptUserId) continue
    for (const n of nightsOf(h.checkIn, h.checkOut)) if (!taken.has(n)) taken.set(n, 'held')
  }
  return taken
}

export const nightPrice = (l: ListingRec, d: ISODate) => l.priceOverrides[d] ?? l.priceMinor

export function calendar(db: DB, l: ListingRec, from: ISODate, days: number, supply: boolean): CalendarDay[] {
  const taken = takenNights(db, l)
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i)
    const reason = taken.get(date)
    const past = date < today()
    return {
      date,
      available: !reason && !past,
      price: money(nightPrice(l, date), l.currency),
      reason: supply ? reason : undefined,
      note: supply && reason === 'blocked' ? l.blocks[date] : undefined,
    }
  })
}

/** BOOK-001 to 005: the server's price for a stay, or a specific reason it can't be booked. */
export function priceStay(db: DB, l: ListingRec, checkIn: ISODate, checkOut: ISODate, guests: number, userId?: string) {
  if (l.intent !== 'short_stay' || l.state !== 'published') throw new ApiError('BAD_REQUEST', 'This place cannot be booked online.')
  if (!isISODate(checkIn) || !isISODate(checkOut)) throw new ApiError('BAD_REQUEST', 'Choose check-in and check-out dates.')
  if (checkIn < today()) throw new ApiError('BAD_REQUEST', 'Check-in cannot be in the past.', { reason: 'PAST_DATE' })
  const nights = diffDays(checkIn, checkOut)
  if (nights < 1) throw new ApiError('BAD_REQUEST', 'Check-out must be after check-in.')
  if (diffDays(today(), checkIn) > 365) throw new ApiError('BAD_REQUEST', 'You can book up to a year ahead.', { reason: 'BEYOND_HORIZON' })
  if (l.minNights && nights < l.minNights) {
    throw new ApiError('BAD_REQUEST', `This place needs a stay of at least ${l.minNights} nights.`, { reason: 'MIN_STAY' })
  }
  if (!Number.isInteger(guests) || guests < 1) throw new ApiError('BAD_REQUEST', 'Add at least one guest.')
  if (l.maxGuests && guests > l.maxGuests) {
    throw new ApiError('BAD_REQUEST', `This place sleeps up to ${l.maxGuests} guests.`, { reason: 'TOO_MANY_GUESTS' })
  }
  const taken = takenNights(db, l, userId)
  const clash = nightsOf(checkIn, checkOut).find((n) => taken.has(n))
  if (clash) {
    const why = taken.get(clash)
    throw new ApiError('CONFLICT', why === 'held' ? 'Someone else is booking some of these dates right now. Try other dates or check back in a few minutes.' : 'Some of these dates are no longer available. Choose other dates.', { reason: why === 'held' ? 'DATES_HELD' : 'DATES_TAKEN' })
  }

  const stay = nightsOf(checkIn, checkOut).reduce((s, n) => s + nightPrice(l, n), 0)
  const distinct = new Set(nightsOf(checkIn, checkOut).map((n) => nightPrice(l, n)))
  const cleaning = l.cleaningFeeMinor ?? 0
  const service = percentOf(stay, SERVICE_FEE_PERCENT)
  const tax = percentOf(stay + cleaning, TAX_PERCENT)
  const m = (a: number) => money(a, l.currency)
  const stayLabel =
    distinct.size === 1
      ? `${formatMoney(m(nightPrice(l, checkIn)))} × ${nights} ${nights === 1 ? 'night' : 'nights'}`
      : `Stay, ${nights} nights (weekend rates apply)`
  const lines: PriceLine[] = [
    { label: stayLabel, amount: m(stay), kind: 'charge' },
    ...(cleaning ? [{ label: 'Cleaning fee', amount: m(cleaning), kind: 'charge' as const }] : []),
    { label: 'Abode service fee', amount: m(service), kind: 'charge' },
    { label: `VAT and levies (test rate ${TAX_PERCENT}%)`, amount: m(tax), kind: 'tax' },
  ]
  return { nights, lines, totalMinor: stay + cleaning + service + tax, quoteExpiresAt: Date.now() + QUOTE_MS }
}

/** BOOK-035: what a cancellation would refund now, under the booking's policy. */
export function refundFor(b: BookingRec): { lines: PriceLine[]; totalMinor: number; policyText: string } {
  const daysOut = diffDays(today(), b.checkIn)
  const stayLine = b.lines[0]
  const others = b.lines.filter((l, i) => i !== 0 && !l.label.startsWith('Abode service') && l.kind !== 'tax')
  const taxLine = b.lines.find((l) => l.kind === 'tax')
  let stayPercent = 100
  if (b.cancellationPolicy === 'flexible' && daysOut < 1) stayPercent = Math.round(((b.nights - 1) / b.nights) * 100)
  if (b.cancellationPolicy === 'moderate' && daysOut < 5) stayPercent = 50
  if (b.cancellationPolicy === 'strict') stayPercent = daysOut >= 7 ? 50 : 0
  const stayBack = percentOf(stayLine.amount.amountMinor, stayPercent)
  const lines: PriceLine[] = [{ label: `${stayLine.label} (${stayPercent}% back)`, amount: money(stayBack, stayLine.amount.currency), kind: 'charge' }]
  for (const o of others) lines.push({ ...o })
  if (taxLine) {
    const taxBack = percentOf(taxLine.amount.amountMinor, stayPercent)
    lines.push({ ...taxLine, amount: money(taxBack, taxLine.amount.currency) })
  }
  const totalMinor = lines.reduce((s, l) => s + l.amount.amountMinor, 0)
  return { lines, totalMinor, policyText: `${POLICY_TEXT[b.cancellationPolicy]} The Abode service fee is not refunded.` }
}

// ── Payments (simulated provider) ───────────────────────────────────────────

/** How long the simulated provider takes to answer. */
const PAYMENT_MS = 6000

/**
 * The provider's answer arrives later, as a webhook would. Here it is
 * applied whenever the booking is next read (BOOK-019, BOOK-020).
 */
export function settlePayment(db: DB, b: BookingRec) {
  if (b.state !== 'pending_payment' || b.payment.status !== 'pending') return
  if (Date.now() - b.payment.startedAt < PAYMENT_MS) return
  const l = db.listings.find((x) => x.id === b.listingId)!
  if (b.payment.outcome === 'succeed') {
    b.payment.status = 'succeeded'
    b.state = 'confirmed'
    l.stats.bookings++
    notify(db, [b.guestId], 'Booking confirmed', `${b.reference} · ${l.title}`, `/trips/${b.id}`)
    notify(db, orgUsers(db, l.orgId, ['admin', 'finance']), 'New booking', `${b.reference} · ${l.title} · ${b.checkIn}`, `/portal/bookings/${b.id}`)
  } else if (b.payment.outcome === 'fail') {
    b.payment.status = 'failed'
    b.payment.failureReason = 'The payment was declined or not approved in time.'
    b.state = 'cancelled_by_platform'
    b.cancelReason = 'Payment was not completed.'
  } else {
    b.payment.status = 'checking'
    if (!db.recon.some((r) => r.bookingId === b.id)) {
      db.recon.unshift({ id: uid('rc'), bookingId: b.id, issue: 'payment_unmatched', amountMinor: b.totalMinor, createdAt: Date.now(), resolved: false })
    }
  }
}

export function toBooking(db: DB, b: BookingRec, viewerIsGuestOrOrg: boolean): Booking {
  settlePayment(db, b)
  const l = db.listings.find((x) => x.id === b.listingId)!
  const g = db.users.find((u) => u.id === b.guestId)!
  const { line1, area, city, digitalAddress } = l.address
  const confirmed = ['confirmed', 'in_stay', 'completed'].includes(b.state)
  return {
    id: b.id,
    reference: b.reference,
    listing: toSummary(db, l),
    guest: { id: g.id, name: g.name, email: g.email, phone: g.phone },
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    guests: b.guests,
    nights: b.nights,
    lines: b.lines,
    total: money(b.totalMinor),
    state: b.state,
    payment: { method: b.payment.method, label: b.payment.label, status: b.payment.status, failureReason: b.payment.failureReason },
    cancellationText: b.cancellationText || POLICY_TEXT[b.cancellationPolicy],
    // PROP-037: the full address is released only once the booking is confirmed.
    fullAddress: confirmed && viewerIsGuestOrOrg ? `${line1}, ${area}, ${city}${digitalAddress ? ` (${digitalAddress})` : ''}` : undefined,
    refund: b.refund,
    cancelReason: b.cancelReason,
    createdAt: b.createdAt,
  }
}

// ── Viewings and live tracking (simulated) ──────────────────────────────────

/** A demo trip runs in 4 real minutes but stands for a 24-minute drive. */
export const TRIP_MS = 4 * MIN
const TIME_SCALE = 6
const SAMPLE_MS = 10_000

/** The agent's route across the stylised map, in 0..1 coordinates. */
const ROUTE = [
  { x: 0.08, y: 0.82 },
  { x: 0.28, y: 0.74 },
  { x: 0.4, y: 0.52 },
  { x: 0.62, y: 0.48 },
  { x: 0.74, y: 0.3 },
  { x: 0.88, y: 0.2 },
]

function pointAt(f: number) {
  const segs = ROUTE.length - 1
  const pos = Math.min(Math.max(f, 0), 1) * segs
  const i = Math.min(Math.floor(pos), segs - 1)
  const t = pos - i
  const a = ROUTE[i]
  const b = ROUTE[i + 1]
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export const routePoints = () => ROUTE

/** Ends tracking for any reason (TRK-022): position is never sent again. */
export function endTracking(v: ViewingRec, reason: string) {
  if (v.tracking && !v.tracking.ended) {
    v.tracking.ended = true
    v.tracking.sharing = false
    v.tracking.endedReason = reason
  }
}

export function trackingView(v: ViewingRec): TrackingView | undefined {
  const t = v.tracking
  if (!t) return undefined
  const now = Date.now()
  if (!t.ended && now > t.endsAt) endTracking(v, 'Sharing reached its time limit.')
  if (t.ended || !t.sharing) {
    return { sessionId: t.id, sharing: false, progress: null, position: null, ageSeconds: null, lowAccuracy: false, eta: null, endsAt: new Date(t.endsAt).toISOString(), ended: t.ended, endedReason: t.endedReason }
  }
  const elapsed = now - t.startedAt
  let sampleAt = t.startedAt + Math.floor(elapsed / SAMPLE_MS) * SAMPLE_MS
  // Between 55% and 70% of the way, the phone loses signal: no new samples.
  const gapStart = t.startedAt + t.durationMs * 0.55
  const gapEnd = t.startedAt + t.durationMs * 0.7
  if (sampleAt > gapStart && sampleAt < gapEnd) sampleAt = gapStart
  const progress = Math.min(1, (sampleAt - t.startedAt) / t.durationMs)
  const remainingMin = ((1 - progress) * t.durationMs * TIME_SCALE) / MIN
  return {
    sessionId: t.id,
    sharing: true,
    progress,
    position: pointAt(progress),
    ageSeconds: Math.round((now - sampleAt) / 1000),
    lowAccuracy: progress > 0.2 && progress < 0.3,
    eta: progress >= 1 ? { minMinutes: 0, maxMinutes: 2, basis: 'the agent’s last position' } : { minMinutes: Math.max(1, Math.floor(remainingMin * 0.8)), maxMinutes: Math.ceil(remainingMin * 1.25) + 1, basis: 'typical traffic at this time' },
    endsAt: new Date(t.endsAt).toISOString(),
    ended: false,
  }
}

export function toViewing(db: DB, v: ViewingRec, forSeeker: boolean): Viewing {
  const l = db.listings.find((x) => x.id === v.listingId)!
  const s = db.users.find((u) => u.id === v.seekerId)!
  const agent = v.agentId ? db.users.find((u) => u.id === v.agentId) : undefined
  return {
    id: v.id,
    listing: toSummary(db, l),
    seeker: { id: s.id, name: s.name, phone: forSeeker ? undefined : s.phone },
    orgId: v.orgId,
    slots: v.slots,
    confirmedSlot: v.confirmedSlot,
    state: v.state,
    agent: agent ? { id: agent.id, name: agent.name } : undefined,
    meetingPoint: v.meetingPoint,
    cancelReason: v.cancelReason,
    timeline: v.timeline,
    tracking: trackingView(v),
    createdAt: v.createdAt,
  }
}

export function newTracking(agentId: string) {
  const now = Date.now()
  return { id: uid('trk'), agentId, sharing: true, startedAt: now, durationMs: TRIP_MS, endsAt: now + TRIP_MS + 30 * MIN, ended: false }
}

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY)
