/**
 * Every word the design system shows, in one place (PLT-034, FE-GLB-022).
 * English (Ghana) only for now; a second locale becomes a second object of
 * the same shape. Components never hard-code user-facing text.
 *
 * Controlled words (FE-GLB-007): a viewing is never a "booking" or
 * "reservation", and nothing here says "sold" for an offer.
 */
export const ds = {
  basis: {
    total: '',
    per_night: 'per night',
    per_month: 'per month',
    per_annum: 'per year',
    per_sqm_per_annum: 'per m² per year',
  },
  breakdown: {
    total: 'Total',
    taxes: 'Taxes',
    serverNote: 'Prices are calculated by Abode and confirmed at checkout.',
  },
  promoted: {
    label: 'Promoted',
    srLabel: 'Promoted listing. This placement is paid for.',
  },
  trust: {
    agency: 'Licensed agency',
    owner: 'Listed by owner',
    unverified: 'Not verified',
    learnMore: 'What this badge means',
  },
  countdown: {
    held: (time: string) => `Dates held for ${time}`,
    expired: 'Your hold has ended. Get a new price to continue.',
    srMinutes: (m: number) => `${m} ${m === 1 ? 'minute' : 'minutes'} left on your hold.`,
  },
  location: {
    updated: (age: string) => `Updated ${age} ago`,
    stale: (age: string) => `Last seen ${age} ago. Position may be out of date.`,
    lowAccuracy: 'Low accuracy',
    unavailable: 'Live location is unavailable. Showing status updates only.',
    eta: (min: number, max: number) => `Arriving in about ${min}–${max} min`,
    etaBasis: (basis: string) => `Estimate based on ${basis}. Not a guarantee.`,
  },
  sharing: {
    active: 'You are sharing your live location',
    with: (names: string) => `Visible to ${names}`,
    until: (time: string) => `Stops automatically at ${time}`,
    stop: 'Stop sharing',
  },
  alert: {
    reference: (id: string) => `Reference: ${id}`,
  },
  environment: {
    label: (env: string, mode: string) => `${env.toUpperCase()} environment · payments in ${mode} mode`,
  },
  status: {
    booking: {
      pending_payment: 'Awaiting payment',
      confirmed: 'Confirmed',
      in_stay: 'In stay',
      completed: 'Completed',
      cancelled_by_guest: 'Cancelled by guest',
      cancelled_by_host: 'Cancelled by host',
      cancelled_by_platform: 'Cancelled by Abode',
      no_show: 'No-show',
      disputed: 'In dispute',
    },
    listing: {
      draft: 'Draft',
      submitted: 'Submitted',
      in_review: 'In review',
      published: 'Published',
      paused: 'Paused',
      expired: 'Expired',
      withdrawn: 'Withdrawn',
      let_or_sold: 'Let or sold',
      archived: 'Archived',
    },
    viewing: {
      requested: 'Viewing requested',
      proposed: 'Time proposed',
      confirmed: 'Viewing confirmed',
      agent_en_route: 'Agent on the way',
      arrived: 'Agent arrived',
      in_progress: 'Viewing in progress',
      completed: 'Viewing completed',
      cancelled: 'Viewing cancelled',
      no_show: 'No-show',
    },
    refund: {
      pending: 'Refund pending',
      settled: 'Refunded',
    },
  },
} as const
