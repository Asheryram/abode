# Abode design system

Every screen is built from the parts in `src/design-system`. See them live at `/design-system` (run `npm run dev`).

This document is for people and coding agents. Its rules come from the frontend specification (FE-SRS), whose IDs are cited in brackets.

## The five rules

1. **Import UI only from `src/design-system`.** No one-off buttons, badges or alerts in feature code. If a part is missing, ask the design-system owner to add it; do not build it inside a page.
2. **Use semantic colour tokens, never raw values.** Write `bg-danger-bg text-danger-fg`, not `bg-red-50 text-red-800` or a hex code. Raw values live only in `src/styles/tokens.css`.
3. **Never format or calculate money yourself.** Use `Money`, `PriceTag` and `PriceBreakdown`. They take integer minor units from the API and do no arithmetic (FE-GLB-001, FE-GLB-004).
4. **No hard-coded user-facing text in the design system.** Component text lives in `src/design-system/strings.ts` (FE-GLB-022). Legal or disclaimer wording is marked `[COUNSEL]` and is never written by an agent.
5. **Accessibility is part of the component, not an extra.** Keep visible labels, focus styles, `aria-live` behaviour and contrast. `npm run check:contrast` must pass (FE-NFR-004).

## Who may change what

| Area | Owner | Others may |
| --- | --- | --- |
| `src/styles/tokens.css` | Design-system owner | Read only |
| `src/design-system/*` | Design-system owner | Use; request changes |
| `src/pages/*`, feature components | Implementers | Compose design-system parts |

A change to a token or component needs: the reference page updated, `npm run check` passing, and before/after screenshots in the pull request.

## Changing the look

All colours and the font live in one file: `src/styles/tokens.css`.

- **Brand colour:** change the `--color-brand-*` scale. `brand-700` is buttons and links.
- **Highlight colour:** change the `--color-accent-*` scale.
- **Font:** change `--font-sans`, and the Google Fonts link in `index.html`.
- Then run `npm run check:contrast` to confirm text is still readable.

Product words (intents, property types, regions, role names) live in `src/config.ts`. Component wording lives in `src/design-system/strings.ts`.

## Tokens

| Group | Tokens | Use for |
| --- | --- | --- |
| Brand | `brand-50` … `brand-900` (primary `brand-700`) | Primary actions, links, brand surfaces |
| Accent | `accent-100` … `accent-700` | Highlights and surfaces only. Never as text on white or on `accent-100` |
| Neutrals | `ink`, `muted`, `line`, `canvas` | Text, secondary text, borders, page background |
| Status | `success-*`, `warning-*`, `danger-*`, `info-*`, `neutral-*` (each `-bg`, `-fg`, `-border`; plus `danger-solid`) | Meaning: confirmed, attention, failure or destructive, information |
| Marketplace | `promoted-*`, `trust-agency-*`, `trust-owner-*`, `live`, `stale` | Paid placement, trust badges, live location |

Adding a token that carries text means adding its pair to `scripts/check-contrast.mjs`.

Type is Plus Jakarta Sans, using the Tailwind scale: page title `text-3xl font-bold`, section `text-xl font-bold`, card `text-lg font-semibold`, body `text-[15px]`, secondary `text-sm text-muted`, label `text-xs font-semibold uppercase tracking-wide`.

## Components

### Basics (`primitives.tsx`)

`Button` (primary, secondary, ghost, dark, danger; sm, md, lg; `loading`), `TextField`, `TextArea`, `SelectField`, `Counter`, `Modal`, `ConfirmDialog`, `Badge`, `Avatar`, `Spinner`, `EmptyState`, `ErrorState`, `InlineError`, `BackLink`.

- One primary button per screen. `danger` only for actions that destroy or cancel.
- Set `loading` while a request is in flight; it also disables the button, which prevents double submits (FE-GLB-011).
- Every field has a visible `label`. Pass `error` to show and announce a field error.

### Money and prices (`marketplace.tsx`, `money.ts`)

| Component | Use | Rule |
| --- | --- | --- |
| `Money` | Any amount | Takes `{ amountMinor, currency }`. Throws if the amount is not an integer |
| `PriceTag` | Headline price on cards and listings | `basis` is required, so no price appears without "per night", "per month" and so on (FE-GLB-003) |
| `PriceBreakdown` | Quote, checkout, receipt | Shows the server's lines and the server's total. Taxes listed separately. Never sums the lines |

### Trust and paid placement

- `TrustBadge`: pass the API's verification summary and today's date in the property's calendar. Expired verification shows as "Not verified" (TRU-024). Each badge links to `/trust`.
- `PromotedLabel`: required on every paid placement (FE-GLB-006). It has no prop to hide it. Do not hide it with layout or CSS.

### Status

`BookingStatus`, `ListingStatusPill`, `ViewingStatus` and `RefundStatus` map each state to one label and one tone. Use them instead of building pills by hand. `StatusPill` is the generic base for new state sets. Pending and settled refunds always look different (FE-GLB-020).

### Live and time-sensitive (`live.tsx`)

- `HoldCountdown`: pass `remainingSeconds` exactly as the API returned it. It counts with a monotonic clock, turns amber under 2 minutes, and tells screen readers only at 5-minute steps, then 2 and 1 minute.
- `LocationFreshness`: shows the age of the last position, marks it stale past the threshold, flags low accuracy, and states when live location is unavailable (TRK-031 to TRK-034).
- `EtaRange`: always a range with its basis, never a single time (TRK-033).
- `SharingBanner`: must be on every screen while the user shares location: who can see it, when it stops, and a stop button (TRK-023).

### Page structure and forms (`layout.tsx`)

`PageHeader`, `Card`, `Stat`, `TabLinks`, `Segmented`, `Checkbox`, `RadioCards`, `Facts`, `DataTable` (a table on wide screens, stacked cards on phones), `ErrorAlert`, `ReasonDialog` and `DemoNote`.

- `ReasonDialog` is required for any privileged or consequential action. The reason goes to the audit log (ADM-004).
- `DemoNote` marks test-only hints, such as test codes. Remove these when the real backend arrives.

### Feedback (`feedback.tsx`)

- `Alert`: info, success, warning, danger. Pass `reference` with the API correlation ID on errors so support can trace them (FE-GLB-010).
- `EnvironmentBanner`: back office only. Shows on every page unless production with live payments. No close button (ADM-033).

## Checks

| Command | What it checks |
| --- | --- |
| `npm run check:contrast` | Every text and background token pair against WCAG 2.2 AA |
| `npm test` | Money formatting, trust expiry, countdown timing, location freshness |
| `npm run check` | Lint, contrast, tests and build together. Run before every pull request |
