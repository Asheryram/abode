/** ORG-001 to 021 and TRU-001 to 005: team and licences, organization verification, mandates. */
import { FileText, Upload } from 'lucide-react'
import { useState } from 'react'
import { useOrg } from '../../app/guards'
import { ORG_ROLE_LABEL, orgKindLabel } from '../../config'
import { useToast } from '../../context/ToastContext'
import type { Mandate, Member, OrgRole, VerificationCase, VerificationState } from '../../contracts'
import { Alert, Button, Card, Checkbox, DataTable, ErrorAlert, ErrorState, Facts, fieldErrors, Modal, PageHeader, ReasonDialog, SelectField, Spinner, StatusPill, TextArea, TextField, TrustBadge, type Tone } from '../../design-system'
import { useAuth } from '../../app/auth'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { addDays, today } from '../../lib/dates'
import { formatDate, formatDateTime } from '../../lib/format'
import { api } from '../../services/api'

const ROLE_OPTIONS = (Object.keys(ORG_ROLE_LABEL) as OrgRole[]).map((r) => ({ value: r, label: ORG_ROLE_LABEL[r] }))

export function TeamPage() {
  const { org } = useOrg()
  const { user } = useAuth()
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(() => api.portal.members(org.orgId), [org.orgId])
  const action = useAction()
  const [invite, setInvite] = useState({ email: '', role: 'agent' as OrgRole })
  const [licenceFor, setLicenceFor] = useState<Member | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const t = today()
  const run = (fn: () => Promise<void>, msg: string) => void action.run(async () => { await fn(); toast(msg); reload() })

  return (
    <div>
      <PageHeader title="Team" subtitle="Who can work in this organization, and what they can do." />
      {action.error ? <div className="mb-4"><ErrorAlert error={action.error} /></div> : null}
      <DataTable<Member>
        rows={data.members}
        rowKey={(m) => m.userId}
        columns={[
          { header: 'Person', cell: (m) => <div><p className="font-semibold">{m.name}{m.userId === user?.id && <span className="text-muted"> (you)</span>}</p><p className="text-xs text-muted">{m.email}</p></div> },
          { header: 'Role', cell: (m) => <select aria-label={`Role for ${m.name}`} className="rounded-lg border border-line bg-white px-2 py-1 text-sm" value={m.role} disabled={action.busy} onChange={(e) => run(() => api.portal.changeRole(org.orgId, m.userId, e.target.value as OrgRole), 'Role changed.')}>{ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> },
          { header: 'Licence', cell: (m) => m.role !== 'agent' ? <span className="text-muted">Not needed</span> : !m.licence ? <StatusPill tone="warning">Missing</StatusPill> : m.licence.expiresOn < t ? <StatusPill tone="danger">Expired {formatDate(m.licence.expiresOn)}</StatusPill> : <span className="text-sm">{m.licence.number}<span className="block text-xs text-muted">until {formatDate(m.licence.expiresOn)}</span></span> },
          { header: '', cell: (m) => <div className="flex gap-2 md:justify-end">{m.role === 'agent' && <Button size="sm" variant="secondary" onClick={() => setLicenceFor(m)}>Update licence</Button>}<Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>Remove</Button></div> },
        ]}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Invite someone">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.portal.invite(org.orgId, invite.email, invite.role); setInvite({ ...invite, email: '' }) }, 'Invitation sent.') }}>
            <TextField label="Email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            <SelectField label="Role" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as OrgRole })} options={ROLE_OPTIONS} placeholder={false} hint="Agents need a current licence before they can lead viewings or take enquiries." />
            <Button type="submit" loading={action.busy} disabled={!invite.email}>Send invitation</Button>
          </form>
        </Card>
        <Card title="Waiting to join">
          {!data.invitations.length ? <p className="text-muted">No pending invitations.</p> : (
            <ul className="divide-y divide-line">
              {data.invitations.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span><span className="font-medium">{i.email}</span><span className="block text-xs text-muted">{ORG_ROLE_LABEL[i.role]} · sent {formatDate(i.sentAt)}</span></span>
                  <Button size="sm" variant="ghost" onClick={() => run(() => api.portal.cancelInvite(org.orgId, i.id), 'Invitation cancelled.')}>Cancel</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <LicenceDialog member={licenceFor} onClose={() => setLicenceFor(null)} onDone={reload} />
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remove member">
        <h2 className="text-xl font-bold">Remove {removing?.name}?</h2>
        <p className="mt-2 text-muted">They lose access straight away. Listings assigned to them become unassigned.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>Keep</Button>
          <Button variant="danger" loading={action.busy} onClick={() => { const m = removing!; setRemoving(null); run(() => api.portal.removeMember(org.orgId, m.userId), `${m.name} removed.`) }}>Remove</Button>
        </div>
      </Modal>
    </div>
  )
}

function LicenceDialog({ member, onClose, onDone }: { member: Member | null; onClose(): void; onDone(): void }) {
  const { org } = useOrg()
  const toast = useToast()
  const [number, setNumber] = useState('')
  const [expires, setExpires] = useState(addDays(today(), 365))
  const [file, setFile] = useState('')
  const { busy, error, run } = useAction()
  return (
    <Modal open={!!member} onClose={onClose} title="Update licence">
      <h2 className="text-xl font-bold">Update {member?.name}’s licence</h2>
      <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.portal.submitLicence(org.orgId, member!.userId, number, expires, file); toast('Sent to Abode to check.'); onClose(); onDone() }) }}>
        <TextField label="Licence number" placeholder="GREA/AG/0000" value={number} onChange={(e) => setNumber(e.target.value)} />
        <TextField label="Valid until" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Licence document</span>
          <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')} className="block w-full text-sm" />
        </label>
        <p className="text-sm text-muted">Abode checks the licence before it counts. Their paused listings resume once it’s approved.</p>
        {error ? <ErrorAlert error={error} /> : null}
        <Button type="submit" className="w-full" loading={busy} disabled={!number}>Send for checking</Button>
      </form>
    </Modal>
  )
}

const CASE_TONE: Record<VerificationState, { label: string; tone: Tone }> = {
  submitted: { label: 'Waiting for review', tone: 'info' },
  in_review: { label: 'Being reviewed', tone: 'info' },
  more_info: { label: 'More information needed', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Not approved', tone: 'danger' },
}

export const CaseStatus = ({ state }: { state: VerificationState }) => <StatusPill tone={CASE_TONE[state].tone}>{CASE_TONE[state].label}</StatusPill>

export function OrganizationPage() {
  const { org } = useOrg()
  const toast = useToast()
  const info = useAsync(() => api.portal.org(org.orgId), [org.orgId])
  const cases = useAsync(() => api.portal.verificationCases(org.orgId), [org.orgId])
  const [files, setFiles] = useState<{ name: string; type: string }[]>([])
  const [note, setNote] = useState('')
  const submit = useAction()
  if ((info.loading && !info.data) || (cases.loading && !cases.data)) return <Spinner />
  if (info.error || cases.error) return <ErrorState error={info.error ?? cases.error} />
  const o = info.data!.org
  const orgCase = cases.data!.find((c) => c.subject.kind === 'organization')
  const canSubmit = o.status !== 'active' && (!orgCase || ['more_info', 'rejected'].includes(orgCase.state))

  return (
    <div>
      <PageHeader title="Organization" subtitle={orgKindLabel(o.kind)} actions={<TrustBadge verification={o.verification} today={today()} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Details">
            <Facts items={[
              { label: 'Legal name', value: o.legalName },
              { label: 'Trading name', value: o.tradingName },
              { label: 'Registration number', value: o.registrationNumber ?? 'Not applicable' },
              { label: 'Address', value: `${o.address}, ${o.region}` },
              { label: 'Currency', value: o.baseCurrency },
              { label: 'Status', value: o.status === 'active' ? 'Verified and active' : o.status === 'suspended' ? 'Suspended' : 'Waiting for verification' },
            ]} />
          </Card>
          <Card title="Verification history">
            <DataTable<VerificationCase>
              rows={cases.data!}
              rowKey={(c) => c.id}
              empty="Nothing submitted yet."
              columns={[
                { header: 'What', cell: (c) => <span>{{ organization: 'Organization', agent_licence: 'Agent licence', ownership: 'Ownership' }[c.subject.kind]}: {c.subject.name}</span> },
                { header: 'Sent', cell: (c) => formatDate(c.createdAt) },
                { header: 'Status', cell: (c) => <CaseStatus state={c.state} /> },
                { header: 'Note from Abode', cell: (c) => c.reason ?? '—' },
              ]}
            />
          </Card>
        </div>
        <aside>
          <Card title="Get verified">
            {o.status === 'active' ? (
              <p className="text-muted">You’re verified until {o.verification.validUntil ? formatDate(o.verification.validUntil) : 'further notice'}. We’ll remind you before it runs out.</p>
            ) : !canSubmit ? (
              <div className="space-y-2">
                <CaseStatus state={orgCase!.state} />
                <p className="text-muted">Sent {formatDateTime(orgCase!.createdAt)}. We usually decide within 2 working days. You can prepare listings meanwhile; they go live once you’re verified.</p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit.run(async () => { await api.portal.submitVerification(org.orgId, files, note); setFiles([]); toast('Documents sent. We’ll be in touch.'); cases.reload() }) }}>
                {orgCase?.state === 'more_info' && <Alert tone="warning" title="Abode needs more information">{orgCase.reason}</Alert>}
                {orgCase?.state === 'rejected' && <Alert tone="danger" title="Not approved">{orgCase.reason}</Alert>}
                <p className="text-sm text-muted">{o.kind === 'agency' ? 'Upload your certificate of incorporation, proof of your office address, and a director’s Ghana Card.' : 'Upload your Ghana Card and proof of ownership, such as an indenture or property rate receipt.'}</p>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-5 text-center hover:border-ink/40">
                  <Upload className="size-6 text-muted" aria-hidden />
                  <span className="font-semibold">Add documents</span>
                  <span className="text-xs text-muted">PDF or photo. Only Abode’s verification team can see them.</span>
                  <input type="file" multiple accept=".pdf,image/*" className="sr-only" onChange={(e) => { const added = [...(e.target.files ?? [])].map((f) => ({ name: f.name, type: 'Document' })); e.target.value = ''; setFiles((s) => [...s, ...added]) }} />
                </label>
                {files.length > 0 && <ul className="space-y-1 text-sm">{files.map((f, i) => <li key={i} className="flex items-center gap-2"><FileText className="size-4 text-muted" aria-hidden />{f.name}</li>)}</ul>}
                <TextArea label="Anything we should know? (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                {submit.error ? <ErrorAlert error={submit.error} /> : null}
                <Button type="submit" className="w-full" loading={submit.busy} disabled={!files.length}>Send for verification</Button>
              </form>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}

export function MandatesPage() {
  const { org } = useOrg()
  const toast = useToast()
  const mandates = useAsync(() => api.portal.mandates(org.orgId), [org.orgId])
  const listings = useAsync(() => api.portal.listings(org.orgId), [org.orgId])
  const [createOpen, setCreateOpen] = useState(false)
  const [revoking, setRevoking] = useState<Mandate | null>(null)
  if ((mandates.loading && !mandates.data) || (listings.loading && !listings.data)) return <Spinner />
  if (mandates.error || listings.error) return <ErrorState error={mandates.error ?? listings.error} />
  const tone: Record<Mandate['status'], Tone> = { active: 'success', revoked: 'danger', expired: 'neutral' }
  return (
    <div>
      <PageHeader title="Mandates" subtitle="An owner’s written authority for you to market their property. Listings need an active mandate to go live." actions={<Button onClick={() => setCreateOpen(true)}>Record a mandate</Button>} />
      <DataTable<Mandate>
        rows={mandates.data!}
        rowKey={(m) => m.id}
        columns={[
          { header: 'Property', cell: (m) => <span className="font-semibold">{m.propertyTitle}</span> },
          { header: 'Owner', cell: (m) => m.ownerName },
          { header: 'Type', cell: (m) => (m.exclusive ? 'Exclusive' : 'Non-exclusive') },
          { header: 'Period', cell: (m) => <span className={m.status === 'active' && m.endsOn <= addDays(today(), 14) ? 'font-semibold text-warning-fg' : ''}>{formatDate(m.startsOn)} – {formatDate(m.endsOn)}</span> },
          { header: 'Status', cell: (m) => <StatusPill tone={tone[m.status]}>{m.status === 'active' ? 'Active' : m.status === 'revoked' ? 'Revoked' : 'Expired'}</StatusPill> },
          { header: '', cell: (m) => (m.status === 'active' ? <Button size="sm" variant="ghost" onClick={() => setRevoking(m)}>Revoke</Button> : null) },
        ]}
      />
      <MandateDialog open={createOpen} onClose={() => setCreateOpen(false)} listings={listings.data!.map((l) => ({ value: l.id, label: l.title || 'Untitled listing' }))} onDone={mandates.reload} />
      <ReasonDialog
        open={!!revoking}
        title="Revoke this mandate?"
        body={<>Any listing for <strong>{revoking?.propertyTitle}</strong> is withdrawn from search straight away.</>}
        confirmLabel="Revoke mandate"
        danger
        onClose={() => setRevoking(null)}
        onConfirm={async (reason) => {
          const r = await api.portal.revokeMandate(org.orgId, revoking!.id, reason)
          toast(r.withdrawn.length ? `Mandate revoked. Withdrawn: ${r.withdrawn.join(', ')}.` : 'Mandate revoked.')
          mandates.reload()
        }}
      />
    </div>
  )
}

function MandateDialog({ open, onClose, listings, onDone }: { open: boolean; onClose(): void; listings: { value: string; label: string }[]; onDone(): void }) {
  const { org } = useOrg()
  const toast = useToast()
  const [form, setForm] = useState({ listingId: '', ownerName: '', exclusive: true, startsOn: today(), endsOn: addDays(today(), 180) })
  const { busy, error, run } = useAction()
  const f = fieldErrors(error)
  return (
    <Modal open={open} onClose={onClose} title="Record a mandate">
      <h2 className="text-xl font-bold">Record a mandate</h2>
      <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.portal.createMandate(org.orgId, form); toast('Mandate recorded.'); onClose(); onDone() }) }}>
        <SelectField label="Property (listing)" value={form.listingId} onChange={(e) => setForm({ ...form, listingId: e.target.value })} options={listings} />
        <TextField label="Owner’s full name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} error={f.ownerName} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Starts" type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} />
          <TextField label="Ends" type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} error={f.endsOn} />
        </div>
        <Checkbox label="Exclusive mandate" hint="Only your agency may market this property." checked={form.exclusive} onChange={(e) => setForm({ ...form, exclusive: e.target.checked })} />
        {error && !Object.keys(f).length ? <ErrorAlert error={error} /> : null}
        <Button type="submit" className="w-full" loading={busy} disabled={!form.listingId}>Save mandate</Button>
      </form>
    </Modal>
  )
}
