import type { AmenityId, Booking, PlaceType, PropertyType, Review } from '../../contracts'
import { addDays, today } from '../../lib/dates'
import { quoteStay } from '../../lib/pricing'
import type { ListingRecord, Tables, UserRecord } from './records'

/** Bump to wipe and re-seed everyone's local data on their next visit. */
export const SEED_VERSION = 1

/** Every seeded account uses this password. Shown on the login page. */
export const DEMO_PASSWORD = 'password123'
export const DEMO_GUEST_EMAIL = 'kofi@abode.test'
export const DEMO_HOST_EMAIL = 'ama@abode.test'

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`

const EXTERIOR = {
  house: [
    '1564013799919-ab600027ffc6',
    '1568605114967-8130f3a36994',
    '1570129477492-45c003edd2be',
    '1580587771525-78b9dba3b914',
    '1600596542815-ffad4c1539a9',
    '1600585154340-be6161a56a0c',
    '1600047509807-ba8f99d2cdde',
    '1416331108676-a22ccb276e35',
  ],
  villa: ['1613490493576-7fde63acd811', '1582268611958-ebfd161ef9cf', '1520250497591-112f2f40a3f4', '1566073771259-6a8506099945'],
  beach: ['1499793983690-e29da59ef1c2', '1520250497591-112f2f40a3f4'],
  cabin: ['1449844908441-8829872d2607', '1542718610-a1d656d1884c', '1510798831971-661eb04b3739'],
}

const INTERIOR = [
  '1505691938895-1758d7feb511',
  '1502672260266-1c1ef2d93688',
  '1522708323590-d24dbb6b0267',
  '1560448204-e02f11c3d0e2',
  '1600607687939-ce8a6c25118c',
  '1600566753190-17f0baa2a6c3',
  '1600210492486-724fe5c67fb0',
  '1556020685-ae41abfc9365',
  '1484154218962-a197022b5858',
  '1493809842364-78817add7ffb',
  '1586023492125-27b2c045efd7',
  '1631049307264-da0ec9d70304',
  '1595526114035-0d45ed16cfbf',
  '1600566753086-00f18fb6b3ea',
  '1600573472550-8090b5e0745e',
]

/** Small deterministic PRNG, so the seed looks the same on every machine. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

interface SeedListing {
  id: string
  hostId: string
  title: string
  description: string
  propertyType: PropertyType
  placeType?: PlaceType
  address: string
  city: string
  region: string
  guests: number
  bedrooms: number
  beds: number
  bathrooms: number
  price: number
  cleaning: number
  amenities: AmenityId[]
  cover: string
}

const LISTINGS: SeedListing[] = [
  {
    id: 'lst_eastlegon',
    hostId: 'usr_ama',
    title: 'Sunlit 3-bedroom home in East Legon',
    description:
      'A bright family home on a quiet, gated street in East Legon. Three air-conditioned bedrooms, a full kitchen and a shaded garden for evenings outside. A few minutes from A&C Mall and about 15 minutes to Kotoka Airport.\n\nA backup generator and reserve water tank mean power cuts and water outages will not slow you down.',
    propertyType: 'house',
    address: 'Lagos Avenue',
    city: 'Accra',
    region: 'Greater Accra',
    guests: 6,
    bedrooms: 3,
    beds: 4,
    bathrooms: 3,
    price: 1200,
    cleaning: 150,
    amenities: ['wifi', 'ac', 'kitchen', 'parking', 'generator', 'water-tank', 'security', 'washer', 'tv'],
    cover: EXTERIOR.house[0]!,
  },
  {
    id: 'lst_osu',
    hostId: 'usr_kwame',
    title: 'Modern studio steps from Oxford Street',
    description:
      'A compact, stylish studio in the heart of Osu. Walk to restaurants, bars and the Oxford Street shops. Ideal for solo travellers and couples who want to be in the middle of it all.',
    propertyType: 'apartment',
    address: 'Ring Road East',
    city: 'Accra',
    region: 'Greater Accra',
    guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    price: 450,
    cleaning: 60,
    amenities: ['wifi', 'ac', 'kitchen', 'tv', 'workspace', 'security'],
    cover: INTERIOR[2]!,
  },
  {
    id: 'lst_adavilla',
    hostId: 'usr_ama',
    title: 'Oceanfront villa with infinity pool',
    description:
      'Where the Volta meets the sea. This five-bedroom villa sits on a private stretch of sand at Ada Foah, with an infinity pool, an outdoor dining deck and staff on hand for breakfast every morning.',
    propertyType: 'villa',
    address: 'Estuary Road',
    city: 'Ada Foah',
    region: 'Greater Accra',
    guests: 10,
    bedrooms: 5,
    beds: 6,
    bathrooms: 5,
    price: 3500,
    cleaning: 400,
    amenities: ['wifi', 'ac', 'kitchen', 'parking', 'pool', 'generator', 'breakfast', 'beach-access', 'security', 'tv'],
    cover: EXTERIOR.villa[0]!,
  },
  {
    id: 'lst_busua',
    hostId: 'usr_efua',
    title: 'Beach house steps from Busua surf',
    description:
      'Wake up to the sound of waves. A relaxed two-bedroom beach house a short walk from Busua’s surf schools and seafood spots. Hammocks on the porch, boards available to borrow.',
    propertyType: 'beach',
    address: 'Beach Road',
    city: 'Busua',
    region: 'Western',
    guests: 4,
    bedrooms: 2,
    beds: 3,
    bathrooms: 2,
    price: 1500,
    cleaning: 120,
    amenities: ['wifi', 'kitchen', 'parking', 'beach-access', 'water-tank', 'breakfast'],
    cover: EXTERIOR.beach[0]!,
  },
  {
    id: 'lst_aburi',
    hostId: 'usr_yaw',
    title: 'Hilltop cabin in the Aburi mountains',
    description:
      'Cool air, birdsong and a view across the Akuapem hills. A timber cabin for two, ten minutes from the Aburi Botanical Gardens. The perfect weekend escape from Accra.',
    propertyType: 'cabin',
    address: 'Botanical Gardens Road',
    city: 'Aburi',
    region: 'Eastern',
    guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    price: 700,
    cleaning: 80,
    amenities: ['wifi', 'kitchen', 'parking', 'workspace'],
    cover: EXTERIOR.cabin[0]!,
  },
  {
    id: 'lst_kumasi',
    hostId: 'usr_kwame',
    title: 'Garden guesthouse room in Ahodwo',
    description:
      'A private en-suite room in a welcoming guesthouse with a leafy courtyard. Home-cooked breakfast included. Close to Kejetia Market and the Manhyia Palace.',
    propertyType: 'guesthouse',
    placeType: 'private-room',
    address: 'Ahodwo Roundabout',
    city: 'Kumasi',
    region: 'Ashanti',
    guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    price: 350,
    cleaning: 0,
    amenities: ['wifi', 'ac', 'breakfast', 'parking', 'security', 'generator'],
    cover: INTERIOR[11]!,
  },
  {
    id: 'lst_airport',
    hostId: 'usr_ama',
    title: 'Penthouse with skyline views, Airport Residential',
    description:
      'Two-bedroom penthouse with floor-to-ceiling windows, a rooftop terrace and a residents’ gym. Five minutes from the airport, great for business trips.',
    propertyType: 'apartment',
    address: 'Liberation Road',
    city: 'Accra',
    region: 'Greater Accra',
    guests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 2,
    price: 2200,
    cleaning: 200,
    amenities: ['wifi', 'ac', 'kitchen', 'gym', 'pool', 'workspace', 'security', 'generator', 'tv', 'washer'],
    cover: INTERIOR[5]!,
  },
  {
    id: 'lst_capecoast',
    hostId: 'usr_efua',
    title: 'Family house near Cape Coast Castle',
    description:
      'A spacious four-bedroom house a short drive from Cape Coast Castle and Kakum National Park. Room for the whole family, with a big kitchen and a yard for the kids.',
    propertyType: 'house',
    address: 'Victoria Road',
    city: 'Cape Coast',
    region: 'Central',
    guests: 8,
    bedrooms: 4,
    beds: 5,
    bathrooms: 3,
    price: 900,
    cleaning: 100,
    amenities: ['wifi', 'kitchen', 'parking', 'water-tank', 'generator', 'tv'],
    cover: EXTERIOR.house[2]!,
  },
  {
    id: 'lst_bosomtwe',
    hostId: 'usr_yaw',
    title: 'Lakeside cabin at Lake Bosomtwe',
    description:
      'A rustic cabin on the shore of Ghana’s only natural lake. Swim, paddle out in a canoe, or just watch the fishermen on their planks at sunrise.',
    propertyType: 'cabin',
    address: 'Abono Lakeshore',
    city: 'Abono',
    region: 'Ashanti',
    guests: 3,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    price: 650,
    cleaning: 60,
    amenities: ['kitchen', 'parking', 'breakfast'],
    cover: EXTERIOR.cabin[1]!,
  },
  {
    id: 'lst_tamale',
    hostId: 'usr_yaw',
    title: 'Quiet room in a Tamale family home',
    description:
      'Stay with a local family in a calm part of Tamale. A private room with a fan and AC, shared kitchen, and hosts happy to point you to the best tuo zaafi in town.',
    propertyType: 'guesthouse',
    placeType: 'private-room',
    address: 'Gumani',
    city: 'Tamale',
    region: 'Northern',
    guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    price: 250,
    cleaning: 0,
    amenities: ['wifi', 'ac', 'kitchen', 'water-tank'],
    cover: INTERIOR[12]!,
  },
  {
    id: 'lst_trasacco',
    hostId: 'usr_kwame',
    title: 'Garden villa in Trasacco Valley',
    description:
      'Six bedrooms, a landscaped garden and a pool in one of Accra’s most private estates. Built for celebrations, family reunions and long, slow weekends.',
    propertyType: 'villa',
    address: 'Trasacco Valley',
    city: 'Accra',
    region: 'Greater Accra',
    guests: 12,
    bedrooms: 6,
    beds: 7,
    bathrooms: 6,
    price: 4200,
    cleaning: 500,
    amenities: ['wifi', 'ac', 'kitchen', 'parking', 'pool', 'gym', 'generator', 'water-tank', 'security', 'tv', 'washer'],
    cover: EXTERIOR.villa[1]!,
  },
  {
    id: 'lst_kokrobite',
    hostId: 'usr_ama',
    title: 'Beachfront bungalow in Kokrobite',
    description:
      'A laid-back bungalow right on the sand, 45 minutes west of Accra. Drumming and dance lessons nearby, fresh coconuts on the beach, sunsets every evening.',
    propertyType: 'beach',
    address: 'Kokrobite Beach',
    city: 'Kokrobite',
    region: 'Greater Accra',
    guests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    price: 800,
    cleaning: 80,
    amenities: ['wifi', 'kitchen', 'parking', 'beach-access'],
    cover: EXTERIOR.beach[1]!,
  },
  {
    id: 'lst_takoradi',
    hostId: 'usr_efua',
    title: 'Cosy apartment near Market Circle',
    description:
      'A tidy one-bedroom apartment in central Takoradi with fast Wi-Fi and a proper desk. Walking distance to Market Circle and a short ride to the beach.',
    propertyType: 'apartment',
    address: 'Liberation Road',
    city: 'Takoradi',
    region: 'Western',
    guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    price: 500,
    cleaning: 50,
    amenities: ['wifi', 'ac', 'kitchen', 'workspace', 'tv', 'generator'],
    cover: INTERIOR[9]!,
  },
  {
    id: 'lst_akosombo',
    hostId: 'usr_yaw',
    title: 'Volta riverside cabin in Akosombo',
    description:
      'Watch boats drift along the Volta from your own deck. A two-bedroom cabin near the dam, with kayaks, a fire pit and the Adomi Bridge a short drive away.',
    propertyType: 'cabin',
    address: 'Riverside Drive',
    city: 'Akosombo',
    region: 'Eastern',
    guests: 4,
    bedrooms: 2,
    beds: 3,
    bathrooms: 1,
    price: 750,
    cleaning: 90,
    amenities: ['wifi', 'kitchen', 'parking', 'generator'],
    cover: EXTERIOR.cabin[2]!,
  },
  {
    id: 'lst_cantonments',
    hostId: 'usr_efua',
    title: 'Elegant townhouse in Cantonments',
    description:
      'A three-storey townhouse with a private courtyard in leafy Cantonments. Close to embassies, Labadi Beach and some of Accra’s best restaurants.',
    propertyType: 'house',
    address: 'Switchback Road',
    city: 'Accra',
    region: 'Greater Accra',
    guests: 6,
    bedrooms: 3,
    beds: 3,
    bathrooms: 3,
    price: 1800,
    cleaning: 180,
    amenities: ['wifi', 'ac', 'kitchen', 'parking', 'security', 'generator', 'water-tank', 'washer', 'tv', 'workspace'],
    cover: EXTERIOR.house[4]!,
  },
]

const REVIEWERS = [
  'Akosua B.', 'Nana K.', 'Selorm A.', 'Esi M.', 'Kojo T.', 'Adwoa P.', 'Kwesi O.',
  'Afia D.', 'Fiifi E.', 'Mawuli G.', 'Naa L.', 'Ebo Q.', 'Dzifa N.', 'Yaa F.',
]

const COMMENTS = [
  'Exactly like the photos. Spotless, and the host replied within minutes every time.',
  'Great location and the generator kicked in during a power cut without us even noticing.',
  'We loved our stay. Check-in was smooth and the beds were really comfortable.',
  'Beautiful place, very peaceful. Would definitely come back.',
  'Good value for money. The neighbourhood felt safe and quiet at night.',
  'The host left us a list of local spots to eat, every one of them was great.',
  'Clean, comfortable and well equipped. The kitchen had everything we needed.',
  'A little hard to find at night, but the host sent a pin and met us at the gate.',
  'Perfect for a weekend away. The view alone is worth it.',
  'Wi-Fi was fast enough for video calls all week. Ideal for remote work.',
]

const USERS: Omit<UserRecord, 'passwordHash'>[] = [
  { id: 'usr_ama', name: 'Ama Owusu', email: DEMO_HOST_EMAIL, phone: '024 555 0101', bio: 'Born and raised in Accra. I love helping guests discover the city’s food and beaches.', createdAt: '2023-03-14T09:00:00.000Z' },
  { id: 'usr_kwame', name: 'Kwame Mensah', email: 'kwame@abode.test', bio: 'Architect and part-time host. My places are designed for rest.', createdAt: '2022-11-02T09:00:00.000Z' },
  { id: 'usr_efua', name: 'Efua Asante', email: 'efua@abode.test', bio: 'Coastal girl. Ask me about the best surf and seafood on the west coast.', createdAt: '2024-01-20T09:00:00.000Z' },
  { id: 'usr_yaw', name: 'Yaw Boateng', email: 'yaw@abode.test', bio: 'I host cabins for people who need a break from the city.', createdAt: '2023-07-08T09:00:00.000Z' },
  { id: 'usr_kofi', name: 'Kofi Adjei', email: DEMO_GUEST_EMAIL, phone: '020 555 0202', createdAt: '2024-05-01T09:00:00.000Z' },
  { id: 'usr_abena', name: 'Abena Darko', email: 'abena@abode.test', createdAt: '2024-08-15T09:00:00.000Z' },
]

export type SeedData = Omit<Tables, 'sessions'>


export function buildSeed(hash: (email: string, password: string) => string): SeedData {
  const rand = rng(42)
  const now = new Date().toISOString()

  const users: UserRecord[] = USERS.map((u) => ({ ...u, passwordHash: hash(u.email, DEMO_PASSWORD) }))

  const listings: ListingRecord[] = LISTINGS.map((l, i) => {
    const interiors = Array.from({ length: 4 }, (_, k) => INTERIOR[(i * 3 + k) % INTERIOR.length]!)
    const photos = [l.cover, ...interiors.filter((p) => p !== l.cover)].slice(0, 5).map(photo)
    const created = new Date(Date.now() - (LISTINGS.length - i) * 86_400_000 * 9).toISOString()
    return {
      id: l.id,
      hostId: l.hostId,
      status: 'listed',
      title: l.title,
      description: l.description,
      propertyType: l.propertyType,
      placeType: l.placeType ?? 'entire',
      location: { address: l.address, city: l.city, region: l.region, country: 'Ghana' },
      maxGuests: l.guests,
      bedrooms: l.bedrooms,
      beds: l.beds,
      bathrooms: l.bathrooms,
      amenities: l.amenities,
      photos,
      pricePerNight: l.price,
      cleaningFee: l.cleaning,
      createdAt: created,
      updatedAt: created,
    }
  })

  const reviews: Review[] = []
  listings.forEach((l, i) => {
    const count = i % 5 === 4 ? 0 : 2 + Math.floor(rand() * 6)
    for (let k = 0; k < count; k++) {
      const daysAgo = 10 + Math.floor(rand() * 300)
      reviews.push({
        id: `rev_${l.id}_${k}`,
        listingId: l.id,
        authorName: REVIEWERS[Math.floor(rand() * REVIEWERS.length)]!,
        rating: rand() < 0.75 ? 5 : 4,
        comment: COMMENTS[Math.floor(rand() * COMMENTS.length)]!,
        createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      })
    }
  })

  const t = today()
  const book = (id: string, listingId: string, guestId: string, from: number, nights: number, guests: number): Booking => {
    const listing = listings.find((l) => l.id === listingId)!
    const checkIn = addDays(t, from)
    const checkOut = addDays(checkIn, nights)
    const q = quoteStay(listing, checkIn, checkOut)
    return {
      id,
      listingId,
      guestId,
      checkIn,
      checkOut,
      guests,
      nights: q.nights,
      pricePerNight: q.pricePerNight,
      cleaningFee: q.cleaningFee,
      serviceFee: q.serviceFee,
      total: q.total,
      paymentMethod: 'momo',
      status: 'confirmed',
      createdAt: now,
    }
  }

  const bookings: Booking[] = [
    // Kofi, the demo guest: one past trip and one coming up.
    book('bkg_seed_1', 'lst_osu', 'usr_kofi', -40, 3, 2),
    book('bkg_seed_2', 'lst_aburi', 'usr_kofi', 10, 3, 2),
    // Ama, the demo host, has guests arriving at two of her places.
    book('bkg_seed_3', 'lst_eastlegon', 'usr_kofi', 21, 4, 4),
    book('bkg_seed_4', 'lst_eastlegon', 'usr_abena', 3, 3, 3),
    book('bkg_seed_5', 'lst_adavilla', 'usr_abena', 7, 5, 8),
    book('bkg_seed_6', 'lst_airport', 'usr_abena', -20, 4, 2),
    // A few more so calendars elsewhere show taken dates.
    book('bkg_seed_7', 'lst_busua', 'usr_abena', 5, 4, 3),
    book('bkg_seed_8', 'lst_trasacco', 'usr_kofi', 14, 2, 10),
  ]

  return { users, listings, bookings, reviews, wishlists: { usr_kofi: ['lst_adavilla', 'lst_bosomtwe'] } }
}
