import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOrg } from '../../app/guards'
import { orgKindLabel } from '../../config'
import { Alert, Card, ErrorState, PageHeader, Spinner, Stat, TrustBadge } from '../../design-system'
import { useAsync } from '../../hooks/useAsync'
import { today } from '../../lib/dates'
import { api } from '../../services/api'

export function DashboardPage() {
  const { org } = useOrg()
  const { data, error, loading, reload } = useAsync(() => api.portal.dashboard(org.orgId), [org.orgId])
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const { counts } = data
  const role = org.role
  return (
    <div>
      <PageHeader
        eyebrow={orgKindLabel(data.org.kind)}
        title={data.org.tradingName}
        subtitle={<span className="inline-flex items-center gap-2"><TrustBadge verification={data.org.verification} today={today()} /> {data.org.status === 'active' ? 'Verified and active' : data.org.status === 'suspended' ? 'Suspended' : 'Waiting for verification'}</span>}
        actions={role !== 'finance' ? <Link to="/portal/listings/new" className="rounded-xl bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800">New listing</Link> : undefined}
      />
      {data.org.status === 'suspended' && <div className="mb-6"><Alert tone="danger" title="This organization is suspended">Your listings are hidden from search. Contact Abode support.</Alert></div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {role !== 'finance' && <Stat label="Live listings" value={counts.published} to="/portal/listings" />}
        {role !== 'finance' && <Stat label="Drafts" value={counts.drafts} to="/portal/listings" />}
        {role !== 'finance' && <Stat label="New enquiries" value={counts.newLeads} to="/portal/leads" />}
        {role !== 'finance' && <Stat label="Upcoming viewings" value={counts.upcomingViewings} to="/portal/viewings" />}
        {role !== 'agent' && <Stat label="Upcoming bookings" value={counts.upcomingBookings} to="/portal/bookings" />}
      </div>
      <div className="mt-6">
        <Card title="To do">
          {!data.tasks.length ? (
            <p className="text-muted">Nothing needs your attention right now.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.tasks.map((t) => (
                <li key={t.id}>
                  <Link to={t.link} className="flex items-center justify-between gap-3 py-3 hover:text-brand-700">
                    <span className="flex items-start gap-3">
                      <span className={`mt-2 size-2 shrink-0 rounded-full ${t.tone === 'danger' ? 'bg-danger-solid' : t.tone === 'warning' ? 'bg-warning-fg' : 'bg-info-fg'}`} aria-hidden />
                      {t.text}
                    </span>
                    <ArrowRight className="size-4 shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
