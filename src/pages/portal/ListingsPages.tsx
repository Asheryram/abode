/** PROP-001 to 037 from the supply side: list, create, edit, photos, publish gate, lifecycle. */
import { CalendarDays, CheckCircle2, Circle, House, ImagePlus, Star, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOrg } from '../../app/guards'
import { SafeImage } from '../../components/SafeImage'
import { FEATURES, GHANA_REGIONS, INTENTS, intentLabel, PROPERTY_TYPES, propertyTypeLabel } from '../../config'
import { useToast } from '../../context/ToastContext'
import type { Intent, ListingInput, ListingState, ManagedListing, PriceBasis, PropertyType, PublishCheck } from '../../contracts'
import { Alert, Button, Card, Checkbox, cx, DataTable, ErrorAlert, ErrorState, fieldErrors, ListingStatusPill, PageHeader, PriceTag, RadioCards, ReasonDialog, Segmented, SelectField, Spinner, StatusPill, TextArea, TextField } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { usePoll } from '../../hooks/usePoll'
import { resizeImage } from '../../lib/images'
import { formatDate, formatDateTime } from '../../lib/format'
import { minorToInput, parseMinor } from '../../lib/moneyInput'
import { api } from '../../services/api'

const BASES: Record<Intent, { value: PriceBasis; label: string }[]> = {
  short_stay: [{ value: 'per_night', label: 'Per night' }],
  rent: [{ value: 'per_month', label: 'Per month' }, { value: 'per_annum', label: 'Per year' }],
  sale: [{ value: 'total', label: 'Total price' }],
  commercial: [{ value: 'per_month', label: 'Per month' }, { value: 'per_annum', label: 'Per year' }, { value: 'per_sqm_per_annum', label: 'Per m² per year' }],
}

export function ListingsPage() {
  const { org } = useOrg()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'live' | 'drafts' | 'other'>('all')
  const { data, error, loading, reload } = useAsync(() => api.portal.listings(org.orgId), [org.orgId])
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  const rows = data.filter((l) => filter === 'all' || (filter === 'live' ? l.state === 'published' : filter === 'drafts' ? ['draft', 'in_review', 'submitted'].includes(l.state) : !['published', 'draft', 'in_review', 'submitted'].includes(l.state)))
  return (
    <div>
      <PageHeader title="Listings" subtitle={org.role === 'agent' ? 'Listings assigned to you.' : undefined} actions={<Link to="/portal/listings/new" className="rounded-xl bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800">New listing</Link>} />
      <div className="mb-4">
        <Segmented<typeof filter> label="Show" value={filter} onChange={setFilter} options={[{ value: 'all', label: `All (${data.length})` }, { value: 'live', label: 'Live' }, { value: 'drafts', label: 'Drafts and review' }, { value: 'other', label: 'Paused and ended' }]} />
      </div>
      <DataTable
        rows={rows}
        rowKey={(l) => l.id}
        onRowClick={(l) => navigate(`/portal/listings/${l.id}`)}
        empty="No listings here."
        columns={[
          { header: 'Listing', cell: (l) => (
            <div className="flex items-center gap-3">
              <SafeImage src={l.photos[0]?.url} alt="" className="size-12 shrink-0 rounded-lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{l.title || 'Untitled listing'}</p>
                <p className="truncate text-xs text-muted">{intentLabel(l.intent)} · {l.locationText}</p>
              </div>
            </div>
          ) },
          { header: 'Status', cell: (l) => <ListingStatusPill state={l.state} /> },
          { header: 'Price', cell: (l) => (l.price.amountMinor ? <PriceTag amount={l.price} basis={l.basis} size="sm" /> : <span className="text-muted">Not set</span>) },
          { header: 'Views', cell: (l) => l.stats.views, className: 'tabular-nums' },
          { header: 'Enquiries', cell: (l) => l.stats.enquiries, className: 'tabular-nums' },
        ]}
      />
    </div>
  )
}

/** Step one: what kind of listing. It is saved as a draft straight away. */
export function NewListingPage() {
  const { org } = useOrg()
  const navigate = useNavigate()
  const [intent, setIntent] = useState<Intent>(org.orgKind === 'host' ? 'short_stay' : 'rent')
  const [type, setType] = useState<PropertyType>('apartment')
  const { busy, error, run } = useAction()
  const types = PROPERTY_TYPES.filter((t) => t.intents.includes(intent))
  useEffect(() => {
    if (!types.some((t) => t.id === type)) setType(types[0].id)
  }, [intent, type, types])

  return (
    <div className="max-w-2xl">
      <PageHeader title="New listing" subtitle="Start with the basics. You can save and come back any time." />
      <div className="space-y-6">
        <RadioCards<Intent> label="What are you offering?" value={intent} onChange={setIntent} columns={2} options={INTENTS.map((i) => ({ value: i.id, label: i.label, hint: i.hint }))} />
        <RadioCards<PropertyType> label="Type of property" value={type} onChange={setType} columns={3} options={types.map((t) => ({ value: t.id, label: t.label }))} />
        {error ? <ErrorAlert error={error} /> : null}
        <Button
          size="lg"
          loading={busy}
          onClick={() =>
            void run(async () => {
              const l = await api.portal.createListing(org.orgId, { intent, propertyType: type, title: '', description: '', address: { line1: '', area: '', city: '', region: 'Greater Accra' }, addressDisplay: 'area_only', priceMinor: 0, basis: BASES[intent][0].value, features: [], cancellationPolicy: intent === 'short_stay' ? 'moderate' : undefined })
              navigate(`/portal/listings/${l.id}`, { replace: true })
            })
          }
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

function toInput(l: ManagedListing): ListingInput & { priceText: string; cleaningText: string } {
  return {
    intent: l.intent,
    propertyType: l.propertyType,
    title: l.title,
    description: l.description,
    address: l.address,
    addressDisplay: l.addressDisplay,
    priceMinor: l.price.amountMinor,
    priceText: minorToInput(l.price.amountMinor),
    basis: l.basis,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    areaSqm: l.areaSqm,
    maxGuests: l.maxGuests,
    minNights: l.minNights,
    cleaningFeeMinor: l.cleaningFee?.amountMinor,
    cleaningText: minorToInput(l.cleaningFee?.amountMinor),
    cancellationPolicy: l.cancellationPolicy,
    features: l.features,
    houseRules: l.houseRules,
    availableFrom: l.availableFrom,
    furnished: l.furnished,
    agentId: l.agentId,
  }
}

const num = (v: string) => (v === '' ? undefined : Math.max(0, Math.floor(Number(v))))

export function ListingEditorPage() {
  const { id = '' } = useParams()
  const { org } = useOrg()
  const toast = useToast()
  const { data, error, loading, reload, setData } = useAsync(() => api.portal.listing(id), [id])
  const [form, setForm] = useState<ReturnType<typeof toInput> | null>(null)
  const [dirty, setDirty] = useState(false)
  const save = useAction()
  const submit = useAction()
  const stateAction = useAction()
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const pendingPhotos = data?.listing.photos.some((p) => p.status === 'pending')
  const poll = useCallback(() => reload(), [reload])
  usePoll(poll, 3000, !!pendingPhotos && !dirty)

  useEffect(() => {
    if (data && !dirty) setForm(toInput(data.listing))
  }, [data, dirty])

  if (loading && !data) return <Spinner />
  if (error || !data || !form) return <ErrorState error={error} onRetry={reload} />
  const l = data.listing
  const readOnly = org.role === 'finance'
  const f = fieldErrors(save.error)
  const update = (patch: Partial<typeof form>) => {
    setForm({ ...form, ...patch })
    setDirty(true)
  }
  const doSave = () =>
    save.run(async () => {
      const priceMinor = form.priceText ? parseMinor(form.priceText) : 0
      if (priceMinor === null) throw new Error('Enter the price as a number, for example 1250 or 1250.50.')
      const cleaningFeeMinor = form.cleaningText ? parseMinor(form.cleaningText) : undefined
      if (cleaningFeeMinor === null) throw new Error('Enter the cleaning fee as a number, for example 150.')
      const { priceText: _p, cleaningText: _c, ...input } = form
      void _p
      void _c
      await api.portal.updateListing(l.id, { ...input, priceMinor, cleaningFeeMinor: cleaningFeeMinor ?? undefined })
      setDirty(false)
      toast('Saved.')
      reload()
      return true
    })

  const unmet = data.checks.filter((c) => !c.met)
  const act = (action: 'pause' | 'resume' | 'renew' | 'let_or_sold') => void stateAction.run(async () => {
    await api.portal.setListingState(l.id, action)
    toast('Listing updated.')
    reload()
  })

  return (
    <div>
      <Link to="/portal/listings" className="text-sm font-semibold text-brand-700 hover:underline">← Listings</Link>
      <PageHeader title={l.title || 'Untitled listing'} subtitle={`${intentLabel(l.intent)} · ${propertyTypeLabel(l.propertyType)}`} actions={<ListingStatusPill state={l.state} />} />
      {l.rejectionReason && l.state === 'draft' && <div className="mb-6"><Alert tone="danger" title="Abode asked for changes">{l.rejectionReason}</Alert></div>}
      {l.withdrawnReason && ['paused', 'withdrawn'].includes(l.state) && <div className="mb-6"><Alert tone="warning" title={l.state === 'paused' ? 'Paused' : 'Withdrawn'}>{l.withdrawnReason}</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <fieldset disabled={readOnly} className="min-w-0 space-y-6">
          <Card title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Title" className="sm:col-span-2" value={form.title} maxLength={90} onChange={(e) => update({ title: e.target.value })} error={f.title} hint="Say what and where, e.g. “Furnished 2-bed apartment in Cantonments”." />
              <TextArea label="Description" className="sm:col-span-2" rows={6} value={form.description} onChange={(e) => update({ description: e.target.value })} hint={`${form.description.length} characters. At least 50.`} />
              {form.propertyType !== 'land' && form.intent !== 'commercial' && (
                <>
                  <TextField label="Bedrooms" type="number" min={0} value={form.bedrooms ?? ''} onChange={(e) => update({ bedrooms: num(e.target.value) })} />
                  <TextField label="Bathrooms" type="number" min={0} value={form.bathrooms ?? ''} onChange={(e) => update({ bathrooms: num(e.target.value) })} />
                </>
              )}
              <TextField label="Floor or land area (m²)" type="number" min={0} value={form.areaSqm ?? ''} onChange={(e) => update({ areaSqm: num(e.target.value) })} />
              {form.intent === 'short_stay' && <TextField label="Maximum guests" type="number" min={1} value={form.maxGuests ?? ''} onChange={(e) => update({ maxGuests: num(e.target.value) })} />}
              {form.intent === 'rent' && (
                <>
                  <TextField label="Available from" type="date" value={form.availableFrom ?? ''} onChange={(e) => update({ availableFrom: e.target.value || undefined })} />
                  <SelectField label="Furnishing" value={form.furnished === undefined ? '' : form.furnished ? 'yes' : 'no'} onChange={(e) => update({ furnished: e.target.value === '' ? undefined : e.target.value === 'yes' })} options={[{ value: 'yes', label: 'Furnished' }, { value: 'no', label: 'Unfurnished' }]} />
                </>
              )}
              {org.orgKind === 'agency' && org.role === 'admin' && (
                <SelectField label="Assigned agent" value={form.agentId ?? ''} onChange={(e) => update({ agentId: e.target.value || undefined })} options={data.agents.map((a) => ({ value: a.id, label: a.name }))} placeholder="No one yet" hint="Only agents with a current licence are listed." />
              )}
            </div>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-semibold">Features</legend>
              <div className="flex flex-wrap gap-2">
                {FEATURES.map((feat) => {
                  const on = form.features.includes(feat)
                  return (
                    <button key={feat} type="button" aria-pressed={on} onClick={() => update({ features: on ? form.features.filter((x) => x !== feat) : [...form.features, feat] })} className={cx('rounded-full border px-3 py-1.5 text-sm', on ? 'border-brand-700 bg-brand-50 font-semibold text-brand-800' : 'border-line bg-white hover:border-ink/40')}>
                      {feat}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </Card>

          <Card title="Location">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Street and number" className="sm:col-span-2" value={form.address.line1} onChange={(e) => update({ address: { ...form.address, line1: e.target.value } })} />
              <TextField label="Area or neighbourhood" value={form.address.area} onChange={(e) => update({ address: { ...form.address, area: e.target.value } })} />
              <TextField label="Town or city" value={form.address.city} onChange={(e) => update({ address: { ...form.address, city: e.target.value } })} />
              <SelectField label="Region" value={form.address.region} onChange={(e) => update({ address: { ...form.address, region: e.target.value } })} options={GHANA_REGIONS} placeholder={false} />
              <TextField label="Digital address (GhanaPostGPS)" placeholder="GA-183-8164" value={form.address.digitalAddress ?? ''} onChange={(e) => update({ address: { ...form.address, digitalAddress: e.target.value || undefined } })} />
            </div>
            <div className="mt-5">
              <RadioCards
                label="What the public sees before booking or a viewing"
                value={form.addressDisplay}
                onChange={(v) => update({ addressDisplay: v })}
                options={[
                  { value: 'area_only', label: 'Area and town only', hint: 'Recommended for homes. Guests get the full address once confirmed.' },
                  { value: 'street', label: 'Street, area and town' },
                  { value: 'full', label: 'Full address', hint: 'Best for shops and offices that want walk-ins.' },
                ]}
              />
            </div>
          </Card>

          <Card title="Price">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={`Price (GH₵)`} inputMode="decimal" value={form.priceText} onChange={(e) => update({ priceText: e.target.value })} error={f.price} hint="Abode adds its service fee and taxes for guests at checkout." />
              <SelectField label="Charged" value={form.basis} onChange={(e) => update({ basis: e.target.value as PriceBasis })} options={BASES[form.intent]} placeholder={false} error={f.basis} />
              {form.intent === 'short_stay' && (
                <>
                  <TextField label="Cleaning fee (GH₵, optional)" inputMode="decimal" value={form.cleaningText} onChange={(e) => update({ cleaningText: e.target.value })} hint="Leave empty for no cleaning fee." />
                  <TextField label="Minimum nights" type="number" min={1} value={form.minNights ?? ''} onChange={(e) => update({ minNights: num(e.target.value) })} />
                  <div className="sm:col-span-2">
                    <RadioCards
                      label="Cancellation policy"
                      value={form.cancellationPolicy}
                      onChange={(v) => update({ cancellationPolicy: v })}
                      columns={3}
                      options={[
                        { value: 'flexible', label: 'Flexible', hint: 'Full refund until 1 day before.' },
                        { value: 'moderate', label: 'Moderate', hint: 'Full refund until 5 days before.' },
                        { value: 'strict', label: 'Strict', hint: '50% back until 7 days before.' },
                      ]}
                    />
                  </div>
                  <TextArea label="House rules" className="sm:col-span-2" rows={3} value={form.houseRules ?? ''} onChange={(e) => update({ houseRules: e.target.value || undefined })} />
                </>
              )}
            </div>
          </Card>

          <PhotosCard listing={l} onChange={(updated) => setData({ ...data, listing: updated })} reload={reload} />
        </fieldset>

        <aside className="space-y-4">
          <div className="sticky top-20 space-y-4">
            {!readOnly && (
              <Card>
                {save.error && !Object.keys(f).length ? <div className="mb-3"><ErrorAlert error={save.error} /></div> : null}
                <Button className="w-full" variant={dirty ? 'primary' : 'secondary'} loading={save.busy} onClick={() => void doSave()} disabled={!dirty}>{dirty ? 'Save changes' : 'All changes saved'}</Button>
              </Card>
            )}
            <PublishCard checks={data.checks} state={l.state} />
            {!readOnly && (
              <Card title="Go live">
                {['draft'].includes(l.state) && (
                  <>
                    {submit.error ? <div className="mb-3"><ErrorAlert error={submit.error} /></div> : null}
                    <Button className="w-full" disabled={dirty || unmet.length > 0} loading={submit.busy} onClick={() => void submit.run(async () => { await api.portal.submitListing(l.id); toast('Sent to Abode for review.'); reload() })}>Submit for review</Button>
                    <p className="mt-2 text-xs text-muted">{dirty ? 'Save your changes first.' : unmet.length ? 'Complete the checklist above first.' : 'Abode checks new listings, usually within a day.'}</p>
                  </>
                )}
                {l.state === 'in_review' && <p className="text-muted">Abode is reviewing this listing. You’ll get a notification when it’s live.</p>}
                <div className="mt-3 flex flex-col gap-2">
                  {l.state === 'published' && <Button variant="secondary" onClick={() => act('pause')} loading={stateAction.busy}>Pause</Button>}
                  {l.state === 'paused' && <Button variant="secondary" onClick={() => act('resume')} loading={stateAction.busy}>Resume</Button>}
                  {['published', 'expired'].includes(l.state) && <Button variant="secondary" onClick={() => act('renew')} loading={stateAction.busy}>Renew for 60 days</Button>}
                  {['published', 'paused'].includes(l.state) && l.intent !== 'short_stay' && <Button variant="secondary" onClick={() => act('let_or_sold')} loading={stateAction.busy}>{l.intent === 'sale' ? 'Mark as sold' : 'Mark as let'}</Button>}
                  {!['withdrawn', 'archived', 'let_or_sold'].includes(l.state) && <Button variant="ghost" onClick={() => setWithdrawOpen(true)}>Withdraw listing</Button>}
                </div>
                {stateAction.error ? <div className="mt-3"><ErrorAlert error={stateAction.error} /></div> : null}
                {l.expiresOn && l.state === 'published' && <p className="mt-3 text-xs text-muted">Live until {formatDate(l.expiresOn)}.</p>}
              </Card>
            )}
            {l.intent === 'short_stay' && (
              <Link to={`/portal/listings/${l.id}/calendar`} className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 font-semibold hover:border-ink/40">
                <CalendarDays className="size-4" aria-hidden /> Availability and prices
              </Link>
            )}
            {l.state === 'published' && <Link to={`/listings/${l.id}`} className="block text-center text-sm font-semibold text-brand-700 hover:underline">View the public page</Link>}
            <Card title="History">
              <ol className="space-y-2 text-sm">
                {[...l.history].reverse().slice(0, 6).map((h, i) => (
                  <li key={i}>
                    <ListingStatusPill state={h.state} /> <span className="text-muted">{h.by} · {formatDateTime(h.at)}</span>
                    {h.note && <p className="mt-0.5">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </aside>
      </div>
      <ReasonDialog
        open={withdrawOpen}
        title="Withdraw this listing?"
        body="It disappears from search straight away. You can create it again later."
        confirmLabel="Withdraw"
        danger
        reasonHint="For example: the owner has decided not to let it."
        onClose={() => setWithdrawOpen(false)}
        onConfirm={async (reason) => {
          await api.portal.setListingState(l.id, 'withdraw', reason)
          toast('Listing withdrawn.')
          reload()
        }}
      />
    </div>
  )
}

/** PROP-020, FE-SUP-010: every unmet condition, each with how to fix it. */
function PublishCard({ checks, state }: { checks: PublishCheck[]; state: ListingState }) {
  const unmet = checks.filter((c) => !c.met).length
  return (
    <Card title="Checklist">
      <p className="mb-3 text-sm text-muted">{unmet ? `${unmet} to do before this can go live.` : state === 'draft' ? 'Ready to submit.' : 'Everything is in place.'}</p>
      <ul className="space-y-2.5">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm">
            {c.met ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-fg" aria-label="Done" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted" aria-label="To do" />}
            <span>
              <span className={cx(c.met && 'text-muted')}>{c.label}</span>
              {!c.met && <span className="block text-xs text-muted">{c.fix}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

const fileToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('The photo could not be read.'))
    r.readAsDataURL(blob)
  })

/** PROP-025 to 033: upload, then describe each photo and confirm you have the rights. */
function PhotosCard({ listing, onChange, reload }: { listing: ManagedListing; onChange(l: ManagedListing): void; reload(): void }) {
  const upload = useAction()
  const edit = useAction()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const rooms = useMemo(() => ['Exterior', 'Living room', 'Bedroom', 'Kitchen', 'Bathroom', 'Garden', 'View', 'Office space', 'Other'], [])
  const patch = (photoId: string, p: Parameters<typeof api.portal.updatePhoto>[2]) => void edit.run(async () => onChange(await api.portal.updatePhoto(listing.id, photoId, p)))

  return (
    <Card title="Photos" actions={<span className="text-sm text-muted">{listing.photos.length} of 30</span>}>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center hover:border-ink/40">
        <ImagePlus className="size-8 text-muted" aria-hidden />
        <span className="font-semibold">{upload.busy ? 'Uploading…' : 'Add photos'}</span>
        <span className="text-sm text-muted">JPG or PNG. We resize large photos for you.</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          disabled={upload.busy}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            void upload.run(async () => {
              const prepared = []
              for (const file of files) {
                if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is larger than 20 MB.`)
                prepared.push({ url: await fileToDataUrl(await resizeImage(file)), alt: '', rightsConfirmed: false })
              }
              onChange(await api.portal.addPhotos(listing.id, prepared))
              setTimeout(reload, 5500)
            })
          }}
        />
      </label>
      {upload.error ? <div className="mt-3"><ErrorAlert error={upload.error} title="Some photos couldn’t be added" /></div> : null}
      {edit.error ? <div className="mt-3"><ErrorAlert error={edit.error} /></div> : null}
      <ul className="mt-4 space-y-4">
        {listing.photos.map((p, i) => (
          <li key={p.id} className="grid gap-3 rounded-2xl border border-line p-3 sm:grid-cols-[140px_1fr]">
            <div className="relative">
              <SafeImage src={p.url} alt={p.alt} className="aspect-[4/3] w-full rounded-xl" />
              {i === 0 && <span className="absolute top-2 left-2 rounded-md bg-white/90 px-2 py-0.5 text-xs font-semibold">Cover photo</span>}
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'info'}>{p.status === 'pending' ? 'Checking photo' : p.status === 'approved' ? 'Approved' : 'Rejected'}</StatusPill>
                {i > 0 && <Button size="sm" variant="ghost" onClick={() => patch(p.id, { makePrimary: true })}><Star className="size-3.5" aria-hidden /> Make cover</Button>}
                <Button size="sm" variant="ghost" onClick={() => patch(p.id, { remove: true })} aria-label="Remove photo"><Trash2 className="size-3.5" aria-hidden /> Remove</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <TextField label="Describe the photo" placeholder="e.g. Bright living room with garden view" value={drafts[p.id] ?? p.alt} onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })} onBlur={() => drafts[p.id] !== undefined && drafts[p.id] !== p.alt && patch(p.id, { alt: drafts[p.id] })} hint={!p.alt ? 'Needed for people using screen readers.' : undefined} />
                <SelectField label="Room" value={p.room ?? ''} onChange={(e) => patch(p.id, { room: e.target.value })} options={rooms} />
              </div>
              <Checkbox label="I took this photo or have permission to use it" checked={p.rightsConfirmed} onChange={(e) => patch(p.id, { rightsConfirmed: e.target.checked })} />
            </div>
          </li>
        ))}
      </ul>
      {!listing.photos.length && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted"><House className="size-4" aria-hidden /> Listings with at least 5 good photos get far more enquiries.</p>
      )}
    </Card>
  )
}
