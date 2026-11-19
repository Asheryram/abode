# Abode app guide

A working frontend for every role in SRS-PMTP-001, running on test data in the browser. No backend is needed yet.

## The three areas

| Area | Address | Who | What they do |
| --- | --- | --- | --- |
| Public site | `/` | Seekers and guests | Search by intent, view listings, book short stays, send enquiries, request viewings, follow the agent live, message, manage trips |
| Supply portal | `/portal` | Owners, hosts, agents, agency administrators and finance users | Listings with photos and the publish checklist, enquiries, viewings and live sharing, availability and prices, bookings, team and licences, verification, mandates, payouts |
| Back office | `/admin` | Abode staff, by role | Verification, listing review, reports, reconciliation and payouts (two-person rule), support look-up, feature switches, audit log |

The menu in each area shows only what the signed-in role may use. The test backend checks every action as well, as the real one will.

## Test accounts

Every account uses the password `password123`. The sign-in page lists them all; click one to sign in.

| Account | Role |
| --- | --- |
| kofi@abode.test | Guest with bookings and an enquiry |
| efua@abode.test | Seeker with a viewing today |
| ama@abode.test | Owner: rentals, a short stay, a draft and a listing in review |
| yaw@abode.test | Host: Labadi Beach Stays |
| esi@abode.test | Agency administrator, Accra Prime Realty |
| kwame@abode.test | Agent, Accra Prime Realty |
| adjoa@abode.test | Agency finance, Accra Prime Realty |
| selasi@abode.test | New agency waiting for verification |
| verify@abode.test | Verification officer |
| mod@abode.test | Moderator |
| finance@abode.test | Finance operator (created the waiting payout) |
| finance2@abode.test | Finance operator (second approver) |
| support@abode.test | Support agent |
| admin@abode.test | Platform administrator |
| analyst@abode.test | Read-only analyst |

Staff accounts use two-step sign-in.

### Test codes

| What | Code |
| --- | --- |
| Two-step sign-in | `123456` |
| Email confirmation | `246810` |
| Phone confirmation | `135791` |
| Password reset | `975310` |

### Test payments

| Method | Number | Result |
| --- | --- | --- |
| Mobile money | any number | Confirmed after about 6 seconds |
| Mobile money | ending `0000` | Fails; no booking is made |
| Mobile money | ending `1111` | Waits for Abode finance to check it (shows in back office reconciliation) |
| Card | any number | Confirmed |
| Card | `4000 0000 0000 0002` | Declined |

"Reset all test data" on the sign-in page puts everything back to the start.

## Flows worth showing

1. **Book a stay:** sign in as Kofi, open a short stay, pick dates, Reserve, pay by mobile money, watch the pending screen turn into a confirmation, then cancel and see the refund preview.
2. **Live viewing:** sign in as Kwame, open today’s viewing with Efua, tap “I’m on my way”, opt in and start sharing. Then sign in as Efua and open the viewing to watch the agent approach. The test trip takes about 4 minutes and includes a short signal drop, so you can see the “stale” warning.
3. **Publish gate:** sign in as Ama and open the Spintex draft to see every unmet condition. Create a new listing, add photos and submit it.
4. **Review and approve:** sign in as the moderator and approve the Kumasi listing; as the verification officer, claim and approve Golden Key Homes.
5. **Two-person rule:** sign in as finance@ and try to approve the payout (refused), then as finance2@ and approve it.
6. **Agency team:** sign in as Esi, try to make yourself an agent (blocked: last administrator), and see Akua’s expired licence.

## How it is built

- `src/services/api.ts` is the only door to data. Today it points at `src/services/backend/`, a test backend that runs in the browser and stores data in IndexedDB. It plays the server’s role: it prices stays, holds dates, simulates payments and tracking, and checks permissions. Screens never calculate money or decide access themselves.
- When the real backend exists, replace the contents of `api.ts` with a client generated from its OpenAPI document, keeping the same method names. Screens don’t change.
- `src/contracts/models.ts` holds every data shape, named after the SRS.
- `src/design-system/` holds every reusable building block; `src/styles/tokens.css` holds every colour. See `docs/design-system.md`.

## What is simulated or not yet built

- **Maps:** the tracking map is a drawing, not a real map. The maps provider (DEP-04) isn’t chosen.
- **Photos and documents:** stored in the browser only. Verification documents keep their file name only.
- **Session:** the test backend keeps the session in browser storage under a clearly named demo key. The real backend must use HttpOnly cookies (DEC-FE-04).
- **Payments:** a simulated provider. The real one plugs in at checkout and in reconciliation.
- **Text:** component wording is in the string catalogue; page wording is still in the pages. Move it before adding a second language.
- **Not built yet (P1 in the SRS):** saved-search alerts, reviews, offers, agency storefronts, campaigns and analytics dashboards, support impersonation.
