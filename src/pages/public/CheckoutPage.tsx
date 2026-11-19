/**
 * FE-GST-004 to 007: the dates are held while the guest pays. Payment happens
 * in the provider's own form; returning from it always lands on the pending
 * screen, never straight on "confirmed" (BOOK-020).
 */
import { CreditCard, Lock, Smartphone } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../app/auth'
import { ListingRow } from '../../components/listing'
import { MOBILE_MONEY_NETWORKS } from '../../config'
import type { PaymentMethod } from '../../contracts'
import { Alert, Button, Card, Checkbox, DemoNote, ErrorAlert, ErrorState, fieldErrors, HoldCountdown, PageHeader, PriceBreakdown, RadioCards, SelectField, Spinner, TextField } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { formatStay } from '../../lib/dates'
import { plural } from '../../lib/format'
import { api } from '../../services/api'
import { newId } from '../../lib/ids'

export function CheckoutPage() {
  const { holdId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: hold, error, loading, reload } = useAsync(() => api.pub.getHold(holdId), [holdId])
  const [expired, setExpired] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('mobile_money')
  const [network, setNetwork] = useState(MOBILE_MONEY_NETWORKS[0])
  const [account, setAccount] = useState('')
  const [lead, setLead] = useState({ leadName: user?.name ?? '', phone: user?.phone ?? '' })
  const [accept, setAccept] = useState(false)
  // One key per payment attempt: a retry or double click never pays twice (BOOK-017).
  const attemptKey = useRef(newId('idem'))
  const pay = useAction()
  const release = useAction()
  const f = fieldErrors(pay.error)

  if (loading && !hold) return <Spinner />
  if (error || !hold) return <ErrorState error={error} onRetry={reload} />

  if (hold.bookingId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Alert tone="info" title="You’ve already paid for this hold">
          <Link to={`/trips/${hold.bookingId}`} className="font-semibold underline">See your booking</Link>
        </Alert>
      </div>
    )
  }

  if (expired || hold.status !== 'active') {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Alert tone="warning" title="Your hold has ended">
          The dates were released so others can book them. Go back to get a new price; if the dates are still free, you can book them.
        </Alert>
        <Link to={`/listings/${hold.listing.id}?checkIn=${hold.quote.checkIn}&checkOut=${hold.quote.checkOut}&guests=${hold.quote.guests}`} className="mt-4 inline-block font-semibold text-brand-700 hover:underline">
          Back to {hold.listing.title}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader title="Confirm and pay" />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            void pay.run(async () => {
              const r = await api.pub.pay(hold.id, { method, network, account, guests: lead, acceptTerms: accept, idempotencyKey: attemptKey.current })
              navigate(`/trips/${r.bookingId}`, { replace: true })
            })
          }}
        >
          <HoldCountdown remainingSeconds={hold.remainingSeconds} onExpire={() => setExpired(true)} />

          <Card title="Who’s staying">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Lead guest’s full name" value={lead.leadName} onChange={(e) => setLead({ ...lead, leadName: e.target.value })} error={f.leadName} />
              <TextField label="Phone for the host" type="tel" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} hint="Shared with the host once you’re confirmed." />
            </div>
          </Card>

          <Card title="How you’ll pay">
            <RadioCards
              label="Payment method"
              value={method}
              onChange={(m) => { setMethod(m); setAccount('') }}
              columns={2}
              options={[
                { value: 'mobile_money', label: 'Mobile money', hint: 'Approve on your phone' },
                { value: 'card', label: 'Card', hint: 'Visa or Mastercard' },
              ]}
            />
            <div className="mt-5 rounded-2xl border-2 border-dashed border-line p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
                <Lock className="size-3.5" aria-hidden /> Secure form from the payment provider (test)
              </p>
              {method === 'mobile_money' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Network" value={network} onChange={(e) => setNetwork(e.target.value)} options={MOBILE_MONEY_NETWORKS} placeholder={false} />
                  <TextField label="Mobile money number" type="tel" inputMode="tel" placeholder="024 123 4567" value={account} onChange={(e) => setAccount(e.target.value)} error={f.account} />
                  <p className="flex items-start gap-2 text-sm text-muted sm:col-span-2">
                    <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden /> You’ll get a prompt on this phone to approve the payment with your PIN.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField label="Card number" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={account} onChange={(e) => setAccount(e.target.value)} error={f.account} className="sm:col-span-3" />
                  <TextField label="Expiry" placeholder="MM/YY" autoComplete="cc-exp" />
                  <TextField label="Security code" placeholder="123" autoComplete="cc-csc" />
                  <CreditCard className="hidden size-8 self-end text-muted sm:block" aria-hidden />
                </div>
              )}
            </div>
            <div className="mt-4">
              <DemoNote>
                {method === 'mobile_money' ? (
                  <>Any number works. Ending in <b>0000</b> fails; ending in <b>1111</b> leaves the payment for Abode finance to check.</>
                ) : (
                  <>Any card number works. <b>4000 0000 0000 0002</b> is declined.</>
                )}
              </DemoNote>
            </div>
          </Card>

          <Checkbox label={<>I agree to the house rules, the cancellation policy and Abode’s booking terms.</>} checked={accept} onChange={(e) => setAccept(e.target.checked)} error={f.acceptTerms} />
          {pay.error && !Object.keys(f).length ? <ErrorAlert error={pay.error} /> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" size="lg" loading={pay.busy}>
              Pay {method === 'mobile_money' ? 'with mobile money' : 'by card'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              loading={release.busy}
              onClick={() => void release.run(async () => {
                await api.pub.releaseHold(hold.id)
                navigate(`/listings/${hold.listing.id}`)
              })}
            >
              Release these dates
            </Button>
          </div>
        </form>

        <aside className="space-y-4">
          <ListingRow l={hold.listing} />
          <Card>
            <p className="font-semibold">{formatStay(hold.quote.checkIn, hold.quote.checkOut)}</p>
            <p className="text-sm text-muted">{plural(hold.quote.guests, 'guest')}</p>
            <div className="mt-4">
              <PriceBreakdown lines={hold.quote.lines} total={hold.quote.total} />
            </div>
            <p className="mt-3 text-xs text-muted">{hold.quote.cancellationText}</p>
          </Card>
        </aside>
      </div>
    </div>
  )
}
