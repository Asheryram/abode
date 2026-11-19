/** PAY-034, PAY-044, PAY-052: reconciliation, refunds and payouts under the two-person rule. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/auth'
import { useToast } from '../../context/ToastContext'
import type { Payout, ReconciliationItem } from '../../contracts'
import { Alert, Button, DataTable, ErrorState, Money, PageHeader, ReasonDialog, Spinner, StatusPill, type Tone } from '../../design-system'
import { useAsync } from '../../hooks/useAsync'
import { formatDate } from '../../lib/format'
import { api } from '../../services/api'

const ISSUE: Record<ReconciliationItem['issue'], string> = {
  payment_unmatched: 'Payment not matched',
  payment_pending_long: 'Payment pending too long',
  refund_pending: 'Refund to send',
}

const PAYOUT: Record<Payout['state'], { label: string; tone: Tone }> = {
  pending_approval: { label: 'Needs second approval', tone: 'warning' },
  approved: { label: 'Approved, not sent', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

type ReconAction = 'confirm_payment' | 'fail_payment' | 'settle_refund'
type PayoutAction = 'approve' | 'reject' | 'mark_paid'

export function FinancePage() {
  const { user } = useAuth()
  const toast = useToast()
  const recon = useAsync(() => api.admin.reconciliation(), [])
  const payouts = useAsync(() => api.admin.payouts(), [])
  const [reconAct, setReconAct] = useState<{ item: ReconciliationItem; action: ReconAction } | null>(null)
  const [payAct, setPayAct] = useState<{ p: Payout; action: PayoutAction } | null>(null)
  if ((recon.loading && !recon.data) || (payouts.loading && !payouts.data)) return <Spinner />
  if (recon.error || payouts.error) return <ErrorState error={recon.error ?? payouts.error} />
  const canAct = ['finance_operator', 'platform_admin'].includes(user!.staffRole!)
  const open = recon.data!.filter((r) => !r.resolved)

  return (
    <div className="space-y-10">
      <section>
        <PageHeader title="Reconciliation" subtitle="Payments and refunds where our records and the provider’s don’t agree yet." />
        <DataTable<ReconciliationItem>
          rows={open}
          rowKey={(r) => r.id}
          empty="Everything matches."
          columns={[
            { header: 'Booking', cell: (r) => <span className="font-mono">{r.bookingRef}</span> },
            { header: 'Issue', cell: (r) => <StatusPill tone={r.issue === 'refund_pending' ? 'info' : 'warning'}>{ISSUE[r.issue]}</StatusPill> },
            { header: 'Amount', cell: (r) => <Money amount={r.amount} className="font-semibold" /> },
            { header: 'Age', cell: (r) => <span className={r.ageHours > 24 ? 'font-semibold text-danger-fg' : ''}>{r.ageHours < 1 ? 'Under 1 h' : `${r.ageHours} h`}</span> },
            {
              header: '',
              cell: (r) =>
                canAct ? (
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {r.issue === 'refund_pending' ? (
                      <Button size="sm" onClick={() => setReconAct({ item: r, action: 'settle_refund' })}>Mark refund sent</Button>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => setReconAct({ item: r, action: 'confirm_payment' })}>Payment received</Button>
                        <Button size="sm" variant="secondary" onClick={() => setReconAct({ item: r, action: 'fail_payment' })}>Not received</Button>
                      </>
                    )}
                  </div>
                ) : null,
            },
          ]}
        />
      </section>

      <section>
        <PageHeader title="Payouts" subtitle="Money owed to hosts and owners. The person who creates a payout can’t approve it." />
        <div className="mb-4">
          <Alert tone="info" title="Two-person rule">
            Kojo Mensah created the waiting payout. Sign in as Nana Ama Boakye (the second finance operator) to approve it. <Link to="/login" className="font-semibold underline">Switch account</Link>
          </Alert>
        </div>
        <DataTable<Payout>
          rows={payouts.data!}
          rowKey={(p) => p.id}
          columns={[
            { header: 'To', cell: (p) => <span className="font-semibold">{p.orgName}</span> },
            { header: 'For', cell: (p) => p.bookingRefs.join(', ') },
            { header: 'Amount', cell: (p) => <Money amount={p.amount} className="font-semibold" /> },
            { header: 'Created', cell: (p) => <span>{formatDate(p.createdAt)}<span className="block text-xs text-muted">by {p.createdBy}{p.createdById === user!.id ? ' (you)' : ''}</span></span> },
            { header: 'Status', cell: (p) => <span><StatusPill tone={PAYOUT[p.state].tone}>{PAYOUT[p.state].label}</StatusPill>{p.approvedBy && <span className="block text-xs text-muted">approved by {p.approvedBy}</span>}</span> },
            {
              header: '',
              cell: (p) =>
                canAct ? (
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {p.state === 'pending_approval' && <Button size="sm" onClick={() => setPayAct({ p, action: 'approve' })}>Approve</Button>}
                    {p.state === 'pending_approval' && <Button size="sm" variant="ghost" onClick={() => setPayAct({ p, action: 'reject' })}>Reject</Button>}
                    {p.state === 'approved' && <Button size="sm" onClick={() => setPayAct({ p, action: 'mark_paid' })}>Mark as paid</Button>}
                  </div>
                ) : null,
            },
          ]}
        />
      </section>

      <ReasonDialog
        open={!!reconAct}
        title={{ confirm_payment: 'Confirm payment received', fail_payment: 'Mark payment as not received', settle_refund: 'Mark refund as sent' }[reconAct?.action ?? 'confirm_payment']}
        body={reconAct?.action === 'fail_payment' ? 'The booking is cancelled and the guest is told.' : reconAct?.action === 'confirm_payment' ? 'The booking is confirmed and the guest is told.' : 'The guest is told their refund has been paid.'}
        reasonLabel="Provider reference or note"
        danger={reconAct?.action === 'fail_payment'}
        confirmLabel="Confirm"
        onClose={() => setReconAct(null)}
        onConfirm={async (reason) => {
          await api.admin.resolveRecon(reconAct!.item.id, reconAct!.action, reason)
          toast('Recorded.')
          recon.reload()
        }}
      />
      <ReasonDialog
        open={!!payAct}
        title={{ approve: 'Approve payout', reject: 'Reject payout', mark_paid: 'Mark payout as paid' }[payAct?.action ?? 'approve']}
        body={payAct ? <>Payout to {payAct.p.orgName} for <Money amount={payAct.p.amount} />.</> : undefined}
        reasonLabel={payAct?.action === 'reject' ? 'Reason' : 'Note (optional)'}
        minLength={payAct?.action === 'reject' ? 5 : 0}
        danger={payAct?.action === 'reject'}
        confirmLabel="Confirm"
        onClose={() => setPayAct(null)}
        onConfirm={async (reason) => {
          await api.admin.decidePayout(payAct!.p.id, payAct!.action, reason)
          toast('Payout updated.')
          payouts.reload()
        }}
      />
    </div>
  )
}
