/**
 * Test data for every role. Dates are relative to today, so the data always
 * looks current. All accounts use DEMO_PASSWORD.
 */
import type { FeatureFlag, Intent, ISODate, Mandate, PropertyType } from '../../contracts'
import { addDays, today } from '../../lib/dates'
import type { BookingRec, DB, ListingRec, MemberRec, OrgRec, UserRec } from './state'
import { DAY, hashPassword, HOUR, MIN, photoUrl } from './util'

export const DEMO_PASSWORD = 'password123'

/** Shown on the sign-in page so testers can pick any role. */
export const DEMO_ACCOUNTS: { group: string; accounts: { email: string; name: string; role: string }[] }[] = [
  {
    group: 'Seekers and guests',
    accounts: [
      { email: 'kofi@abode.test', name: 'Kofi Boateng', role: 'Guest with bookings and an enquiry' },
      { email: 'efua@abode.test', name: 'Efua Asante', role: 'Seeker with a viewing today' },
    ],
  },
  {
    group: 'Owners and hosts',
    accounts: [
      { email: 'ama@abode.test', name: 'Ama Mensah', role: 'Owner: rentals and a short stay' },
      { email: 'yaw@abode.test', name: 'Yaw Darko', role: 'Host: Labadi Beach Stays' },
    ],
  },
  {
    group: 'Agency: Accra Prime Realty',
    accounts: [
      { email: 'esi@abode.test', name: 'Esi Owusu', role: 'Agency administrator' },
      { email: 'kwame@abode.test', name: 'Kwame Addo', role: 'Agent' },
      { email: 'adjoa@abode.test', name: 'Adjoa Quaye', role: 'Agency finance' },
      { email: 'selasi@abode.test', name: 'Selasi Agbeko', role: 'New agency awaiting verification' },
    ],
  },
  {
    group: 'Abode staff (back office)',
    accounts: [
      { email: 'verify@abode.test', name: 'Abena Ofori', role: 'Verification officer' },
      { email: 'mod@abode.test', name: 'Mawuli Tetteh', role: 'Moderator' },
      { email: 'finance@abode.test', name: 'Kojo Mensah', role: 'Finance operator' },
      { email: 'finance2@abode.test', name: 'Nana Ama Boakye', role: 'Finance operator (second approver)' },
      { email: 'support@abode.test', name: 'Akosua Frimpong', role: 'Support agent' },
      { email: 'admin@abode.test', name: 'Nii Lamptey', role: 'Platform administrator' },
      { email: 'analyst@abode.test', name: 'Selorm Dzidzienyo', role: 'Read-only analyst' },
    ],
  },
]

const IMG = {
  beach: ['1499793983690-e29da59ef1c2', '1520250497591-112f2f40a3f4', '1566073771259-6a8506099945'],
  house: ['1564013799919-ab600027ffc6', '1568605114967-8130f3a36994', '1570129477492-45c003edd2be', '1580587771525-78b9dba3b914', '1600596542815-ffad4c1539a9', '1600585154340-be6161a56a0c', '1600047509807-ba8f99d2cdde'],
  villa: ['1613490493576-7fde63acd811', '1582268611958-ebfd161ef9cf'],
  cabin: ['1449844908441-8829872d2607', '1542718610-a1d656d1884c', '1510798831971-661eb04b3739'],
  interior: ['1505691938895-1758d7feb511', '1502672260266-1c1ef2d93688', '1522708323590-d24dbb6b0267', '1560448204-e02f11c3d0e2', '1600607687939-ce8a6c25118c', '1600566753190-17f0baa2a6c3', '1600210492486-724fe5c67fb0', '1556020685-ae41abfc9365', '1484154218962-a197022b5858', '1493809842364-78817add7ffb', '1586023492125-27b2c045efd7', '1631049307264-da0ec9d70304'],
  office: ['1497366216548-37526070297c', '1497366811353-6870744d04b2'],
  shop: ['1441986300917-64674bd600d8'],
  warehouse: ['1586528116311-ad8dd3c8310d'],
  land: ['1500382017468-9049fed747ef'],
}

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString()
const d = (days: number): ISODate => addDays(today(), days)

function photos(listingId: string, main: string[], extra: string[], title: string) {
  const ids = [...main, ...extra]
  const rooms = ['Exterior', 'Living room', 'Bedroom', 'Kitchen', 'Bathroom', 'View']
  return ids.map((id, i) => ({
    id: `${listingId}_ph${i}`,
    url: photoUrl(id),
    alt: `${title}: ${rooms[i % rooms.length].toLowerCase()}`,
    room: rooms[i % rooms.length],
    status: 'approved' as const,
    rightsConfirmed: true,
    uploadedAt: iso(-40 * DAY),
  }))
}

interface L {
  id: string
  orgId: string
  intent: Intent
  type: PropertyType
  title: string
  description: string
  line1: string
  area: string
  city: string
  region: string
  digital?: string
  price: number
  basis: ListingRec['basis']
  img: string[]
  extra?: string[]
  beds?: number
  baths?: number
  sqm?: number
  guests?: number
  minNights?: number
  cleaning?: number
  policy?: ListingRec['cancellationPolicy']
  features: string[]
  rating?: number
  reviews?: number
  promoted?: boolean
  agentId?: string
  state?: ListingRec['state']
  furnished?: boolean
  display?: ListingRec['addressDisplay']
}

function listing(l: L): ListingRec {
  const state = l.state ?? 'published'
  return {
    id: l.id,
    orgId: l.orgId,
    propertyId: `prop_${l.id}`,
    intent: l.intent,
    propertyType: l.type,
    state,
    title: l.title,
    description: l.description,
    address: { line1: l.line1, area: l.area, city: l.city, region: l.region, digitalAddress: l.digital },
    addressDisplay: l.display ?? 'area_only',
    priceMinor: l.price * 100,
    currency: 'GHS',
    basis: l.basis,
    bedrooms: l.beds,
    bathrooms: l.baths,
    areaSqm: l.sqm,
    maxGuests: l.guests,
    minNights: l.minNights ?? (l.intent === 'short_stay' ? 1 : undefined),
    cleaningFeeMinor: l.cleaning !== undefined ? l.cleaning * 100 : undefined,
    cancellationPolicy: l.policy ?? (l.intent === 'short_stay' ? 'moderate' : undefined),
    features: l.features,
    houseRules: l.intent === 'short_stay' ? 'No parties. Quiet hours from 22:00. Check-in after 14:00, check-out by 11:00.' : undefined,
    availableFrom: l.intent === 'rent' ? d(14) : undefined,
    furnished: l.furnished,
    photos: photos(l.id, l.img, l.extra ?? IMG.interior.slice(0, 3), l.title),
    agentId: l.agentId,
    promoted: l.promoted ?? false,
    rating: l.rating,
    reviewCount: l.reviews ?? 0,
    priceOverrides: {},
    blocks: {},
    expiresOn: state === 'published' ? d(45) : undefined,
    history: [{ at: iso(-60 * DAY), state: 'draft', by: 'Lister' }, ...(state !== 'draft' ? [{ at: iso(-50 * DAY), state, by: 'Abode review' }] : [])],
    stats: { views: 120 + l.id.length * 37, enquiries: 6, bookings: l.intent === 'short_stay' ? 9 : 0 },
    createdAt: iso(-60 * DAY),
  }
}

export function buildSeed(): DB {
  const now = iso(0)
  const user = (id: string, name: string, email: string, extra: Partial<UserRec> = {}): UserRec => ({
    id,
    name,
    email,
    phone: '+233 24 000 0000',
    passwordHash: hashPassword(email, DEMO_PASSWORD),
    emailVerified: true,
    phoneVerified: true,
    mfaEnabled: false,
    consents: [
      { purpose: 'service_messages', granted: true, updatedAt: now },
      { purpose: 'marketing_email', granted: false, updatedAt: now },
      { purpose: 'marketing_sms', granted: false, updatedAt: now },
      { purpose: 'analytics', granted: false, updatedAt: now },
    ],
    failedLogins: 0,
    createdAt: iso(-200 * DAY),
    ...extra,
  })

  const users: UserRec[] = [
    user('u_kofi', 'Kofi Boateng', 'kofi@abode.test'),
    user('u_efua', 'Efua Asante', 'efua@abode.test'),
    user('u_kwesi', 'Kwesi Appiah', 'kwesi@abode.test'),
    user('u_ama', 'Ama Mensah', 'ama@abode.test'),
    user('u_yaw', 'Yaw Darko', 'yaw@abode.test'),
    user('u_esi', 'Esi Owusu', 'esi@abode.test'),
    user('u_kwame', 'Kwame Addo', 'kwame@abode.test'),
    user('u_akua', 'Akua Sarpong', 'akua@abode.test'),
    user('u_adjoa', 'Adjoa Quaye', 'adjoa@abode.test'),
    user('u_selasi', 'Selasi Agbeko', 'selasi@abode.test'),
    user('u_verify', 'Abena Ofori', 'verify@abode.test', { staffRole: 'verification_officer', mfaEnabled: true }),
    user('u_mod', 'Mawuli Tetteh', 'mod@abode.test', { staffRole: 'moderator', mfaEnabled: true }),
    user('u_fin', 'Kojo Mensah', 'finance@abode.test', { staffRole: 'finance_operator', mfaEnabled: true }),
    user('u_fin2', 'Nana Ama Boakye', 'finance2@abode.test', { staffRole: 'finance_operator', mfaEnabled: true }),
    user('u_support', 'Akosua Frimpong', 'support@abode.test', { staffRole: 'support_agent', mfaEnabled: true }),
    user('u_admin', 'Nii Lamptey', 'admin@abode.test', { staffRole: 'platform_admin', mfaEnabled: true }),
    user('u_analyst', 'Selorm Dzidzienyo', 'analyst@abode.test', { staffRole: 'analyst', mfaEnabled: true }),
  ]

  const org = (o: Omit<OrgRec, 'baseCurrency' | 'createdAt'>): OrgRec => ({ ...o, baseCurrency: 'GHS', createdAt: iso(-300 * DAY) })
  const orgs: OrgRec[] = [
    org({ id: 'o_prime', kind: 'agency', legalName: 'Accra Prime Realty Ltd', tradingName: 'Accra Prime Realty', registrationNumber: 'CS-084512-2019', address: '14 Liberation Road, Airport Residential, Accra', region: 'Greater Accra', status: 'active', verification: { kind: 'agency', validUntil: d(240) }, beneficiary: { method: 'bank', accountName: 'Accra Prime Realty Ltd', accountNumberMasked: '•••• 4417', provider: 'GCB Bank' } }),
    org({ id: 'o_ama', kind: 'individual_owner', legalName: 'Ama Mensah', tradingName: 'Ama Mensah', address: 'Tema Community 25', region: 'Greater Accra', status: 'active', verification: { kind: 'owner', validUntil: d(300) }, beneficiary: { method: 'mobile_money', accountName: 'Ama Mensah', accountNumberMasked: '•••• 8812', provider: 'MTN MoMo' } }),
    org({ id: 'o_labadi', kind: 'host', legalName: 'Labadi Beach Stays Enterprise', tradingName: 'Labadi Beach Stays', registrationNumber: 'BN-552190-2021', address: 'La Beach Road, Labadi, Accra', region: 'Greater Accra', status: 'active', verification: { kind: 'owner', validUntil: d(180) }, beneficiary: { method: 'mobile_money', accountName: 'Yaw Darko', accountNumberMasked: '•••• 3390', provider: 'Telecel Cash' } }),
    org({ id: 'o_golden', kind: 'agency', legalName: 'Golden Key Homes Ltd', tradingName: 'Golden Key Homes', registrationNumber: 'CS-120933-2025', address: 'Adum, Kumasi', region: 'Ashanti', status: 'pending_verification', verification: { kind: 'unverified' } }),
  ]

  const member = (orgId: string, userId: string, role: MemberRec['role'], licence?: MemberRec['licence']): MemberRec => ({ orgId, userId, role, licence, joinedAt: iso(-280 * DAY) })
  const members: MemberRec[] = [
    member('o_prime', 'u_esi', 'admin'),
    member('o_prime', 'u_kwame', 'agent', { number: 'GREA/AG/2291', expiresOn: d(210) }),
    member('o_prime', 'u_akua', 'agent', { number: 'GREA/AG/1874', expiresOn: d(-9) }),
    member('o_prime', 'u_adjoa', 'finance'),
    member('o_ama', 'u_ama', 'admin'),
    member('o_labadi', 'u_yaw', 'admin'),
    member('o_golden', 'u_selasi', 'admin'),
  ]

  const listings: ListingRec[] = [
    listing({ id: 'l_labadi', orgId: 'o_labadi', intent: 'short_stay', type: 'house', title: 'Beachfront bungalow in Labadi', description: 'A bright two-bedroom bungalow a short walk from Labadi Beach. Wake up to the sound of the sea, cook in a fully equipped kitchen and unwind on the shaded veranda. Supermarkets, restaurants and nightlife are minutes away.', line1: '7 La Beach Road', area: 'Labadi', city: 'Accra', region: 'Greater Accra', digital: 'GL-021-8822', price: 850, basis: 'per_night', img: IMG.beach.slice(0, 1), beds: 2, baths: 2, guests: 4, cleaning: 150, policy: 'flexible', features: ['Wi-Fi', 'Air conditioning', 'Kitchen', 'Backup generator', 'Beach access', 'Free parking'], rating: 4.86, reviews: 42 }),
    listing({ id: 'l_kokrobite', orgId: 'o_labadi', intent: 'short_stay', type: 'house', title: 'Kokrobite surf cabin', description: 'A simple, breezy cabin steps from the surf at Kokrobite. Ideal for a couple who want quiet evenings, fresh seafood and lessons at the local surf school.', line1: 'Big Milly’s Lane', area: 'Kokrobite', city: 'Accra', region: 'Greater Accra', price: 520, basis: 'per_night', img: IMG.cabin.slice(0, 1), beds: 1, baths: 1, guests: 2, cleaning: 80, policy: 'moderate', features: ['Wi-Fi', 'Beach access', 'Outdoor shower', 'Hammock'], rating: 4.71, reviews: 18 }),
    listing({ id: 'l_capecoast', orgId: 'o_labadi', intent: 'short_stay', type: 'apartment', title: 'Castle-view apartment in Cape Coast', description: 'Two-bedroom apartment with a balcony looking towards Cape Coast Castle. Walk to the old town, the fishing harbour and Oasis Beach.', line1: 'Victoria Road', area: 'Central Cape Coast', city: 'Cape Coast', region: 'Central', price: 640, basis: 'per_night', img: IMG.house.slice(0, 1), beds: 2, baths: 1, guests: 4, cleaning: 100, policy: 'moderate', features: ['Wi-Fi', 'Air conditioning', 'Balcony', 'Kitchen', 'Washing machine'], rating: 4.64, reviews: 25 }),
    listing({ id: 'l_busua', orgId: 'o_labadi', intent: 'short_stay', type: 'villa', title: 'Busua beach house', description: 'A spacious three-bedroom house on Busua Beach with a garden that opens onto the sand. Great for families and small groups.', line1: 'Beach Road', area: 'Busua', city: 'Busua', region: 'Western', price: 1200, basis: 'per_night', img: IMG.villa.slice(0, 1), beds: 3, baths: 3, guests: 6, cleaning: 250, policy: 'strict', features: ['Wi-Fi', 'Garden', 'Beach access', 'Kitchen', 'Backup generator', 'Free parking'], rating: 4.93, reviews: 31 }),
    listing({ id: 'l_akosombo', orgId: 'o_labadi', intent: 'short_stay', type: 'house', title: 'Akosombo riverside cabin', description: 'A peaceful two-bedroom cabin on the Volta River near Akosombo. Swim off the jetty, take a boat to Dodi Island, or just watch the river from the deck.', line1: 'Riverside Drive', area: 'Akosombo', city: 'Akosombo', region: 'Eastern', price: 750, basis: 'per_night', img: IMG.cabin.slice(1, 2), beds: 2, baths: 1, guests: 4, cleaning: 120, policy: 'flexible', features: ['River view', 'Jetty', 'Kitchen', 'Free parking', 'Barbecue'], rating: 4.8, reviews: 22, promoted: true }),
    listing({ id: 'l_eastlegon', orgId: 'o_ama', intent: 'short_stay', type: 'apartment', title: 'Garden flat in East Legon', description: 'A calm one-bedroom flat in a gated compound with a small garden. Close to the University of Ghana, A&C Mall and the airport.', line1: '12 Lagos Avenue', area: 'East Legon', city: 'Accra', region: 'Greater Accra', price: 600, basis: 'per_night', img: IMG.house.slice(1, 2), beds: 1, baths: 1, guests: 2, cleaning: 80, policy: 'moderate', features: ['Wi-Fi', 'Air conditioning', 'Workspace', 'Security', 'Free parking'], rating: 4.75, reviews: 14 }),
    listing({ id: 'l_tema', orgId: 'o_ama', intent: 'rent', type: 'house', title: '3-bedroom house in Tema Community 25', description: 'A family house with three bedrooms (one en suite), a fitted kitchen, a walled compound and parking for two cars. Water storage tank and prepaid meter. Two years’ rent advance negotiable.', line1: 'House 18, Street 4', area: 'Community 25', city: 'Tema', region: 'Greater Accra', price: 9500, basis: 'per_month', img: IMG.house.slice(2, 3), beds: 3, baths: 2, sqm: 180, features: ['Walled compound', 'Parking', 'Water tank', 'Prepaid meter'], furnished: false }),
    listing({ id: 'l_kumasi', orgId: 'o_ama', intent: 'rent', type: 'apartment', title: 'Self-contained apartment in Ahodwo, Kumasi', description: 'A new one-bedroom self-contained apartment with its own kitchen and bathroom, in a quiet part of Ahodwo close to the Golden Tulip.', line1: 'Ahodwo Roundabout', area: 'Ahodwo', city: 'Kumasi', region: 'Ashanti', price: 3200, basis: 'per_month', img: IMG.house.slice(3, 4), beds: 1, baths: 1, sqm: 55, features: ['Self-contained', 'Security', 'Water tank'], state: 'in_review', furnished: false }),
    { ...listing({ id: 'l_spintex', orgId: 'o_ama', intent: 'rent', type: 'apartment', title: 'Two-bedroom in Spintex', description: 'Draft.', line1: '', area: 'Spintex', city: 'Accra', region: 'Greater Accra', price: 0, basis: 'per_month', img: [], extra: [], beds: 2, baths: 2, features: [], state: 'draft' }) },
    listing({ id: 'l_cantonments', orgId: 'o_prime', intent: 'rent', type: 'apartment', title: 'Furnished 2-bed apartment in Cantonments', description: 'A fully furnished two-bedroom apartment in a secure block with a pool, gym and 24-hour security. Walking distance to embassies and the Marina Mall.', line1: 'Switchback Road', area: 'Cantonments', city: 'Accra', region: 'Greater Accra', price: 18000, basis: 'per_month', img: IMG.interior.slice(4, 5), extra: IMG.interior.slice(5, 8), beds: 2, baths: 2, sqm: 120, features: ['Furnished', 'Swimming pool', 'Gym', '24-hour security', 'Backup generator', 'Parking'], promoted: true, agentId: 'u_kwame', furnished: true }),
    listing({ id: 'l_osu', orgId: 'o_prime', intent: 'rent', type: 'apartment', title: 'Studio apartment in Osu', description: 'A compact studio on a quiet side street off Oxford Street. Kitchenette, shower room and a small balcony. Ideal for a young professional.', line1: '5th Lane', area: 'Osu', city: 'Accra', region: 'Greater Accra', price: 4500, basis: 'per_month', img: IMG.interior.slice(8, 9), beds: 0, baths: 1, sqm: 35, features: ['Balcony', 'Kitchenette', 'Prepaid meter'], agentId: 'u_kwame', furnished: false }),
    listing({ id: 'l_trasacco', orgId: 'o_prime', intent: 'sale', type: 'villa', title: '4-bedroom villa in Trasacco Valley', description: 'A modern four-bedroom villa with a pool, landscaped garden and staff quarters in the gated Trasacco Valley estate. Registered title, ready to move in.', line1: 'Trasacco Valley Estate', area: 'East Legon Hills', city: 'Accra', region: 'Greater Accra', price: 9500000, basis: 'total', img: IMG.villa.slice(1, 2), beds: 4, baths: 5, sqm: 520, features: ['Swimming pool', 'Garden', 'Staff quarters', 'Gated estate', 'Registered title'], agentId: 'u_kwame' }),
    listing({ id: 'l_airport', orgId: 'o_prime', intent: 'sale', type: 'townhouse', title: '3-bedroom townhouse, Airport Residential', description: 'An elegant three-bedroom townhouse in a small gated development. Each bedroom en suite, open-plan living, rooftop terrace.', line1: 'Senchi Street', area: 'Airport Residential', city: 'Accra', region: 'Greater Accra', price: 3600000, basis: 'total', img: IMG.house.slice(4, 5), beds: 3, baths: 4, sqm: 240, features: ['Rooftop terrace', 'Gated', 'En suite bedrooms', 'Parking'], agentId: 'u_kwame' }),
    listing({ id: 'l_aburi', orgId: 'o_prime', intent: 'sale', type: 'land', title: 'Plot of land in Aburi', description: 'A 1,000 m² residential plot on the Aburi ridge with views towards Accra. Indenture and site plan available. Access road in place.', line1: 'Aburi–Mamfe Road', area: 'Aburi', city: 'Aburi', region: 'Eastern', price: 650000, basis: 'total', img: IMG.land, extra: [], sqm: 1000, features: ['Indenture', 'Site plan', 'Access road'], agentId: 'u_kwame' }),
    listing({ id: 'l_ridge', orgId: 'o_prime', intent: 'commercial', type: 'office', title: 'Office floor in Ridge', description: 'A 450 m² open-plan office floor in a Grade A building in Ridge, with backup power, fibre internet and 12 parking spaces.', line1: 'Independence Avenue', area: 'Ridge', city: 'Accra', region: 'Greater Accra', price: 2400, basis: 'per_sqm_per_annum', img: IMG.office.slice(0, 1), extra: IMG.office.slice(1, 2), sqm: 450, features: ['Backup power', 'Fibre internet', 'Lift', 'Parking'], agentId: 'u_kwame' }),
    listing({ id: 'l_oxford', orgId: 'o_prime', intent: 'commercial', type: 'shop', title: 'Shop on Oxford Street, Osu', description: 'A ground-floor shop with a glass frontage on Oxford Street. High foot traffic day and night.', line1: 'Oxford Street', area: 'Osu', city: 'Accra', region: 'Greater Accra', price: 15000, basis: 'per_month', img: IMG.shop, extra: [], sqm: 80, features: ['Street frontage', 'Storage room'], agentId: 'u_kwame' }),
    listing({ id: 'l_warehouse', orgId: 'o_prime', intent: 'commercial', type: 'warehouse', title: 'Warehouse in Tema Industrial Area', description: 'An 1,800 m² warehouse with loading bays, office space and 24-hour security, close to Tema Port.', line1: 'Heavy Industrial Area', area: 'Industrial Area', city: 'Tema', region: 'Greater Accra', price: 42000, basis: 'per_month', img: IMG.warehouse, extra: [], sqm: 1800, features: ['Loading bays', 'Office space', '24-hour security'], agentId: 'u_kwame' }),
    listing({ id: 'l_airport1', orgId: 'o_prime', intent: 'rent', type: 'apartment', title: '1-bedroom in Airport Residential', description: 'A furnished one-bedroom apartment with backup power and a shared pool.', line1: 'Ninth Street', area: 'Airport Residential', city: 'Accra', region: 'Greater Accra', price: 8000, basis: 'per_month', img: IMG.interior.slice(9, 10), beds: 1, baths: 1, sqm: 70, features: ['Furnished', 'Swimming pool', 'Backup generator'], agentId: 'u_akua', state: 'paused', furnished: true }),
  ]
  // Weekend prices and an owner block on the Labadi bungalow (RATE-016 to 019).
  const labadi = listings[0]
  for (let i = 0; i < 90; i++) {
    const date = d(i)
    const day = new Date(date + 'T12:00:00').getDay()
    if (day === 5 || day === 6) labadi.priceOverrides[date] = 95000
  }
  for (let i = 20; i < 23; i++) labadi.blocks[d(i)] = 'Owner staying'
  listings.find((l) => l.id === 'l_airport1')!.withdrawnReason = 'Paused: the assigned agent’s licence has expired.'
  listings.find((l) => l.id === 'l_spintex')!.photos = []

  const mandates: Mandate[] = listings
    .filter((l) => l.orgId === 'o_prime')
    .map((l, i) => ({
      id: `m_${l.id}`,
      agencyId: 'o_prime',
      ownerName: ['Daniel Ofori', 'Grace Amponsah', 'Kwabena Osei', 'Mercy Adomako', 'Emmanuel Tagoe', 'Joyce Badu', 'Patrick Nyarko', 'Lydia Armah', 'Samuel Ankrah'][i % 9],
      propertyId: l.propertyId,
      propertyTitle: l.title,
      exclusive: i % 3 !== 2,
      startsOn: d(-90),
      endsOn: d(i === 1 ? 12 : 270),
      status: 'active' as const,
    }))

  // ── Bookings ──
  const booking = (b: Partial<BookingRec> & Pick<BookingRec, 'id' | 'listingId' | 'guestId' | 'checkIn' | 'checkOut' | 'state'>): BookingRec => {
    const l = listings.find((x) => x.id === b.listingId)!
    const nights = Math.round((Date.parse(b.checkOut) - Date.parse(b.checkIn)) / DAY)
    const acc = l.priceMinor * nights
    const service = Math.round(acc * 0.1)
    const cleaning = l.cleaningFeeMinor ?? 0
    const tax = Math.round((acc + cleaning) * 0.05)
    const m = (amountMinor: number) => ({ amountMinor, currency: 'GHS' })
    return {
      reference: `AB-${b.id.slice(2, 6).toUpperCase()}-${b.id.length}Q`,
      guests: 2,
      nights,
      lines: [
        { label: `Stay, ${nights} nights`, amount: m(acc), kind: 'charge' },
        { label: 'Cleaning fee', amount: m(cleaning), kind: 'charge' },
        { label: 'Abode service fee', amount: m(service), kind: 'charge' },
        { label: 'VAT and levies (test rate 5%)', amount: m(tax), kind: 'tax' },
      ],
      totalMinor: acc + cleaning + service + tax,
      payment: { method: 'mobile_money', label: 'MTN Mobile Money', status: 'succeeded', startedAt: Date.now() - 20 * DAY, outcome: 'succeed' },
      cancellationPolicy: l.cancellationPolicy ?? 'moderate',
      cancellationText: '',
      createdAt: iso(-20 * DAY),
      ...b,
    }
  }
  const bookings: BookingRec[] = [
    booking({ id: 'b_kofi1', reference: 'AB-7KQ2-M9', listingId: 'l_labadi', guestId: 'u_kofi', checkIn: d(10), checkOut: d(13), state: 'confirmed' }),
    booking({ id: 'b_kofi2', reference: 'AB-3HXP-R4', listingId: 'l_kokrobite', guestId: 'u_kofi', checkIn: d(-30), checkOut: d(-27), state: 'completed' }),
    booking({ id: 'b_efua1', reference: 'AB-9WTD-K2', listingId: 'l_busua', guestId: 'u_efua', checkIn: d(3), checkOut: d(6), state: 'confirmed', guests: 4 }),
    booking({ id: 'b_kwesi1', reference: 'AB-5MNB-T7', listingId: 'l_capecoast', guestId: 'u_kwesi', checkIn: d(18), checkOut: d(20), state: 'pending_payment', payment: { method: 'mobile_money', label: 'Telecel Cash', status: 'checking', startedAt: Date.now() - 7 * HOUR, outcome: 'check' }, createdAt: iso(-7 * HOUR) }),
    booking({ id: 'b_efua2', reference: 'AB-2LCV-H8', listingId: 'l_akosombo', guestId: 'u_efua', checkIn: d(25), checkOut: d(27), state: 'cancelled_by_guest', cancelReason: 'Change of plans', createdAt: iso(-6 * DAY) }),
    booking({ id: 'b_ama1', reference: 'AB-6RTY-P3', listingId: 'l_eastlegon', guestId: 'u_kwesi', checkIn: d(5), checkOut: d(8), state: 'confirmed' }),
  ]
  const cancelled = bookings.find((b) => b.id === 'b_efua2')!
  const refundable = cancelled.lines.filter((l) => !l.label.startsWith('Abode service'))
  cancelled.refund = { lines: refundable, total: { amountMinor: refundable.reduce((s, l) => s + l.amount.amountMinor, 0), currency: 'GHS' }, settled: false, requestedAt: iso(-2 * DAY) }

  // ── Enquiries, threads, messages ──
  const enquiries: DB['enquiries'] = [
    { id: 'e_kofi1', listingId: 'l_cantonments', orgId: 'o_prime', seekerId: 'u_kofi', message: 'Hello, is the apartment still available from next month? Can I view it this week?', contactMethod: 'in_app', status: 'contacted', assigneeId: 'u_kwame', threadId: 't_e_kofi1', createdAt: iso(-3 * DAY) },
    { id: 'e_efua1', listingId: 'l_airport', orgId: 'o_prime', seekerId: 'u_efua', message: 'I’m interested in the townhouse. Is the price negotiable, and is the title registered?', contactMethod: 'phone', status: 'viewing_scheduled', assigneeId: 'u_kwame', threadId: 't_e_efua1', createdAt: iso(-5 * DAY) },
    { id: 'e_kwesi1', listingId: 'l_osu', orgId: 'o_prime', seekerId: 'u_kwesi', message: 'Is water and electricity included in the rent?', contactMethod: 'in_app', status: 'new', threadId: 't_e_kwesi1', createdAt: iso(-5 * HOUR) },
    { id: 'e_kofi2', listingId: 'l_tema', orgId: 'o_ama', seekerId: 'u_kofi', message: 'Good afternoon. Would you accept one year advance instead of two?', contactMethod: 'in_app', status: 'new', threadId: 't_e_kofi2', createdAt: iso(-1 * DAY) },
  ]
  const thread = (id: string, subject: string, kind: 'enquiry' | 'viewing' | 'booking', ctx: string, orgId: string, seekerId: string) => ({ id, subject, context: { kind, id: ctx }, orgId, seekerId, closed: false, lastReadAt: {} as Record<string, number> })
  const threads: DB['threads'] = [
    thread('t_e_kofi1', 'Furnished 2-bed apartment in Cantonments', 'enquiry', 'e_kofi1', 'o_prime', 'u_kofi'),
    thread('t_e_efua1', '3-bedroom townhouse, Airport Residential', 'enquiry', 'e_efua1', 'o_prime', 'u_efua'),
    thread('t_e_kwesi1', 'Studio apartment in Osu', 'enquiry', 'e_kwesi1', 'o_prime', 'u_kwesi'),
    thread('t_e_kofi2', '3-bedroom house in Tema Community 25', 'enquiry', 'e_kofi2', 'o_ama', 'u_kofi'),
    thread('t_b_kofi1', 'Booking AB-7KQ2-M9 · Beachfront bungalow in Labadi', 'booking', 'b_kofi1', 'o_labadi', 'u_kofi'),
  ]
  const msg = (id: string, threadId: string, senderId: string, body: string, ago: number) => ({ id, threadId, senderId, body, at: iso(-ago) })
  const messages: DB['messages'] = [
    msg('m1', 't_e_kofi1', 'u_kofi', enquiries[0].message, 3 * DAY),
    msg('m2', 't_e_kofi1', 'u_kwame', 'Hi Kofi, yes it is available from the 1st. I can show you round on Saturday morning. Does 10:00 work?', 3 * DAY - 2 * HOUR),
    msg('m3', 't_e_kofi1', 'u_kofi', 'Saturday at 10 works. Thank you!', 2 * DAY),
    msg('m4', 't_e_efua1', 'u_efua', enquiries[1].message, 5 * DAY),
    msg('m5', 't_e_efua1', 'u_kwame', 'Hello Efua. The title is registered with the Lands Commission. There is a little room on price. Let’s talk at the viewing.', 5 * DAY - HOUR),
    msg('m6', 't_e_kwesi1', 'u_kwesi', enquiries[2].message, 5 * HOUR),
    msg('m7', 't_e_kofi2', 'u_kofi', enquiries[3].message, DAY),
    msg('m8', 't_b_kofi1', 'u_yaw', 'Akwaaba Kofi! Looking forward to hosting you. I’ll send directions the day before you arrive.', 19 * DAY),
  ]

  // ── Viewings ──
  const slot = (ms: number) => {
    const t = new Date(Date.now() + ms)
    t.setMinutes(t.getMinutes() < 30 ? 30 : 60, 0, 0)
    return t.toISOString()
  }
  const viewings: DB['viewings'] = [
    { id: 'v_efua1', listingId: 'l_airport', orgId: 'o_prime', seekerId: 'u_efua', enquiryId: 'e_efua1', slots: [slot(45 * MIN)], confirmedSlot: slot(45 * MIN), state: 'confirmed', agentId: 'u_kwame', meetingPoint: 'Front gate on Senchi Street', timeline: [{ at: iso(-4 * DAY), state: 'requested' }, { at: iso(-3 * DAY), state: 'confirmed', note: 'Kwame Addo will meet you' }], createdAt: iso(-4 * DAY) },
    { id: 'v_kofi1', listingId: 'l_cantonments', orgId: 'o_prime', seekerId: 'u_kofi', enquiryId: 'e_kofi1', slots: [slot(2 * DAY), slot(2 * DAY + 2 * HOUR)], state: 'requested', meetingPoint: 'Building reception', timeline: [{ at: iso(-2 * DAY), state: 'requested' }], createdAt: iso(-2 * DAY) },
    { id: 'v_kwesi1', listingId: 'l_osu', orgId: 'o_prime', seekerId: 'u_kwesi', slots: [slot(DAY + 3 * HOUR), slot(2 * DAY + 5 * HOUR)], state: 'requested', meetingPoint: 'Entrance on 5th Lane', timeline: [{ at: iso(-4 * HOUR), state: 'requested' }], createdAt: iso(-4 * HOUR) },
    { id: 'v_kofi2', listingId: 'l_tema', orgId: 'o_ama', seekerId: 'u_kofi', slots: [slot(-12 * DAY)], confirmedSlot: slot(-12 * DAY), state: 'completed', agentId: 'u_ama', meetingPoint: 'House 18 gate', timeline: [{ at: iso(-14 * DAY), state: 'requested' }, { at: iso(-13 * DAY), state: 'confirmed' }, { at: iso(-12 * DAY), state: 'completed' }], createdAt: iso(-14 * DAY) },
  ]

  const notifications: DB['notifications'] = [
    { id: 'n1', userId: 'u_kofi', title: 'New message from Kwame Addo', body: 'About: Furnished 2-bed apartment in Cantonments', link: '/messages/t_e_kofi1', at: iso(-3 * DAY + 2 * HOUR), read: false },
    { id: 'n2', userId: 'u_kofi', title: 'Booking confirmed', body: 'AB-7KQ2-M9 · Beachfront bungalow in Labadi', link: '/trips/b_kofi1', at: iso(-20 * DAY), read: true },
    { id: 'n3', userId: 'u_efua', title: 'Viewing confirmed for today', body: '3-bedroom townhouse, Airport Residential, with Kwame Addo', link: '/viewings/v_efua1', at: iso(-3 * DAY), read: false },
    { id: 'n4', userId: 'u_kwame', title: 'Viewing today', body: 'Efua Asante · 3-bedroom townhouse, Airport Residential', link: '/portal/viewings/v_efua1', at: iso(-HOUR), read: false },
    { id: 'n5', userId: 'u_esi', title: 'New enquiry', body: 'Kwesi Appiah · Studio apartment in Osu', link: '/portal/leads/e_kwesi1', at: iso(-5 * HOUR), read: false },
    { id: 'n6', userId: 'u_esi', title: 'Agent licence expired', body: 'Akua Sarpong’s licence expired. Her listing has been paused.', link: '/portal/team', at: iso(-9 * DAY), read: false },
    { id: 'n7', userId: 'u_ama', title: 'Listing in review', body: 'Self-contained apartment in Ahodwo, Kumasi', link: '/portal/listings/l_kumasi', at: iso(-DAY), read: false },
  ]

  const verificationCases: DB['verificationCases'] = [
    { id: 'vc_golden', subject: { kind: 'organization', id: 'o_golden', name: 'Golden Key Homes Ltd' }, orgId: 'o_golden', orgName: 'Golden Key Homes', submittedBy: 'Selasi Agbeko', evidence: [{ id: 'ev1', name: 'Certificate of incorporation.pdf', type: 'Registration' }, { id: 'ev2', name: 'Office tenancy agreement.pdf', type: 'Proof of address' }, { id: 'ev3', name: 'Director Ghana Card.jpg', type: 'Identity' }], note: 'We are a new agency in Kumasi. Our GREA membership is in progress.', state: 'submitted', history: [{ at: iso(-2 * DAY), state: 'submitted', by: 'Selasi Agbeko' }], createdAt: iso(-2 * DAY) },
    { id: 'vc_akua', subject: { kind: 'agent_licence', id: 'u_akua', name: 'Akua Sarpong' }, orgId: 'o_prime', orgName: 'Accra Prime Realty', submittedBy: 'Esi Owusu', evidence: [{ id: 'ev4', name: 'GREA licence renewal receipt.pdf', type: 'Licence' }], state: 'submitted', history: [{ at: iso(-DAY), state: 'submitted', by: 'Esi Owusu' }], createdAt: iso(-DAY) },
    { id: 'vc_kumasi', subject: { kind: 'ownership', id: 'l_kumasi', name: 'Self-contained apartment in Ahodwo, Kumasi' }, orgId: 'o_ama', orgName: 'Ama Mensah', submittedBy: 'Ama Mensah', evidence: [{ id: 'ev5', name: 'Indenture.pdf', type: 'Ownership' }, { id: 'ev6', name: 'Property rate receipt 2026.pdf', type: 'Ownership' }], state: 'in_review', history: [{ at: iso(-DAY), state: 'submitted', by: 'Ama Mensah' }, { at: iso(-20 * HOUR), state: 'in_review', by: 'Abode' }], createdAt: iso(-DAY) },
  ]

  const reports: DB['reports'] = [
    { id: 'r1', target: { kind: 'listing', id: 'l_oxford', label: 'Shop on Oxford Street, Osu' }, reporter: 'Kwesi Appiah', category: 'inaccurate', detail: 'The photos don’t match the shop I visited. It is much smaller.', state: 'open', createdAt: iso(-1 * DAY) },
    { id: 'r2', target: { kind: 'user', id: 'u_unknown', label: 'Prince Owusu (messages)' }, reporter: 'Efua Asante', category: 'fraud', detail: 'Asked me to send a deposit by MoMo before any viewing, outside Abode.', state: 'open', createdAt: iso(-6 * HOUR) },
  ]

  const payouts: DB['payouts'] = [
    { id: 'p1', orgId: 'o_labadi', amountMinor: 385000, bookingRefs: ['AB-3HXP-R4'], state: 'pending_approval', createdById: 'u_fin', createdAt: iso(-3 * HOUR) },
    { id: 'p2', orgId: 'o_ama', amountMinor: 164000, bookingRefs: ['AB-1QWE-Z9'], state: 'paid', createdById: 'u_fin', approvedById: 'u_fin2', createdAt: iso(-12 * DAY) },
  ]

  const recon: DB['recon'] = [
    { id: 'rc1', bookingId: 'b_kwesi1', issue: 'payment_unmatched', amountMinor: bookings[3].totalMinor, createdAt: Date.now() - 7 * HOUR, resolved: false },
    { id: 'rc2', bookingId: 'b_efua2', issue: 'refund_pending', amountMinor: cancelled.refund.total.amountMinor, createdAt: Date.now() - 2 * DAY, resolved: false },
  ]

  const flags: FeatureFlag[] = [
    { key: 'live_tracking', label: 'Live location during viewings', description: 'Agents can share their live location with a seeker on the way to a viewing.', enabled: true, gate: { name: 'GATE-DPIA', evidenceRecorded: true } },
    { key: 'card_payments', label: 'Card payments', description: 'Guests can pay by card through the payment provider.', enabled: true, gate: { name: 'GATE-PSP', evidenceRecorded: true } },
    { key: 'mobile_money', label: 'Mobile money payments', description: 'Guests can pay with MTN, Telecel or AirtelTigo money.', enabled: true, gate: { name: 'GATE-PSP', evidenceRecorded: true } },
    { key: 'offers', label: 'Offers on sale and rent listings', description: 'Seekers can make offers. Wording must be reviewed by counsel.', enabled: false, gate: { name: 'GATE-LEGAL', evidenceRecorded: false } },
    { key: 'storefronts', label: 'Agency storefront pages', description: 'Public pages for each agency and agent.', enabled: false },
    { key: 'partner_api', label: 'Partner API', description: 'Approved partners can read published listings.', enabled: false, gate: { name: 'GATE-PARTNER', evidenceRecorded: false } },
  ]

  const audit: DB['audit'] = [
    { id: 'a1', at: iso(-12 * DAY), actor: 'Nana Ama Boakye', action: 'payout.approve', target: 'Payout to Ama Mensah · GH₵1,640.00', reason: 'Matched to booking AB-1QWE-Z9' },
    { id: 'a2', at: iso(-9 * DAY), actor: 'System', action: 'listing.pause', target: '1-bedroom in Airport Residential', reason: 'Agent licence expired' },
    { id: 'a3', at: iso(-50 * DAY), actor: 'Abena Ofori', action: 'verification.approve', target: 'Accra Prime Realty Ltd', reason: 'Registration and GREA membership checked' },
  ]

  return {
    users,
    sessions: {},
    orgs,
    members,
    invitations: [{ id: 'inv1', orgId: 'o_prime', email: 'yaa.agent@example.com', role: 'agent', sentAt: iso(-2 * DAY) }],
    mandates,
    listings,
    quotes: [],
    holds: [],
    bookings,
    enquiries,
    viewings,
    threads,
    messages,
    notifications,
    favourites: { u_kofi: ['l_busua', 'l_cantonments'] },
    verificationCases,
    reports,
    payouts,
    recon,
    audit,
    flags,
  }
}
