/** Profile, security (two-step sign-in), privacy centre, and starting as a supplier. */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/auth'
import { GHANA_REGIONS, ORG_KINDS } from '../../config'
import { useToast } from '../../context/ToastContext'
import type { Consent, OrgKind } from '../../contracts'
import { Alert, Button, Card, Checkbox, DemoNote, ErrorAlert, fieldErrors, Modal, PageHeader, RadioCards, SelectField, Spinner, TextField } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { api, demo } from '../../services/api'

const CONSENT_LABEL: Record<Consent['purpose'], { label: string; hint: string }> = {
  service_messages: { label: 'Booking and security messages', hint: 'Always on. These are needed to run your account.' },
  marketing_email: { label: 'News and offers by email', hint: 'New places and occasional offers.' },
  marketing_sms: { label: 'News and offers by SMS', hint: 'Rarely, and never more than once a week.' },
  analytics: { label: 'Help improve Abode', hint: 'Anonymous usage statistics. No personal details.' },
}

export function AccountPage() {
  const { user, setUser, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' })
  const save = useAction()
  const consent = useAction()
  const [mfaOpen, setMfaOpen] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [recovery, setRecovery] = useState<string[] | null>(null)
  const mfa = useAction()
  const [disableOpen, setDisableOpen] = useState(false)
  const [password, setPassword] = useState('')
  const exportAction = useAction()
  const [closeOpen, setCloseOpen] = useState(false)
  const [blockers, setBlockers] = useState<string[]>([])
  const close = useAction()
  if (!user) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title="Account and privacy" subtitle={user.email} />
      <div className="space-y-6">
        <Card title="Your details">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              void save.run(async () => {
                setUser(await api.account.updateProfile(profile))
                toast('Details saved.')
              })
            }}
          >
            <TextField label="Full name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} error={fieldErrors(save.error).name} />
            <TextField label="Phone" type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} hint={user.phone ? (user.phoneVerified ? 'Confirmed' : 'Not confirmed yet') : undefined} />
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <Button type="submit" loading={save.busy}>Save details</Button>
              {(!user.emailVerified || (user.phone && !user.phoneVerified)) && (
                <Link to="/verify" className="text-sm font-semibold text-brand-700 hover:underline">Confirm your email or phone</Link>
              )}
            </div>
          </form>
        </Card>

        <Card title="Two-step sign-in">
          <p className="text-muted">{user.mfaEnabled ? 'On. You’ll be asked for a code from your authenticator app when you sign in.' : 'Off. Turn it on to protect your account even if your password is stolen.'}</p>
          <div className="mt-4">
            {user.mfaEnabled ? (
              <Button variant="secondary" onClick={() => setDisableOpen(true)} disabled={!!user.staffRole}>
                {user.staffRole ? 'Required for staff' : 'Turn off'}
              </Button>
            ) : (
              <Button onClick={() => setMfaOpen(true)}>Turn on two-step sign-in</Button>
            )}
          </div>
        </Card>

        <Card title="Privacy choices">
          <div className="space-y-4">
            {user.consents.map((c) => (
              <Checkbox
                key={c.purpose}
                label={CONSENT_LABEL[c.purpose].label}
                hint={CONSENT_LABEL[c.purpose].hint}
                checked={c.granted}
                disabled={c.purpose === 'service_messages' || consent.busy}
                onChange={(e) => void consent.run(async () => setUser(await api.account.setConsent(c.purpose, e.target.checked)))}
              />
            ))}
          </div>
          {consent.error ? <div className="mt-3"><ErrorAlert error={consent.error} /></div> : null}
        </Card>

        <Card title="Your data">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Download a copy of your data</p>
              <p className="text-sm text-muted">Your profile, bookings, enquiries and messages.</p>
            </div>
            <Button variant="secondary" loading={exportAction.busy} onClick={() => void exportAction.run(async () => toast(await api.account.requestExport()))}>Request a copy</Button>
          </div>
          <div className="mt-6 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Close your account</p>
              <p className="text-sm text-muted">We keep some records for legal reasons, such as receipts.</p>
            </div>
            <Button variant="danger" onClick={() => { setBlockers([]); setPassword(''); setCloseOpen(true) }}>Close account</Button>
          </div>
        </Card>
      </div>

      <Modal open={mfaOpen} onClose={() => { setMfaOpen(false); setRecovery(null); setMfaCode('') }} title="Turn on two-step sign-in">
        <h2 className="text-xl font-bold">Turn on two-step sign-in</h2>
        {recovery ? (
          <div className="mt-3 space-y-4">
            <Alert tone="warning" title="Save these recovery codes now">They are shown only once. Each one lets you sign in if you lose your phone.</Alert>
            <ul className="grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-4 font-mono text-sm">{recovery.map((c) => <li key={c}>{c}</li>)}</ul>
            <Button className="w-full" onClick={() => { setMfaOpen(false); setRecovery(null) }}>I’ve saved them</Button>
          </div>
        ) : (
          <form className="mt-3 space-y-4" onSubmit={(e) => { e.preventDefault(); void mfa.run(async () => { const r = await api.account.enableMfa(mfaCode); setUser(r.user); setRecovery(r.recoveryCodes) }) }}>
            <p className="text-muted">Scan the code in your authenticator app (such as Google Authenticator), then enter the 6-digit code it shows.</p>
            <div className="mx-auto grid size-36 place-items-center rounded-xl border border-line bg-[repeating-linear-gradient(45deg,var(--color-ink)_0_6px,white_6px_12px)] text-xs font-bold text-white" aria-label="QR code (test)">
              <span className="rounded bg-ink px-2 py-1">TEST QR</span>
            </div>
            <TextField label="Code from the app" inputMode="numeric" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} error={fieldErrors(mfa.error).code} />
            <DemoNote>The test code is <strong className="font-mono">{demo.codes.mfa}</strong>.</DemoNote>
            <Button type="submit" className="w-full" loading={mfa.busy}>Turn on</Button>
          </form>
        )}
      </Modal>

      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Turn off two-step sign-in">
        <h2 className="text-xl font-bold">Turn off two-step sign-in?</h2>
        <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void mfa.run(async () => { setUser(await api.account.disableMfa(password)); setDisableOpen(false); toast('Two-step sign-in is off.') }) }}>
          <TextField label="Your password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors(mfa.error).password} hint="We ask again because this lowers your account’s protection." />
          <Button type="submit" variant="danger" className="w-full" loading={mfa.busy}>Turn off</Button>
        </form>
      </Modal>

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Close your account">
        <h2 className="text-xl font-bold">Close your account?</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void close.run(async () => {
              const r = await api.account.closeAccount(password)
              if (r.closed) {
                await logout()
                toast('Your account is closed.')
                navigate('/')
              } else setBlockers(r.blockers)
            })
          }}
        >
          {blockers.length > 0 && (
            <Alert tone="warning" title="We can’t close it yet">
              <ul className="list-disc pl-4">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            </Alert>
          )}
          <TextField label="Your password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors(close.error).password} />
          <Button type="submit" variant="danger" className="w-full" loading={close.busy}>Close my account</Button>
        </form>
      </Modal>
    </div>
  )
}

/** ORG-001: start supplying. The person becomes the organization's administrator. */
export function ListYourPropertyPage() {
  const { user, ready, refresh } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [kind, setKind] = useState<OrgKind>('individual_owner')
  const [form, setForm] = useState({ legalName: user?.name ?? '', tradingName: '', registrationNumber: '', address: '', region: 'Greater Accra' })
  const { busy, error, run } = useAction()
  const f = fieldErrors(error)
  // The account may arrive after the first render; fill the name in once it does.
  useEffect(() => {
    if (user) setForm((s) => (s.legalName ? s : { ...s, legalName: user.name }))
  }, [user])

  if (!ready) return <Spinner />
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">List your property on Abode</h1>
        <p className="mt-3 text-lg text-muted">Rent it out, sell it, or host short stays. Owners, hosts and agencies all start here.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/signup" state={{ from: { pathname: '/list-your-property' } }} className="rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800">Create an account</Link>
          <Link to="/login" state={{ from: { pathname: '/list-your-property' } }} className="rounded-xl border border-line bg-white px-5 py-3 font-semibold hover:border-ink/40">Sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader title="Set up your listing account" subtitle="Tell us who is listing. We check every supplier before their listings go live." />
      {!user.emailVerified && (
        <div className="mb-6">
          <Alert tone="warning" title="Confirm your email first">
            <Link to="/verify" state={{ from: { pathname: '/list-your-property' } }} className="font-semibold underline">Confirm your email</Link> to continue.
          </Alert>
        </div>
      )}
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            await api.portal.createOrg({ kind, ...form })
            await refresh()
            toast('Account created. Next, verify your details.')
            navigate('/portal/organization')
          })
        }}
      >
        <RadioCards<OrgKind> label="Which describes you?" value={kind} onChange={setKind} options={ORG_KINDS.map((k) => ({ value: k.id, label: k.label, hint: k.hint }))} />
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={kind === 'individual_owner' ? 'Your full legal name' : 'Registered business name'} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} error={f.legalName} className="sm:col-span-2" />
            {kind !== 'individual_owner' && <TextField label="Trading name (if different)" value={form.tradingName} onChange={(e) => setForm({ ...form, tradingName: e.target.value })} />}
            {kind !== 'individual_owner' && <TextField label="Registration number" placeholder="CS-000000-2026" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} error={f.registrationNumber} />}
            <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} error={f.address} className="sm:col-span-2" />
            <SelectField label="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} options={GHANA_REGIONS} placeholder={false} />
          </div>
        </Card>
        {error && !Object.keys(f).length ? <ErrorAlert error={error} /> : null}
        <Button type="submit" size="lg" loading={busy} disabled={!user.emailVerified}>Create listing account</Button>
      </form>
    </div>
  )
}
