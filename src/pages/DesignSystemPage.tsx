/**
 * Living reference for the design system: every token and component, in
 * every state. Internal tool, not linked from the product navigation.
 * Text here is demo content, so it is exempt from the string catalogue rule.
 */
import { Inbox } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import {
  Alert,
  Badge,
  BookingStatus,
  Button,
  Counter,
  EmptyState,
  EnvironmentBanner,
  ErrorState,
  EtaRange,
  HoldCountdown,
  ListingStatusPill,
  LocationFreshness,
  PriceBreakdown,
  PriceTag,
  PromotedLabel,
  RefundStatus,
  SelectField,
  SharingBanner,
  TextField,
  TrustBadge,
  ViewingStatus,
  type MoneyAmount,
} from '../design-system'

const ghs = (amountMinor: number): MoneyAmount => ({ amountMinor, currency: 'GHS' })
const TODAY = '2026-11-17'

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="text-xl font-bold">{title}</h2>
      {note && <p className="mt-1 max-w-2xl text-sm text-muted">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

const Row = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-3">{children}</div>

const SWATCHES: [string, string][] = [
  ['brand-700', 'Primary actions, links'],
  ['ink', 'Body text'],
  ['muted', 'Secondary text'],
  ['line', 'Borders, dividers'],
  ['canvas', 'Page background'],
  ['accent-500', 'Highlights (surface only)'],
  ['success-fg', 'Success'],
  ['warning-fg', 'Warning, stale'],
  ['danger-solid', 'Danger, destructive'],
  ['info-fg', 'Information'],
  ['promoted-bg', 'Paid placement'],
  ['live', 'Live location'],
]

export default function DesignSystemPage() {
  const [guests, setGuests] = useState(2)
  const [holdKey, setHoldKey] = useState(0)
  const [sharing, setSharing] = useState(true)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      <header className="py-10">
        <p className="text-sm font-semibold text-brand-700">Abode</p>
        <h1 className="mt-1 text-3xl font-bold">Design system</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Every screen is built from these parts. Rules for using them are in <code>docs/design-system.md</code>. Import
          from <code>src/design-system</code>.
        </p>
      </header>

      <Section title="Colour tokens" note="Use the semantic name, never a raw hex value. Every text pair passes WCAG AA (npm run check:contrast).">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {SWATCHES.map(([token, use]) => (
            <div key={token} className="overflow-hidden rounded-xl border border-line bg-white">
              <div className="h-14" style={{ background: `var(--color-${token})` }} />
              <div className="p-3">
                <p className="font-mono text-xs font-semibold">{token}</p>
                <p className="text-xs text-muted">{use}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography" note="Plus Jakarta Sans. Sizes come from the Tailwind scale; these are the ones in use.">
        <div className="space-y-3">
          <p className="text-3xl font-bold">Page title · 3xl bold</p>
          <p className="text-xl font-bold">Section title · xl bold</p>
          <p className="text-lg font-semibold">Card title · lg semibold</p>
          <p className="text-[15px]">Body · 15px regular. Most reading text on the site.</p>
          <p className="text-sm text-muted">Secondary · sm muted</p>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Label · xs semibold caps</p>
        </div>
      </Section>

      <Section title="Buttons" note="One primary button per screen. Danger only for actions that destroy or cancel something.">
        <div className="space-y-4">
          <Row>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="dark">Dark</Button>
            <Button variant="danger">Cancel booking</Button>
          </Row>
          <Row>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </Row>
        </div>
      </Section>

      <Section title="Form fields" note="Every field has a visible label. Errors appear under the field and are announced.">
        <div className="grid max-w-xl gap-5">
          <TextField label="Full name" placeholder="Ama Mensah" />
          <TextField label="Email" hint="We send booking confirmations here." defaultValue="ama@example.com" />
          <TextField label="Password" type="password" error="Use at least 12 characters." defaultValue="short" />
          <SelectField label="Region" options={['Greater Accra', 'Ashanti', 'Central']} />
          <div className="rounded-xl border border-line bg-white px-4">
            <Counter label="Guests" hint="Ages 13 or above" value={guests} min={1} max={8} onChange={setGuests} />
          </div>
        </div>
      </Section>

      <Section
        title="Prices"
        note="Money arrives from the API as integer minor units. The client never adds it up: the breakdown shows the server's lines and the server's total."
      >
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <PriceTag amount={ghs(45000)} basis="per_night" size="lg" />
            <div>
              <PriceTag amount={ghs(850000)} basis="per_month" />
            </div>
            <div>
              <PriceTag amount={ghs(9600000)} basis="per_annum" />
            </div>
            <div>
              <PriceTag amount={ghs(120000000)} basis="total" />
            </div>
            <div>
              <PriceTag amount={ghs(32000)} basis="per_sqm_per_annum" />
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <PriceBreakdown
              lines={[
                { label: 'GH₵450.00 × 3 nights', amount: ghs(135000), kind: 'charge' },
                { label: 'Cleaning fee', amount: ghs(15000), kind: 'charge' },
                { label: 'Service fee', amount: ghs(15000), kind: 'charge' },
                { label: 'VAT and levies', amount: ghs(9900), kind: 'tax' },
              ]}
              total={ghs(174900)}
            />
          </div>
        </div>
      </Section>

      <Section title="Trust and paid placement" note="Badges come only from the API's verification summary. An expired verification shows as Not verified. Promoted cannot be hidden.">
        <Row>
          <TrustBadge verification={{ kind: 'agency', validUntil: '2027-06-30' }} today={TODAY} />
          <TrustBadge verification={{ kind: 'owner', validUntil: '2027-06-30' }} today={TODAY} />
          <TrustBadge verification={{ kind: 'unverified' }} today={TODAY} />
          <TrustBadge verification={{ kind: 'agency', validUntil: '2026-10-01' }} today={TODAY} />
          <span className="text-xs text-muted">← agency badge that expired 1 Oct</span>
          <PromotedLabel />
        </Row>
      </Section>

      <Section title="Status" note="Each state has one label and one tone, everywhere it appears.">
        <div className="space-y-3">
          <Row>
            <BookingStatus state="pending_payment" />
            <BookingStatus state="confirmed" />
            <BookingStatus state="in_stay" />
            <BookingStatus state="completed" />
            <BookingStatus state="cancelled_by_host" />
            <BookingStatus state="disputed" />
          </Row>
          <Row>
            <ListingStatusPill state="draft" />
            <ListingStatusPill state="in_review" />
            <ListingStatusPill state="published" />
            <ListingStatusPill state="paused" />
            <ListingStatusPill state="withdrawn" />
          </Row>
          <Row>
            <ViewingStatus state="requested" />
            <ViewingStatus state="confirmed" />
            <ViewingStatus state="agent_en_route" />
            <ViewingStatus state="completed" />
          </Row>
          <Row>
            <RefundStatus settled={false} />
            <RefundStatus settled />
          </Row>
          <Row>
            <Badge>Neutral badge</Badge>
            <Badge tone="green">Green badge</Badge>
            <Badge tone="amber">Amber badge</Badge>
            <Badge tone="red">Red badge</Badge>
          </Row>
        </div>
      </Section>

      <Section title="Alerts" note="Danger alerts interrupt screen readers; the rest wait. Errors from the API show the support reference.">
        <div className="grid max-w-2xl gap-3">
          <Alert tone="info" title="Check-in is from 14:00 GMT">The host will message you directions the day before.</Alert>
          <Alert tone="success" title="Booking confirmed">Reference AB-7KQ2-M9. We sent the details to your email.</Alert>
          <Alert tone="warning" title="Your listing expires in 5 days">Renew it to keep it in search.</Alert>
          <Alert tone="danger" title="We couldn't save your changes" reference="c0ffee12-4b7a">
            Try again. If it keeps happening, contact support with this reference.
          </Alert>
        </div>
      </Section>

      <Section title="Hold countdown" note="Counts down from the time the API returned. Turns amber under 2 minutes. Screen readers hear it only at 5-minute steps, then 2 and 1 minute.">
        <div className="max-w-sm space-y-3">
          <HoldCountdown key={holdKey} remainingSeconds={125} />
          <Button variant="secondary" size="sm" onClick={() => setHoldKey((k) => k + 1)}>
            Restart demo
          </Button>
        </div>
      </Section>

      <Section title="Live location" note="Every position shows its age. Old positions are marked stale. When location is off, the screen says so and falls back to status updates.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
            <LocationFreshness ageSeconds={12} />
            <LocationFreshness ageSeconds={20} lowAccuracy />
            <LocationFreshness ageSeconds={240} />
            <LocationFreshness ageSeconds={null} />
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <EtaRange minMinutes={12} maxMinutes={18} basis="current traffic" />
          </div>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-line">
          {sharing ? (
            <SharingBanner visibleTo={['Ama Mensah']} stopsAt="15:40 GMT" onStop={() => setSharing(false)} />
          ) : (
            <div className="flex items-center justify-between gap-3 bg-white p-4 text-sm">
              <span>Sharing stopped.</span>
              <Button size="sm" variant="secondary" onClick={() => setSharing(true)}>
                Show banner again
              </Button>
            </div>
          )}
        </div>
      </Section>

      <Section title="Back-office environment banner" note="Shown on every back-office page outside production. It has no close button.">
        <div className="overflow-hidden rounded-2xl border border-line">
          <EnvironmentBanner environment="staging" paymentMode="sandbox" />
        </div>
      </Section>

      <Section title="Empty and error states">
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState icon={Inbox} title="No enquiries yet" body="When someone asks about a listing, it appears here." />
          <div className="rounded-2xl border border-line bg-white">
            <ErrorState error={new Error('Something went wrong loading your trips.')} onRetry={() => {}} />
          </div>
        </div>
      </Section>
    </div>
  )
}
