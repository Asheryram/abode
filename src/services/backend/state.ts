/**
 * Storage for the test backend. The whole test database is one object kept
 * in IndexedDB, so it survives reloads and can be reset from the login page.
 *
 * Records here are the server's private shapes. Screens never see them:
 * the server turns them into the public shapes in `src/contracts`.
 */
import type {
  Address,
  AddressDisplay,
  AuditEvent,
  Beneficiary,
  BookingState,
  CancellationPolicy,
  Consent,
  FeatureFlag,
  Intent,
  Invitation,
  ISODate,
  ISODateTime,
  LeadStatus,
  ListingState,
  Mandate,
  OrgKind,
  OrgRole,
  OrgStatus,
  Payment,
  Photo,
  PriceLine,
  PropertyType,
  Refund,
  Report,
  StaffRole,
  VerificationCase,
  VerificationSummary,
  ViewingState,
} from '../../contracts'
import type { PriceBasis } from '../../design-system/money'
import { kvClear, kvGet, kvSet } from './db'

export interface UserRec {
  id: string
  name: string
  email: string
  phone?: string
  passwordHash: string
  emailVerified: boolean
  phoneVerified: boolean
  mfaEnabled: boolean
  staffRole?: StaffRole
  consents: Consent[]
  failedLogins: number
  createdAt: ISODateTime
  closed?: boolean
}

export interface OrgRec {
  id: string
  kind: OrgKind
  legalName: string
  tradingName: string
  registrationNumber?: string
  address: string
  region: string
  baseCurrency: string
  status: OrgStatus
  verification: VerificationSummary
  beneficiary?: Beneficiary
  createdAt: ISODateTime
}

export interface MemberRec {
  orgId: string
  userId: string
  role: OrgRole
  licence?: { number: string; expiresOn: ISODate }
  joinedAt: ISODateTime
}

export interface ListingRec {
  id: string
  orgId: string
  propertyId: string
  intent: Intent
  propertyType: PropertyType
  state: ListingState
  title: string
  description: string
  address: Address
  addressDisplay: AddressDisplay
  priceMinor: number
  currency: string
  basis: PriceBasis
  bedrooms?: number
  bathrooms?: number
  areaSqm?: number
  maxGuests?: number
  minNights?: number
  cleaningFeeMinor?: number
  cancellationPolicy?: CancellationPolicy
  features: string[]
  houseRules?: string
  availableFrom?: ISODate
  furnished?: boolean
  photos: (Photo & { uploadedAt: ISODateTime })[]
  agentId?: string
  promoted: boolean
  rating?: number
  reviewCount: number
  /** Short stay: per-date price overrides and closed dates (RATE-016 to 019). */
  priceOverrides: Record<ISODate, number>
  blocks: Record<ISODate, string>
  expiresOn?: ISODate
  withdrawnReason?: string
  rejectionReason?: string
  history: { at: ISODateTime; state: ListingState; by: string; note?: string }[]
  stats: { views: number; enquiries: number; bookings: number }
  createdAt: ISODateTime
}

export interface QuoteRec {
  id: string
  listingId: string
  userId: string
  checkIn: ISODate
  checkOut: ISODate
  guests: number
  nights: number
  lines: PriceLine[]
  totalMinor: number
  cancellationText: string
  expiresAt: number
}

export interface HoldRec {
  id: string
  quoteId: string
  listingId: string
  userId: string
  checkIn: ISODate
  checkOut: ISODate
  expiresAt: number
  status: 'active' | 'released' | 'expired' | 'converted'
  bookingId?: string
}

export interface BookingRec {
  id: string
  reference: string
  listingId: string
  guestId: string
  checkIn: ISODate
  checkOut: ISODate
  guests: number
  nights: number
  lines: PriceLine[]
  totalMinor: number
  state: BookingState
  payment: Payment & { startedAt: number; outcome: 'succeed' | 'fail' | 'check' }
  cancellationPolicy: CancellationPolicy
  cancellationText: string
  refund?: Refund
  cancelReason?: string
  createdAt: ISODateTime
}

export interface EnquiryRec {
  id: string
  listingId: string
  orgId: string
  seekerId: string
  message: string
  contactMethod: 'in_app' | 'phone' | 'email'
  status: LeadStatus
  assigneeId?: string
  lostReason?: string
  threadId: string
  createdAt: ISODateTime
}

export interface ViewingRec {
  id: string
  listingId: string
  orgId: string
  seekerId: string
  enquiryId?: string
  slots: ISODateTime[]
  confirmedSlot?: ISODateTime
  state: ViewingState
  agentId?: string
  meetingPoint: string
  cancelReason?: string
  timeline: { at: ISODateTime; state: ViewingState; note?: string }[]
  tracking?: TrackingRec
  createdAt: ISODateTime
}

/** A simulated trip: the agent's position is worked out from the clock. */
export interface TrackingRec {
  id: string
  agentId: string
  sharing: boolean
  startedAt: number
  durationMs: number
  /** Sharing stops automatically at this time (TRK-021). */
  endsAt: number
  ended: boolean
  endedReason?: string
}

export interface ThreadRec {
  id: string
  subject: string
  context: { kind: 'enquiry' | 'viewing' | 'booking'; id: string }
  orgId: string
  seekerId: string
  closed: boolean
  lastReadAt: Record<string, number>
}

export interface MessageRec {
  id: string
  threadId: string
  senderId: string
  body: string
  at: ISODateTime
}

export interface NotificationRec {
  id: string
  userId: string
  title: string
  body: string
  link?: string
  at: ISODateTime
  read: boolean
}

export interface PayoutRec {
  id: string
  orgId: string
  amountMinor: number
  bookingRefs: string[]
  state: 'pending_approval' | 'approved' | 'paid' | 'rejected'
  createdById: string
  approvedById?: string
  rejectedReason?: string
  createdAt: ISODateTime
}

export interface ReconRec {
  id: string
  bookingId: string
  issue: 'payment_unmatched' | 'payment_pending_long' | 'refund_pending'
  amountMinor: number
  createdAt: number
  resolved: boolean
}

export interface DB {
  users: UserRec[]
  sessions: Record<string, { userId: string; createdAt: number }>
  orgs: OrgRec[]
  members: MemberRec[]
  invitations: Invitation[]
  mandates: Mandate[]
  listings: ListingRec[]
  quotes: QuoteRec[]
  holds: HoldRec[]
  bookings: BookingRec[]
  enquiries: EnquiryRec[]
  viewings: ViewingRec[]
  threads: ThreadRec[]
  messages: MessageRec[]
  notifications: NotificationRec[]
  favourites: Record<string, string[]>
  verificationCases: VerificationCase[]
  reports: Report[]
  payouts: PayoutRec[]
  recon: ReconRec[]
  audit: AuditEvent[]
  flags: FeatureFlag[]
}

/** Bump to wipe and re-seed everyone's test data on their next visit. */
export const DB_VERSION = 2
const KEY = 'db'

let cache: DB | null = null
let loading: Promise<DB> | null = null

export function loadDb(seed: () => DB): Promise<DB> {
  if (cache) return Promise.resolve(cache)
  loading ??= (async () => {
    const version = await kvGet<number>('dbVersion')
    let db = version === DB_VERSION ? await kvGet<DB>(KEY) : undefined
    if (!db) {
      await kvClear()
      db = seed()
      await kvSet(KEY, db)
      await kvSet('dbVersion', DB_VERSION)
    }
    cache = db
    return db
  })().catch((e) => {
    loading = null
    throw e
  })
  return loading
}

/** Persist after a change. Writes are queued so they never overlap. */
let writing: Promise<void> = Promise.resolve()
export function saveDb(db: DB): Promise<void> {
  writing = writing.then(() => kvSet(KEY, db)).catch(() => undefined)
  return writing
}

export async function resetDb(seed: () => DB): Promise<void> {
  await kvClear()
  cache = null
  loading = null
  await loadDb(seed)
}
