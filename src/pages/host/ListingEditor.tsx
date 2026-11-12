import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Star, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AMENITY_ICONS, PROPERTY_ICONS } from '../../components/icons'
import { Logo } from '../../components/Logo'
import { SafeImage } from '../../components/SafeImage'
import { Button, Counter, cx, ErrorState, InlineError, SelectField, Spinner, TextArea, TextField } from '../../components/ui'
import {
  AMENITIES,
  amenityLabel,
  CURRENCY_SYMBOL,
  GHANA_REGIONS,
  MAX_DESCRIPTION,
  MAX_TITLE,
  MIN_PHOTOS,
  PLACE_TYPES,
  placeTypeLabel,
  PROPERTY_TYPES,
  propertyTypeLabel,
  SERVICE_FEE_RATE,
} from '../../config'
import { ApiError, errorMessage, type Listing, type ListingInput, type ListingStatus } from '../../contracts'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { plural, money } from '../../lib/format'
import { resizeImage } from '../../lib/images'
import { emptyListingInput, publishProblems } from '../../lib/listingRules'
import { quoteStay } from '../../lib/pricing'
import { api } from '../../services/api'
import { NotFoundPage } from '../NotFoundPage'

const STEPS = [
  { id: 'type', title: 'Which of these best describes your place?', short: 'Type' },
  { id: 'location', title: 'Where’s your place located?', short: 'Location' },
  { id: 'basics', title: 'Share some basics about your place', short: 'Basics' },
  { id: 'amenities', title: 'Tell guests what your place has to offer', short: 'Amenities' },
  { id: 'photos', title: 'Add some photos of your place', short: 'Photos' },
  { id: 'describe', title: 'Now, give it a title and description', short: 'Description' },
  { id: 'price', title: 'Set your price', short: 'Price' },
  { id: 'review', title: 'Check everything, then publish', short: 'Review' },
] as const

type StepId = (typeof STEPS)[number]['id']

/** What stops the host moving past this step. */
function blockerFor(step: StepId, l: ListingInput): string | null {
  switch (step) {
    case 'location':
      if (!l.location.address.trim() || !l.location.city.trim() || !l.location.region) return 'Fill in the street, town and region to continue.'
      return null
    case 'photos':
      return l.photos.length < MIN_PHOTOS ? `Add at least ${MIN_PHOTOS} photos to continue (${l.photos.length} so far).` : null
    case 'describe':
      if (!l.title.trim()) return 'Add a title to continue.'
      if (l.description.trim().length < 30) return 'Write at least 30 characters of description to continue.'
      return null
    case 'price':
      return l.pricePerNight > 0 ? null : 'Set a nightly price to continue.'
    default:
      return null
  }
}

const toInput = ({ id: _id, hostId: _h, rating: _r, reviewCount: _c, createdAt: _ca, updatedAt: _u, ...input }: Listing): ListingInput => input

export default function ListingEditor() {
  const { id } = useParams()
  if (!id) return <Editor initial={emptyListingInput()} />
  return <EditExisting id={id} />
}

function EditExisting({ id }: { id: string }) {
  const { data, error, reload } = useAsync(() => api.hosting.getListing(id), [id])
  if (error instanceof ApiError && error.code === 'NOT_FOUND') return <NotFoundPage message="That listing doesn’t exist, or it isn’t yours." />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data) return <Spinner label="Loading your listing" />
  return <Editor initial={toInput(data)} existingId={data.id} />
}

function Editor({ initial, existingId }: { initial: ListingInput; existingId?: string }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [input, setInput] = useState(initial)
  const [listingId, setListingId] = useState(existingId)
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(existingId ? STEPS.length - 1 : 0)
  const [saving, setSaving] = useState<'exit' | 'publish' | 'keep' | null>(null)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [uploading, setUploading] = useState(0)

  const wasLive = initial.status === 'listed'
  const current = STEPS[step]!
  const blocker = blockerFor(current.id, input)
  const isLast = step === STEPS.length - 1

  // Warn before closing the tab on unsaved work.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => window.scrollTo(0, 0), [step])

  const update = (patch: Partial<ListingInput>) => {
    setInput((l) => ({ ...l, ...patch }))
    setDirty(true)
  }
  const updateLocation = (patch: Partial<ListingInput['location']>) => {
    setInput((l) => ({ ...l, location: { ...l.location, ...patch } }))
    setDirty(true)
  }
  const updatePhotos = (fn: (photos: string[]) => string[]) => {
    setInput((l) => ({ ...l, photos: fn(l.photos) }))
    setDirty(true)
  }

  const goTo = (i: number) => {
    setError('')
    setStep(i)
    setFurthest((f) => Math.max(f, i))
  }

  async function save(status: ListingStatus) {
    const body = { ...input, status }
    const saved = listingId ? await api.hosting.updateListing(listingId, body) : await api.hosting.createListing(body)
    setListingId(saved.id)
    setInput(toInput(saved))
    setDirty(false)
    return saved
  }

  const run = async (kind: 'exit' | 'publish' | 'keep', status: ListingStatus, done: (l: Listing) => void) => {
    if (uploading) {
      setError('Wait for your photos to finish uploading.')
      return
    }
    setSaving(kind)
    setError('')
    try {
      done(await save(status))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(null)
    }
  }

  // "Save & exit" keeps a live listing live; anything else stays a draft.
  const saveAndExit = () =>
    run('exit', input.status === 'draft' ? 'draft' : input.status, () => {
      toast('Saved')
      navigate('/host?tab=listings')
    })

  const publish = () =>
    run('publish', 'listed', (l) => {
      toast(wasLive ? 'Changes saved' : 'Your place is live! Guests can book it now.')
      navigate(wasLive ? '/host?tab=listings' : `/listings/${l.id}`)
    })

  const keepStatus = () =>
    run('keep', input.status, () => {
      toast(input.status === 'draft' ? 'Draft saved' : 'Changes saved')
      navigate('/host?tab=listings')
    })

  const problems = publishProblems(input)

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 md:h-20">
          <div className="flex min-w-0 items-center gap-3">
            <Logo compact />
            <p className="truncate text-sm text-muted">{existingId ? `Editing “${initial.title || 'Untitled'}”` : 'New listing'}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {!dirty && !listingId && (
              <Link to="/host" className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-stone-100">
                Exit
              </Link>
            )}
            {(dirty || listingId) && (
              <Button variant="secondary" size="sm" className="rounded-full" onClick={saveAndExit} loading={saving === 'exit'} disabled={!!saving}>
                Save &amp; exit
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-14">
          <p className="text-sm font-semibold text-brand-700">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{current.title}</h1>
          <div className="mt-8">
            {current.id === 'type' && <TypeStep input={input} update={update} />}
            {current.id === 'location' && <LocationStep input={input} updateLocation={updateLocation} />}
            {current.id === 'basics' && <BasicsStep input={input} update={update} />}
            {current.id === 'amenities' && <AmenitiesStep input={input} update={update} />}
            {current.id === 'photos' && <PhotosStep photos={input.photos} updatePhotos={updatePhotos} uploading={uploading} setUploading={setUploading} />}
            {current.id === 'describe' && <DescribeStep input={input} update={update} />}
            {current.id === 'price' && <PriceStep input={input} update={update} />}
            {current.id === 'review' && <ReviewStep input={input} problems={problems} goTo={goTo} />}
          </div>
        </div>
      </main>

      <footer className="pb-safe sticky bottom-0 z-30 border-t border-line bg-white">
        <nav aria-label="Steps" className="flex gap-1 px-1 pt-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              disabled={i > furthest || !!saving}
              onClick={() => goTo(i)}
              aria-label={`Step ${i + 1}: ${s.short}`}
              aria-current={i === step ? 'step' : undefined}
              title={s.short}
              className={cx('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-ink' : i <= furthest ? 'bg-ink/30' : 'bg-stone-200')}
            />
          ))}
        </nav>
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 md:py-4">
          {(error || (blocker && !isLast)) && (
            <div className="mb-3">{error ? <InlineError>{error}</InlineError> : <p className="text-sm text-muted">{blocker}</p>}</div>
          )}
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0 || !!saving} className="underline underline-offset-4">
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Button>
            {isLast ? (
              <div className="flex gap-2">
                {!wasLive && (
                  <Button variant="secondary" onClick={keepStatus} loading={saving === 'keep'} disabled={!!saving}>
                    {input.status === 'unlisted' ? 'Save' : 'Save draft'}
                  </Button>
                )}
                <Button onClick={publish} loading={saving === 'publish'} disabled={!!saving || problems.length > 0}>
                  {wasLive ? 'Save changes' : 'Publish listing'}
                </Button>
              </div>
            ) : (
              <Button variant="dark" onClick={() => goTo(step + 1)} disabled={!!blocker || !!saving}>
                Next <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Steps ───────────────────────────────────────────────────────────────────

type StepProps = { input: ListingInput; update(patch: Partial<ListingInput>): void }

function ChoiceCard({ selected, onClick, children, className }: { selected: boolean; onClick(): void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'rounded-2xl border p-4 text-left transition-all',
        selected ? 'border-ink bg-stone-50 ring-1 ring-ink' : 'border-line hover:border-ink/50',
        className,
      )}
    >
      {children}
    </button>
  )
}

function TypeStep({ input, update }: StepProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PROPERTY_TYPES.map((t) => {
          const Icon = PROPERTY_ICONS[t.id]
          return (
            <ChoiceCard key={t.id} selected={input.propertyType === t.id} onClick={() => update({ propertyType: t.id })} className="flex flex-col gap-3">
              <Icon className="size-8" strokeWidth={1.4} aria-hidden />
              <span className="font-semibold">{t.label}</span>
            </ChoiceCard>
          )
        })}
      </div>
      <h2 className="mt-12 text-xl font-bold">What will guests have?</h2>
      <div className="mt-4 space-y-3">
        {PLACE_TYPES.map((p) => (
          <ChoiceCard key={p.id} selected={input.placeType === p.id} onClick={() => update({ placeType: p.id })} className="block w-full">
            <span className="block font-semibold">{p.label}</span>
            <span className="block text-sm text-muted">{p.hint}</span>
          </ChoiceCard>
        ))}
      </div>
    </>
  )
}

function LocationStep({ input, updateLocation }: { input: ListingInput; updateLocation(p: Partial<ListingInput['location']>): void }) {
  const { address, city, region, country } = input.location
  return (
    <div className="space-y-5">
      <p className="-mt-4 text-muted">Guests see the town and region. You share the exact address with them after they book.</p>
      <TextField label="Street or area" value={address} onChange={(e) => updateLocation({ address: e.target.value })} placeholder="e.g. Lagos Avenue, East Legon" autoComplete="street-address" />
      <TextField label="Town or city" value={city} onChange={(e) => updateLocation({ city: e.target.value })} placeholder="e.g. Accra" autoComplete="address-level2" />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Region" options={GHANA_REGIONS} value={region} onChange={(e) => updateLocation({ region: e.target.value })} />
        <TextField label="Country" value={country} readOnly hint={`${'For now, places must be in Ghana.'}`} />
      </div>
    </div>
  )
}

function BasicsStep({ input, update }: StepProps) {
  return (
    <div className="divide-y divide-line">
      <Counter label="Guests" value={input.maxGuests} min={1} max={16} onChange={(v) => update({ maxGuests: v })} />
      <Counter label="Bedrooms" hint="0 for a studio" value={input.bedrooms} min={0} max={20} onChange={(v) => update({ bedrooms: v })} />
      <Counter label="Beds" value={input.beds} min={1} max={30} onChange={(v) => update({ beds: v })} />
      <Counter label="Bathrooms" value={input.bathrooms} min={1} max={20} onChange={(v) => update({ bathrooms: v })} />
    </div>
  )
}

function AmenitiesStep({ input, update }: StepProps) {
  const toggle = (id: (typeof AMENITIES)[number]['id']) =>
    update({ amenities: input.amenities.includes(id) ? input.amenities.filter((a) => a !== id) : [...input.amenities, id] })
  return (
    <>
      <p className="-mt-4 mb-6 text-muted">Pick everything guests can use. Power and water backups matter to a lot of guests, so include them if you have them.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {AMENITIES.map((a) => {
          const Icon = AMENITY_ICONS[a.id]
          return (
            <ChoiceCard key={a.id} selected={input.amenities.includes(a.id)} onClick={() => toggle(a.id)} className="flex flex-col gap-3">
              <Icon className="size-7" strokeWidth={1.4} aria-hidden />
              <span className="text-sm font-semibold">{a.label}</span>
            </ChoiceCard>
          )
        })}
      </div>
    </>
  )
}

function PhotosStep({
  photos,
  updatePhotos,
  uploading,
  setUploading,
}: {
  photos: string[]
  updatePhotos(fn: (p: string[]) => string[]): void
  uploading: number
  setUploading(fn: (n: number) => number): void
}) {
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [link, setLink] = useState('')

  const addFiles = async (files: FileList | File[]) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'))
    if (!images.length) {
      toast('Choose image files: JPG, PNG or WebP.', 'error')
      return
    }
    setUploading((n) => n + images.length)
    for (const file of images) {
      try {
        const { url } = await api.uploads.photo(await resizeImage(file))
        updatePhotos((p) => [...p, url])
      } catch (e) {
        toast(errorMessage(e), 'error')
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void addFiles(e.dataTransfer.files)
  }

  const move = (from: number, to: number) =>
    updatePhotos((p) => {
      const next = [...p]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item!)
      return next
    })

  const addLink = () => {
    const url = link.trim()
    if (!/^https?:\/\/\S+$/i.test(url)) {
      toast('Paste a full image link starting with https://', 'error')
      return
    }
    updatePhotos((p) => [...p, url])
    setLink('')
  }

  return (
    <>
      <p className="-mt-4 mb-6 text-muted">
        You need at least {MIN_PHOTOS} to publish. Bright, wide shots of each room work best. The first photo is your cover.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-brand-600 bg-brand-50' : 'border-ink/20',
        )}
      >
        <ImagePlus className="size-10 text-ink/60" strokeWidth={1.25} aria-hidden />
        <p className="font-semibold">Drag your photos here</p>
        <p className="text-sm text-muted">or</p>
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          <Upload className="size-4" aria-hidden /> Choose from your device
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor="photo-link">
          Image link
        </label>
        <input
          id="photo-link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
          placeholder="…or paste an image link"
          className="h-11 flex-1 rounded-xl border border-ink/20 px-3.5 text-sm focus:border-brand-600 focus:outline-none"
        />
        <Button variant="secondary" onClick={addLink} disabled={!link.trim()}>
          Add
        </Button>
      </div>

      <p className="mt-8 mb-3 text-sm font-semibold" aria-live="polite">
        {plural(photos.length, 'photo')} added{photos.length < MIN_PHOTOS && ` · ${MIN_PHOTOS - photos.length} more needed`}
        {uploading > 0 && (
          <span className="ml-2 inline-flex items-center gap-1.5 text-muted">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Uploading {uploading}…
          </span>
        )}
      </p>

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((src, i) => (
            <li key={`${i}-${src.slice(-24)}`} className={cx('group relative overflow-hidden rounded-2xl', i === 0 && 'col-span-2 sm:col-span-3')}>
              <SafeImage src={src} alt={`Photo ${i + 1}`} className={cx('w-full', i === 0 ? 'aspect-[16/9]' : 'aspect-square')} />
              {i === 0 && <span className="absolute top-3 left-3 rounded-full bg-white px-3 py-1 text-xs font-bold shadow">Cover photo</span>}
              <div className="absolute top-2 right-2 flex gap-1.5">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => move(i, 0)}
                    className="grid size-8 place-items-center rounded-full bg-white/95 shadow hover:bg-white"
                    aria-label={`Make photo ${i + 1} the cover`}
                    title="Make cover photo"
                  >
                    <Star className="size-4" />
                  </button>
                )}
                {i > 0 && (
                  <button type="button" onClick={() => move(i, i - 1)} className="grid size-8 place-items-center rounded-full bg-white/95 shadow hover:bg-white" aria-label={`Move photo ${i + 1} earlier`} title="Move earlier">
                    <ArrowLeft className="size-4" />
                  </button>
                )}
                {i < photos.length - 1 && (
                  <button type="button" onClick={() => move(i, i + 1)} className="grid size-8 place-items-center rounded-full bg-white/95 shadow hover:bg-white" aria-label={`Move photo ${i + 1} later`} title="Move later">
                    <ArrowRight className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => updatePhotos((p) => p.filter((_, j) => j !== i))}
                  className="grid size-8 place-items-center rounded-full bg-white/95 text-red-700 shadow hover:bg-white"
                  aria-label={`Remove photo ${i + 1}`}
                  title="Remove"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function DescribeStep({ input, update }: StepProps) {
  const descLen = input.description.trim().length
  return (
    <div className="space-y-6">
      <TextField
        label="Title"
        value={input.title}
        maxLength={MAX_TITLE}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="e.g. Sunlit 3-bedroom home in East Legon"
        hint={`Short and specific works best. ${input.title.length}/${MAX_TITLE}`}
      />
      <TextArea
        label="Description"
        value={input.description}
        maxLength={MAX_DESCRIPTION}
        rows={8}
        onChange={(e) => update({ description: e.target.value })}
        placeholder="What makes your place special? Mention the neighbourhood, what’s nearby, and anything guests should know about power, water or parking."
        hint={descLen < 30 ? `At least 30 characters (${descLen} so far).` : `${input.description.length}/${MAX_DESCRIPTION}`}
      />
    </div>
  )
}

function MoneyInput({ label, value, onChange, big }: { label: string; value: number; onChange(n: number): void; big?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <span
        className={cx(
          'flex items-center rounded-2xl border border-ink/20 bg-white px-4 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20',
          big ? 'h-20' : 'h-12',
        )}
      >
        <span className={cx('font-bold text-muted', big ? 'text-3xl' : 'text-base')}>{CURRENCY_SYMBOL}</span>
        <input
          inputMode="numeric"
          value={value ? String(value) : ''}
          onChange={(e) => onChange(Math.min(Number(e.target.value.replace(/\D/g, '')) || 0, 1_000_000))}
          placeholder="0"
          className={cx('w-full bg-transparent pl-2 font-bold focus:outline-none', big ? 'text-4xl' : 'text-base')}
        />
      </span>
    </label>
  )
}

function PriceStep({ input, update }: StepProps) {
  const example = quoteStay(input, '2026-01-01', '2026-01-04')
  return (
    <div className="space-y-6">
      <p className="-mt-4 text-muted">You can change it any time. Bookings already made keep the price the guest agreed to.</p>
      <MoneyInput big label="Price per night" value={input.pricePerNight} onChange={(n) => update({ pricePerNight: n })} />
      <MoneyInput label="Cleaning fee (once per stay, optional)" value={input.cleaningFee} onChange={(n) => update({ cleaningFee: n })} />
      {input.pricePerNight > 0 && (
        <div className="rounded-2xl bg-stone-50 p-5 text-sm">
          <p className="font-semibold">For a 3-night stay</p>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between">
              <dt className="text-muted">Guest pays (incl. {Math.round(SERVICE_FEE_RATE * 100)}% service fee)</dt>
              <dd className="font-medium">{money(example.total)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-semibold">
              <dt>You earn</dt>
              <dd className="text-brand-700">{money(example.subtotal + example.cleaningFee)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}

function ReviewStep({ input, problems, goTo }: { input: ListingInput; problems: string[]; goTo(i: number): void }) {
  const at = (id: StepId) => STEPS.findIndex((s) => s.id === id)
  const rows: { label: string; value: string; step: StepId }[] = [
    { label: 'Type', value: `${propertyTypeLabel(input.propertyType)} · ${placeTypeLabel(input.placeType)}`, step: 'type' },
    { label: 'Location', value: [input.location.address, input.location.city, input.location.region].filter(Boolean).join(', ') || 'Not set', step: 'location' },
    {
      label: 'Basics',
      value: [plural(input.maxGuests, 'guest'), plural(input.bedrooms, 'bedroom'), plural(input.beds, 'bed'), plural(input.bathrooms, 'bath')].join(' · '),
      step: 'basics',
    },
    { label: 'Amenities', value: input.amenities.length ? input.amenities.map(amenityLabel).join(', ') : 'None selected', step: 'amenities' },
    { label: 'Price', value: input.pricePerNight ? `${money(input.pricePerNight)} a night${input.cleaningFee ? ` + ${money(input.cleaningFee)} cleaning` : ''}` : 'Not set', step: 'price' },
  ]

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-3xl border border-line shadow-[0_6px_24px_rgba(0,0,0,0.08)]">
        <SafeImage src={input.photos[0]} alt="Cover photo" className="aspect-[16/10] w-full" />
        <div className="p-5">
          <p className="text-sm text-muted">
            {propertyTypeLabel(input.propertyType)} in {input.location.city || '…'}
          </p>
          <p className="mt-0.5 text-lg font-semibold">{input.title || 'Untitled listing'}</p>
          <p className="mt-1">
            <span className="font-semibold">{money(input.pricePerNight)}</span> <span className="text-muted">night</span>
          </p>
          <button type="button" onClick={() => goTo(at('photos'))} className="mt-3 text-sm font-semibold underline underline-offset-4">
            Edit photos ({input.photos.length})
          </button>
        </div>
      </div>

      <dl className="divide-y divide-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <dt className="font-semibold">{r.label}</dt>
              <dd className="mt-0.5 text-sm text-muted">{r.value}</dd>
            </div>
            <button type="button" onClick={() => goTo(at(r.step))} className="shrink-0 text-sm font-semibold underline underline-offset-4">
              Edit
            </button>
          </div>
        ))}
        <div className="flex items-start justify-between gap-4 py-4">
          <div className="min-w-0">
            <dt className="font-semibold">Description</dt>
            <dd className="mt-0.5 line-clamp-3 text-sm whitespace-pre-line text-muted">{input.description || 'Not written yet'}</dd>
          </div>
          <button type="button" onClick={() => goTo(at('describe'))} className="shrink-0 text-sm font-semibold underline underline-offset-4">
            Edit
          </button>
        </div>
      </dl>

      {problems.length > 0 ? (
        <div className="rounded-2xl bg-accent-100 p-5">
          <p className="font-semibold">Before you can publish</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-2xl bg-brand-50 p-5 text-sm text-brand-900">
          Everything’s ready. Once you publish, guests can find and book your place straight away.
        </p>
      )}
    </div>
  )
}
