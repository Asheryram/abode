/** TRK-001 to 034 from the supply side: confirm, dispatch, travel with optional live location, finish. */
import { Navigation } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOrg } from '../../app/guards'
import { ListingRow } from '../../components/listing'
import { TrackingMap } from '../../components/TrackingMap'
import { useToast } from '../../context/ToastContext'
import type { Viewing, ViewingState } from '../../contracts'
import { Alert, Button, Card, Checkbox, DataTable, ErrorAlert, ErrorState, LocationFreshness, Modal, PageHeader, RadioCards, ReasonDialog, SelectField, Spinner, TextField, ViewingStatus } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { usePoll } from '../../hooks/usePoll'
import { addDays, today } from '../../lib/dates'
import { formatDateTime, fromLocalInput } from '../../lib/format'
import { api } from '../../services/api'

export function ViewingsPage() {
  const { org } = useOrg()
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsync(() => api.portal.viewings(org.orgId), [org.orgId])
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const groups: [string, Viewing[]][] = [
    ['Needs a time', data.filter((v) => ['requested', 'proposed'].includes(v.state))],
    ['Upcoming and in progress', data.filter((v) => ['confirmed', 'agent_en_route', 'arrived', 'in_progress'].includes(v.state)).sort((a, b) => (a.confirmedSlot ?? '').localeCompare(b.confirmedSlot ?? ''))],
    ['Finished', data.filter((v) => ['completed', 'cancelled', 'no_show'].includes(v.state))],
  ]
  return (
    <div>
      <PageHeader title="Viewings" subtitle={org.role === 'agent' ? 'Viewings you lead, or for your listings.' : undefined} />
      <div className="space-y-8">
        {groups.map(([label, rows]) => (
          <section key={label}>
            <h2 className="mb-3 text-lg font-semibold">{label} <span className="text-muted">({rows.length})</span></h2>
            <DataTable<Viewing>
              rows={rows}
              rowKey={(v) => v.id}
              onRowClick={(v) => navigate(`/portal/viewings/${v.id}`)}
              empty="None."
              columns={[
                { header: 'When', cell: (v) => <span className="font-semibold">{v.confirmedSlot ? formatDateTime(v.confirmedSlot) : `${v.slots.length} suggested ${v.slots.length === 1 ? 'time' : 'times'}`}</span> },
                { header: 'Seeker', cell: (v) => v.seeker.name },
                { header: 'Listing', cell: (v) => <span className="line-clamp-1">{v.listing.title}</span> },
                { header: 'Agent', cell: (v) => v.agent?.name ?? '—' },
                { header: 'Status', cell: (v) => <ViewingStatus state={v.state} /> },
              ]}
            />
          </section>
        ))}
      </div>
    </div>
  )
}

export function ViewingPage() {
  const { id = '' } = useParams()
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(() => api.portal.viewing(id), [id])
  const poll = useCallback(() => reload(), [reload])
  usePoll(poll, 5000, data?.viewing.state === 'agent_en_route')
  const action = useAction()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [optIn, setOptIn] = useState(false)

  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const { viewing: v, isAssignedAgent, trackingAllowed } = data
  const t = v.tracking
  const step = (state: Extract<ViewingState, 'agent_en_route' | 'arrived' | 'in_progress' | 'completed' | 'no_show'>, message: string) =>
    void action.run(async () => {
      await api.portal.setViewingState(v.id, state)
      toast(message)
      reload()
    })

  return (
    <div>
      <Link to="/portal/viewings" className="text-sm font-semibold text-brand-700 hover:underline">← Viewings</Link>
      <PageHeader title={`Viewing with ${v.seeker.name}`} subtitle={v.confirmedSlot ? formatDateTime(v.confirmedSlot) : 'Time not confirmed yet'} actions={<ViewingStatus state={v.state} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <ListingRow l={v.listing} to={`/listings/${v.listing.id}`} />

          {['requested', 'proposed'].includes(v.state) && (
            <Card title="Choose a time">
              <p className="mb-3 text-muted">{v.seeker.name} suggested these times (Ghana time, GMT):</p>
              <ul className="mb-4 space-y-1">{v.slots.map((s) => <li key={s} className="font-medium">{formatDateTime(s)}</li>)}</ul>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setConfirmOpen(true)}>Confirm a time</Button>
                <Button variant="secondary" onClick={() => setProposeOpen(true)}>Suggest another time</Button>
              </div>
            </Card>
          )}

          {isAssignedAgent && ['confirmed', 'agent_en_route', 'arrived', 'in_progress'].includes(v.state) && (
            <Card title="Your steps">
              <p className="mb-4 text-muted">Keep the seeker informed. These work with or without location sharing.</p>
              <div className="flex flex-wrap gap-2">
                {v.state === 'confirmed' && <Button onClick={() => step('agent_en_route', 'The seeker knows you’re on the way.')} loading={action.busy}><Navigation className="size-4" aria-hidden /> I’m on my way</Button>}
                {v.state === 'agent_en_route' && <Button onClick={() => step('arrived', 'Marked as arrived. Location sharing stopped.')} loading={action.busy}>I’ve arrived</Button>}
                {v.state === 'arrived' && <Button onClick={() => step('in_progress', 'Viewing started.')} loading={action.busy}>Start viewing</Button>}
                {v.state === 'in_progress' && <Button onClick={() => step('completed', 'Viewing completed.')} loading={action.busy}>Viewing finished</Button>}
                {['arrived', 'confirmed'].includes(v.state) && <Button variant="secondary" onClick={() => step('no_show', 'Marked as no-show.')} loading={action.busy}>Seeker didn’t come</Button>}
              </div>
              {action.error ? <div className="mt-3"><ErrorAlert error={action.error} /></div> : null}
            </Card>
          )}

          {isAssignedAgent && v.state === 'agent_en_route' && trackingAllowed && (
            <Card title="Share your live location (optional)">
              {t?.sharing ? (
                <div className="space-y-3">
                  <TrackingMap tracking={t} stale={(t.ageSeconds ?? 0) > 30} />
                  <LocationFreshness ageSeconds={t.ageSeconds} staleAfterSeconds={30} lowAccuracy={t.lowAccuracy} />
                  <Alert tone="info" title={`Only ${v.seeker.name} can see this`}>
                    It stops when you tap “I’ve arrived”, when you stop it, or at {formatDateTime(t.endsAt)}. Keep this page open: phones pause sharing when the screen locks.
                  </Alert>
                  <Button variant="secondary" loading={action.busy} onClick={() => void action.run(async () => { await api.portal.stopSharing(v.id); toast('Location sharing stopped.'); reload() })}>Stop sharing</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted">Let {v.seeker.name} see where you are on the way, so they know when to come out. It’s your choice each time.</p>
                  {t?.ended && <Alert tone="info" title="Sharing has ended">{t.endedReason}</Alert>}
                  {!t?.ended && (
                    <>
                      <Checkbox label={`Share my live location with ${v.seeker.name} until I arrive`} hint="You can stop at any time. Abode keeps only a short record, then deletes it." checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
                      <Button disabled={!optIn} loading={action.busy} onClick={() => void action.run(async () => { await api.portal.startSharing(v.id, optIn); toast('You’re sharing your location.'); reload() })}>Start sharing</Button>
                      <p className="text-xs text-muted">Test trip: your position moves along a sample route over about 4 minutes, with a short signal drop on the way.</p>
                    </>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card title="Details">
            <dl className="space-y-3">
              <div><dt className="text-sm text-muted">Seeker</dt><dd className="font-medium">{v.seeker.name}{v.seeker.phone && <span className="block text-sm text-muted">{v.seeker.phone}</span>}</dd></div>
              <div><dt className="text-sm text-muted">Agent</dt><dd className="font-medium">{v.agent?.name ?? 'Not assigned'}</dd></div>
              <div><dt className="text-sm text-muted">Meeting point</dt><dd className="font-medium">{v.meetingPoint}</dd></div>
              {v.cancelReason && <div><dt className="text-sm text-muted">Cancelled because</dt><dd>{v.cancelReason}</dd></div>}
            </dl>
            {!['completed', 'cancelled', 'no_show'].includes(v.state) && <Button variant="ghost" className="mt-4 w-full" onClick={() => setCancelOpen(true)}>Cancel viewing</Button>}
          </Card>
          <Card title="Timeline">
            <ol className="space-y-3">
              {[...v.timeline].reverse().map((e, i) => (
                <li key={i} className="border-l-2 border-line pl-3 text-sm">
                  <ViewingStatus state={e.state} />
                  {e.note && <p className="mt-1">{e.note}</p>}
                  <p className="text-xs text-muted">{formatDateTime(e.at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
      <ConfirmViewingDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} viewing={v} agents={data.agents} onDone={reload} />
      <ProposeDialog open={proposeOpen} onClose={() => setProposeOpen(false)} viewingId={v.id} onDone={reload} />
      <ReasonDialog open={cancelOpen} title="Cancel this viewing?" body={`${v.seeker.name} will see your reason.`} confirmLabel="Cancel viewing" danger onClose={() => setCancelOpen(false)} onConfirm={async (reason) => { await api.portal.setViewingState(v.id, 'cancelled', reason); toast('Viewing cancelled.'); reload() }} />
    </div>
  )
}

function ConfirmViewingDialog({ open, onClose, viewing, agents, onDone }: { open: boolean; onClose(): void; viewing: Viewing; agents: { id: string; name: string }[]; onDone(): void }) {
  const toast = useToast()
  const [slot, setSlot] = useState(viewing.slots[viewing.slots.length - 1])
  const [agentId, setAgentId] = useState(viewing.agent?.id ?? agents[0]?.id ?? '')
  const [meeting, setMeeting] = useState(viewing.meetingPoint)
  const { busy, error, run } = useAction()
  return (
    <Modal open={open} onClose={onClose} title="Confirm a time">
      <h2 className="text-xl font-bold">Confirm a time</h2>
      <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.portal.confirmViewing(viewing.id, slot, agentId, meeting); toast('Viewing confirmed. The seeker has been told.'); onClose(); onDone() }) }}>
        <RadioCards<string> label="Time (GMT)" value={slot} onChange={setSlot} options={viewing.slots.map((s) => ({ value: s, label: formatDateTime(s) }))} />
        <SelectField label="Who will lead it" value={agentId} onChange={(e) => setAgentId(e.target.value)} options={agents.map((a) => ({ value: a.id, label: a.name }))} placeholder={false} hint="Only people with a current licence are listed." />
        <TextField label="Where to meet" value={meeting} onChange={(e) => setMeeting(e.target.value)} />
        {error ? <ErrorAlert error={error} /> : null}
        <Button type="submit" className="w-full" loading={busy} disabled={!agentId}>Confirm viewing</Button>
      </form>
    </Modal>
  )
}

function ProposeDialog({ open, onClose, viewingId, onDone }: { open: boolean; onClose(): void; viewingId: string; onDone(): void }) {
  const toast = useToast()
  const [value, setValue] = useState(`${addDays(today(), 1)}T11:00`)
  const { busy, error, run } = useAction()
  return (
    <Modal open={open} onClose={onClose} title="Suggest another time">
      <h2 className="text-xl font-bold">Suggest another time</h2>
      <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.portal.proposeTime(viewingId, fromLocalInput(value)); toast('New time sent to the seeker.'); onClose(); onDone() }) }}>
        <TextField label="New time (GMT)" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        {error ? <ErrorAlert error={error} /> : null}
        <Button type="submit" className="w-full" loading={busy}>Send to seeker</Button>
      </form>
    </Modal>
  )
}
