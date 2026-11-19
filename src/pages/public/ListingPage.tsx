/** Listing detail: booking panel for short stays; enquiry and viewing request for rent, sale and commercial. */
import { Flag, MapPin, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../app/auth'
import { Calendar } from '../../components/Calendar'
import { ListingFacts, PhotoGallery, SaveButton } from '../../components/listing'
import { intentLabel, propertyTypeLabel } from '../../config'
import { useToast } from '../../context/ToastContext'
import { ApiError, type ListingDetail, type Quote, type Report } from '../../contracts'
import { Alert, Button, Card, Counter, ErrorAlert, ErrorState, fieldErrors, Modal, PriceBreakdown, PriceTag, PromotedLabel, RadioCards, SelectField, Spinner, TextArea, TextField, TrustBadge } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { addDays, formatStay, isISODate, today, type DateRange } from '../../lib/dates'
import { formatRating, fromLocalInput, plural } from '../../lib/format'
import { api } from '../../services/api'

export function ListingPage() {
  const { id = '' } = useParams()
  const { data: l, error, loading, reload } = useAsync(() => api.pub.listing(id), [id])
  const [reportOpen, setReportOpen] = useState(false)

  if (loading && !l) return <Spinner />
  if (error || !l) return <ErrorState error={error} onRetry={reload} />

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-700">
            {intentLabel(l.intent)} · {propertyTypeLabel(l.propertyType)}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{l.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1 text-muted">
              <MapPin className="size-4" aria-hidden /> {l.locationText}
            </span>
            {l.rating !== undefined && l.reviewCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-4 fill-ink" aria-hidden /> {formatRating(l.rating)} · {plural(l.reviewCount, 'review')}
              </span>
            )}
            <TrustBadge verification={l.verification} today={today()} />
            {l.promoted && <PromotedLabel />}
          </div>
        </div>
        <SaveButton listingId={l.id} className="border border-line" />
      </div>

      <PhotoGallery photos={l.photos} title={l.title} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section className="border-b border-line pb-8">
            <ListingFacts l={l} className="text-base" />
            {l.availableFrom && <p className="mt-2 text-muted">Available from {new Date(l.availableFrom).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
            {l.furnished !== undefined && <p className="mt-1 text-muted">{l.furnished ? 'Furnished' : 'Unfurnished'}</p>}
          </section>
          <section>
            <h2 className="text-xl font-bold">About this place</h2>
            <p className="mt-3 leading-relaxed whitespace-pre-line">{l.description}</p>
          </section>
          {l.features.length > 0 && (
            <section>
              <h2 className="text-xl font-bold">What it has</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {l.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-brand-700" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(l.houseRules || l.cancellationText) && (
            <section className="grid gap-6 sm:grid-cols-2">
              {l.houseRules && (
                <div>
                  <h3 className="font-semibold">House rules</h3>
                  <p className="mt-1 text-muted">{l.houseRules}</p>
                </div>
              )}
              {l.cancellationText && (
                <div>
                  <h3 className="font-semibold">Cancellation</h3>
                  <p className="mt-1 text-muted">{l.cancellationText}</p>
                </div>
              )}
            </section>
          )}
          <Card>
            <p className="text-sm text-muted">Listed by</p>
            <p className="text-lg font-semibold">{l.org.name}</p>
            {l.agent && (
              <p className="mt-1 text-muted">
                Agent: {l.agent.name}
                {l.agent.licenceNumber && <span className="text-sm"> · Licence {l.agent.licenceNumber}</span>}
              </p>
            )}
            <div className="mt-3">
              <TrustBadge verification={l.verification} today={today()} />
            </div>
            <p className="mt-3 text-sm text-muted">For your safety, keep messages and payments on Abode. Never send money before a viewing.</p>
          </Card>
          <button type="button" onClick={() => setReportOpen(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
            <Flag className="size-4" aria-hidden /> Report this listing
          </button>
        </div>

        <aside>
          <div className="sticky top-24">{l.intent === 'short_stay' ? <BookingPanel l={l} /> : <EnquiryPanel l={l} />}</div>
        </aside>
      </div>
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} target={{ kind: 'listing', id: l.id, label: l.title }} />
    </div>
  )
}

// ── Short stays ─────────────────────────────────────────────────────────────

function BookingPanel({ l }: { l: ListingDetail }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [range, setRange] = useState<DateRange>(() => {
    const ci = params.get('checkIn')
    const co = params.get('checkOut')
    return isISODate(ci) && isISODate(co) ? { start: ci!, end: co! } : {}
  })
  const [guests, setGuests] = useState(() => Math.min(Number(params.get('guests')) || 1, l.maxGuests ?? 16))
  const cal = useAsync(() => api.pub.calendar(l.id, today(), 120), [l.id])
  const blocked = useMemo(() => new Set(cal.data?.filter((d) => !d.available).map((d) => d.date)), [cal.data])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState<unknown>(null)
  const [quoting, setQuoting] = useState(false)
  const [requote, setRequote] = useState(0)
  const reserve = useAction()

  useEffect(() => {
    setQuote(null)
    setQuoteError(null)
    if (!range.start || !range.end) return
    let current = true
    setQuoting(true)
    api.pub.quote(l.id, range.start, range.end, guests).then(
      (q) => current && setQuote(q),
      (e) => current && setQuoteError(e),
    ).finally(() => current && setQuoting(false))
    return () => {
      current = false
    }
  }, [l.id, range.start, range.end, guests, requote])

  const onReserve = () =>
    void reserve.run(async () => {
      if (!user) {
        navigate('/login', { state: { from: { pathname: location.pathname, search: `?checkIn=${range.start}&checkOut=${range.end}&guests=${guests}` } } })
        return
      }
      if (!user.emailVerified) {
        navigate('/verify', { state: { from: location } })
        return
      }
      const hold = await api.pub.hold(quote!.id)
      navigate(`/checkout/${hold.id}`)
    })

  const expired = reserve.error instanceof ApiError && reserve.error.reason === 'QUOTE_EXPIRED'

  return (
    <Card>
      <PriceTag amount={l.price} basis="per_night" size="lg" />
      {l.minNights && l.minNights > 1 && <p className="mt-1 text-sm text-muted">Minimum stay {plural(l.minNights, 'night')}</p>}
      <div className="mt-4 -mx-1">
        {cal.loading && !cal.data ? <Spinner label="Loading dates" /> : <Calendar range={range} onChange={setRange} blocked={blocked} months={1} />}
      </div>
      <div className="flex items-center justify-between border-t border-line pt-2 text-sm">
        <span className="text-muted">{range.start && range.end ? formatStay(range.start, range.end) : range.start ? 'Choose check-out' : 'Choose check-in'}</span>
        {(range.start || range.end) && (
          <button type="button" className="font-semibold underline" onClick={() => setRange({})}>Clear</button>
        )}
      </div>
      <div className="border-b border-line">
        <Counter label="Guests" value={guests} min={1} max={l.maxGuests ?? 16} onChange={setGuests} hint={l.maxGuests ? `Up to ${l.maxGuests}` : undefined} />
      </div>
      <div className="mt-4 space-y-4">
        {quoting && <Spinner label="Getting the price" />}
        {quoteError ? <ErrorAlert error={quoteError} title="These dates can’t be booked" /> : null}
        {quote && !quoting && (
          <>
            <PriceBreakdown lines={quote.lines} total={quote.total} />
            <p className="text-xs text-muted">{quote.cancellationText}</p>
          </>
        )}
        {reserve.error ? <ErrorAlert error={reserve.error} /> : null}
        <Button className="w-full" size="lg" disabled={!quote || quoting} loading={reserve.busy} onClick={expired ? () => { reserve.setError(null); setRequote((n) => n + 1) } : onReserve}>
          {expired ? 'Get a new price' : 'Reserve'}
        </Button>
        <p className="text-center text-xs text-muted">You won’t be charged yet. We’ll hold the dates for 10 minutes while you pay.</p>
      </div>
    </Card>
  )
}

// ── Rent, sale, commercial ──────────────────────────────────────────────────

function EnquiryPanel({ l }: { l: ListingDetail }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [message, setMessage] = useState(`Hello, I’m interested in “${l.title}”. Is it still available?`)
  const [method, setMethod] = useState<'in_app' | 'phone' | 'email'>('in_app')
  const [sent, setSent] = useState<string | null>(null)
  const [viewingOpen, setViewingOpen] = useState(false)
  const send = useAction()

  const needSignIn = () => {
    if (!user) {
      navigate('/login', { state: { from: location } })
      return true
    }
    if (!user.emailVerified) {
      navigate('/verify', { state: { from: location } })
      return true
    }
    return false
  }

  return (
    <Card>
      <PriceTag amount={l.price} basis={l.basis} size="lg" />
      {sent ? (
        <div className="mt-4 space-y-3">
          <Alert tone="success" title="Enquiry sent">
            {l.org.name} will reply in your messages. Sending an enquiry doesn’t hold or reserve the property.
          </Alert>
          <Link to={`/messages/${sent}`} className="block text-center font-semibold text-brand-700 hover:underline">Open the conversation</Link>
        </div>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (needSignIn()) return
            void send.run(async () => {
              const enquiry = await api.pub.enquire(l.id, { message, contactMethod: method })
              setSent(enquiry.threadId)
              toast('Enquiry sent.')
            })
          }}
        >
          <TextArea label="Your message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} error={fieldErrors(send.error).message} />
          <SelectField label="How should they reply?" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} placeholder={false} options={[{ value: 'in_app', label: 'Abode messages' }, { value: 'phone', label: 'Phone call' }, { value: 'email', label: 'Email' }]} />
          {send.error && !fieldErrors(send.error).message ? <ErrorAlert error={send.error} /> : null}
          <Button type="submit" className="w-full" loading={send.busy}>Send enquiry</Button>
        </form>
      )}
      <div className="mt-4 border-t border-line pt-4">
        <Button variant="secondary" className="w-full" onClick={() => !needSignIn() && setViewingOpen(true)}>Request a viewing</Button>
        <p className="mt-2 text-center text-xs text-muted">Free. The agent confirms a time that suits you both.</p>
      </div>
      <ViewingRequestDialog listing={l} open={viewingOpen} onClose={() => setViewingOpen(false)} />
    </Card>
  )
}

function ViewingRequestDialog({ listing, open, onClose }: { listing: ListingDetail; open: boolean; onClose(): void }) {
  const navigate = useNavigate()
  const tomorrow = `${addDays(today(), 1)}T10:00`
  const [slots, setSlots] = useState<string[]>([tomorrow, `${addDays(today(), 2)}T15:00`])
  const [note, setNote] = useState('')
  const { busy, error, run } = useAction()
  return (
    <Modal open={open} onClose={onClose} title="Request a viewing">
      <h2 className="text-xl font-bold">Request a viewing</h2>
      <p className="mt-1 text-muted">Suggest up to three times. Times are in Ghana time (GMT).</p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            const v = await api.pub.requestViewing(listing.id, slots.filter(Boolean).map(fromLocalInput), note)
            navigate(`/viewings/${v.id}`)
          })
        }}
      >
        {slots.map((s, i) => (
          <TextField key={i} label={`Option ${i + 1} (GMT)`} type="datetime-local" value={s} min={`${today()}T00:00`} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
        {slots.length < 3 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setSlots([...slots, ''])}>Add another time</Button>
        )}
        <TextArea label="Anything the agent should know? (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        {error ? <ErrorAlert error={error} /> : null}
        <Button type="submit" className="w-full" loading={busy}>Send request</Button>
      </form>
    </Modal>
  )
}

export function ReportDialog({ open, onClose, target }: { open: boolean; onClose(): void; target: Report['target'] }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [category, setCategory] = useState<Report['category']>('inaccurate')
  const [detail, setDetail] = useState('')
  const { busy, error, run } = useAction()
  return (
    <Modal open={open} onClose={onClose} title="Report">
      <h2 className="text-xl font-bold">Report {target.kind === 'listing' ? 'this listing' : 'this'}</h2>
      {!user ? (
        <div className="mt-4">
          <p className="text-muted">Please sign in so we can follow up with you.</p>
          <Button className="mt-4 w-full" onClick={() => navigate('/login', { state: { from: location } })}>Sign in</Button>
        </div>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await api.pub.report(target, category, detail)
              toast('Thanks. Our team will review your report.')
              onClose()
            })
          }}
        >
          <RadioCards<Report['category']>
            label="What’s wrong?"
            value={category}
            onChange={setCategory}
            options={[
              { value: 'fraud', label: 'It looks like a scam', hint: 'For example, asking for money before a viewing.' },
              { value: 'inaccurate', label: 'Details are wrong', hint: 'Photos, price or location don’t match.' },
              { value: 'duplicate', label: 'It’s listed more than once' },
              { value: 'offensive', label: 'Offensive content' },
              { value: 'other', label: 'Something else' },
            ]}
          />
          <TextArea label="Tell us more (optional)" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
          {error ? <ErrorAlert error={error} /> : null}
          <Button type="submit" className="w-full" loading={busy}>Send report</Button>
        </form>
      )}
    </Modal>
  )
}
