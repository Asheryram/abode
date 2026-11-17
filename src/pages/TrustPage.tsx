/**
 * Public page explaining each trust badge (TRU-022, TRU-023, FE-PUB-010).
 * [COUNSEL] All copy below is placeholder. Final wording must come from
 * counsel before launch (LEG-018, LEG-023). Do not edit it into final copy.
 */
import { TrustBadge } from '../design-system'

const TODAY = new Date().toISOString().slice(0, 10)

const BADGES = [
  {
    kind: 'agency' as const,
    means: '[COUNSEL] We checked that this agency holds a current licence and has authority to market this property.',
    notMeans: '[COUNSEL] It is not a guarantee of the property, the price or the outcome of any deal.',
  },
  {
    kind: 'owner' as const,
    means: '[COUNSEL] We checked evidence that the person listing owns this property or is authorised by the owner.',
    notMeans: '[COUNSEL] The owner is not a licensed agent. It is not a guarantee of the property or the price.',
  },
  {
    kind: 'unverified' as const,
    means: '[COUNSEL] We have not completed checks on this lister, or an earlier check has expired.',
    notMeans: '[COUNSEL] It does not mean the listing is fraudulent.',
  },
]

export default function TrustPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold">What our badges mean</h1>
      <p className="mt-2 text-muted">[COUNSEL] Placeholder introduction pending legal review.</p>
      <div className="mt-8 space-y-6">
        {BADGES.map((b) => (
          <section key={b.kind} className="rounded-2xl border border-line bg-white p-6">
            <TrustBadge verification={{ kind: b.kind, validUntil: '9999-12-31' }} today={TODAY} />
            <p className="mt-4">{b.means}</p>
            <p className="mt-2 text-sm text-muted">{b.notMeans}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
