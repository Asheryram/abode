/** What Abode staff use. Every privileged action needs a reason and is audited (ADM-004). */
import {
  ApiError,
  type AdminQueueSummary,
  type AuditEvent,
  type Booking,
  type Enquiry,
  type FeatureFlag,
  type ManagedListing,
  type Payout,
  type ReconciliationItem,
  type Report,
  type StaffRole,
  type User,
  type VerificationCase,
} from '../../contracts'
import { formatMoney } from '../../design-system/money'
import { addDays, today } from '../../lib/dates'
import { audit, begin, commit, findOr404, money, nameOf, notify, orgUsers, requireStaff, toBooking, toManaged, toUser } from './core'
import { toEnquiry } from './publicApi'
import type { DB } from './state'
import { HOUR, isoNow } from './util'

const reasonRequired = (reason: string) => {
  if (!reason || reason.trim().length < 5) throw new ApiError('BAD_REQUEST', 'Give a reason of at least 5 characters. It is kept in the audit log.', { fields: { reason: 'Required' } })
  return reason.trim()
}

/** ADM-008: a claimed item is worked by one person at a time. */
function claimable<T extends { claimedBy?: string }>(item: T, me: { name: string }) {
  if (item.claimedBy && item.claimedBy !== me.name) throw new ApiError('CONFLICT', `${item.claimedBy} is working on this. Ask them to release it first.`, { reason: 'CLAIMED' })
}

const READ_ALL: StaffRole[] = ['moderator', 'verification_officer', 'finance_operator', 'support_agent', 'analyst']

function toPayout(db: DB, p: DB['payouts'][number]): Payout {
  return { id: p.id, orgId: p.orgId, orgName: db.orgs.find((o) => o.id === p.orgId)!.tradingName, amount: money(p.amountMinor), bookingRefs: p.bookingRefs, state: p.state, createdBy: nameOf(db, p.createdById), createdById: p.createdById, approvedBy: p.approvedById ? nameOf(db, p.approvedById) : undefined, rejectedReason: p.rejectedReason, createdAt: p.createdAt }
}

export const adminApi = {
  async queues(): Promise<AdminQueueSummary> {
    const db = await begin()
    requireStaff(db, READ_ALL)
    return {
      verification: db.verificationCases.filter((c) => ['submitted', 'in_review'].includes(c.state)).length,
      listingReview: db.listings.filter((l) => l.state === 'in_review').length,
      reports: db.reports.filter((r) => r.state === 'open').length,
      reconciliation: db.recon.filter((r) => !r.resolved).length,
      payoutsAwaiting: db.payouts.filter((p) => p.state === 'pending_approval').length,
    }
  },

  // ── Verification ──

  async verificationCases(): Promise<VerificationCase[]> {
    const db = await begin()
    requireStaff(db, ['verification_officer', 'analyst'])
    return db.verificationCases
  },

  async verificationCase(id: string): Promise<VerificationCase> {
    const db = await begin()
    requireStaff(db, ['verification_officer', 'analyst'])
    return findOr404(db.verificationCases.find((c) => c.id === id), 'This case')
  },

  async claimVerification(id: string, claim: boolean): Promise<VerificationCase> {
    const db = await begin()
    const me = requireStaff(db, ['verification_officer'])
    const c = findOr404(db.verificationCases.find((x) => x.id === id), 'This case')
    if (claim) {
      claimable(c, me)
      c.claimedBy = me.name
      if (c.state === 'submitted') {
        c.state = 'in_review'
        c.history.push({ at: isoNow(), state: 'in_review', by: me.name })
      }
    } else if (c.claimedBy === me.name) c.claimedBy = undefined
    await commit(db)
    return c
  },

  /** TRU-005, TRU-010: a decision always carries a reason. */
  async decideVerification(id: string, decision: 'approved' | 'rejected' | 'more_info', reason: string): Promise<VerificationCase> {
    const db = await begin()
    const me = requireStaff(db, ['verification_officer'])
    const c = findOr404(db.verificationCases.find((x) => x.id === id), 'This case')
    if (c.claimedBy !== me.name) throw new ApiError('CONFLICT', 'Claim the case before deciding it.', { reason: 'NOT_CLAIMED' })
    const why = reasonRequired(reason)
    c.state = decision
    c.reason = why
    c.claimedBy = undefined
    c.history.push({ at: isoNow(), state: decision, by: me.name, note: why })
    if (decision === 'approved') {
      if (c.subject.kind === 'organization') {
        const o = db.orgs.find((x) => x.id === c.orgId)!
        o.status = 'active'
        o.verification = { kind: o.kind === 'agency' ? 'agency' : 'owner', validUntil: addDays(today(), 365) }
      }
      if (c.subject.kind === 'agent_licence') {
        const m = db.members.find((x) => x.userId === c.subject.id && x.orgId === c.orgId)
        if (m?.licence) m.licence.expiresOn = addDays(today(), 365)
      }
    }
    const words = { approved: 'Verification approved', rejected: 'Verification not approved', more_info: 'More information needed' }
    notify(db, orgUsers(db, c.orgId, ['admin']), words[decision], `${c.subject.name}: ${why}`, '/portal/organization')
    audit(db, me, `verification.${decision}`, c.subject.name, why)
    await commit(db)
    return c
  },

  // ── Listing review ──

  async reviewQueue(): Promise<ManagedListing[]> {
    const db = await begin()
    requireStaff(db, ['moderator', 'analyst'])
    return db.listings.filter((l) => l.state === 'in_review').map((l) => toManaged(db, l))
  },

  async allListings(q?: string): Promise<ManagedListing[]> {
    const db = await begin()
    requireStaff(db, READ_ALL)
    const t = q?.trim().toLowerCase()
    return db.listings.filter((l) => !t || l.title.toLowerCase().includes(t)).slice(0, 60).map((l) => toManaged(db, l))
  },

  async decideListing(id: string, decision: 'approve' | 'reject' | 'take_down', reason: string): Promise<ManagedListing> {
    const db = await begin()
    const me = requireStaff(db, ['moderator'])
    const l = findOr404(db.listings.find((x) => x.id === id), 'This listing')
    const why = decision === 'approve' ? reason.trim() || 'Meets listing standards' : reasonRequired(reason)
    if (decision === 'approve') {
      if (l.state !== 'in_review') throw new ApiError('BAD_REQUEST', 'This listing is not waiting for review.')
      l.state = 'published'
      l.expiresOn = addDays(today(), 60)
      for (const p of l.photos) if (p.status === 'pending') p.status = 'approved'
    } else if (decision === 'reject') {
      l.state = 'draft'
      l.rejectionReason = why
    } else {
      l.state = 'withdrawn'
      l.withdrawnReason = `Removed by Abode: ${why}`
    }
    l.history.push({ at: isoNow(), state: l.state, by: `Abode (${me.name})`, note: why })
    const words = { approve: 'Your listing is live', reject: 'Your listing needs changes', take_down: 'Your listing was removed' }
    notify(db, orgUsers(db, l.orgId, ['admin']).concat(l.agentId ? [l.agentId] : []), words[decision], `${l.title}${decision === 'approve' ? '' : `: ${why}`}`, `/portal/listings/${l.id}`)
    audit(db, me, `listing.${decision}`, l.title, why)
    await commit(db)
    return toManaged(db, l)
  },

  // ── Reports ──

  async reports(): Promise<Report[]> {
    const db = await begin()
    requireStaff(db, ['moderator', 'analyst', 'support_agent'])
    return db.reports
  },

  async claimReport(id: string, claim: boolean): Promise<Report> {
    const db = await begin()
    const me = requireStaff(db, ['moderator'])
    const r = findOr404(db.reports.find((x) => x.id === id), 'This report')
    if (claim) {
      claimable(r, me)
      r.claimedBy = me.name
    } else if (r.claimedBy === me.name) r.claimedBy = undefined
    await commit(db)
    return r
  },

  async resolveReport(id: string, action: 'dismiss' | 'take_down' | 'warn' | 'restrict', reason: string): Promise<Report> {
    const db = await begin()
    const me = requireStaff(db, ['moderator'])
    const r = findOr404(db.reports.find((x) => x.id === id), 'This report')
    if (r.claimedBy !== me.name) throw new ApiError('CONFLICT', 'Claim the report before resolving it.', { reason: 'NOT_CLAIMED' })
    const why = reasonRequired(reason)
    if (action === 'take_down' && r.target.kind === 'listing') {
      const l = db.listings.find((x) => x.id === r.target.id)
      if (l) {
        l.state = 'withdrawn'
        l.withdrawnReason = `Removed by Abode: ${why}`
        l.history.push({ at: isoNow(), state: 'withdrawn', by: `Abode (${me.name})`, note: why })
        notify(db, orgUsers(db, l.orgId, ['admin']), 'Your listing was removed', `${l.title}: ${why}`, `/portal/listings/${l.id}`)
      }
    }
    r.state = action === 'dismiss' ? 'dismissed' : 'actioned'
    r.resolution = `${{ dismiss: 'Dismissed', take_down: 'Taken down', warn: 'Warning sent', restrict: 'Account restricted' }[action]}: ${why}`
    r.claimedBy = undefined
    audit(db, me, `report.${action}`, r.target.label, why)
    await commit(db)
    return r
  },

  // ── Finance ──

  async reconciliation(): Promise<ReconciliationItem[]> {
    const db = await begin()
    requireStaff(db, ['finance_operator', 'analyst'])
    return db.recon.map((r) => {
      const b = db.bookings.find((x) => x.id === r.bookingId)!
      return { id: r.id, bookingId: b.id, bookingRef: b.reference, issue: r.issue, amount: money(r.amountMinor), ageHours: Math.round((Date.now() - r.createdAt) / HOUR), resolved: r.resolved }
    })
  },

  /** Settle what the provider did: confirm or fail a payment, or record a refund as paid. */
  async resolveRecon(id: string, outcome: 'confirm_payment' | 'fail_payment' | 'settle_refund', reason: string): Promise<void> {
    const db = await begin()
    const me = requireStaff(db, ['finance_operator'])
    const r = findOr404(db.recon.find((x) => x.id === id), 'This item')
    const why = reasonRequired(reason)
    const b = db.bookings.find((x) => x.id === r.bookingId)!
    const l = db.listings.find((x) => x.id === b.listingId)!
    if (outcome === 'confirm_payment') {
      b.payment.status = 'succeeded'
      b.state = 'confirmed'
      notify(db, [b.guestId], 'Booking confirmed', `${b.reference} · ${l.title}`, `/trips/${b.id}`)
    } else if (outcome === 'fail_payment') {
      b.payment.status = 'failed'
      b.state = 'cancelled_by_platform'
      b.cancelReason = 'We could not confirm your payment.'
      notify(db, [b.guestId], 'Payment not received', `${b.reference}: we couldn’t confirm your payment, so the booking was not made.`, `/trips/${b.id}`)
    } else {
      if (!b.refund) throw new ApiError('BAD_REQUEST', 'There is no refund on this booking.')
      b.refund.settled = true
      b.refund.settledAt = isoNow()
      notify(db, [b.guestId], 'Refund sent', `${b.reference}: your refund has been paid.`, `/trips/${b.id}`)
    }
    r.resolved = true
    audit(db, me, `recon.${outcome}`, b.reference, why)
    await commit(db)
  },

  async payouts(): Promise<Payout[]> {
    const db = await begin()
    requireStaff(db, ['finance_operator', 'analyst'])
    return db.payouts.map((p) => toPayout(db, p))
  },

  /** PAY-044, PAY-045: the person who created a payout can never approve it. */
  async decidePayout(id: string, decision: 'approve' | 'reject' | 'mark_paid', reason: string): Promise<Payout> {
    const db = await begin()
    const me = requireStaff(db, ['finance_operator'])
    const p = findOr404(db.payouts.find((x) => x.id === id), 'This payout')
    const why = decision === 'reject' ? reasonRequired(reason) : reason.trim() || 'Checked against bookings'
    if (decision === 'approve') {
      if (p.state !== 'pending_approval') throw new ApiError('BAD_REQUEST', 'This payout is not waiting for approval.')
      if (p.createdById === me.id) throw new ApiError('FORBIDDEN', 'You created this payout, so someone else must approve it. This is the two-person rule.', { reason: 'SELF_APPROVAL' })
      p.state = 'approved'
      p.approvedById = me.id
    } else if (decision === 'reject') {
      p.state = 'rejected'
      p.rejectedReason = why
    } else {
      if (p.state !== 'approved') throw new ApiError('BAD_REQUEST', 'Only approved payouts can be marked as paid.')
      p.state = 'paid'
      notify(db, orgUsers(db, p.orgId, ['admin', 'finance']), 'Payout sent', `${formatMoney(money(p.amountMinor))} for ${p.bookingRefs.join(', ')}`, '/portal/payouts')
    }
    audit(db, me, `payout.${decision}`, `${db.orgs.find((o) => o.id === p.orgId)?.tradingName} · ${p.bookingRefs.join(', ')}`, why)
    await commit(db)
    return toPayout(db, p)
  },

  // ── Support ──

  async searchUsers(q: string): Promise<User[]> {
    const db = await begin()
    requireStaff(db, ['support_agent', 'analyst'])
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    return db.users.filter((u) => u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)).slice(0, 20).map((u) => toUser(db, u))
  },

  async userDetail(id: string): Promise<{ user: User; bookings: Booking[]; enquiries: Enquiry[] }> {
    const db = await begin()
    const me = requireStaff(db, ['support_agent', 'analyst'])
    const u = findOr404(db.users.find((x) => x.id === id), 'This user')
    audit(db, me, 'support.view_user', u.name)
    await commit(db)
    return { user: toUser(db, u), bookings: db.bookings.filter((b) => b.guestId === u.id).map((b) => toBooking(db, b, false)), enquiries: db.enquiries.filter((e) => e.seekerId === u.id).map((e) => toEnquiry(db, e, false)) }
  },

  // ── Platform ──

  async flags(): Promise<FeatureFlag[]> {
    const db = await begin()
    requireStaff(db, READ_ALL)
    return db.flags
  },

  /** ADM-030: a gated feature can't be switched on until its evidence is recorded. */
  async setFlag(key: string, enabled: boolean, reason: string): Promise<FeatureFlag> {
    const db = await begin()
    const me = requireStaff(db, [])
    const f = findOr404(db.flags.find((x) => x.key === key), 'This setting')
    const why = reasonRequired(reason)
    if (enabled && f.gate && !f.gate.evidenceRecorded) throw new ApiError('FORBIDDEN', `${f.gate.name} evidence has not been recorded, so this can’t be switched on.`, { reason: 'GATE_CLOSED' })
    f.enabled = enabled
    f.updatedBy = me.name
    f.updatedAt = isoNow()
    if (!enabled && key === 'live_tracking') {
      for (const v of db.viewings) if (v.tracking && !v.tracking.ended) Object.assign(v.tracking, { ended: true, sharing: false, endedReason: 'Live location was switched off by Abode.' })
    }
    audit(db, me, `flag.${enabled ? 'on' : 'off'}`, f.label, why)
    await commit(db)
    return f
  },

  async recordGateEvidence(key: string, reason: string): Promise<FeatureFlag> {
    const db = await begin()
    const me = requireStaff(db, [])
    const f = findOr404(db.flags.find((x) => x.key === key), 'This setting')
    if (!f.gate) throw new ApiError('BAD_REQUEST', 'This setting has no gate.')
    const why = reasonRequired(reason)
    f.gate.evidenceRecorded = true
    audit(db, me, 'gate.evidence', `${f.gate.name} for ${f.label}`, why)
    await commit(db)
    return f
  },

  async audit(q?: string): Promise<AuditEvent[]> {
    const db = await begin()
    requireStaff(db, ['platform_admin', 'analyst'])
    const t = q?.trim().toLowerCase()
    return db.audit.filter((a) => !t || [a.actor, a.action, a.target, a.reason ?? ''].join(' ').toLowerCase().includes(t)).slice(0, 200)
  },
}
