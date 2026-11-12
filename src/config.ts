import type { AmenityId, PlaceType, PropertyType } from './contracts'

/** Product name. Change it here and the whole app follows. */
export const BRAND = 'Abode'

export const CURRENCY_SYMBOL = 'GH₵'

/** The platform's cut, charged to the guest on top of the stay. */
export const SERVICE_FEE_RATE = 0.1

/** A host has to upload at least this many photos before publishing. */
export const MIN_PHOTOS = 3

export const MAX_TITLE = 60
export const MAX_DESCRIPTION = 1000

export const PROPERTY_TYPES: { id: PropertyType; label: string; plural: string }[] = [
  { id: 'house', label: 'House', plural: 'Houses' },
  { id: 'apartment', label: 'Apartment', plural: 'Apartments' },
  { id: 'villa', label: 'Villa', plural: 'Villas' },
  { id: 'beach', label: 'Beach house', plural: 'Beachfront' },
  { id: 'cabin', label: 'Cabin', plural: 'Cabins' },
  { id: 'guesthouse', label: 'Guesthouse', plural: 'Guesthouses' },
]

export const PLACE_TYPES: { id: PlaceType; label: string; hint: string }[] = [
  { id: 'entire', label: 'An entire place', hint: 'Guests have the whole place to themselves.' },
  { id: 'private-room', label: 'A private room', hint: 'Guests have their own room and share some spaces.' },
  { id: 'shared-room', label: 'A shared room', hint: 'Guests sleep in a room or common area they share.' },
]

export const AMENITIES: { id: AmenityId; label: string }[] = [
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'ac', label: 'Air conditioning' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'parking', label: 'Free parking' },
  { id: 'pool', label: 'Pool' },
  { id: 'tv', label: 'TV' },
  { id: 'washer', label: 'Washing machine' },
  { id: 'generator', label: 'Backup generator' },
  { id: 'water-tank', label: 'Reserve water tank' },
  { id: 'workspace', label: 'Dedicated workspace' },
  { id: 'security', label: '24/7 security' },
  { id: 'gym', label: 'Gym' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'beach-access', label: 'Beach access' },
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

export const propertyTypeLabel = (id: PropertyType) =>
  PROPERTY_TYPES.find((t) => t.id === id)?.label ?? id

export const placeTypeLabel = (id: PlaceType) => PLACE_TYPES.find((t) => t.id === id)?.label ?? id

export const amenityLabel = (id: AmenityId) => AMENITIES.find((a) => a.id === id)?.label ?? id
