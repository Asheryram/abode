/**
 * The shapes the backend sends back, taken from SRS-PMTP-001 and the
 * frontend spec (FE-SRS). Every screen and the test backend are typed
 * against these, so changing a field here shows everything that must follow.
 *
 * Field names are what the JSON on the wire should use.
 */
import type { MoneyAmount, PriceBasis } from '../design-system/money'

export type { MoneyAmount, PriceBasis }

/** A calendar day, `YYYY-MM-DD`, no time or zone. */
export type ISODate = string
/** A moment in time, ISO 8601 with zone. */
export type ISODateTime = string

// ── People and roles ────────────────────────────────────────────────────────

/** Platform staff roles (SRS 3, ADM-001). A user has at most one. */
export type StaffRole =
  | 'moderator'
  | 'verification_officer'
  | 'finance_operator'
  | 'support_agent'
  | 'platform_admin'
  | 'analyst'

/** Role inside a supply organization (ORG-009). */
export type OrgRole = 'admin' | 'agent' | 'finance'

export interface Membership {
  orgId: string
  orgName: string
  orgKind: OrgKind
  role: OrgRole
}

/** The signed-in person's own account. */
export interface User {
  id: string
  name: string
  email: string
  phone?: string
  emailVerified: boolean
  phoneVerified: boolean
  mfaEnabled: boolean
  staffRole?: StaffRole
  memberships: Membership[]
  consents: Consent[]
  createdAt: ISODateTime
}

/** What other people may see about someone. */
export interface PublicPerson {
  id: string
  name: string
}

export interface Consent {
  purpose: 'service_messages' | 'marketing_email' | 'marketing_sms' | 'analytics'
  granted: boolean
  updatedAt: ISODateTime
}

export interface Session {
  user: User
}

// ── Organizations, agents, mandates ─────────────────────────────────────────

/** ORG-001: who supplies listings. */
export type OrgKind = 'agency' | 'individual_owner' | 'host'
export type OrgStatus = 'pending_verification' | 'active' | 'suspended'

export interface Organization {
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
  createdAt: ISODateTime
}

export type TrustKind = 'agency' | 'owner' | 'unverified'

export interface VerificationSummary {
  kind: TrustKind
  validUntil?: ISODate
}

export interface Member {
  userId: string
  name: string
  email: string
  role: OrgRole
  /** Agents only (ORG-013). */
  licence?: { number: string; expiresOn: ISODate }
  joinedAt: ISODateTime
}

export interface Invitation {
  id: string
  orgId: string
  email: string
  role: OrgRole
  sentAt: ISODateTime
}

/** ORG-016: an owner's authority for an agency to market a property. */
export interface Mandate {
  id: string
  agencyId: string
  ownerName: string
  propertyId: string
  propertyTitle: string
  exclusive: boolean
  startsOn: ISODate
  endsOn: ISODate
  status: 'active' | 'revoked' | 'expired'
  revokedReason?: string
}

// ── Properties and listings ─────────────────────────────────────────────────

export type PropertyType =
  | 'house'
  | 'apartment'
  | 'townhouse'
  | 'villa'
  | 'guesthouse'
  | 'land'
  | 'office'
  | 'shop'
  | 'warehouse'

/** One listing has exactly one intent (SEA-002). */
export type Intent = 'short_stay' | 'rent' | 'sale' | 'commercial'

export type ListingState =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'published'
  | 'paused'
  | 'expired'
  | 'withdrawn'
  | 'let_or_sold'
  | 'archived'

/** PROP-034: how much of the address the public sees. */
export type AddressDisplay = 'area_only' | 'street' | 'full'

export type CancellationPolicy = 'flexible' | 'moderate' | 'strict'

export interface Address {
  line1: string
  area: string
  city: string
  region: string
  /** Ghana Post GPS digital address, e.g. GA-183-8164. */
  digitalAddress?: string
}

export interface Photo {
  id: string
  url: string
  alt: string
  room?: string
  /** PROP-031: new uploads wait for scanning and moderation. */
  status: 'pending' | 'approved' | 'rejected'
  rightsConfirmed: boolean
}

/** What the public sees in search results and on the listing page. */
export interface ListingSummary {
  id: string
  intent: Intent
  title: string
  propertyType: PropertyType
  /** Only the precision the lister allows (PROP-035, FE-GLB-008). */
  locationText: string
  region: string
  price: MoneyAmount
  basis: PriceBasis
  bedrooms?: number
  bathrooms?: number
  areaSqm?: number
  maxGuests?: number
  photo?: Photo
  rating?: number
  reviewCount: number
  promoted: boolean
  verification: VerificationSummary
  orgName: string
}

export interface ListingDetail extends ListingSummary {
  description: string
  photos: Photo[]
  features: string[]
  houseRules?: string
  availableFrom?: ISODate
  minNights?: number
  cleaningFee?: MoneyAmount
  cancellationPolicy?: CancellationPolicy
  cancellationText?: string
  furnished?: boolean
  org: { id: string; name: string; kind: OrgKind }
  agent?: PublicPerson & { licenceNumber?: string }
  /** The full address, only once a booking is confirmed (PROP-037). */
  fullAddress?: string
}

/** The supply side's view of its own listing. */
export interface ManagedListing extends ListingDetail {
  state: ListingState
  propertyId: string
  address: Address
  addressDisplay: AddressDisplay
  agentId?: string
  expiresOn?: ISODate
  withdrawnReason?: string
  rejectionReason?: string
  history: { at: ISODateTime; state: ListingState; by: string; note?: string }[]
  stats: { views: number; enquiries: number; bookings: number }
}

/** PROP-020: what still blocks publishing. Empty means ready. */
export interface PublishCheck {
  key: string
  label: string
  met: boolean
  fix: string
}

export interface ListingInput {
  intent: Intent
  propertyType: PropertyType
  title: string
  description: string
  address: Address
  addressDisplay: AddressDisplay
  priceMinor: number
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
  agentId?: string
}

// ── Short-stay pricing and availability ─────────────────────────────────────

export interface CalendarDay {
  date: ISODate
  available: boolean
  price: MoneyAmount
  /** Supply side only: why a night is closed. */
  reason?: 'booked' | 'held' | 'blocked'
  note?: string
}

export interface PriceLine {
  label: string
  amount: MoneyAmount
  kind: 'charge' | 'tax' | 'discount'
}

/** BOOK-001: a server-priced offer that expires. */
export interface Quote {
  id: string
  listingId: string
  checkIn: ISODate
  checkOut: ISODate
  guests: number
  nights: number
  lines: PriceLine[]
  total: MoneyAmount
  cancellationText: string
  expiresAt: ISODateTime
}

/** BOOK-008: inventory set aside while the guest pays. */
export interface Hold {
  id: string
  quote: Quote
  listing: ListingSummary
  /** Seconds left when the server answered (BOOK-016). */
  remainingSeconds: number
  status: 'active' | 'released' | 'expired' | 'converted'
  bookingId?: string
}

export type BookingState =
  | 'pending_payment'
  | 'confirmed'
  | 'in_stay'
  | 'completed'
  | 'cancelled_by_guest'
  | 'cancelled_by_host'
  | 'cancelled_by_platform'
  | 'no_show'
  | 'disputed'

export type PaymentMethod = 'mobile_money' | 'card'

export interface Payment {
  method: PaymentMethod
  /** Mobile money network or card brand, for display. */
  label: string
  status: 'pending' | 'succeeded' | 'failed' | 'checking'
  failureReason?: string
}

export interface Refund {
  lines: PriceLine[]
  total: MoneyAmount
  settled: boolean
  requestedAt: ISODateTime
  settledAt?: ISODateTime
}

export interface Booking {
  id: string
  reference: string
  listing: ListingSummary
  guest: PublicPerson & { email: string; phone?: string }
  checkIn: ISODate
  checkOut: ISODate
  guests: number
  nights: number
  lines: PriceLine[]
  total: MoneyAmount
  state: BookingState
  payment: Payment
  cancellationText: string
  fullAddress?: string
  refund?: Refund
  cancelReason?: string
  createdAt: ISODateTime
}

export interface RefundPreview {
  lines: PriceLine[]
  total: MoneyAmount
  policyText: string
}

// ── Enquiries, viewings, tracking ───────────────────────────────────────────

export type LeadStatus = 'new' | 'contacted' | 'viewing_scheduled' | 'negotiating' | 'won' | 'lost'

export interface Enquiry {
  id: string
  listing: ListingSummary
  seeker: PublicPerson & { email: string; phone?: string }
  message: string
  contactMethod: 'in_app' | 'phone' | 'email'
  /** Supply side only. */
  status?: LeadStatus
  /** Seeker sees only this coarse status (LEAD-008). */
  publicStatus: 'sent' | 'in_progress' | 'closed'
  assignee?: PublicPerson
  lostReason?: string
  threadId: string
  createdAt: ISODateTime
}

export type ViewingState =
  | 'requested'
  | 'proposed'
  | 'confirmed'
  | 'agent_en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export interface Viewing {
  id: string
  listing: ListingSummary
  seeker: PublicPerson & { phone?: string }
  orgId: string
  /** Proposed start times, ISO with zone; shown with the zone named (TRK-005). */
  slots: ISODateTime[]
  confirmedSlot?: ISODateTime
  state: ViewingState
  agent?: PublicPerson
  meetingPoint: string
  cancelReason?: string
  timeline: { at: ISODateTime; state: ViewingState; note?: string }[]
  tracking?: TrackingView
  createdAt: ISODateTime
}

/** What a seeker may see while an agent travels (TRK-012, TRK-031 to 034). */
export interface TrackingView {
  sessionId: string
  sharing: boolean
  /** Fraction of the trip done, 0 to 1. Null when not sharing. */
  progress: number | null
  position: { x: number; y: number } | null
  ageSeconds: number | null
  lowAccuracy: boolean
  eta: { minMinutes: number; maxMinutes: number; basis: string } | null
  endsAt: ISODateTime
  ended: boolean
  endedReason?: string
}

// ── Messages and notifications ──────────────────────────────────────────────

export interface ThreadSummary {
  id: string
  /** Whether the viewer is the seeker or on the supply side of this thread. */
  as: 'seeker' | 'org'
  subject: string
  context: { kind: 'enquiry' | 'viewing' | 'booking'; id: string }
  otherParty: string
  lastMessage?: string
  lastAt: ISODateTime
  unread: number
  closed: boolean
}

export interface Message {
  id: string
  threadId: string
  sender: PublicPerson
  mine: boolean
  body: string
  at: ISODateTime
}

export interface Notification {
  id: string
  title: string
  body: string
  link?: string
  at: ISODateTime
  read: boolean
}

// ── Trust and safety ────────────────────────────────────────────────────────

export type VerificationState = 'submitted' | 'in_review' | 'more_info' | 'approved' | 'rejected'

export interface VerificationCase {
  id: string
  subject: { kind: 'organization' | 'agent_licence' | 'ownership'; id: string; name: string }
  orgId: string
  orgName: string
  submittedBy: string
  evidence: { id: string; name: string; type: string }[]
  note?: string
  state: VerificationState
  reason?: string
  claimedBy?: string
  history: { at: ISODateTime; state: VerificationState; by: string; note?: string }[]
  createdAt: ISODateTime
}

export interface Report {
  id: string
  target: { kind: 'listing' | 'user' | 'message'; id: string; label: string }
  reporter: string
  category: 'fraud' | 'inaccurate' | 'offensive' | 'duplicate' | 'other'
  detail?: string
  state: 'open' | 'actioned' | 'dismissed'
  claimedBy?: string
  resolution?: string
  createdAt: ISODateTime
}

// ── Money operations ────────────────────────────────────────────────────────

export interface Payout {
  id: string
  orgId: string
  orgName: string
  amount: MoneyAmount
  bookingRefs: string[]
  state: 'pending_approval' | 'approved' | 'paid' | 'rejected'
  createdBy: string
  createdById: string
  approvedBy?: string
  rejectedReason?: string
  createdAt: ISODateTime
}

export interface Beneficiary {
  method: 'mobile_money' | 'bank'
  accountName: string
  accountNumberMasked: string
  provider: string
  /** ORG-026: a changed beneficiary waits before payouts go to it. */
  coolingOffUntil?: ISODateTime
}

export interface ReconciliationItem {
  id: string
  bookingRef: string
  bookingId: string
  issue: 'payment_unmatched' | 'payment_pending_long' | 'refund_pending'
  amount: MoneyAmount
  ageHours: number
  resolved: boolean
}

// ── Platform ────────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string
  at: ISODateTime
  actor: string
  action: string
  target: string
  reason?: string
}

export interface FeatureFlag {
  key: string
  label: string
  description: string
  enabled: boolean
  /** Gated flags cannot be switched on without evidence (ADM-030). */
  gate?: { name: string; evidenceRecorded: boolean }
  updatedBy?: string
  updatedAt?: ISODateTime
}

export interface Paged<T> {
  items: T[]
  nextCursor: string | null
  total: number
}

export interface SearchQuery {
  intent: Intent
  q?: string
  region?: string
  propertyType?: PropertyType
  minPriceMinor?: number
  maxPriceMinor?: number
  bedrooms?: number
  checkIn?: ISODate
  checkOut?: ISODate
  guests?: number
  sort?: 'recommended' | 'price_asc' | 'price_desc' | 'newest'
  cursor?: string
}

export interface SearchResult extends ListingSummary {
  /** Short stay with dates: the server's total for the stay (SEA-005). */
  stayTotal?: MoneyAmount
  nights?: number
}

export interface PortalDashboard {
  org: Organization
  counts: { published: number; drafts: number; newLeads: number; upcomingViewings: number; upcomingBookings: number }
  tasks: { id: string; tone: 'info' | 'warning' | 'danger'; text: string; link: string }[]
}

export interface AdminQueueSummary {
  verification: number
  listingReview: number
  reports: number
  reconciliation: number
  payoutsAwaiting: number
}
