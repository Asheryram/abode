/** Host bookings, host cancellation, payouts and the payout account. */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOrg } from '../../app/guards'
import { ListingRow } from '../../components/listing'
import { useToast } from '../../context/ToastContext'
import type { Booking, Payout } from '../../contracts'
import { Alert, BookingStatus, Button, Card, DataTable, ErrorAlert, ErrorState, Facts, fieldErrors, Modal, Money, PageHeader, PriceBreakdown, RadioCards, ReasonDialog, RefundStatus, SelectField, Spinner, StatusPill, TextField } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { formatStay, today } from '../../lib/dates'
import { formatDate, formatDateTime, plural } from '../../lib/format'
import { MOBILE_MONEY_NETWORKS } from '../../config'
import { api } from '../../services/api'

export function BookingsPage() {
  const { org } = useOrg()
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsync(() => api.portal.bookings(org.orgId), [org.orgId])
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const upcoming = data.filter((b) => b.checkOut >= today() && !b.state.startsWith('cancelled'))
  const other = data.filter((b) => !upcoming.includes(b))
  const table = (rows: Booking[]) => (
    <DataTable<Booking>
      rows={rows}
      rowKey={(b) => b.id}
      onRowClick={(b) => navigate(`/portal/bookings/${b.id}`)}
      empty="No bookings."
      columns={[
        { header: 'Dates', cell: (b) => <span className="font-semibold">{formatStay(b.checkIn, b.checkOut)}</span> },
        { header: 'Guest', cell: (b) => b.guest.name },
        { header: 'Listing', cell: (b) => <span className="line-clamp-1">{b.listing.title}</span> },
        { header: 'Total', cell: (b) => <Money amount={b.total} /> },
        { header: 'Status', cell: (b) => <BookingStatus state={b.state} /> },
      ]}
    />
  )
  return (
    <div>
      <PageHeader title="Bookings" />
      <section className="mb-8"><h2 className="mb-3 text-lg font-semibold">Upcoming</h2>{table(upcoming)}</section>
      <section><h2 className="mb-3 text-lg font-semibold">Past and cancelled</h2>{table(other)}</section>
    </div>
  )
}

export function BookingPage() {
  const { id = '' } = useParams()
  const { org } = useOrg()
  const toast = useToast()
  const { data: b, error, loading, reload } = useAsync(() => api.pub.booking(id), [id])
  const [cancelOpen, setCancelOpen] = useState(false)
  if (loading && !b) return <Spinner />
  if (error || !b) return <ErrorState error={error} onRetry={reload} />
  return (
    <div>
      <Link to="/portal/bookings" className="text-sm font-semibold text-brand-700 hover:underline">← Bookings</Link>
      <PageHeader title={`Booking ${b.reference}`} subtitle={b.listing.title} actions={<BookingStatus state={b.state} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <ListingRow l={b.listing} />
          <Card title="Guest and stay">
            <Facts items={[
              { label: 'Guest', value: b.guest.name },
              { label: 'Contact', value: <>{b.guest.email}{b.guest.phone && <span className="block">{b.guest.phone}</span>}</> },
              { label: 'Dates', value: formatStay(b.checkIn, b.checkOut) },
              { label: 'Guests', value: plural(b.guests, 'guest') },
              { label: 'Payment', value: `${b.payment.label} · ${b.payment.status}` },
              { label: 'Booked', value: formatDateTime(b.createdAt) },
            ]} />
          </Card>
          {b.cancelReason && <Alert tone="warning" title="Cancelled">{b.cancelReason}</Alert>}
          {b.refund && (
            <Card title="Refund to guest" actions={<RefundStatus settled={b.refund.settled} />}>
              <PriceBreakdown lines={b.refund.lines} total={b.refund.total} note="Abode finance sends the refund." />
            </Card>
          )}
          {org.role === 'admin' && b.state === 'confirmed' && b.checkIn > today() && (
            <Card title="Need to cancel?">
              <p className="text-muted">The guest gets a full refund, and cancellations affect your listing’s ranking. Only cancel if you really can’t host.</p>
              <Button variant="danger" className="mt-4" onClick={() => setCancelOpen(true)}>Cancel this booking</Button>
            </Card>
          )}
        </div>
        <aside>
          <Card title="What the guest paid">
            <PriceBreakdown lines={b.lines} total={b.total} note="Your payout is the stay and cleaning fee, less Abode’s host commission." />
          </Card>
        </aside>
      </div>
      <ReasonDialog
        open={cancelOpen}
        title="Cancel this booking?"
        body={`${b.guest.name} will get a full refund of the amount they paid.`}
        confirmLabel="Cancel booking"
        danger
        reasonLabel="Message to the guest"
        reasonHint="At least 10 characters. The guest will see this."
        minLength={10}
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          await api.portal.hostCancel(b.id, reason)
          toast('Booking cancelled. The guest has been told.')
          reload()
        }}
      />
    </div>
  )
}

const PAYOUT_TONE: Record<Payout['state'], { label: string; tone: 'info' | 'success' | 'danger' | 'neutral' }> = {
  pending_approval: { label: 'Being checked', tone: 'info' },
  approved: { label: 'Approved', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
  rejected: { label: 'Held back', tone: 'danger' },
}

export function PayoutsPage() {
  const { org } = useOrg()
  const info = useAsync(() => api.portal.org(org.orgId), [org.orgId])
  const payouts = useAsync(() => api.portal.payouts(org.orgId), [org.orgId])
  const [open, setOpen] = useState(false)
  if ((info.loading && !info.data) || (payouts.loading && !payouts.data)) return <Spinner />
  if (info.error || payouts.error) return <ErrorState error={info.error ?? payouts.error} />
  const ben = info.data!.beneficiary
  const cooling = ben?.coolingOffUntil && Date.parse(ben.coolingOffUntil) > Date.now()
  return (
    <div>
      <PageHeader title="Payouts" subtitle="Abode pays out after each stay, once our finance team has checked it." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <DataTable<Payout>
          rows={payouts.data!}
          rowKey={(p) => p.id}
          empty="No payouts yet."
          columns={[
            { header: 'Created', cell: (p) => formatDate(p.createdAt) },
            { header: 'Bookings', cell: (p) => p.bookingRefs.join(', ') },
            { header: 'Amount', cell: (p) => <Money amount={p.amount} className="font-semibold" /> },
            { header: 'Status', cell: (p) => <StatusPill tone={PAYOUT_TONE[p.state].tone}>{PAYOUT_TONE[p.state].label}</StatusPill> },
          ]}
        />
        <Card title="Payout account">
          {ben ? (
            <Facts columns={1} items={[{ label: 'Method', value: ben.method === 'bank' ? 'Bank transfer' : 'Mobile money' }, { label: 'Provider', value: ben.provider }, { label: 'Account', value: `${ben.accountName} · ${ben.accountNumberMasked}` }]} />
          ) : (
            <p className="text-muted">Add where we should send your money.</p>
          )}
          {cooling && <div className="mt-4"><Alert tone="warning" title="New account">For your security, payouts to this account start on {formatDateTime(ben!.coolingOffUntil!)}.</Alert></div>}
          <Button variant="secondary" className="mt-4 w-full" onClick={() => setOpen(true)}>{ben ? 'Change account' : 'Add account'}</Button>
        </Card>
      </div>
      <BeneficiaryDialog open={open} onClose={() => setOpen(false)} onDone={info.reload} />
    </div>
  )
}

function BeneficiaryDialog({ open, onClose, onDone }: { open: boolean; onClose(): void; onDone(): void }) {
  const { org } = useOrg()
  const toast = useToast()
  const [form, setForm] = useState({ method: 'mobile_money' as 'mobile_money' | 'bank', accountName: '', accountNumber: '', provider: MOBILE_MONEY_NETWORKS[0], password: '' })
  const { busy, error, run } = useAction()
  const f = fieldErrors(error)
  return (
    <Modal open={open} onClose={onClose} title="Payout account">
      <h2 className="text-xl font-bold">Where should we pay you?</h2>
      <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.portal.setBeneficiary(org.orgId, form); toast('Payout account saved.'); onClose(); onDone() }) }}>
        <RadioCards<'mobile_money' | 'bank'> label="Method" value={form.method} columns={2} onChange={(m) => setForm({ ...form, method: m, provider: m === 'bank' ? 'GCB Bank' : MOBILE_MONEY_NETWORKS[0] })} options={[{ value: 'mobile_money', label: 'Mobile money' }, { value: 'bank', label: 'Bank account' }]} />
        <SelectField label={form.method === 'bank' ? 'Bank' : 'Network'} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} options={form.method === 'bank' ? ['GCB Bank', 'Ecobank Ghana', 'Stanbic Bank', 'Fidelity Bank', 'Absa Bank Ghana'] : MOBILE_MONEY_NETWORKS} placeholder={false} />
        <TextField label="Name on the account" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />
        <TextField label={form.method === 'bank' ? 'Account number' : 'Wallet number'} inputMode="numeric" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} error={f.accountNumber} />
        <TextField label="Your password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={f.password} hint="We ask again because this controls where money goes." />
        <p className="text-sm text-muted">A new account waits 48 hours before payouts start, and everyone in your team with finance access is told.</p>
        {error && !Object.keys(f).length ? <ErrorAlert error={error} /> : null}
        <Button type="submit" className="w-full" loading={busy}>Save account</Button>
      </form>
    </Modal>
  )
}
