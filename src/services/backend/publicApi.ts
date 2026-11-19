/** What seekers and guests use: search, listings, booking, enquiries, viewings, messages. */
import {
  ApiError,
  type Booking,
  type CalendarDay,
  type Enquiry,
  type Hold,
  type ISODate,
  type ListingDetail,
  type Message,
  type Notification,
  type Paged,
  type PaymentMethod,
  type Quote,
  type RefundPreview,
  type Report,
  type SearchQuery,
  type SearchResult,
  type ThreadSummary,
  type Viewing,
} from '../../contracts'
import { today } from '../../lib/dates'
import {
  begin,
  calendar,
  commit,
  currentUser,
  endTracking,
  findOr404,
  HOLD_SECONDS,
  money,
  nameOf,
  notify,
  orgUsers,
  POLICY_TEXT,
  priceStay,
  refundFor,
  requireUser,
  requireVerified,
  toBooking,
  toDetail,
  toSummary,
  toViewing,
} from './core'
import type { DB, EnquiryRec, ListingRec, ThreadRec } from './state'
import { bookingReference, isoNow, uid } from './util'

const PAGE = 12

function publicStatus(s: EnquiryRec['status']): Enquiry['publicStatus'] {
  if (s === 'new') return 'sent'
  if (s === 'won' || s === 'lost') return 'closed'
  return 'in_progress'
}

export function toEnquiry(db: DB, e: EnquiryRec, forSeeker: boolean): Enquiry {
  const l = db.listings.find((x) => x.id === e.listingId)!
  const s = db.users.find((u) => u.id === e.seekerId)!
  return {
    id: e.id,
    listing: toSummary(db, l),
    seeker: { id: s.id, name: s.name, email: forSeeker ? '' : s.email, phone: forSeeker ? undefined : s.phone },
    message: e.message,
    contactMethod: e.contactMethod,
    status: forSeeker ? undefined : e.status,
    publicStatus: publicStatus(e.status),
    assignee: e.assigneeId ? { id: e.assigneeId, name: nameOf(db, e.assigneeId) } : undefined,
    lostReason: forSeeker ? undefined : e.lostReason,
    threadId: e.threadId,
    createdAt: e.createdAt,
  }
}

/** Who may read a thread: the seeker, and members of the supplying organization. */
export function canSeeThread(db: DB, t: ThreadRec, userId: string) {
  return t.seekerId === userId || db.members.some((m) => m.orgId === t.orgId && m.userId === userId)
}

export function newThread(db: DB, subject: string, context: ThreadRec['context'], orgId: string, seekerId: string): ThreadRec {
  const t: ThreadRec = { id: uid('t'), subject, context, orgId, seekerId, closed: false, lastReadAt: {} }
  db.threads.push(t)
  return t
}

function threadSummary(db: DB, t: ThreadRec, userId: string): ThreadSummary {
  const msgs = db.messages.filter((m) => m.threadId === t.id)
  const last = msgs[msgs.length - 1]
  const seen = t.lastReadAt[userId] ?? 0
  const isSeeker = t.seekerId === userId
  return {
    id: t.id,
    as: isSeeker ? 'seeker' : 'org',
    subject: t.subject,
    context: t.context,
    otherParty: isSeeker ? db.orgs.find((o) => o.id === t.orgId)!.tradingName : nameOf(db, t.seekerId),
    lastMessage: last?.body,
    lastAt: last?.at ?? isoNow(),
    unread: msgs.filter((m) => m.senderId !== userId && Date.parse(m.at) > seen).length,
    closed: t.closed,
  }
}

const published = (l: ListingRec) => l.state === 'published'

export const publicApi = {
  async search(q: SearchQuery): Promise<Paged<SearchResult>> {
    const db = await begin()
    const text = q.q?.trim().toLowerCase()
    let items = db.listings.filter((l) => published(l) && l.intent === q.intent)
    if (text) items = items.filter((l) => [l.title, l.address.area, l.address.city, l.address.region].join(' ').toLowerCase().includes(text))
    if (q.region) items = items.filter((l) => l.address.region === q.region)
    if (q.propertyType) items = items.filter((l) => l.propertyType === q.propertyType)
    if (q.bedrooms) items = items.filter((l) => (l.bedrooms ?? 0) >= q.bedrooms!)
    if (q.guests) items = items.filter((l) => (l.maxGuests ?? 99) >= q.guests!)
    if (q.minPriceMinor) items = items.filter((l) => l.priceMinor >= q.minPriceMinor!)
    if (q.maxPriceMinor) items = items.filter((l) => l.priceMinor <= q.maxPriceMinor!)

    const results: SearchResult[] = []
    for (const l of items) {
      const r: SearchResult = toSummary(db, l)
      if (q.intent === 'short_stay' && q.checkIn && q.checkOut) {
        try {
          const p = priceStay(db, l, q.checkIn, q.checkOut, q.guests ?? 1)
          r.stayTotal = money(p.totalMinor, l.currency)
          r.nights = p.nights
        } catch {
          continue // Not available or not bookable for these dates.
        }
      }
      results.push(r)
    }
    const sort = q.sort ?? 'recommended'
    if (sort === 'price_asc') results.sort((a, b) => a.price.amountMinor - b.price.amountMinor)
    if (sort === 'price_desc') results.sort((a, b) => b.price.amountMinor - a.price.amountMinor)
    if (sort === 'newest') results.reverse()
    if (sort === 'recommended') results.sort((a, b) => Number(b.promoted) - Number(a.promoted) || (b.rating ?? 0) - (a.rating ?? 0))
    const start = q.cursor ? Number(q.cursor) : 0
    const page = results.slice(start, start + PAGE)
    return { items: page, nextCursor: start + PAGE < results.length ? String(start + PAGE) : null, total: results.length }
  },

  async featured(): Promise<Record<'short_stay' | 'rent' | 'sale' | 'commercial', SearchResult[]>> {
    const db = await begin()
    const pick = (intent: ListingRec['intent']) => db.listings.filter((l) => published(l) && l.intent === intent).slice(0, 4).map((l) => toSummary(db, l))
    return { short_stay: pick('short_stay'), rent: pick('rent'), sale: pick('sale'), commercial: pick('commercial') }
  },

  async listing(id: string): Promise<ListingDetail> {
    const db = await begin()
    const l = findOr404(db.listings.find((x) => x.id === id), 'This listing')
    const me = currentUser(db)
    const isLister = me && db.members.some((m) => m.orgId === l.orgId && m.userId === me.id)
    if (!published(l) && !isLister && !me?.staffRole) throw new ApiError('NOT_FOUND', 'This listing is not available. It may have been let, sold or withdrawn.')
    l.stats.views++
    await commit(db)
    return toDetail(db, l)
  },

  async calendar(listingId: string, from: ISODate, days = 62): Promise<CalendarDay[]> {
    const db = await begin()
    const l = findOr404(db.listings.find((x) => x.id === listingId && published(x)), 'This listing')
    return calendar(db, l, from, days, false)
  },

  // ── Short-stay booking ──

  async quote(listingId: string, checkIn: ISODate, checkOut: ISODate, guests: number): Promise<Quote> {
    const db = await begin()
    const me = currentUser(db)
    const l = findOr404(db.listings.find((x) => x.id === listingId), 'This listing')
    const p = priceStay(db, l, checkIn, checkOut, guests, me?.id)
    const q = { id: uid('q'), listingId, userId: me?.id ?? 'anon', checkIn, checkOut, guests, nights: p.nights, lines: p.lines, totalMinor: p.totalMinor, cancellationText: POLICY_TEXT[l.cancellationPolicy ?? 'moderate'], expiresAt: p.quoteExpiresAt }
    db.quotes.push(q)
    await commit(db)
    return { ...q, total: money(q.totalMinor, l.currency), expiresAt: new Date(q.expiresAt).toISOString() }
  },

  /** BOOK-008: set the dates aside while the guest pays. */
  async hold(quoteId: string): Promise<Hold> {
    const db = await begin()
    const me = requireVerified(db)
    const q = findOr404(db.quotes.find((x) => x.id === quoteId), 'This price')
    if (q.expiresAt < Date.now()) throw new ApiError('CONFLICT', 'This price has expired. Get a new price to continue.', { reason: 'QUOTE_EXPIRED' })
    const l = db.listings.find((x) => x.id === q.listingId)!
    if (db.members.some((m) => m.orgId === l.orgId && m.userId === me.id)) throw new ApiError('FORBIDDEN', 'You can’t book a place your own organization lists.')
    priceStay(db, l, q.checkIn, q.checkOut, q.guests, me.id) // Still free? Throws the specific reason if not.
    for (const h of db.holds) if (h.userId === me.id && h.listingId === l.id && h.status === 'active') h.status = 'released'
    const h = { id: uid('h'), quoteId: q.id, listingId: l.id, userId: me.id, checkIn: q.checkIn, checkOut: q.checkOut, expiresAt: Date.now() + HOLD_SECONDS * 1000, status: 'active' as const }
    q.userId = me.id
    db.holds.push(h)
    await commit(db)
    return publicApi.toHold(db, h.id)
  },

  toHold(db: DB, holdId: string): Hold {
    const h = findOr404(db.holds.find((x) => x.id === holdId), 'This reservation')
    const q = db.quotes.find((x) => x.id === h.quoteId)!
    const l = db.listings.find((x) => x.id === h.listingId)!
    return {
      id: h.id,
      quote: { ...q, total: money(q.totalMinor, l.currency), expiresAt: new Date(q.expiresAt).toISOString() },
      listing: toSummary(db, l),
      remainingSeconds: Math.max(0, Math.floor((h.expiresAt - Date.now()) / 1000)),
      status: h.status,
      bookingId: h.bookingId,
    }
  },

  async getHold(holdId: string): Promise<Hold> {
    const db = await begin()
    const me = requireUser(db)
    const h = findOr404(db.holds.find((x) => x.id === holdId && x.userId === me.id), 'This reservation')
    return publicApi.toHold(db, h.id)
  },

  async releaseHold(holdId: string): Promise<void> {
    const db = await begin()
    const me = requireUser(db)
    const h = db.holds.find((x) => x.id === holdId && x.userId === me.id)
    if (h && h.status === 'active') h.status = 'released'
    await commit(db)
  },

  /**
   * Starts payment with the (simulated) provider. The answer comes later;
   * the booking stays pending until then (BOOK-019). One booking per hold,
   * so a retried or double-clicked payment never charges twice (BOOK-017).
   *
   * Test numbers: mobile money ending 0000 fails, ending 1111 needs a manual
   * check; card 4000 0000 0000 0002 is declined; anything else succeeds.
   */
  async pay(holdId: string, input: { method: PaymentMethod; network?: string; account: string; guests: { leadName: string; phone: string }; acceptTerms: boolean; idempotencyKey: string }): Promise<{ bookingId: string }> {
    const db = await begin()
    const me = requireVerified(db)
    const h = findOr404(db.holds.find((x) => x.id === holdId && x.userId === me.id), 'This reservation')
    if (h.bookingId) return { bookingId: h.bookingId }
    if (h.status !== 'active') throw new ApiError('CONFLICT', 'Your hold has ended. Get a new price to continue.', { reason: 'HOLD_EXPIRED' })
    const fields: Record<string, string> = {}
    if (!input.acceptTerms) fields.acceptTerms = 'Please accept the booking terms.'
    if (input.guests.leadName.trim().length < 2) fields.leadName = 'Enter the lead guest’s name.'
    const digits = input.account.replace(/\D/g, '')
    if (input.method === 'mobile_money' && digits.length < 9) fields.account = 'Enter the mobile money number.'
    if (input.method === 'card' && digits.length < 15) fields.account = 'Enter the card number.'
    if (Object.keys(fields).length) throw new ApiError('BAD_REQUEST', 'Please check the highlighted fields.', { fields })
    const q = db.quotes.find((x) => x.id === h.quoteId)!
    const l = db.listings.find((x) => x.id === h.listingId)!
    const outcome: 'succeed' | 'fail' | 'check' = input.method === 'mobile_money' ? (digits.endsWith('0000') ? 'fail' : digits.endsWith('1111') ? 'check' : 'succeed') : digits === '4000000000000002' ? 'fail' : 'succeed'
    const b = {
      id: uid('b'),
      reference: bookingReference(),
      listingId: l.id,
      guestId: me.id,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      guests: q.guests,
      nights: q.nights,
      lines: q.lines,
      totalMinor: q.totalMinor,
      state: 'pending_payment' as const,
      payment: { method: input.method, label: input.method === 'card' ? `Card ending ${digits.slice(-4)}` : `${input.network ?? 'Mobile money'} · ${digits.slice(-4)}`, status: 'pending' as const, startedAt: Date.now(), outcome },
      cancellationPolicy: l.cancellationPolicy ?? 'moderate',
      cancellationText: q.cancellationText,
      createdAt: isoNow(),
    }
    db.bookings.push(b)
    h.status = 'converted'
    h.bookingId = b.id
    if (!db.threads.some((t) => t.context.id === b.id)) newThread(db, `Booking ${b.reference} · ${l.title}`, { kind: 'booking', id: b.id }, l.orgId, me.id)
    await commit(db)
    return { bookingId: b.id }
  },

  async booking(id: string): Promise<Booking> {
    const db = await begin()
    const me = requireUser(db)
    const b = findOr404(db.bookings.find((x) => x.id === id), 'This booking')
    const l = db.listings.find((x) => x.id === b.listingId)!
    const isOrg = db.members.some((m) => m.orgId === l.orgId && m.userId === me.id)
    if (b.guestId !== me.id && !isOrg && !me.staffRole) throw new ApiError('NOT_FOUND', 'This booking could not be found.')
    const out = toBooking(db, b, b.guestId === me.id || isOrg)
    await commit(db)
    return out
  },

  async myBookings(): Promise<Booking[]> {
    const db = await begin()
    const me = requireUser(db)
    const out = db.bookings.filter((b) => b.guestId === me.id).map((b) => toBooking(db, b, true))
    await commit(db)
    return out.sort((a, b) => b.checkIn.localeCompare(a.checkIn))
  },

  async refundPreview(bookingId: string): Promise<RefundPreview> {
    const db = await begin()
    const me = requireUser(db)
    const b = findOr404(db.bookings.find((x) => x.id === bookingId && x.guestId === me.id), 'This booking')
    if (!['confirmed', 'pending_payment'].includes(b.state)) throw new ApiError('BAD_REQUEST', 'This booking can no longer be cancelled.')
    const r = refundFor(b)
    return { lines: r.lines, total: money(r.totalMinor), policyText: r.policyText }
  },

  async cancelBooking(bookingId: string, reason: string): Promise<Booking> {
    const db = await begin()
    const me = requireUser(db)
    const b = findOr404(db.bookings.find((x) => x.id === bookingId && x.guestId === me.id), 'This booking')
    if (b.state === 'cancelled_by_guest') return toBooking(db, b, true)
    if (b.state !== 'confirmed') throw new ApiError('BAD_REQUEST', 'This booking can no longer be cancelled.')
    const r = refundFor(b)
    b.state = 'cancelled_by_guest'
    b.cancelReason = reason || 'No reason given'
    b.refund = { lines: r.lines, total: money(r.totalMinor), settled: false, requestedAt: isoNow() }
    db.recon.unshift({ id: uid('rc'), bookingId: b.id, issue: 'refund_pending', amountMinor: r.totalMinor, createdAt: Date.now(), resolved: false })
    const l = db.listings.find((x) => x.id === b.listingId)!
    notify(db, orgUsers(db, l.orgId, ['admin', 'finance']), 'Booking cancelled by guest', `${b.reference} · ${l.title}`, `/portal/bookings/${b.id}`)
    await commit(db)
    return toBooking(db, b, true)
  },

  // ── Enquiries and viewings (seeker side) ──

  /** LEAD-001: an enquiry never reserves anything (LEAD-005). */
  async enquire(listingId: string, input: { message: string; contactMethod: EnquiryRec['contactMethod'] }): Promise<Enquiry> {
    const db = await begin()
    const me = requireVerified(db)
    const l = findOr404(db.listings.find((x) => x.id === listingId && published(x)), 'This listing')
    if (input.message.trim().length < 10) throw new ApiError('BAD_REQUEST', 'Please write a short message (at least 10 characters).', { fields: { message: 'Too short' } })
    const id = uid('e')
    const t = newThread(db, l.title, { kind: 'enquiry', id }, l.orgId, me.id)
    const e: EnquiryRec = { id, listingId, orgId: l.orgId, seekerId: me.id, message: input.message.trim(), contactMethod: input.contactMethod, status: 'new', assigneeId: l.agentId, threadId: t.id, createdAt: isoNow() }
    db.enquiries.unshift(e)
    db.messages.push({ id: uid('m'), threadId: t.id, senderId: me.id, body: e.message, at: e.createdAt })
    l.stats.enquiries++
    notify(db, [...orgUsers(db, l.orgId, ['admin']), ...(l.agentId ? [l.agentId] : [])], 'New enquiry', `${me.name} · ${l.title}`, `/portal/leads/${e.id}`)
    await commit(db)
    return toEnquiry(db, e, true)
  },

  async myEnquiries(): Promise<Enquiry[]> {
    const db = await begin()
    const me = requireUser(db)
    return db.enquiries.filter((e) => e.seekerId === me.id).map((e) => toEnquiry(db, e, true))
  },

  /** TRK-001: a request for a viewing. It is not a booking. */
  async requestViewing(listingId: string, slots: string[], note?: string): Promise<Viewing> {
    const db = await begin()
    const me = requireVerified(db)
    const l = findOr404(db.listings.find((x) => x.id === listingId && published(x)), 'This listing')
    if (l.intent === 'short_stay') throw new ApiError('BAD_REQUEST', 'Short stays are booked, not viewed.')
    const valid = slots.filter((s) => Date.parse(s) > Date.now())
    if (!valid.length) throw new ApiError('BAD_REQUEST', 'Choose at least one time in the future.', { fields: { slots: 'Choose a future time' } })
    const enquiry = db.enquiries.find((e) => e.listingId === l.id && e.seekerId === me.id)
    const v = { id: uid('v'), listingId: l.id, orgId: l.orgId, seekerId: me.id, enquiryId: enquiry?.id, slots: valid, state: 'requested' as const, meetingPoint: 'The agent will confirm where to meet', timeline: [{ at: isoNow(), state: 'requested' as const, note }], createdAt: isoNow() }
    db.viewings.unshift(v)
    if (enquiry && enquiry.status === 'new') enquiry.status = 'contacted'
    notify(db, [...orgUsers(db, l.orgId, ['admin']), ...(l.agentId ? [l.agentId] : [])], 'Viewing requested', `${me.name} · ${l.title}`, `/portal/viewings/${v.id}`)
    await commit(db)
    return toViewing(db, v, true)
  },

  async myViewings(): Promise<Viewing[]> {
    const db = await begin()
    const me = requireUser(db)
    const out = db.viewings.filter((v) => v.seekerId === me.id).map((v) => toViewing(db, v, true))
    await commit(db)
    return out
  },

  async viewing(id: string): Promise<Viewing> {
    const db = await begin()
    const me = requireUser(db)
    const v = findOr404(db.viewings.find((x) => x.id === id && x.seekerId === me.id), 'This viewing')
    const out = toViewing(db, v, true)
    await commit(db)
    return out
  },

  async acceptProposedTime(id: string): Promise<Viewing> {
    const db = await begin()
    const me = requireUser(db)
    const v = findOr404(db.viewings.find((x) => x.id === id && x.seekerId === me.id), 'This viewing')
    if (v.state !== 'proposed') throw new ApiError('BAD_REQUEST', 'There is no new time to accept.')
    v.state = 'confirmed'
    v.confirmedSlot = v.slots[v.slots.length - 1]
    v.timeline.push({ at: isoNow(), state: 'confirmed', note: 'You accepted the proposed time' })
    notify(db, [...orgUsers(db, v.orgId, ['admin']), ...(v.agentId ? [v.agentId] : [])], 'Viewing time accepted', `${me.name} accepted the new time`, `/portal/viewings/${v.id}`)
    await commit(db)
    return toViewing(db, v, true)
  },

  async cancelViewing(id: string, reason: string): Promise<Viewing> {
    const db = await begin()
    const me = requireUser(db)
    const v = findOr404(db.viewings.find((x) => x.id === id && x.seekerId === me.id), 'This viewing')
    if (!reason.trim()) throw new ApiError('BAD_REQUEST', 'Please tell the agent why you are cancelling.', { fields: { reason: 'Required' } })
    if (['completed', 'cancelled', 'no_show'].includes(v.state)) throw new ApiError('BAD_REQUEST', 'This viewing has already ended.')
    v.state = 'cancelled'
    v.cancelReason = reason.trim()
    v.timeline.push({ at: isoNow(), state: 'cancelled', note: reason.trim() })
    endTracking(v, 'The viewing was cancelled.')
    notify(db, [...orgUsers(db, v.orgId, ['admin']), ...(v.agentId ? [v.agentId] : [])], 'Viewing cancelled by seeker', reason.trim(), `/portal/viewings/${v.id}`)
    await commit(db)
    return toViewing(db, v, true)
  },

  // ── Messages and notifications ──

  async threads(): Promise<ThreadSummary[]> {
    const db = await begin()
    const me = requireUser(db)
    return db.threads.filter((t) => canSeeThread(db, t, me.id)).map((t) => threadSummary(db, t, me.id)).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
  },

  async thread(id: string): Promise<{ thread: ThreadSummary; messages: Message[] }> {
    const db = await begin()
    const me = requireUser(db)
    const t = findOr404(db.threads.find((x) => x.id === id && canSeeThread(db, x, me.id)), 'This conversation')
    t.lastReadAt[me.id] = Date.now()
    const messages = db.messages.filter((m) => m.threadId === t.id).map((m) => ({ id: m.id, threadId: m.threadId, sender: { id: m.senderId, name: nameOf(db, m.senderId) }, mine: m.senderId === me.id, body: m.body, at: m.at }))
    await commit(db)
    return { thread: threadSummary(db, t, me.id), messages }
  },

  async send(threadId: string, body: string): Promise<Message> {
    const db = await begin()
    const me = requireVerified(db)
    const t = findOr404(db.threads.find((x) => x.id === threadId && canSeeThread(db, x, me.id)), 'This conversation')
    if (t.closed) throw new ApiError('BAD_REQUEST', 'This conversation is closed.')
    if (!body.trim()) throw new ApiError('BAD_REQUEST', 'Write a message first.')
    const m = { id: uid('m'), threadId, senderId: me.id, body: body.trim().slice(0, 2000), at: isoNow() }
    db.messages.push(m)
    t.lastReadAt[me.id] = Date.now()
    const recipients = t.seekerId === me.id ? orgUsers(db, t.orgId, ['admin', 'agent']) : [t.seekerId]
    notify(db, recipients.filter((r) => r !== me.id), `New message from ${me.name}`, t.subject, t.seekerId === me.id ? `/portal/messages/${t.id}` : `/messages/${t.id}`)
    await commit(db)
    return { id: m.id, threadId, sender: { id: me.id, name: me.name }, mine: true, body: m.body, at: m.at }
  },

  async notifications(): Promise<Notification[]> {
    const db = await begin()
    const me = currentUser(db)
    if (!me) return []
    return db.notifications.filter((n) => n.userId === me.id).slice(0, 50)
  },

  async markNotificationsRead(): Promise<void> {
    const db = await begin()
    const me = requireUser(db)
    for (const n of db.notifications) if (n.userId === me.id) n.read = true
    await commit(db)
  },

  // ── Saved listings and reports ──

  async saved(): Promise<string[]> {
    const db = await begin()
    const me = currentUser(db)
    return me ? (db.favourites[me.id] ?? []) : []
  },

  async toggleSaved(listingId: string): Promise<string[]> {
    const db = await begin()
    const me = requireUser(db)
    const list = new Set(db.favourites[me.id] ?? [])
    if (list.has(listingId)) list.delete(listingId)
    else list.add(listingId)
    db.favourites[me.id] = [...list]
    await commit(db)
    return db.favourites[me.id]
  },

  async savedListings() {
    const db = await begin()
    const me = requireUser(db)
    return (db.favourites[me.id] ?? []).map((id) => db.listings.find((l) => l.id === id)).filter((l): l is ListingRec => !!l && published(l)).map((l) => toSummary(db, l))
  },

  /** TRU-026: anyone signed in can report a listing. */
  async report(target: Report['target'], category: Report['category'], detail?: string): Promise<void> {
    const db = await begin()
    const me = requireUser(db)
    db.reports.unshift({ id: uid('r'), target, reporter: me.name, category, detail: detail?.trim() || undefined, state: 'open', createdAt: isoNow() })
    await commit(db)
  },

  async today(): Promise<ISODate> {
    return today()
  },
}
