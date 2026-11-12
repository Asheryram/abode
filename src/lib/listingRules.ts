import { MAX_DESCRIPTION, MAX_TITLE, MIN_PHOTOS } from '../config'
import type { ListingInput } from '../contracts'

/**
 * What still stops a listing from going live. Empty means it can be published.
 * Used by the host's review step and again by the API, the way a real server
 * would never trust the form alone.
 */
export function publishProblems(l: ListingInput): string[] {
  const out: string[] = []
  if (!l.location.city.trim()) out.push('Add the town or city.')
  if (!l.location.address.trim()) out.push('Add a street or area.')
  if (!l.location.region.trim()) out.push('Pick a region.')
  if (l.maxGuests < 1) out.push('Allow at least one guest.')
  if (l.photos.length < MIN_PHOTOS) out.push(`Add at least ${MIN_PHOTOS} photos.`)
  if (!l.title.trim()) out.push('Give your place a title.')
  if (l.title.length > MAX_TITLE) out.push(`Keep the title under ${MAX_TITLE} characters.`)
  if (l.description.trim().length < 30) out.push('Write a description of at least 30 characters.')
  if (l.description.length > MAX_DESCRIPTION) out.push(`Keep the description under ${MAX_DESCRIPTION} characters.`)
  if (!(l.pricePerNight > 0)) out.push('Set a nightly price.')
  if (l.cleaningFee < 0) out.push('The cleaning fee cannot be negative.')
  return out
}

export function emptyListingInput(): ListingInput {
  return {
    status: 'draft',
    title: '',
    description: '',
    propertyType: 'house',
    placeType: 'entire',
    location: { address: '', city: '', region: '', country: 'Ghana' },
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: [],
    photos: [],
    pricePerNight: 0,
    cleaningFee: 0,
  }
}
