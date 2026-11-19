/** The seeker's enquiries and viewings, the live tracking view, and saved listings. */
import { CalendarDays, Heart, Inbox } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ListingCard, ListingRow } from '../../components/listing'
import { TrackingMap } from '../../components/TrackingMap'
import { useToast } from '../../context/ToastContext'
import type { Enquiry } from '../../contracts'
import { Alert, Button, Card, EmptyState, ErrorState, EtaRange, LocationFreshness, PageHeader, ReasonDialog, Spinner, StatusPill, ViewingStatus } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { usePoll } from '../../hooks/usePoll'
import { formatDateTime, timeAgo } from '../../lib/format'
import { api } from '../../services/api'

const ENQUIRY_TONE: Record<Enquiry['publicStatus'], { tone: 'info' | 'success' | 'neutral'; label: string }> = {
  sent: { tone: 'info', label: 'Sent' },
  in_progress: { tone: 'success', label: 'In conversation' },
  closed: { tone: 'neutral', label: 'Closed' },
}

export function EnquiriesPage() {
  const enquiries = useAsync(() => api.pub.myEnquiries(), [])
  const viewings = useAsync(() => api.pub.myViewings(), [])
  if ((enquiries.loading && !enquiries.data) || (viewings.loading && !viewings.data)) return <Spinner />
  if (enquiries.error || viewings.error) return <ErrorState error={enquiries.error ?? viewings.error} />
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8 sm:px-6">
      <PageHeader title="Enquiries and viewings" subtitle="Viewings and enquiries never reserve a property. Only a signed agreement does." />
      <section>
        <h2 className="mb-3 text-lg font-semibold">Viewings</h2>
        {!viewings.data!.length ? (
          <EmptyState icon={CalendarDays} title="No viewings yet" body="Request a viewing from any rent, sale or commercial listing." />
        ) : (
          <div className="space-y-3">
            {viewings.data!.map((v) => (
              <ListingRow
                key={v.id}
                l={v.listing}
                to={`/viewings/${v.id}`}
                right={
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold">{v.confirmedSlot ? formatDateTime(v.confirmedSlot) : 'Time to be confirmed'}</p>
                    <div className="mt-1"><ViewingStatus state={v.state} /></div>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Enquiries</h2>
        {!enquiries.data!.length ? (
          <EmptyState icon={Inbox} title="No enquiries yet" body="Ask a question on any listing and the conversation appears here." />
        ) : (
          <div className="space-y-3">
            {enquiries.data!.map((e) => (
              <ListingRow
                key={e.id}
                l={e.listing}
                to={`/messages/${e.threadId}`}
                right={
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-muted">{timeAgo(e.createdAt)}</p>
                    <div className="mt-1"><StatusPill tone={ENQUIRY_TONE[e.publicStatus].tone}>{ENQUIRY_TONE[e.publicStatus].label}</StatusPill></div>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export function ViewingPage() {
  const { id = '' } = useParams()
  const toast = useToast()
  const { data: v, error, loading, reload } = useAsync(() => api.pub.viewing(id), [id])
  const poll = useCallback(() => reload(), [reload])
  const live = v && ['confirmed', 'agent_en_route', 'arrived'].includes(v.state)
  usePoll(poll, v?.tracking?.sharing ? 5000 : 15_000, !!live)
  const [cancelOpen, setCancelOpen] = useState(false)
  const accept = useAction()

  if (loading && !v) return <Spinner />
  if (error || !v) return <ErrorState error={error} onRetry={reload} />
  const t = v.tracking
  const STALE_AFTER = 30

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to="/enquiries" className="text-sm font-semibold text-brand-700 hover:underline">← Enquiries and viewings</Link>
      <PageHeader title="Your viewing" subtitle={v.listing.title} actions={<ViewingStatus state={v.state} />} />

      {v.state === 'proposed' && (
        <div className="mb-6">
          <Alert tone="info" title="The agent proposed a new time">
            {formatDateTime(v.slots[v.slots.length - 1])}
            <div className="mt-2"><Button size="sm" loading={accept.busy} onClick={() => void accept.run(async () => { await api.pub.acceptProposedTime(v.id); toast('New time accepted.'); reload() })}>Accept this time</Button></div>
          </Alert>
        </div>
      )}

      {(v.state === 'agent_en_route' || (t && !t.ended)) && (
        <Card title="On the way" className="mb-6">
          {t?.sharing ? (
            <div className="space-y-4">
              <TrackingMap tracking={t} stale={(t.ageSeconds ?? 0) > STALE_AFTER} />
              <div className="flex flex-wrap items-start justify-between gap-4">
                {t.eta && <EtaRange minMinutes={t.eta.minMinutes} maxMinutes={t.eta.maxMinutes} basis={t.eta.basis} />}
                <LocationFreshness ageSeconds={t.ageSeconds} staleAfterSeconds={STALE_AFTER} lowAccuracy={t.lowAccuracy} />
              </div>
              <p className="text-xs text-muted">{v.agent?.name} chose to share their location for this trip only. It stops when they arrive, or at {formatDateTime(t.endsAt)} at the latest.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <TrackingMap />
              <LocationFreshness ageSeconds={null} />
            </div>
          )}
        </Card>
      )}
      {t?.ended && v.state !== 'agent_en_route' && v.state === 'arrived' && (
        <div className="mb-6"><Alert tone="success" title={`${v.agent?.name ?? 'The agent'} has arrived`}>Meet them at: {v.meetingPoint}.</Alert></div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Details">
          <dl className="space-y-3">
            <div><dt className="text-sm text-muted">When</dt><dd className="font-medium">{v.confirmedSlot ? formatDateTime(v.confirmedSlot) : `Waiting for the agent to confirm one of: ${v.slots.map(formatDateTime).join('; ')}`}</dd></div>
            <div><dt className="text-sm text-muted">Agent</dt><dd className="font-medium">{v.agent?.name ?? 'Not assigned yet'}</dd></div>
            <div><dt className="text-sm text-muted">Where to meet</dt><dd className="font-medium">{v.meetingPoint}</dd></div>
            {v.cancelReason && <div><dt className="text-sm text-muted">Cancelled because</dt><dd className="font-medium">{v.cancelReason}</dd></div>}
          </dl>
          {['requested', 'proposed', 'confirmed'].includes(v.state) && (
            <Button variant="secondary" className="mt-5" onClick={() => setCancelOpen(true)}>Cancel viewing</Button>
          )}
        </Card>
        <Card title="Updates">
          <ol className="space-y-3">
            {[...v.timeline].reverse().map((e, i) => (
              <li key={i} className="border-l-2 border-line pl-3">
                <ViewingStatus state={e.state} />
                {e.note && <p className="mt-1 text-sm">{e.note}</p>}
                <p className="mt-0.5 text-xs text-muted">{formatDateTime(e.at)}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <ReasonDialog
        open={cancelOpen}
        title="Cancel this viewing?"
        body="The agent will see your reason."
        reasonHint="For example: found another place, or the time no longer works."
        confirmLabel="Cancel viewing"
        danger
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          await api.pub.cancelViewing(v.id, reason)
          toast('Viewing cancelled.')
          reload()
        }}
      />
    </div>
  )
}

export function SavedPage() {
  const { data, error, loading, reload } = useAsync(() => api.pub.savedListings(), [])
  if (loading && !data) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Saved" />
      {!data!.length ? (
        <EmptyState icon={Heart} title="Nothing saved yet" body="Tap the heart on any listing to keep it here." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {data!.map((l) => <ListingCard key={l.id} l={l} />)}
        </div>
      )}
    </div>
  )
}
