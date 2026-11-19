/** LEAD-007 to 011: the enquiry inbox. Agents see their own; administrators see and assign all. */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOrg } from '../../app/guards'
import { ListingRow } from '../../components/listing'
import { useToast } from '../../context/ToastContext'
import type { Enquiry, LeadStatus } from '../../contracts'
import { Button, Card, DataTable, ErrorAlert, ErrorState, Facts, PageHeader, ReasonDialog, Segmented, SelectField, Spinner, StatusPill, ViewingStatus, type Tone } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { formatDateTime, timeAgo } from '../../lib/format'
import { api } from '../../services/api'

export const LEAD_STATUS: Record<LeadStatus, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'info' },
  contacted: { label: 'Contacted', tone: 'neutral' },
  viewing_scheduled: { label: 'Viewing booked', tone: 'success' },
  negotiating: { label: 'Negotiating', tone: 'warning' },
  won: { label: 'Won', tone: 'success' },
  lost: { label: 'Lost', tone: 'neutral' },
}

const LeadPill = ({ s }: { s?: LeadStatus }) => (s ? <StatusPill tone={LEAD_STATUS[s].tone}>{LEAD_STATUS[s].label}</StatusPill> : null)

export function LeadsPage() {
  const { org } = useOrg()
  const navigate = useNavigate()
  const [show, setShow] = useState<'open' | 'all'>('open')
  const { data, error, loading, reload } = useAsync(() => api.portal.leads(org.orgId), [org.orgId])
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const rows = data.filter((e) => show === 'all' || !['won', 'lost'].includes(e.status!))
  return (
    <div>
      <PageHeader title="Enquiries" subtitle={org.role === 'agent' ? 'Enquiries assigned to you.' : 'Every enquiry for your organization.'} />
      <div className="mb-4"><Segmented<'open' | 'all'> label="Show" value={show} onChange={setShow} options={[{ value: 'open', label: 'Open' }, { value: 'all', label: `All (${data.length})` }]} /></div>
      <DataTable<Enquiry>
        rows={rows}
        rowKey={(e) => e.id}
        onRowClick={(e) => navigate(`/portal/leads/${e.id}`)}
        empty="No enquiries yet."
        columns={[
          { header: 'From', cell: (e) => <div><p className="font-semibold">{e.seeker.name}</p><p className="text-xs text-muted">{timeAgo(e.createdAt)}</p></div> },
          { header: 'Listing', cell: (e) => <span className="line-clamp-1">{e.listing.title}</span> },
          { header: 'Status', cell: (e) => <LeadPill s={e.status} /> },
          { header: 'Assigned to', cell: (e) => e.assignee?.name ?? <span className="text-warning-fg">Not assigned</span> },
        ]}
      />
    </div>
  )
}

export function LeadPage() {
  const { id = '' } = useParams()
  const { org } = useOrg()
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(() => api.portal.lead(id), [id])
  const action = useAction()
  const [lostOpen, setLostOpen] = useState(false)
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const { lead, agents, viewings } = data
  const update = (patch: Parameters<typeof api.portal.updateLead>[1], message: string) =>
    void action.run(async () => {
      await api.portal.updateLead(lead.id, patch)
      toast(message)
      reload()
    })

  return (
    <div>
      <Link to="/portal/leads" className="text-sm font-semibold text-brand-700 hover:underline">← Enquiries</Link>
      <PageHeader title={`Enquiry from ${lead.seeker.name}`} subtitle={`Received ${formatDateTime(lead.createdAt)}`} actions={<LeadPill s={lead.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <ListingRow l={lead.listing} to={`/listings/${lead.listing.id}`} />
          <Card title="Message">
            <p className="whitespace-pre-line">{lead.message}</p>
            <Link to={`/portal/messages/${lead.threadId}`} className="mt-4 inline-block rounded-xl bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800">Reply in messages</Link>
          </Card>
          <Card title="Contact">
            <Facts items={[
              { label: 'Name', value: lead.seeker.name },
              { label: 'Prefers', value: { in_app: 'Abode messages', phone: 'A phone call', email: 'Email' }[lead.contactMethod] },
              { label: 'Email', value: lead.seeker.email },
              { label: 'Phone', value: lead.seeker.phone ?? 'Not given' },
            ]} />
          </Card>
          <Card title="Viewings">
            {!viewings.length ? <p className="text-muted">No viewings yet. The seeker can request one from the listing page.</p> : (
              <ul className="divide-y divide-line">
                {viewings.map((v) => (
                  <li key={v.id}>
                    <Link to={`/portal/viewings/${v.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand-700">
                      <span>{v.confirmedSlot ? formatDateTime(v.confirmedSlot) : 'Time not confirmed'}</span>
                      <ViewingStatus state={v.state} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <aside className="space-y-4">
          <Card title="Progress">
            <SelectField
              label="Status"
              value={lead.status}
              placeholder={false}
              disabled={action.busy}
              onChange={(e) => {
                const s = e.target.value as LeadStatus
                if (s === 'lost') setLostOpen(true)
                else update({ status: s }, 'Status updated.')
              }}
              options={(Object.keys(LEAD_STATUS) as LeadStatus[]).map((s) => ({ value: s, label: LEAD_STATUS[s].label }))}
            />
            {lead.lostReason && <p className="mt-2 text-sm text-muted">Lost because: {lead.lostReason}</p>}
            {org.role === 'admin' && (
              <div className="mt-4">
                <SelectField label="Assigned to" value={lead.assignee?.id ?? ''} disabled={action.busy} onChange={(e) => e.target.value && update({ assigneeId: e.target.value }, 'Enquiry reassigned.')} options={agents.map((a) => ({ value: a.id, label: a.name }))} placeholder="Choose someone" hint="Only people with a current licence can take enquiries." />
              </div>
            )}
            {action.error ? <div className="mt-3"><ErrorAlert error={action.error} /></div> : null}
          </Card>
          <Button variant="ghost" className="w-full" onClick={() => update({ status: 'won' }, 'Marked as won.')} disabled={lead.status === 'won'}>Mark as won</Button>
        </aside>
      </div>
      <ReasonDialog open={lostOpen} title="Why was this enquiry lost?" confirmLabel="Mark as lost" reasonLabel="Reason" reasonHint="For example: chose another property, budget too low." minLength={3} onClose={() => setLostOpen(false)} onConfirm={(reason) => api.portal.updateLead(lead.id, { status: 'lost', lostReason: reason }).then(() => { toast('Marked as lost.'); reload() })} />
    </div>
  )
}
