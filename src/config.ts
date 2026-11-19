/**
 * Product-wide labels and lists. Change a word here and every screen follows.
 * Colours and fonts live in src/styles/tokens.css; component text lives in
 * src/design-system/strings.ts.
 */
import type { Intent, OrgKind, OrgRole, PropertyType, StaffRole } from './contracts'

/** Product name. */
export const BRAND = 'Abode'

export const INTENTS: { id: Intent; label: string; verb: string; hint: string }[] = [
  { id: 'short_stay', label: 'Short stays', verb: 'Stay', hint: 'Book a place by the night' },
  { id: 'rent', label: 'Rent', verb: 'Rent', hint: 'Homes to rent long term' },
  { id: 'sale', label: 'Buy', verb: 'Buy', hint: 'Homes and land for sale' },
  { id: 'commercial', label: 'Commercial', verb: 'Lease', hint: 'Offices, shops and warehouses' },
]

export const intentLabel = (i: Intent) => INTENTS.find((x) => x.id === i)?.label ?? i

export const PROPERTY_TYPES: { id: PropertyType; label: string; intents: Intent[] }[] = [
  { id: 'house', label: 'House', intents: ['short_stay', 'rent', 'sale'] },
  { id: 'apartment', label: 'Apartment', intents: ['short_stay', 'rent', 'sale'] },
  { id: 'townhouse', label: 'Townhouse', intents: ['rent', 'sale'] },
  { id: 'villa', label: 'Villa', intents: ['short_stay', 'rent', 'sale'] },
  { id: 'guesthouse', label: 'Guesthouse', intents: ['short_stay'] },
  { id: 'land', label: 'Land', intents: ['sale'] },
  { id: 'office', label: 'Office', intents: ['commercial'] },
  { id: 'shop', label: 'Shop', intents: ['commercial'] },
  { id: 'warehouse', label: 'Warehouse', intents: ['commercial'] },
]

export const propertyTypeLabel = (id: PropertyType) => PROPERTY_TYPES.find((t) => t.id === id)?.label ?? id

export const FEATURES = [
  'Wi-Fi',
  'Air conditioning',
  'Kitchen',
  'Backup generator',
  'Water tank',
  'Prepaid meter',
  'Free parking',
  'Parking',
  'Swimming pool',
  'Gym',
  '24-hour security',
  'Security',
  'Walled compound',
  'Gated estate',
  'Garden',
  'Balcony',
  'Beach access',
  'Workspace',
  'Washing machine',
  'Furnished',
  'Lift',
  'Fibre internet',
  'Loading bays',
  'Street frontage',
]

export const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Central',
  'Western',
  'Eastern',
  'Volta',
  'Northern',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
  'Western North',
  'Oti',
  'Savannah',
  'North East',
]

export const ORG_KINDS: { id: OrgKind; label: string; hint: string }[] = [
  { id: 'individual_owner', label: 'I own property', hint: 'List your own homes for rent, sale or short stays.' },
  { id: 'host', label: 'I run short stays', hint: 'A guesthouse or holiday homes business.' },
  { id: 'agency', label: 'I’m an agency', hint: 'A registered agency marketing property for owners.' },
]

export const orgKindLabel = (k: OrgKind) => ({ agency: 'Agency', individual_owner: 'Owner', host: 'Short-stay host' })[k]

export const ORG_ROLE_LABEL: Record<OrgRole, string> = { admin: 'Administrator', agent: 'Agent', finance: 'Finance' }

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  moderator: 'Moderator',
  verification_officer: 'Verification officer',
  finance_operator: 'Finance operator',
  support_agent: 'Support agent',
  platform_admin: 'Platform administrator',
  analyst: 'Analyst (read only)',
}

export const MOBILE_MONEY_NETWORKS = ['MTN Mobile Money', 'Telecel Cash', 'AirtelTigo Money']
