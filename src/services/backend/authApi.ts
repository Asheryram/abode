/** Sign-in, sign-up, verification, MFA, password reset and the privacy centre. */
import { ApiError, type Consent, type User } from '../../contracts'
import { begin, commit, currentUser, requireUser, session, toUser } from './core'
import type { UserRec } from './state'
import { hashPassword, isoNow, MIN, uid } from './util'

/** Test codes. A real backend sends these by email, SMS or an authenticator app. */
export const DEMO_CODES = { email: '246810', phone: '135791', mfa: '123456', reset: '975310' }

const mfaChallenges = new Map<string, { userId: string; expires: number }>()
const GENERIC_LOGIN = 'That email and password don’t match an account. Check them and try again.'

function startSession(db: Parameters<typeof toUser>[0], u: UserRec) {
  const sid = uid('s')
  db.sessions[sid] = { userId: u.id, createdAt: Date.now() }
  session.set(sid)
}

export type LoginResult = { status: 'ok'; user: User } | { status: 'mfa'; challengeId: string }

export const authApi = {
  async me(): Promise<User | null> {
    const db = await begin()
    const u = currentUser(db)
    return u ? toUser(db, u) : null
  },

  /** ACC-014: one message for every failure, so it never reveals who has an account. */
  async login(email: string, password: string): Promise<LoginResult> {
    const db = await begin()
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && !x.closed)
    if (!u || u.passwordHash !== hashPassword(u.email, password)) {
      if (u) {
        u.failedLogins++
        await commit(db)
      }
      throw new ApiError('UNAUTHORIZED', GENERIC_LOGIN, { reason: 'INVALID_CREDENTIALS' })
    }
    if (u.failedLogins >= 8) throw new ApiError('UNAUTHORIZED', GENERIC_LOGIN + ' If you keep having trouble, reset your password.')
    u.failedLogins = 0
    if (u.mfaEnabled) {
      const challengeId = uid('mfa')
      mfaChallenges.set(challengeId, { userId: u.id, expires: Date.now() + 5 * MIN })
      return { status: 'mfa', challengeId }
    }
    startSession(db, u)
    await commit(db)
    return { status: 'ok', user: toUser(db, u) }
  },

  async verifyMfa(challengeId: string, code: string): Promise<User> {
    const db = await begin()
    const c = mfaChallenges.get(challengeId)
    if (!c || c.expires < Date.now()) throw new ApiError('UNAUTHORIZED', 'That sign-in attempt has expired. Please sign in again.')
    if (code.replace(/\s/g, '') !== DEMO_CODES.mfa) throw new ApiError('BAD_REQUEST', 'That code is not right. Check your authenticator app and try again.', { fields: { code: 'Incorrect code' } })
    mfaChallenges.delete(challengeId)
    const u = db.users.find((x) => x.id === c.userId)!
    startSession(db, u)
    await commit(db)
    return toUser(db, u)
  },

  async logout(): Promise<void> {
    const db = await begin()
    const sid = session.get()
    if (sid) delete db.sessions[sid]
    session.set(null)
    await commit(db)
  },

  async signup(input: { name: string; email: string; phone?: string; password: string; acceptTerms: boolean; marketing: boolean }): Promise<User> {
    const db = await begin()
    const fields: Record<string, string> = {}
    if (input.name.trim().length < 2) fields.name = 'Enter your full name.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) fields.email = 'Enter a valid email address.'
    if (input.password.length < 12) fields.password = 'Use at least 12 characters.'
    if (/^(password|123456|qwerty)/i.test(input.password)) fields.password = 'This password is too common. Choose another.'
    if (!input.acceptTerms) fields.acceptTerms = 'You need to accept the terms to create an account.'
    if (Object.keys(fields).length) throw new ApiError('BAD_REQUEST', 'Please check the highlighted fields.', { fields })
    // ACC-007: the same outcome whether or not the email is taken. The real
    // backend emails the existing owner instead of saying "already registered".
    const existing = db.users.find((x) => x.email.toLowerCase() === input.email.trim().toLowerCase())
    if (existing) throw new ApiError('CONFLICT', 'We couldn’t create an account with these details. If you already have one, sign in or reset your password.')
    const now = isoNow()
    const consents: Consent[] = [
      { purpose: 'service_messages', granted: true, updatedAt: now },
      { purpose: 'marketing_email', granted: input.marketing, updatedAt: now },
      { purpose: 'marketing_sms', granted: false, updatedAt: now },
      { purpose: 'analytics', granted: false, updatedAt: now },
    ]
    const u: UserRec = { id: uid('u'), name: input.name.trim(), email: input.email.trim(), phone: input.phone?.trim() || undefined, passwordHash: hashPassword(input.email.trim(), input.password), emailVerified: false, phoneVerified: false, mfaEnabled: false, consents, failedLogins: 0, createdAt: now }
    db.users.push(u)
    startSession(db, u)
    await commit(db)
    return toUser(db, u)
  },

  async verifyEmail(code: string): Promise<User> {
    const db = await begin()
    const u = requireUser(db)
    if (code.trim() !== DEMO_CODES.email) throw new ApiError('BAD_REQUEST', 'That code is not right or has expired.', { fields: { code: 'Incorrect code' } })
    u.emailVerified = true
    await commit(db)
    return toUser(db, u)
  },

  async verifyPhone(code: string): Promise<User> {
    const db = await begin()
    const u = requireUser(db)
    if (!u.phone) throw new ApiError('BAD_REQUEST', 'Add a phone number first.')
    if (code.trim() !== DEMO_CODES.phone) throw new ApiError('BAD_REQUEST', 'That code is not right or has expired.', { fields: { code: 'Incorrect code' } })
    u.phoneVerified = true
    await commit(db)
    return toUser(db, u)
  },

  /** ACC-031: the same answer whether or not the address has an account. */
  async requestReset(email: string): Promise<string> {
    await begin()
    void email
    return 'If an account uses that address, we’ve sent a code to reset the password.'
  },

  async completeReset(email: string, code: string, password: string): Promise<void> {
    const db = await begin()
    if (password.length < 12) throw new ApiError('BAD_REQUEST', 'Use at least 12 characters.', { fields: { password: 'Use at least 12 characters.' } })
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    if (!u || code.trim() !== DEMO_CODES.reset) throw new ApiError('BAD_REQUEST', 'That code is not right or has expired.', { fields: { code: 'Incorrect code' } })
    u.passwordHash = hashPassword(u.email, password)
    u.failedLogins = 0
    for (const [sid, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[sid]
    await commit(db)
  },
}

export const accountApi = {
  async updateProfile(input: { name: string; phone?: string }): Promise<User> {
    const db = await begin()
    const u = requireUser(db)
    if (input.name.trim().length < 2) throw new ApiError('BAD_REQUEST', 'Enter your full name.', { fields: { name: 'Enter your full name.' } })
    if ((input.phone ?? '') !== (u.phone ?? '')) u.phoneVerified = false
    u.name = input.name.trim()
    u.phone = input.phone?.trim() || undefined
    await commit(db)
    return toUser(db, u)
  },

  async setConsent(purpose: Consent['purpose'], granted: boolean): Promise<User> {
    const db = await begin()
    const u = requireUser(db)
    if (purpose === 'service_messages') throw new ApiError('BAD_REQUEST', 'Service messages about your bookings and security can’t be turned off.')
    const c = u.consents.find((x) => x.purpose === purpose)
    if (c) {
      c.granted = granted
      c.updatedAt = isoNow()
    }
    await commit(db)
    return toUser(db, u)
  },

  /** ACC-025, ACC-027: returns recovery codes once. They cannot be shown again. */
  async enableMfa(code: string): Promise<{ user: User; recoveryCodes: string[] }> {
    const db = await begin()
    const u = requireUser(db)
    if (code.replace(/\s/g, '') !== DEMO_CODES.mfa) throw new ApiError('BAD_REQUEST', 'That code is not right. Check your authenticator app.', { fields: { code: 'Incorrect code' } })
    u.mfaEnabled = true
    await commit(db)
    const codes = Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 7).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase())
    return { user: toUser(db, u), recoveryCodes: codes }
  },

  async disableMfa(password: string): Promise<User> {
    const db = await begin()
    const u = requireUser(db)
    if (u.staffRole) throw new ApiError('FORBIDDEN', 'Two-step sign-in is required for Abode staff.')
    if (u.passwordHash !== hashPassword(u.email, password)) throw new ApiError('BAD_REQUEST', 'That password is not right.', { reason: 'STEP_UP_FAILED', fields: { password: 'Incorrect password' } })
    u.mfaEnabled = false
    await commit(db)
    return toUser(db, u)
  },

  async requestExport(): Promise<string> {
    const db = await begin()
    requireUser(db)
    return 'We’re preparing a copy of your data. We’ll email you a secure download link within 30 days.'
  },

  /** ACC-036: closure is blocked while something still depends on the account. */
  async closeAccount(password: string): Promise<{ closed: boolean; blockers: string[] }> {
    const db = await begin()
    const u = requireUser(db)
    if (u.passwordHash !== hashPassword(u.email, password)) throw new ApiError('BAD_REQUEST', 'That password is not right.', { fields: { password: 'Incorrect password' } })
    const blockers: string[] = []
    const active = db.bookings.filter((b) => b.guestId === u.id && ['pending_payment', 'confirmed', 'in_stay'].includes(b.state))
    if (active.length) blockers.push(`You have ${active.length} upcoming or active ${active.length === 1 ? 'booking' : 'bookings'}. Cancel or complete them first.`)
    for (const m of db.members.filter((x) => x.userId === u.id && x.role === 'admin')) {
      const admins = db.members.filter((x) => x.orgId === m.orgId && x.role === 'admin')
      if (admins.length === 1) blockers.push(`You are the only administrator of ${db.orgs.find((o) => o.id === m.orgId)?.tradingName}. Add another administrator first.`)
    }
    if (u.staffRole) blockers.push('Staff accounts are closed by a platform administrator.')
    if (blockers.length) return { closed: false, blockers }
    u.closed = true
    session.set(null)
    await commit(db)
    return { closed: true, blockers: [] }
  },
}
