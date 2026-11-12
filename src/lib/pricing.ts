import { SERVICE_FEE_RATE } from '../config'
import type { ISODate, Listing } from '../contracts'
import { diffDays } from './dates'

export interface Quote {
  nights: number
  pricePerNight: number
  subtotal: number
  cleaningFee: number
  serviceFee: number
  total: number
}

/**
 * The one place a stay is priced. The booking widget, the checkout page and
 * the mock API all call this, so the figure a guest sees is the figure they pay.
 */
export function quoteStay(
  listing: Pick<Listing, 'pricePerNight' | 'cleaningFee'>,
  checkIn: ISODate,
  checkOut: ISODate,
): Quote {
  const nights = Math.max(0, diffDays(checkIn, checkOut))
  const subtotal = nights * listing.pricePerNight
  const cleaningFee = nights > 0 ? listing.cleaningFee : 0
  const serviceFee = Math.round((subtotal + cleaningFee) * SERVICE_FEE_RATE)
  return {
    nights,
    pricePerNight: listing.pricePerNight,
    subtotal,
    cleaningFee,
    serviceFee,
    total: subtotal + cleaningFee + serviceFee,
  }
}
