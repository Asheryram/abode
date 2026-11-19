/** What owners, hosts, agents and agency staff use. Everything is scoped to one organization. */
import {
  ApiError,
  type Beneficiary,
  type Booking,
  type CalendarDay,
  type Enquiry,
  type ISODate,
  type LeadStatus,
  type ListingInput,
  type ManagedListing,
  type Mandate,
  type Member,
  type Organization,
  type OrgKind,
  type OrgRole,
  type Payout,
  type PortalDashboard,
  type PublishCheck,
  type VerificationCase,
  type Viewing,
  type ViewingState,
} from '../../contracts'
import { addDays, today } from '../../lib/dates'
import { formatDate } from '../../lib/format'
import {
  audit,
  begin,
  calendar,
  commit,
  endTracking,
  findOr404,
  money,
  nameOf,
  newTracking,
  notify,
  orgUsers,
  publishChecks,
  requireMember,
  requireUser,
  settlePhotos,
  toBooking,
  toManaged,
  toUser,
  toViewing,
} from './core'
import { toEnquiry } from './publicApi'
import type { DB, ListingRec, OrgRec } from './state'
import { DAY, hashPassword, isoNow, uid } from './util'

function toOrg(o: OrgRec): Organization {
  const { beneficiary: _b, ...rest } = o
  void _b
  return rest
}

function listingFor(db: DB, id: string) {
  const l = findOr404(db.listings.find((x) => x.id === id), 'This listing')
  const ctx = requireMember(db, l.orgId)
  return { l, ...ctx }
}

/** Agents work only on what is assigned to them; admins see everything in the org. */
const seesAll = (role: OrgRole) => role === 'admin'

function eligibleAgents(db: DB, orgId: string) {
  return db.members.filter((m) => m.orgId === orgId && (m.role === 'admin' || (m.role === 'agent' && m.licence && m.licence.expiresOn >= today())))
}

function applyInput(l: ListingRec, input: ListingInput) {
  l.intent = input.intent
  l.propertyType = input.propertyType
  l.title = input.title.trim()
  l.description = input.description.trim()
  l.address = { ...input.address }
  l.addressDisplay = input.addressDisplay
  l.priceMinor = Math.max(0, Math.round(input.priceMinor))
  l.basis = input.basis
  l.bedrooms = input.bedrooms
  l.bathrooms = input.bathrooms
  l.areaSqm = input.areaSqm
  l.maxGuests = input.maxGuests
  l.minNights = input.minNights
  l.cleaningFeeMinor = input.cleaningFeeMinor
  l.cancellationPolicy = input.cancellationPolicy
  l.features = input.features
  l.houseRules = input.houseRules
  l.availableFrom = input.availableFrom
  l.furnished = input.furnished
  l.agentId = input.agentId
}

function validateInput(input: ListingInput) {
  const fields: Record<string, string> = {}
  if (input.intent === 'short_stay' && input.basis !== 'per_night') fields.basis = 'Short stays are priced per night.'
  if (input.intent === 'sale' && input.basis !== 'total') fields.basis = 'Sale listings show the total price.'
  if (input.priceMinor < 0 || !Number.isInteger(input.priceMinor)) fields.price = 'Enter a valid price.'
  if (input.title.length > 90) fields.title = 'Keep the title under 90 characters.'
  if (Object.keys(fields).length) throw new ApiError('BAD_REQUEST', 'Please check the highlighted fields.', { fields })
}

export const portalApi = {
  // ── Organization ──

  async dashboard(orgId: string): Promise<PortalDashboard> {
    const db = await begin()
    const { member, org, user } = requireMember(db, orgId)
    const mine = (agentId?: string) => seesAll(member.role) || agentId === user.id
    const listings = db.listings.filter((l) => l.orgId === orgId)
    const upcoming = db.bookings.filter((b) => listings.some((l) => l.id === b.listingId) && ['confirmed', 'pending_payment'].includes(b.state) && b.checkIn >= today())
    const tasks: PortalDashboard['tasks'] = []
    if (org.status === 'pending_verification') {
      const open = db.verificationCases.find((c) => c.orgId === orgId && c.subject.kind === 'organization')
      tasks.push({ id: 'verify', tone: 'warning', text: open ? `Verification ${open.state === 'more_info' ? 'needs more information' : 'is being reviewed'}. You can prepare listings meanwhile.` : 'Verify your organization so your listings can go live.', link: '/portal/organization' })
    }
    for (const m of db.members.filter((x) => x.orgId === orgId && x.licence && x.licence.expiresOn < today())) {
      if (seesAll(member.role) || m.userId === user.id) tasks.push({ id: `lic_${m.userId}`, tone: 'danger', text: `${nameOf(db, m.userId)}’s agent licence has expired. Their listings are paused.`, link: '/portal/team' })
    }
    for (const l of listings.filter((x) => x.state === 'draft' && mine(x.agentId))) tasks.push({ id: `draft_${l.id}`, tone: 'info', text: `Finish your draft: ${l.title || 'Untitled listing'}`, link: `/portal/listings/${l.id}` })
    for (const l of listings.filter((x) => x.rejectionReason && x.state === 'draft')) tasks.push({ id: `rej_${l.id}`, tone: 'danger', text: `Changes needed on ${l.title}: ${l.rejectionReason}`, link: `/portal/listings/${l.id}` })
    for (const l of listings.filter((x) => x.state === 'published' && x.expiresOn && x.expiresOn <= addDays(today(), 14))) tasks.push({ id: `exp_${l.id}`, tone: 'warning', text: `${l.title} expires on ${formatDate(l.expiresOn!)}. Renew it to stay in search.`, link: `/portal/listings/${l.id}` })
    for (const md of db.mandates.filter((x) => x.agencyId === orgId && x.status === 'active' && x.endsOn <= addDays(today(), 14))) tasks.push({ id: `man_${md.id}`, tone: 'warning', text: `The mandate for ${md.propertyTitle} ends on ${formatDate(md.endsOn)}.`, link: '/portal/mandates' })
    return {
      org: toOrg(org),
      counts: {
        published: listings.filter((l) => l.state === 'published').length,
        drafts: listings.filter((l) => l.state === 'draft').length,
        newLeads: db.enquiries.filter((e) => e.orgId === orgId && e.status === 'new' && mine(e.assigneeId)).length,
        upcomingViewings: db.viewings.filter((v) => v.orgId === orgId && ['requested', 'proposed', 'confirmed', 'agent_en_route'].includes(v.state) && mine(v.agentId)).length,
        upcomingBookings: upcoming.length,
      },
      tasks,
    }
  },

  /** ORG-001: anyone signed in can start supplying. They become its administrator. */
  async createOrg(input: { kind: OrgKind; legalName: string; tradingName: string; registrationNumber?: string; address: string; region: string }): Promise<Organization> {
    const db = await begin()
    const me = requireUser(db)
    if (!me.emailVerified) throw new ApiError('FORBIDDEN', 'Please verify your email address first.')
    const fields: Record<string, string> = {}
    if (input.legalName.trim().length < 2) fields.legalName = 'Enter the legal name.'
    if (input.address.trim().length < 5) fields.address = 'Enter the address.'
    if (input.kind === 'agency' && !input.registrationNumber?.trim()) fields.registrationNumber = 'Agencies must give their registration number.'
    if (Object.keys(fields).length) throw new ApiError('BAD_REQUEST', 'Please check the highlighted fields.', { fields })
    const o: OrgRec = { id: uid('o'), kind: input.kind, legalName: input.legalName.trim(), tradingName: (input.tradingName || input.legalName).trim(), registrationNumber: input.registrationNumber?.trim() || undefined, address: input.address.trim(), region: input.region, baseCurrency: 'GHS', status: 'pending_verification', verification: { kind: 'unverified' }, createdAt: isoNow() }
    db.orgs.push(o)
    db.members.push({ orgId: o.id, userId: me.id, role: 'admin', joinedAt: isoNow() })
    audit(db, me, 'organization.create', o.legalName)
    await commit(db)
    return toOrg(o)
  },

  async org(orgId: string): Promise<{ org: Organization; me: ReturnType<typeof toUser>; role: OrgRole; beneficiary?: Beneficiary }> {
    const db = await begin()
    const { org, member, user } = requireMember(db, orgId)
    return { org: toOrg(org), me: toUser(db, user), role: member.role, beneficiary: member.role !== 'agent' ? org.beneficiary : undefined }
  },

  async members(orgId: string): Promise<{ members: Member[]; invitations: { id: string; email: string; role: OrgRole; sentAt: string }[] }> {
    const db = await begin()
    requireMember(db, orgId)
    return {
      members: db.members.filter((m) => m.orgId === orgId).map((m) => {
        const u = db.users.find((x) => x.id === m.userId)!
        return { userId: u.id, name: u.name, email: u.email, role: m.role, licence: m.licence, joinedAt: m.joinedAt }
      }),
      invitations: db.invitations.filter((i) => i.orgId === orgId),
    }
  },

  async invite(orgId: string, email: string, role: OrgRole): Promise<void> {
    const db = await begin()
    const { user } = requireMember(db, orgId, ['admin'])
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) throw new ApiError('BAD_REQUEST', 'Enter a valid email address.', { fields: { email: 'Invalid email' } })
    if (db.invitations.some((i) => i.orgId === orgId && i.email === email.trim())) throw new ApiError('CONFLICT', 'That person has already been invited.')
    db.invitations.unshift({ id: uid('inv'), orgId, email: email.trim(), role, sentAt: isoNow() })
    audit(db, user, 'member.invite', `${email} as ${role}`)
    await commit(db)
  },

  async cancelInvite(orgId: string, inviteId: string): Promise<void> {
    const db = await begin()
    requireMember(db, orgId, ['admin'])
    db.invitations = db.invitations.filter((i) => i.id !== inviteId)
    await commit(db)
  },

  /** ORG-011: an organization always keeps at least one administrator. */
  async changeRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
    const db = await begin()
    const { user } = requireMember(db, orgId, ['admin'])
    const m = findOr404(db.members.find((x) => x.orgId === orgId && x.userId === userId), 'This member')
    if (m.role === 'admin' && role !== 'admin' && db.members.filter((x) => x.orgId === orgId && x.role === 'admin').length === 1) {
      throw new ApiError('CONFLICT', 'Every organization needs at least one administrator. Make someone else an administrator first.', { reason: 'LAST_ADMIN' })
    }
    m.role = role
    audit(db, user, 'member.role', `${nameOf(db, userId)} → ${role}`)
    await commit(db)
  },

  async removeMember(orgId: string, userId: string): Promise<void> {
    const db = await begin()
    const { user } = requireMember(db, orgId, ['admin'])
    const m = findOr404(db.members.find((x) => x.orgId === orgId && x.userId === userId), 'This member')
    if (m.role === 'admin' && db.members.filter((x) => x.orgId === orgId && x.role === 'admin').length === 1) {
      throw new ApiError('CONFLICT', 'You can’t remove the last administrator. Make someone else an administrator first.', { reason: 'LAST_ADMIN' })
    }
    db.members = db.members.filter((x) => x !== m)
    for (const l of db.listings.filter((x) => x.orgId === orgId && x.agentId === userId)) l.agentId = undefined
    audit(db, user, 'member.remove', nameOf(db, userId))
    await commit(db)
  },

  /** ORG-013: a renewed licence goes to Abode for checking. */
  async submitLicence(orgId: string, userId: string, number: string, expiresOn: ISODate, evidenceName: string): Promise<void> {
    const db = await begin()
    const { user } = requireMember(db, orgId, ['admin'])
    const m = findOr404(db.members.find((x) => x.orgId === orgId && x.userId === userId && x.role === 'agent'), 'This agent')
    if (!number.trim() || !expiresOn) throw new ApiError('BAD_REQUEST', 'Enter the licence number and expiry date.')
    const org = db.orgs.find((o) => o.id === orgId)!
    db.verificationCases.unshift({ id: uid('vc'), subject: { kind: 'agent_licence', id: m.userId, name: nameOf(db, m.userId) }, orgId, orgName: org.tradingName, submittedBy: user.name, evidence: [{ id: uid('ev'), name: evidenceName || 'Licence.pdf', type: 'Licence' }], note: `Licence ${number.trim()}, valid until ${expiresOn}`, state: 'submitted', history: [{ at: isoNow(), state: 'submitted', by: user.name }], createdAt: isoNow() })
    await commit(db)
  },

  async verificationCases(orgId: string): Promise<VerificationCase[]> {
    const db = await begin()
    requireMember(db, orgId)
    return db.verificationCases.filter((c) => c.orgId === orgId)
  },

  /** TRU-001: evidence goes to Abode. File contents are never shown publicly. */
  async submitVerification(orgId: string, evidence: { name: string; type: string }[], note?: string): Promise<VerificationCase> {
    const db = await begin()
    const { user, org } = requireMember(db, orgId, ['admin'])
    if (evidence.length < 2) throw new ApiError('BAD_REQUEST', 'Upload at least two documents: proof of registration or identity, and proof of address.', { fields: { evidence: 'Add documents' } })
    const open = db.verificationCases.find((c) => c.orgId === orgId && c.subject.kind === 'organization' && ['submitted', 'in_review', 'more_info'].includes(c.state))
    if (open) {
      open.evidence.push(...evidence.map((e) => ({ id: uid('ev'), ...e })))
      open.state = 'submitted'
      open.note = note ?? open.note
      open.history.push({ at: isoNow(), state: 'submitted', by: user.name, note: 'More information sent' })
      await commit(db)
      return open
    }
    const c: VerificationCase = { id: uid('vc'), subject: { kind: 'organization', id: org.id, name: org.legalName }, orgId, orgName: org.tradingName, submittedBy: user.name, evidence: evidence.map((e) => ({ id: uid('ev'), ...e })), note, state: 'submitted', history: [{ at: isoNow(), state: 'submitted', by: user.name }], createdAt: isoNow() }
    db.verificationCases.unshift(c)
    await commit(db)
    return c
  },

  async mandates(orgId: string): Promise<Mandate[]> {
    const db = await begin()
    requireMember(db, orgId)
    for (const m of db.mandates) if (m.status === 'active' && m.endsOn < today()) m.status = 'expired'
    return db.mandates.filter((m) => m.agencyId === orgId)
  },

  async createMandate(orgId: string, input: { listingId: string; ownerName: string; exclusive: boolean; startsOn: ISODate; endsOn: ISODate }): Promise<Mandate> {
    const db = await begin()
    const { user } = requireMember(db, orgId, ['admin'])
    const l = findOr404(db.listings.find((x) => x.id === input.listingId && x.orgId === orgId), 'This listing')
    if (!input.ownerName.trim()) throw new ApiError('BAD_REQUEST', 'Enter the owner’s name.', { fields: { ownerName: 'Required' } })
    if (!input.endsOn || input.endsOn <= input.startsOn) throw new ApiError('BAD_REQUEST', 'The end date must be after the start date.', { fields: { endsOn: 'After start' } })
    // ORG-019: only one exclusive mandate per property at a time.
    if (input.exclusive && db.mandates.some((m) => m.propertyId === l.propertyId && m.status === 'active' && m.exclusive)) {
      throw new ApiError('CONFLICT', 'This property already has an active exclusive mandate.', { reason: 'EXCLUSIVE_CONFLICT' })
    }
    const m: Mandate = { id: uid('mnd'), agencyId: orgId, ownerName: input.ownerName.trim(), propertyId: l.propertyId, propertyTitle: l.title || 'Untitled listing', exclusive: input.exclusive, startsOn: input.startsOn, endsOn: input.endsOn, status: 'active' }
    db.mandates.unshift(m)
    audit(db, user, 'mandate.create', m.propertyTitle)
    await commit(db)
    return m
  },

  /** ORG-021: revoking a mandate withdraws the listings that depend on it. */
  async revokeMandate(orgId: string, mandateId: string, reason: string): Promise<{ withdrawn: string[] }> {
    const db = await begin()
    const { user } = requireMember(db, orgId, ['admin'])
    const m = findOr404(db.mandates.find((x) => x.id === mandateId && x.agencyId === orgId), 'This mandate')
    if (!reason.trim()) throw new ApiError('BAD_REQUEST', 'Give a reason.', { fields: { reason: 'Required' } })
    m.status = 'revoked'
    m.revokedReason = reason.trim()
    const withdrawn: string[] = []
    for (const l of db.listings.filter((x) => x.propertyId === m.propertyId && ['published', 'paused', 'in_review', 'submitted'].includes(x.state))) {
      l.state = 'withdrawn'
      l.withdrawnReason = 'The owner’s mandate was revoked.'
      l.history.push({ at: isoNow(), state: 'withdrawn', by: user.name, note: reason.trim() })
      withdrawn.push(l.title)
    }
    audit(db, user, 'mandate.revoke', m.propertyTitle, reason.trim())
    await commit(db)
    return { withdrawn }
  },

  // ── Listings ──

  async listings(orgId: string): Promise<ManagedListing[]> {
    const db = await begin()
    const { member, user } = requireMember(db, orgId)
    const out = db.listings.filter((l) => l.orgId === orgId && (seesAll(member.role) || member.role === 'finance' || l.agentId === user.id)).map((l) => toManaged(db, l))
    await commit(db)
    return out
  },

  async listing(id: string): Promise<{ listing: ManagedListing; checks: PublishCheck[]; agents: { id: string; name: string }[] }> {
    const db = await begin()
    const { l } = listingFor(db, id)
    const out = { listing: toManaged(db, l), checks: publishChecks(db, l), agents: eligibleAgents(db, l.orgId).map((m) => ({ id: m.userId, name: nameOf(db, m.userId) })) }
    await commit(db)
    return out
  },

  async createListing(orgId: string, input: ListingInput): Promise<ManagedListing> {
    const db = await begin()
    const { user, member, org } = requireMember(db, orgId, ['admin', 'agent'])
    validateInput(input)
    const id = uid('l')
    const l: ListingRec = { id, orgId, propertyId: uid('prop'), intent: input.intent, propertyType: input.propertyType, state: 'draft', title: '', description: '', address: input.address, addressDisplay: input.addressDisplay, priceMinor: 0, currency: org.baseCurrency, basis: input.basis, features: [], photos: [], promoted: false, reviewCount: 0, priceOverrides: {}, blocks: {}, history: [{ at: isoNow(), state: 'draft', by: user.name }], stats: { views: 0, enquiries: 0, bookings: 0 }, createdAt: isoNow() }
    applyInput(l, { ...input, agentId: input.agentId ?? (member.role === 'agent' ? user.id : undefined) })
    db.listings.unshift(l)
    await commit(db)
    return toManaged(db, l)
  },

  async updateListing(id: string, input: ListingInput): Promise<ManagedListing> {
    const db = await begin()
    const { l, member, user } = listingFor(db, id)
    if (member.role === 'finance') throw new ApiError('FORBIDDEN', 'Finance users can’t edit listings.')
    if (member.role === 'agent' && l.agentId !== user.id) throw new ApiError('FORBIDDEN', 'You can only edit listings assigned to you.')
    validateInput(input)
    const changed = input.priceMinor !== l.priceMinor || input.title.trim() !== l.title
    applyInput(l, input)
    if (l.state === 'published' && changed) l.history.push({ at: isoNow(), state: 'published', by: user.name, note: 'Title or price edited' })
    await commit(db)
    return toManaged(db, l)
  },

  /** PROP-025 to 030: photos arrive pending, with alt text and rights confirmed per photo. */
  async addPhotos(id: string, photos: { url: string; alt: string; room?: string; rightsConfirmed: boolean }[]): Promise<ManagedListing> {
    const db = await begin()
    const { l } = listingFor(db, id)
    if (l.photos.length + photos.length > 30) throw new ApiError('BAD_REQUEST', 'A listing can have up to 30 photos.')
    for (const p of photos) l.photos.push({ id: uid('ph'), url: p.url, alt: p.alt, room: p.room, status: 'pending', rightsConfirmed: p.rightsConfirmed, uploadedAt: isoNow() })
    await commit(db)
    return toManaged(db, l)
  },

  async updatePhoto(id: string, photoId: string, patch: { alt?: string; room?: string; rightsConfirmed?: boolean; makePrimary?: boolean; remove?: boolean }): Promise<ManagedListing> {
    const db = await begin()
    const { l } = listingFor(db, id)
    const i = l.photos.findIndex((p) => p.id === photoId)
    if (i < 0) throw new ApiError('NOT_FOUND', 'That photo could not be found.')
    if (patch.remove) l.photos.splice(i, 1)
    else {
      const p = l.photos[i]
      if (patch.alt !== undefined) p.alt = patch.alt
      if (patch.room !== undefined) p.room = patch.room
      if (patch.rightsConfirmed !== undefined) p.rightsConfirmed = patch.rightsConfirmed
      if (patch.makePrimary) {
        l.photos.splice(i, 1)
        l.photos.unshift(p)
      }
    }
    settlePhotos(l)
    await commit(db)
    return toManaged(db, l)
  },

  /** PROP-020, PROP-021: submit returns every unmet condition at once. */
  async submitListing(id: string): Promise<ManagedListing> {
    const db = await begin()
    const { l, user } = listingFor(db, id)
    settlePhotos(l)
    const unmet = publishChecks(db, l).filter((c) => !c.met)
    if (unmet.length) throw new ApiError('BAD_REQUEST', `${unmet.length} ${unmet.length === 1 ? 'thing needs' : 'things need'} fixing before this can go live.`, { reason: 'PUBLISH_GATE' })
    l.state = 'in_review'
    l.rejectionReason = undefined
    l.history.push({ at: isoNow(), state: 'in_review', by: user.name })
    await commit(db)
    return toManaged(db, l)
  },

  async setListingState(id: string, action: 'pause' | 'resume' | 'renew' | 'withdraw' | 'let_or_sold', reason?: string): Promise<ManagedListing> {
    const db = await begin()
    const { l, user, member } = listingFor(db, id)
    if (member.role === 'finance') throw new ApiError('FORBIDDEN', 'Finance users can’t change listings.')
    const to = { pause: 'paused', resume: 'published', renew: 'published', withdraw: 'withdrawn', let_or_sold: 'let_or_sold' } as const
    const allowed: Record<typeof action, ListingRec['state'][]> = { pause: ['published'], resume: ['paused'], renew: ['published', 'expired'], withdraw: ['published', 'paused', 'expired', 'draft', 'in_review'], let_or_sold: ['published', 'paused'] }
    if (!allowed[action].includes(l.state)) throw new ApiError('BAD_REQUEST', 'That isn’t possible for a listing in this state.')
    if (action === 'resume') {
      const unmet = publishChecks(db, l).filter((c) => !c.met)
      if (unmet.length) throw new ApiError('BAD_REQUEST', `Can’t resume yet: ${unmet.map((c) => c.label.toLowerCase()).join('; ')}.`, { reason: 'PUBLISH_GATE' })
    }
    l.state = to[action]
    if (action === 'renew' || action === 'resume') l.expiresOn = addDays(today(), 60)
    if (action === 'withdraw') l.withdrawnReason = reason || 'Withdrawn by the lister'
    if (action === 'resume') l.withdrawnReason = undefined
    l.history.push({ at: isoNow(), state: l.state, by: user.name, note: reason ?? (action === 'renew' ? 'Renewed for 60 days' : undefined) })
    await commit(db)
    return toManaged(db, l)
  },

  // ── Short-stay calendar ──

  async calendar(id: string, from: ISODate, days = 42): Promise<CalendarDay[]> {
    const db = await begin()
    const { l } = listingFor(db, id)
    return calendar(db, l, from, days, true)
  },

  /** RATE-023, RATE-026: open or close a range; all or nothing. */
  async setAvailability(id: string, dates: ISODate[], open: boolean, note?: string): Promise<void> {
    const db = await begin()
    const { l, member } = listingFor(db, id)
    if (member.role === 'finance') throw new ApiError('FORBIDDEN', 'Finance users can’t change availability.')
    const booked = new Set(db.bookings.filter((b) => b.listingId === l.id && ['confirmed', 'pending_payment', 'in_stay'].includes(b.state)).flatMap((b) => {
      const out: string[] = []
      for (let d = b.checkIn; d < b.checkOut; d = addDays(d, 1)) out.push(d)
      return out
    }))
    const clash = dates.find((d) => booked.has(d))
    if (clash) throw new ApiError('CONFLICT', `${clash} is booked by a guest. Cancel that booking first if you really need the date.`)
    for (const d of dates) {
      if (open) delete l.blocks[d]
      else l.blocks[d] = note?.trim() || 'Closed by host'
    }
    await commit(db)
  },

  async setPrices(id: string, dates: ISODate[], priceMinor: number | null): Promise<void> {
    const db = await begin()
    const { l, member } = listingFor(db, id)
    if (member.role === 'finance') throw new ApiError('FORBIDDEN', 'Finance users can’t change prices.')
    if (priceMinor !== null && (!Number.isInteger(priceMinor) || priceMinor <= 0)) throw new ApiError('BAD_REQUEST', 'Enter a price above zero.')
    for (const d of dates) {
      if (priceMinor === null) delete l.priceOverrides[d]
      else l.priceOverrides[d] = priceMinor
    }
    await commit(db)
  },

  // ── Leads ──

  async leads(orgId: string): Promise<Enquiry[]> {
    const db = await begin()
    const { member, user } = requireMember(db, orgId, ['admin', 'agent'])
    return db.enquiries.filter((e) => e.orgId === orgId && (seesAll(member.role) || e.assigneeId === user.id)).map((e) => toEnquiry(db, e, false))
  },

  async lead(id: string): Promise<{ lead: Enquiry; agents: { id: string; name: string }[]; viewings: Viewing[] }> {
    const db = await begin()
    const e = findOr404(db.enquiries.find((x) => x.id === id), 'This enquiry')
    const { member, user } = requireMember(db, e.orgId, ['admin', 'agent'])
    if (!seesAll(member.role) && e.assigneeId !== user.id) throw new ApiError('FORBIDDEN', 'This enquiry is assigned to someone else.')
    return { lead: toEnquiry(db, e, false), agents: eligibleAgents(db, e.orgId).map((m) => ({ id: m.userId, name: nameOf(db, m.userId) })), viewings: db.viewings.filter((v) => v.enquiryId === e.id || (v.listingId === e.listingId && v.seekerId === e.seekerId)).map((v) => toViewing(db, v, false)) }
  },

  async updateLead(id: string, patch: { status?: LeadStatus; lostReason?: string; assigneeId?: string }): Promise<Enquiry> {
    const db = await begin()
    const e = findOr404(db.enquiries.find((x) => x.id === id), 'This enquiry')
    const { member, user } = requireMember(db, e.orgId, ['admin', 'agent'])
    if (!seesAll(member.role) && e.assigneeId !== user.id) throw new ApiError('FORBIDDEN', 'This enquiry is assigned to someone else.')
    if (patch.assigneeId !== undefined) {
      if (!seesAll(member.role)) throw new ApiError('FORBIDDEN', 'Only administrators can reassign enquiries.')
      if (!eligibleAgents(db, e.orgId).some((m) => m.userId === patch.assigneeId)) throw new ApiError('BAD_REQUEST', 'That person can’t take enquiries (no current licence).')
      e.assigneeId = patch.assigneeId
      notify(db, [patch.assigneeId], 'Enquiry assigned to you', `${nameOf(db, e.seekerId)} · ${db.listings.find((l) => l.id === e.listingId)?.title}`, `/portal/leads/${e.id}`)
    }
    if (patch.status) {
      if (patch.status === 'lost' && !patch.lostReason?.trim()) throw new ApiError('BAD_REQUEST', 'Say why the enquiry was lost.', { fields: { lostReason: 'Required' } })
      e.status = patch.status
      e.lostReason = patch.status === 'lost' ? patch.lostReason!.trim() : undefined
    }
    audit(db, user, 'lead.update', `${e.id} → ${e.status}`)
    await commit(db)
    return toEnquiry(db, e, false)
  },

  // ── Viewings and tracking (agent side) ──

  async viewings(orgId: string): Promise<Viewing[]> {
    const db = await begin()
    const { member, user } = requireMember(db, orgId, ['admin', 'agent'])
    const out = db.viewings.filter((v) => v.orgId === orgId && (seesAll(member.role) || v.agentId === user.id || (!v.agentId && db.listings.find((l) => l.id === v.listingId)?.agentId === user.id))).map((v) => toViewing(db, v, false))
    await commit(db)
    return out
  },

  async viewing(id: string): Promise<{ viewing: Viewing; agents: { id: string; name: string }[]; isAssignedAgent: boolean; trackingAllowed: boolean }> {
    const db = await begin()
    const v = findOr404(db.viewings.find((x) => x.id === id), 'This viewing')
    const { user } = requireMember(db, v.orgId, ['admin', 'agent'])
    const out = { viewing: toViewing(db, v, false), agents: eligibleAgents(db, v.orgId).map((m) => ({ id: m.userId, name: nameOf(db, m.userId) })), isAssignedAgent: v.agentId === user.id, trackingAllowed: db.flags.find((f) => f.key === 'live_tracking')?.enabled ?? false }
    await commit(db)
    return out
  },

  /** TRK-009, TRK-010: confirm one slot with an eligible agent; no double-booking. */
  async confirmViewing(id: string, slot: string, agentId: string, meetingPoint: string): Promise<Viewing> {
    const db = await begin()
    const v = findOr404(db.viewings.find((x) => x.id === id), 'This viewing')
    const { user } = requireMember(db, v.orgId, ['admin', 'agent'])
    if (!eligibleAgents(db, v.orgId).some((m) => m.userId === agentId)) throw new ApiError('BAD_REQUEST', 'That person can’t lead viewings (no current licence).')
    const clash = db.viewings.find((o) => o.id !== v.id && o.agentId === agentId && o.confirmedSlot && ['confirmed', 'agent_en_route', 'arrived', 'in_progress'].includes(o.state) && Math.abs(Date.parse(o.confirmedSlot) - Date.parse(slot)) < 60 * 60_000)
    if (clash) throw new ApiError('CONFLICT', `${nameOf(db, agentId)} already has a viewing within an hour of that time.`, { reason: 'AGENT_DOUBLE_BOOKED' })
    v.state = 'confirmed'
    v.confirmedSlot = slot
    v.agentId = agentId
    v.meetingPoint = meetingPoint.trim() || v.meetingPoint
    v.timeline.push({ at: isoNow(), state: 'confirmed', note: `${nameOf(db, agentId)} will meet you` })
    const e = v.enquiryId ? db.enquiries.find((x) => x.id === v.enquiryId) : undefined
    if (e) e.status = 'viewing_scheduled'
    notify(db, [v.seekerId], 'Viewing confirmed', db.listings.find((l) => l.id === v.listingId)!.title, `/viewings/${v.id}`)
    audit(db, user, 'viewing.confirm', v.id)
    await commit(db)
    return toViewing(db, v, false)
  },

  async proposeTime(id: string, slot: string): Promise<Viewing> {
    const db = await begin()
    const v = findOr404(db.viewings.find((x) => x.id === id), 'This viewing')
    requireMember(db, v.orgId, ['admin', 'agent'])
    if (Date.parse(slot) <= Date.now()) throw new ApiError('BAD_REQUEST', 'Choose a time in the future.')
    v.state = 'proposed'
    v.slots = [...v.slots, slot]
    v.timeline.push({ at: isoNow(), state: 'proposed', note: 'A new time was proposed' })
    notify(db, [v.seekerId], 'New viewing time proposed', db.listings.find((l) => l.id === v.listingId)!.title, `/viewings/${v.id}`)
    await commit(db)
    return toViewing(db, v, false)
  },

  /** TRK-013: manual status at every step, with or without location (TRK-014). */
  async setViewingState(id: string, state: Extract<ViewingState, 'agent_en_route' | 'arrived' | 'in_progress' | 'completed' | 'no_show' | 'cancelled'>, reason?: string): Promise<Viewing> {
    const db = await begin()
    const v = findOr404(db.viewings.find((x) => x.id === id), 'This viewing')
    const { user } = requireMember(db, v.orgId, ['admin', 'agent'])
    const order: ViewingState[] = ['confirmed', 'agent_en_route', 'arrived', 'in_progress', 'completed']
    if (state === 'cancelled' && !reason?.trim()) throw new ApiError('BAD_REQUEST', 'Give the seeker a reason.', { fields: { reason: 'Required' } })
    if (order.includes(state) && order.indexOf(state) <= order.indexOf(v.state)) throw new ApiError('BAD_REQUEST', 'That step is already done.')
    if (['completed', 'cancelled', 'no_show'].includes(v.state)) throw new ApiError('BAD_REQUEST', 'This viewing has ended.')
    v.state = state
    if (state === 'cancelled') v.cancelReason = reason!.trim()
    v.timeline.push({ at: isoNow(), state, note: reason?.trim() })
    if (state !== 'agent_en_route') endTracking(v, state === 'arrived' ? 'The agent arrived.' : 'The viewing moved on.')
    const title = db.listings.find((l) => l.id === v.listingId)!.title
    const words: Record<string, string> = { agent_en_route: `${user.name} is on the way`, arrived: `${user.name} has arrived`, in_progress: 'Your viewing has started', completed: 'Viewing completed', no_show: 'Marked as no-show', cancelled: 'Viewing cancelled' }
    notify(db, [v.seekerId], words[state], title, `/viewings/${v.id}`)
    await commit(db)
    return toViewing(db, v, false)
  },

  /** TRK-018: sharing starts only from an explicit choice each time. */
  async startSharing(id: string, optIn: boolean): Promise<Viewing> {
    const db = await begin()
    const v = findOr404(db.viewings.find((x) => x.id === id), 'This viewing')
    const { user } = requireMember(db, v.orgId, ['admin', 'agent'])
    if (!optIn) throw new ApiError('BAD_REQUEST', 'Confirm that you want to share your location.')
    if (!db.flags.find((f) => f.key === 'live_tracking')?.enabled) throw new ApiError('FORBIDDEN', 'Live location is switched off by Abode.')
    if (v.agentId !== user.id) throw new ApiError('FORBIDDEN', 'Only the assigned agent can share their location.')
    if (v.state !== 'agent_en_route') throw new ApiError('BAD_REQUEST', 'Tap “I’m on my way” first.')
    if (v.tracking && !v.tracking.ended) return toViewing(db, v, false)
    v.tracking = newTracking(user.id)
    await commit(db)
    return toViewing(db, v, false)
  },

  async stopSharing(id: string): Promise<Viewing> {
    const db = await begin()
    const v = findOr404(db.viewings.find((x) => x.id === id), 'This viewing')
    requireMember(db, v.orgId, ['admin', 'agent'])
    endTracking(v, 'The agent stopped sharing.')
    await commit(db)
    return toViewing(db, v, false)
  },

  /** For the banner shown on every portal page while sharing (TRK-023). */
  async mySharing(): Promise<{ viewingId: string; seekerName: string; endsAt: string } | null> {
    const db = await begin()
    const me = requireUser(db)
    for (const v of db.viewings) {
      if (v.tracking && v.tracking.agentId === me.id && !v.tracking.ended && v.tracking.sharing) {
        if (Date.now() > v.tracking.endsAt) {
          endTracking(v, 'Sharing reached its time limit.')
          await commit(db)
          continue
        }
        return { viewingId: v.id, seekerName: nameOf(db, v.seekerId), endsAt: new Date(v.tracking.endsAt).toISOString() }
      }
    }
    return null
  },

  // ── Bookings and money ──

  async bookings(orgId: string): Promise<Booking[]> {
    const db = await begin()
    requireMember(db, orgId, ['admin', 'finance'])
    const ids = new Set(db.listings.filter((l) => l.orgId === orgId).map((l) => l.id))
    const out = db.bookings.filter((b) => ids.has(b.listingId)).map((b) => toBooking(db, b, true)).sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    await commit(db)
    return out
  },

  /** BOOK-037: a host cancellation refunds the guest in full and needs a reason. */
  async hostCancel(bookingId: string, reason: string): Promise<Booking> {
    const db = await begin()
    const b = findOr404(db.bookings.find((x) => x.id === bookingId), 'This booking')
    const l = db.listings.find((x) => x.id === b.listingId)!
    const { user } = requireMember(db, l.orgId, ['admin'])
    if (b.state !== 'confirmed') throw new ApiError('BAD_REQUEST', 'Only confirmed bookings can be cancelled.')
    if (reason.trim().length < 10) throw new ApiError('BAD_REQUEST', 'Explain to the guest why (at least 10 characters).', { fields: { reason: 'Too short' } })
    b.state = 'cancelled_by_host'
    b.cancelReason = reason.trim()
    b.refund = { lines: b.lines, total: money(b.totalMinor), settled: false, requestedAt: isoNow() }
    db.recon.unshift({ id: uid('rc'), bookingId: b.id, issue: 'refund_pending', amountMinor: b.totalMinor, createdAt: Date.now(), resolved: false })
    notify(db, [b.guestId], 'Your host cancelled your booking', `${b.reference}. You’ll get a full refund.`, `/trips/${b.id}`)
    audit(db, user, 'booking.host_cancel', b.reference, reason.trim())
    await commit(db)
    return toBooking(db, b, true)
  },

  async payouts(orgId: string): Promise<Payout[]> {
    const db = await begin()
    const { org } = requireMember(db, orgId, ['admin', 'finance'])
    return db.payouts.filter((p) => p.orgId === orgId).map((p) => ({ id: p.id, orgId: p.orgId, orgName: org.tradingName, amount: money(p.amountMinor), bookingRefs: p.bookingRefs, state: p.state, createdBy: nameOf(db, p.createdById), createdById: p.createdById, approvedBy: p.approvedById ? nameOf(db, p.approvedById) : undefined, rejectedReason: p.rejectedReason, createdAt: p.createdAt }))
  },

  /** ORG-026: changing where money goes needs the password again, then waits 48 hours. */
  async setBeneficiary(orgId: string, input: { method: Beneficiary['method']; accountName: string; accountNumber: string; provider: string; password: string }): Promise<Beneficiary> {
    const db = await begin()
    const { user, org } = requireMember(db, orgId, ['admin', 'finance'])
    if (user.passwordHash !== hashPassword(user.email, input.password)) throw new ApiError('BAD_REQUEST', 'That password is not right.', { reason: 'STEP_UP_FAILED', fields: { password: 'Incorrect password' } })
    const digits = input.accountNumber.replace(/\D/g, '')
    if (digits.length < 8) throw new ApiError('BAD_REQUEST', 'Enter the full account or wallet number.', { fields: { accountNumber: 'Too short' } })
    org.beneficiary = { method: input.method, accountName: input.accountName.trim(), accountNumberMasked: `•••• ${digits.slice(-4)}`, provider: input.provider, coolingOffUntil: new Date(Date.now() + 2 * DAY).toISOString() }
    audit(db, user, 'beneficiary.change', org.tradingName)
    notify(db, orgUsers(db, orgId, ['admin', 'finance']), 'Payout account changed', `Payouts to the new account start after 48 hours.`, '/portal/payouts')
    await commit(db)
    return org.beneficiary
  },
}
