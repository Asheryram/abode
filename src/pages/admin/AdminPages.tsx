/**
 * The back office (ADM-001 to 033). Each queue is claimed by one person at a
 * time, every decision needs a reason, and every action is audited.
 */
import { FileText, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../app/auth'
import { SafeImage } from '../../components/SafeImage'
import { intentLabel } from '../../config'
import { useToast } from '../../context/ToastContext'
import type { AuditEvent, FeatureFlag, ManagedListing, Report, User, VerificationCase } from '../../contracts'
import { Alert, BookingStatus, Button, Card, DataTable, ErrorAlert, ErrorState, Facts, ListingStatusPill, PageHeader, PriceTag, ReasonDialog, Segmented, Spinner, Stat, StatusPill, TextField, type Tone } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { formatDate, formatDateTime, timeAgo } from '../../lib/format'
import { api } from '../../services/api'
import { CaseStatus } from '../portal/OrgPages'

export function OverviewPage() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useAsync(() => api.admin.queues(), [])
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  return (
    <div>
      <PageHeader title={`Good day, ${user!.name.split(' ')[0]}`} subtitle="What’s waiting across the platform." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Verification cases" value={data.verification} to="/admin/verification" />
        <Stat label="Listings to review" value={data.listingReview} to="/admin/listings" />
        <Stat label="Open reports" value={data.reports} to="/admin/reports" />
        <Stat label="Money to reconcile" value={data.reconciliation} to="/admin/finance" />
        <Stat label="Payouts to approve" value={data.payoutsAwaiting} to="/admin/finance" />
      </div>
      <div className="mt-6">
        <Alert tone="info" title="How the back office works">
          Claim an item before you work on it, so no one else does at the same time. Every decision asks for a reason, which goes in the audit log. Your sidebar only shows what your role can do.
        </Alert>
      </div>
    </div>
  )
}

// ── Verification ────────────────────────────────────────────────────────────

export function VerificationQueuePage() {
  const navigate = useNavigate()
  const [show, setShow] = useState<'open' | 'all'>('open')
  const { data, error, loading, reload } = useAsync(() => api.admin.verificationCases(), [])
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const rows = data.filter((c) => show === 'all' || ['submitted', 'in_review', 'more_info'].includes(c.state))
  return (
    <div>
      <PageHeader title="Verification" subtitle="Organizations, agent licences and proof of ownership." />
      <div className="mb-4"><Segmented<'open' | 'all'> label="Show" value={show} onChange={setShow} options={[{ value: 'open', label: 'Open' }, { value: 'all', label: 'All' }]} /></div>
      <DataTable<VerificationCase>
        rows={rows}
        rowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/admin/verification/${c.id}`)}
        empty="No cases waiting."
        columns={[
          { header: 'Subject', cell: (c) => <div><p className="font-semibold">{c.subject.name}</p><p className="text-xs text-muted">{{ organization: 'Organization', agent_licence: 'Agent licence', ownership: 'Ownership' }[c.subject.kind]} · {c.orgName}</p></div> },
          { header: 'Waiting', cell: (c) => timeAgo(c.createdAt) },
          { header: 'Status', cell: (c) => <CaseStatus state={c.state} /> },
          { header: 'Claimed by', cell: (c) => c.claimedBy ?? '—' },
        ]}
      />
    </div>
  )
}

export function VerificationCasePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const { data: c, error, loading, reload } = useAsync(() => api.admin.verificationCase(id), [id])
  const claim = useAction()
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'more_info' | null>(null)
  if (loading && !c) return <Spinner />
  if (error || !c) return <ErrorState error={error} onRetry={reload} />
  const mine = c.claimedBy === user!.name
  const open = ['submitted', 'in_review', 'more_info'].includes(c.state)
  const canAct = user!.staffRole === 'verification_officer' || user!.staffRole === 'platform_admin'
  return (
    <div>
      <Link to="/admin/verification" className="text-sm font-semibold text-brand-700 hover:underline">← Verification</Link>
      <PageHeader title={c.subject.name} subtitle={`${{ organization: 'Organization', agent_licence: 'Agent licence', ownership: 'Ownership' }[c.subject.kind]} · ${c.orgName}`} actions={<CaseStatus state={c.state} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Submitted">
            <Facts items={[{ label: 'By', value: c.submittedBy }, { label: 'On', value: formatDateTime(c.createdAt) }]} />
            {c.note && <p className="mt-4 rounded-xl bg-stone-50 p-3">“{c.note}”</p>}
          </Card>
          <Card title="Evidence">
            <p className="mb-3 text-sm text-muted">Opened only here, through short-lived links. Never copy evidence into other tools (TRU-007).</p>
            <ul className="space-y-2">
              {c.evidence.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                  <span className="flex items-center gap-2"><FileText className="size-4 text-muted" aria-hidden /> {e.name}</span>
                  <span className="text-xs text-muted">{e.type}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="History">
            <ol className="space-y-2 text-sm">
              {c.history.map((h, i) => <li key={i}><CaseStatus state={h.state} /> <span className="text-muted">{h.by} · {formatDateTime(h.at)}</span>{h.note && <p className="mt-0.5">{h.note}</p>}</li>)}
            </ol>
          </Card>
        </div>
        <aside>
          <Card title="Decision">
            {!canAct ? <p className="text-muted">Read-only for your role.</p> : !open ? <p className="text-muted">Decided: {c.reason}</p> : (
              <div className="space-y-3">
                {c.claimedBy && !mine && <Alert tone="warning" title={`${c.claimedBy} is working on this`}>Ask them to release it if you need to take over.</Alert>}
                {!c.claimedBy && <Button className="w-full" loading={claim.busy} onClick={() => void claim.run(async () => { await api.admin.claimVerification(c.id, true); reload() })}>Claim this case</Button>}
                {mine && (
                  <>
                    <Button className="w-full" onClick={() => setDecision('approved')}>Approve</Button>
                    <Button className="w-full" variant="secondary" onClick={() => setDecision('more_info')}>Ask for more information</Button>
                    <Button className="w-full" variant="danger" onClick={() => setDecision('rejected')}>Reject</Button>
                    <Button className="w-full" variant="ghost" onClick={() => void claim.run(async () => { await api.admin.claimVerification(c.id, false); reload() })}>Release</Button>
                  </>
                )}
                {claim.error ? <ErrorAlert error={claim.error} /> : null}
              </div>
            )}
          </Card>
        </aside>
      </div>
      <ReasonDialog
        open={!!decision}
        title={decision === 'approved' ? 'Approve verification' : decision === 'rejected' ? 'Reject verification' : 'Ask for more information'}
        body={decision === 'more_info' ? 'The organization sees your message and can send more documents.' : 'The organization is told the outcome and your reason.'}
        reasonLabel={decision === 'more_info' ? 'What do you need?' : 'Reason'}
        confirmLabel={decision === 'approved' ? 'Approve' : decision === 'rejected' ? 'Reject' : 'Send request'}
        danger={decision === 'rejected'}
        onClose={() => setDecision(null)}
        onConfirm={async (reason) => {
          await api.admin.decideVerification(c.id, decision!, reason)
          toast('Decision recorded.')
          reload()
        }}
      />
    </div>
  )
}

// ── Listing review ──────────────────────────────────────────────────────────

export function ListingReviewPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(() => api.admin.reviewQueue(), [])
  const [acting, setActing] = useState<{ l: ManagedListing; decision: 'approve' | 'reject' } | null>(null)
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const canAct = ['moderator', 'platform_admin'].includes(user!.staffRole!)
  return (
    <div>
      <PageHeader title="Listing review" subtitle="New listings wait here before going live. Check photos, wording, price and location." />
      {!data.length && <Card><p className="text-muted">Nothing waiting. Good work.</p></Card>}
      <div className="space-y-4">
        {data.map((l) => (
          <Card key={l.id}>
            <div className="grid gap-4 md:grid-cols-[200px_1fr_auto]">
              <SafeImage src={l.photos[0]?.url} alt={l.photos[0]?.alt ?? ''} className="aspect-[4/3] w-full rounded-xl" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><ListingStatusPill state={l.state} /><span className="text-sm text-muted">{intentLabel(l.intent)} · {l.org.name}</span></div>
                <h2 className="mt-1 text-lg font-semibold">{l.title}</h2>
                <p className="text-sm text-muted">{l.address.line1}, {l.address.area}, {l.address.city}</p>
                <div className="mt-1"><PriceTag amount={l.price} basis={l.basis} size="sm" /></div>
                <p className="mt-2 line-clamp-3 text-sm">{l.description}</p>
                <p className="mt-2 text-xs text-muted">{l.photos.length} photos · {l.photos.filter((p) => !p.alt).length} without a description</p>
              </div>
              {canAct && (
                <div className="flex gap-2 md:flex-col">
                  <Button onClick={() => setActing({ l, decision: 'approve' })}>Approve</Button>
                  <Button variant="secondary" onClick={() => setActing({ l, decision: 'reject' })}>Ask for changes</Button>
                  <Link to={`/listings/${l.id}`} className="text-center text-sm font-semibold text-brand-700 hover:underline">Preview</Link>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      <ReasonDialog
        open={!!acting}
        title={acting?.decision === 'approve' ? `Approve “${acting.l.title}”?` : 'What needs to change?'}
        body={acting?.decision === 'approve' ? 'It goes live in search straight away.' : 'The lister sees this and can resubmit.'}
        reasonLabel={acting?.decision === 'approve' ? 'Note (optional, at least 5 characters if given)' : 'Changes needed'}
        minLength={acting?.decision === 'approve' ? 0 : 5}
        confirmLabel={acting?.decision === 'approve' ? 'Approve and publish' : 'Send back'}
        onClose={() => setActing(null)}
        onConfirm={async (reason) => {
          await api.admin.decideListing(acting!.l.id, acting!.decision, reason)
          toast(acting!.decision === 'approve' ? 'Listing is live.' : 'Sent back to the lister.')
          reload()
        }}
      />
    </div>
  )
}

// ── Reports ─────────────────────────────────────────────────────────────────

const REPORT_TONE: Record<Report['state'], Tone> = { open: 'warning', actioned: 'success', dismissed: 'neutral' }

export function ReportsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(() => api.admin.reports(), [])
  const action = useAction()
  const [resolving, setResolving] = useState<{ r: Report; action: 'dismiss' | 'take_down' | 'warn' | 'restrict' } | null>(null)
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const canAct = ['moderator', 'platform_admin'].includes(user!.staffRole!)
  return (
    <div>
      <PageHeader title="Reports" subtitle="What people have flagged as unsafe, wrong or offensive." />
      {action.error ? <div className="mb-4"><ErrorAlert error={action.error} /></div> : null}
      <div className="space-y-4">
        {data.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={REPORT_TONE[r.state]}>{r.state === 'open' ? 'Open' : r.state === 'actioned' ? 'Actioned' : 'Dismissed'}</StatusPill>
                  <StatusPill tone={r.category === 'fraud' ? 'danger' : 'neutral'}>{{ fraud: 'Possible scam', inaccurate: 'Inaccurate', offensive: 'Offensive', duplicate: 'Duplicate', other: 'Other' }[r.category]}</StatusPill>
                </div>
                <h2 className="mt-2 font-semibold">{r.target.label}</h2>
                <p className="text-sm text-muted">Reported by {r.reporter} · {timeAgo(r.createdAt)}</p>
                {r.detail && <p className="mt-2">“{r.detail}”</p>}
                {r.resolution && <p className="mt-2 text-sm text-muted">{r.resolution}</p>}
              </div>
              {canAct && r.state === 'open' && (
                <div className="flex flex-wrap gap-2">
                  {!r.claimedBy && <Button size="sm" loading={action.busy} onClick={() => void action.run(async () => { await api.admin.claimReport(r.id, true); reload() })}>Claim</Button>}
                  {r.claimedBy && r.claimedBy !== user!.name && <span className="text-sm text-muted">{r.claimedBy} is on it</span>}
                  {r.claimedBy === user!.name && (
                    <>
                      {r.target.kind === 'listing' && <Button size="sm" variant="danger" onClick={() => setResolving({ r, action: 'take_down' })}>Take down</Button>}
                      {r.target.kind !== 'listing' && <Button size="sm" variant="danger" onClick={() => setResolving({ r, action: 'restrict' })}>Restrict account</Button>}
                      <Button size="sm" variant="secondary" onClick={() => setResolving({ r, action: 'warn' })}>Warn</Button>
                      <Button size="sm" variant="ghost" onClick={() => setResolving({ r, action: 'dismiss' })}>Dismiss</Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      <ReasonDialog
        open={!!resolving}
        title={{ dismiss: 'Dismiss report', take_down: 'Take down listing', warn: 'Send a warning', restrict: 'Restrict account' }[resolving?.action ?? 'dismiss']}
        confirmLabel="Confirm"
        danger={resolving?.action === 'take_down' || resolving?.action === 'restrict'}
        onClose={() => setResolving(null)}
        onConfirm={async (reason) => {
          await api.admin.resolveReport(resolving!.r.id, resolving!.action, reason)
          toast('Report resolved.')
          reload()
        }}
      />
    </div>
  )
}

// ── Support ─────────────────────────────────────────────────────────────────

export function SupportPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<User[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const search = useAction()
  const detail = useAsync(() => (selected ? api.admin.userDetail(selected) : Promise.resolve(null)), [selected])
  return (
    <div>
      <PageHeader title="Support" subtitle="Look someone up to help them. Opening a person’s record is logged." />
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void search.run(async () => setResults(await api.admin.searchUsers(q))) }}>
        <TextField label="Name or email" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
        <Button type="submit" className="self-end" loading={search.busy}><Search className="size-4" aria-hidden /> Search</Button>
      </form>
      {search.error ? <div className="mt-3"><ErrorAlert error={search.error} /></div> : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {results?.length === 0 && <p className="text-muted">No one matches.</p>}
          {results?.map((u) => (
            <button key={u.id} type="button" onClick={() => setSelected(u.id)} className={`block w-full rounded-xl border p-3 text-left ${selected === u.id ? 'border-ink bg-white' : 'border-line bg-white hover:border-ink/40'}`}>
              <p className="font-semibold">{u.name}</p>
              <p className="text-sm text-muted">{u.email}</p>
            </button>
          ))}
        </div>
        <div>
          {detail.loading && selected && <Spinner />}
          {detail.error ? <ErrorState error={detail.error} /> : null}
          {detail.data && (
            <div className="space-y-4">
              <Card title={detail.data.user.name}>
                <Facts items={[
                  { label: 'Email', value: `${detail.data.user.email} ${detail.data.user.emailVerified ? '(confirmed)' : '(not confirmed)'}` },
                  { label: 'Phone', value: detail.data.user.phone ?? '—' },
                  { label: 'Two-step sign-in', value: detail.data.user.mfaEnabled ? 'On' : 'Off' },
                  { label: 'Joined', value: formatDate(detail.data.user.createdAt) },
                  { label: 'Organizations', value: detail.data.user.memberships.map((m) => m.orgName).join(', ') || '—' },
                ]} />
              </Card>
              <Card title="Bookings">
                {!detail.data.bookings.length ? <p className="text-muted">None.</p> : (
                  <ul className="divide-y divide-line">{detail.data.bookings.map((b) => <li key={b.id} className="flex items-center justify-between gap-3 py-2.5"><span><span className="font-mono text-sm">{b.reference}</span> · {b.listing.title}</span><BookingStatus state={b.state} /></li>)}</ul>
                )}
              </Card>
              <Card title="Enquiries">
                {!detail.data.enquiries.length ? <p className="text-muted">None.</p> : (
                  <ul className="divide-y divide-line">{detail.data.enquiries.map((e) => <li key={e.id} className="py-2.5">{e.listing.title} <span className="text-sm text-muted">· {timeAgo(e.createdAt)}</span></li>)}</ul>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Feature switches ────────────────────────────────────────────────────────

export function FlagsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(() => api.admin.flags(), [])
  const [changing, setChanging] = useState<{ f: FeatureFlag; to: boolean | 'evidence' } | null>(null)
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const isAdmin = user!.staffRole === 'platform_admin'
  return (
    <div>
      <PageHeader title="Feature switches" subtitle="Turn features on or off for everyone. Gated features need their evidence recorded first." />
      <div className="space-y-3">
        {data.map((f) => (
          <Card key={f.key}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{f.label}</h2>
                  <StatusPill tone={f.enabled ? 'success' : 'neutral'}>{f.enabled ? 'On' : 'Off'}</StatusPill>
                  {f.gate && <StatusPill tone={f.gate.evidenceRecorded ? 'info' : 'warning'}>{f.gate.name}: {f.gate.evidenceRecorded ? 'evidence recorded' : 'evidence missing'}</StatusPill>}
                </div>
                <p className="mt-1 text-sm text-muted">{f.description}</p>
                {f.updatedBy && <p className="mt-1 text-xs text-muted">Last changed by {f.updatedBy}, {formatDateTime(f.updatedAt!)}</p>}
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  {f.gate && !f.gate.evidenceRecorded && <Button size="sm" variant="secondary" onClick={() => setChanging({ f, to: 'evidence' })}>Record evidence</Button>}
                  <Button size="sm" variant={f.enabled ? 'secondary' : 'primary'} onClick={() => setChanging({ f, to: !f.enabled })}>{f.enabled ? 'Turn off' : 'Turn on'}</Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      {!isAdmin && <p className="mt-4 text-sm text-muted">Only platform administrators can change these.</p>}
      <ReasonDialog
        open={!!changing}
        title={changing?.to === 'evidence' ? `Record ${changing.f.gate?.name} evidence` : `${changing?.to ? 'Turn on' : 'Turn off'} “${changing?.f.label}”?`}
        body={changing?.to === 'evidence' ? 'Say what was checked and where the record is kept.' : changing?.to === false && changing.f.key === 'live_tracking' ? 'Anyone sharing their location right now stops immediately.' : 'This affects everyone straight away.'}
        confirmLabel="Confirm"
        onClose={() => setChanging(null)}
        onConfirm={async (reason) => {
          if (changing!.to === 'evidence') await api.admin.recordGateEvidence(changing!.f.key, reason)
          else await api.admin.setFlag(changing!.f.key, changing!.to, reason)
          toast('Saved.')
          reload()
        }}
      />
    </div>
  )
}

// ── Audit log ───────────────────────────────────────────────────────────────

export function AuditPage() {
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const { data, error, loading, reload } = useAsync(() => api.admin.audit(term), [term])
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every privileged action, who did it and why. It can’t be edited." />
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q) }}>
        <TextField label="Search by person, action or target" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
        <Button type="submit" className="self-end">Search</Button>
      </form>
      {loading && !data ? <Spinner /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <DataTable<AuditEvent>
          rows={data!}
          rowKey={(a) => a.id}
          empty="No matching events."
          columns={[
            { header: 'When', cell: (a) => <span className="whitespace-nowrap">{formatDateTime(a.at)}</span> },
            { header: 'Who', cell: (a) => a.actor },
            { header: 'Action', cell: (a) => <span className="font-mono text-xs">{a.action}</span> },
            { header: 'Target', cell: (a) => a.target },
            { header: 'Reason', cell: (a) => a.reason ?? '—' },
          ]}
        />
      )}
    </div>
  )
}
