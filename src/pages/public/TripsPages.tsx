/** FE-GST-007 to 010: pending payment, confirmation, receipts and cancellation with a refund preview. */
import { Luggage, MessageSquare, Smartphone } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ListingRow } from '../../components/listing'
import { useToast } from '../../context/ToastContext'
import type { Booking, RefundPreview } from '../../contracts'
import { Alert, BookingStatus, Button, Card, EmptyState, ErrorAlert, ErrorState, Facts, Modal, Money, PageHeader, PriceBreakdown, RefundStatus, Spinner, TextArea } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { usePoll } from '../../hooks/usePoll'
import { formatLong, formatStay, today } from '../../lib/dates'
import { formatDateTime, plural } from '../../lib/format'
import { api } from '../../services/api'

export function TripsPage() {
  const { data, error, loading, reload } = useAsync(() => api.pub.myBookings(), [])
  if (loading && !data) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const t = today()
  const groups: [string, Booking[]][] = [
    ['Upcoming', data!.filter((b) => ['confirmed', 'pending_payment', 'in_stay'].includes(b.state) && b.checkOut >= t)],
    ['Past', data!.filter((b) => b.state === 'completed' || (b.state === 'confirmed' && b.checkOut < t))],
    ['Cancelled', data!.filter((b) => b.state.startsWith('cancelled') || b.state === 'no_show')],
  ]
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader title="Trips and bookings" />
      {!data!.length && <EmptyState icon={Luggage} title="No trips yet" body="When you book a short stay, it appears here." action={<Link to="/search?intent=short_stay" className="font-semibold text-brand-700 hover:underline">Find a place to stay</Link>} />}
      <div className="space-y-8">
        {groups.filter(([, list]) => list.length).map(([label, list]) => (
          <section key={label}>
            <h2 className="mb-3 text-lg font-semibold">{label}</h2>
            <div className="space-y-3">
              {list.map((b) => (
                <ListingRow key={b.id} l={b.listing} to={`/trips/${b.id}`} right={<div className="hidden text-right sm:block"><p className="text-sm font-semibold">{formatStay(b.checkIn, b.checkOut)}</p><div className="mt-1"><BookingStatus state={b.state} /></div></div>} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export function TripPage() {
  const { id = '' } = useParams()
  const { data: b, error, loading, reload } = useAsync(() => api.pub.booking(id), [id])
  const pending = b?.state === 'pending_payment'
  const poll = useCallback(() => reload(), [reload])
  // The provider's answer arrives later; keep asking the server (BOOK-019).
  usePoll(poll, 2000, pending && b?.payment.status === 'pending')
  usePoll(poll, 10_000, pending && b?.payment.status === 'checking')
  const [cancelOpen, setCancelOpen] = useState(false)

  if (loading && !b) return <Spinner />
  if (error || !b) return <ErrorState error={error} onRetry={reload} />

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to="/trips" className="text-sm font-semibold text-brand-700 hover:underline">← All trips</Link>
      <div className="mt-4">
        <PaymentState b={b} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <ListingRow l={b.listing} to={`/listings/${b.listing.id}`} />
          <Card title="Your stay">
            <Facts
              items={[
                { label: 'Booking reference', value: <span className="font-mono">{b.reference}</span> },
                { label: 'Status', value: <BookingStatus state={b.state} /> },
                { label: 'Check-in', value: `${formatLong(b.checkIn)}, from 14:00 GMT` },
                { label: 'Check-out', value: `${formatLong(b.checkOut)}, by 11:00 GMT` },
                { label: 'Guests', value: plural(b.guests, 'guest') },
                { label: 'Address', value: b.fullAddress ?? <span className="text-muted">{b.listing.locationText}. The exact address appears once your booking is confirmed.</span> },
              ]}
            />
          </Card>
          <Card title="Cancellation">
            <p className="text-muted">{b.cancellationText}</p>
            {b.cancelReason && <p className="mt-2">Reason: {b.cancelReason}</p>}
            {b.refund && (
              <div className="mt-4 rounded-xl bg-stone-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">Refund</p>
                  <RefundStatus settled={b.refund.settled} />
                </div>
                <PriceBreakdown lines={b.refund.lines} total={b.refund.total} note={b.refund.settled ? `Paid back on ${formatDateTime(b.refund.settledAt!)}.` : 'Refunds usually reach you within 5 to 10 working days.'} />
              </div>
            )}
            {b.state === 'confirmed' && b.checkIn > today() && (
              <Button variant="secondary" className="mt-4" onClick={() => setCancelOpen(true)}>Cancel booking</Button>
            )}
          </Card>
        </div>
        <aside className="space-y-4">
          <Card title="Receipt">
            <PriceBreakdown lines={b.lines} total={b.total} note={`Paid with ${b.payment.label}. Booked ${formatDateTime(b.createdAt)}.`} />
          </Card>
          <Link to="/messages" className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 font-semibold hover:border-ink/40">
            <MessageSquare className="size-4" aria-hidden /> Message the host
          </Link>
        </aside>
      </div>
      <CancelDialog booking={b} open={cancelOpen} onClose={() => setCancelOpen(false)} onDone={reload} />
    </div>
  )
}

/** The three outcomes the server can report; never inferred from a redirect. */
function PaymentState({ b }: { b: Booking }) {
  if (b.state === 'pending_payment' && b.payment.status === 'pending') {
    return (
      <Alert tone="info" title="Waiting for your payment">
        <p className="flex items-start gap-2">
          <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
          {b.payment.method === 'mobile_money' ? 'Approve the payment on your phone with your PIN. This page updates by itself.' : 'Your bank is confirming the payment. This page updates by itself.'}
        </p>
        <div className="mt-2"><Spinner label="Checking" className="justify-start py-0" /></div>
      </Alert>
    )
  }
  if (b.state === 'pending_payment' && b.payment.status === 'checking') {
    return (
      <Alert tone="warning" title="We’re checking your payment">
        We haven’t had a clear answer from your payment provider yet. Your dates are kept while our finance team checks. You don’t need to pay again. We’ll message you as soon as it’s settled.
      </Alert>
    )
  }
  if (b.payment.status === 'failed') {
    return (
      <Alert tone="danger" title="Payment not completed">
        {b.payment.failureReason} No booking was made and you haven’t been charged.{' '}
        <Link to={`/listings/${b.listing.id}?checkIn=${b.checkIn}&checkOut=${b.checkOut}&guests=${b.guests}`} className="font-semibold underline">Try again with a new price</Link>
      </Alert>
    )
  }
  if (b.state === 'confirmed') {
    return (
      <Alert tone="success" title="Your booking is confirmed">
        Reference <span className="font-mono font-semibold">{b.reference}</span>. We’ve sent the details to {b.guest.email}.
      </Alert>
    )
  }
  return null
}

function CancelDialog({ booking, open, onClose, onDone }: { booking: Booking; open: boolean; onClose(): void; onDone(): void }) {
  const toast = useToast()
  const preview = useAsync<RefundPreview | null>(() => (open ? api.pub.refundPreview(booking.id) : Promise.resolve(null)), [open, booking.id])
  const [reason, setReason] = useState('')
  const { busy, error, run } = useAction()
  return (
    <Modal open={open} onClose={onClose} title="Cancel booking">
      <h2 className="text-xl font-bold">Cancel this booking?</h2>
      <p className="mt-1 text-muted">{booking.listing.title} · {formatStay(booking.checkIn, booking.checkOut)}</p>
      <div className="mt-4">
        {preview.loading && !preview.data ? <Spinner /> : preview.error ? <ErrorAlert error={preview.error} /> : preview.data && (
          <div className="rounded-xl bg-stone-50 p-4">
            <p className="mb-2 font-semibold">You’ll get back <Money amount={preview.data.total} /></p>
            <PriceBreakdown lines={preview.data.lines} total={preview.data.total} note={preview.data.policyText} />
          </div>
        )}
      </div>
      <div className="mt-4">
        <TextArea label="Reason (optional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error ? <div className="mt-4"><ErrorAlert error={error} /></div> : null}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Keep booking</Button>
        <Button variant="danger" loading={busy} disabled={!preview.data} onClick={() => void run(async () => { await api.pub.cancelBooking(booking.id, reason); toast('Booking cancelled. Your refund is on its way.'); onClose(); onDone() })}>Cancel booking</Button>
      </div>
    </Modal>
  )
}
