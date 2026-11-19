/** Sign in (with a picker for every test role), sign up, verification and password reset. */
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { homeFor, useAuth } from '../../app/auth'
import { returnPath } from '../../app/guards'
import { Logo } from '../../components/Logo'
import { BRAND } from '../../config'
import { useToast } from '../../context/ToastContext'
import { Button, Checkbox, cx, DemoNote, ErrorAlert, fieldErrors, TextField } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { api, demo } from '../../services/api'

function AuthFrame({ title, subtitle, children, wide }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <div className="px-4 py-5 sm:px-8">
        <Logo />
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:pt-10">
        <div className={cx('w-full rounded-3xl border border-line bg-white p-6 sm:p-8', wide ? 'max-w-3xl' : 'max-w-md')}>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { login, verifyMfa } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [challenge, setChallenge] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [showAccounts, setShowAccounts] = useState(true)
  const { busy, error, setError, run } = useAction()

  const finish = (user: Parameters<typeof homeFor>[0]) => {
    toast(`Welcome back, ${user.name.split(' ')[0]}.`)
    navigate(returnPath(location.state) ?? homeFor(user), { replace: true })
  }

  const signIn = (e?: FormEvent, as?: string) => {
    e?.preventDefault()
    void run(async () => {
      const r = await login(as ?? email, as ? demo.password : password)
      if (r.status === 'mfa') {
        setChallenge(r.challengeId)
        setCode('')
      } else finish(r.user)
    })
  }

  if (challenge) {
    return (
      <AuthFrame title="Two-step sign-in" subtitle="Enter the 6-digit code from your authenticator app.">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => finish(await verifyMfa(challenge, code)))
          }}
          className="space-y-4"
        >
          <TextField label="Code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} error={fieldErrors(error).code} autoFocus />
          <DemoNote>
            The test code is <strong className="font-mono">{demo.codes.mfa}</strong>.
          </DemoNote>
          {error && !fieldErrors(error).code ? <ErrorAlert error={error} /> : null}
          <Button type="submit" className="w-full" loading={busy}>
            Verify and sign in
          </Button>
          <button type="button" className="w-full text-sm font-semibold text-muted hover:text-ink" onClick={() => { setChallenge(null); setError(null) }}>
            Use a different account
          </button>
        </form>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title={`Sign in to ${BRAND}`} subtitle="One account for searching, booking and listing." wide>
      <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
        <form onSubmit={signIn} className="space-y-4">
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error ? <ErrorAlert error={error} title="Couldn’t sign you in" /> : null}
          <Button type="submit" className="w-full" loading={busy}>
            Sign in
          </Button>
          <div className="flex justify-between text-sm">
            <Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">
              Forgot password?
            </Link>
            <Link to="/signup" state={location.state} className="font-semibold text-brand-700 hover:underline">
              Create an account
            </Link>
          </div>
        </form>

        <div className="rounded-2xl border border-dashed border-info-border bg-info-bg/50 p-4">
          <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setShowAccounts((s) => !s)} aria-expanded={showAccounts}>
            <span>
              <span className="block font-semibold text-info-fg">Try any role</span>
              <span className="block text-sm text-info-fg">Test accounts. Password for all: <span className="font-mono">{demo.password}</span></span>
            </span>
            <ChevronDown className={cx('size-5 text-info-fg transition-transform', showAccounts && 'rotate-180')} aria-hidden />
          </button>
          {showAccounts && (
            <div className="mt-3 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              {demo.accounts.map((g) => (
                <div key={g.group}>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-info-fg uppercase">{g.group}</p>
                  <div className="space-y-1">
                    {g.accounts.map((a) => (
                      <button key={a.email} type="button" disabled={busy} onClick={() => signIn(undefined, a.email)} className="flex w-full items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-left hover:ring-2 hover:ring-info-border disabled:opacity-60">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{a.name}</span>
                          <span className="block truncate text-xs text-muted">{a.role}</span>
                        </span>
                        {g.group.startsWith('Abode staff') && <ShieldCheck className="size-4 shrink-0 text-info-fg" aria-label="Uses two-step sign-in" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-info-fg hover:bg-white"
                onClick={async () => {
                  await demo.reset()
                  toast('Test data reset to its starting state.')
                  window.location.reload()
                }}
              >
                Reset all test data
              </button>
            </div>
          )}
        </div>
      </div>
    </AuthFrame>
  )
}

export function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', acceptTerms: false, marketing: false })
  const { busy, error, run } = useAction()
  const f = fieldErrors(error)
  const set = (k: keyof typeof form) => (v: string | boolean) => setForm((s) => ({ ...s, [k]: v }))

  return (
    <AuthFrame title="Create your account" subtitle={<>Already have one? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link></>}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            await signup(form)
            navigate('/verify', { replace: true, state: location.state })
          })
        }}
      >
        <TextField label="Full name" autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} error={f.name} />
        <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)} error={f.email} />
        <TextField label="Phone (optional)" type="tel" autoComplete="tel" placeholder="+233 24 123 4567" value={form.phone} onChange={(e) => set('phone')(e.target.value)} hint="Used for booking updates by SMS." />
        <TextField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password')(e.target.value)} error={f.password} hint="At least 12 characters. A short sentence works well." />
        <Checkbox label={<>I accept the <span className="font-semibold">terms of use</span> and have read the <span className="font-semibold">privacy notice</span>.</>} checked={form.acceptTerms} onChange={(e) => set('acceptTerms')(e.target.checked)} error={f.acceptTerms} />
        <Checkbox label="Send me occasional emails about new places and offers." hint="Optional. You can change this any time." checked={form.marketing} onChange={(e) => set('marketing')(e.target.checked)} />
        {error && !Object.keys(f).length ? <ErrorAlert error={error} /> : null}
        <Button type="submit" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
    </AuthFrame>
  )
}

export function VerifyPage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [emailCode, setEmailCode] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const emailAction = useAction()
  const phoneAction = useAction()
  if (!user) return null
  const next = () => navigate(returnPath(location.state) ?? homeFor(user), { replace: true })

  return (
    <AuthFrame title="Confirm your details" subtitle="This keeps fake accounts off Abode. You need a confirmed email to enquire, message or book.">
      <div className="space-y-6">
        <section>
          <h2 className="font-semibold">Email</h2>
          {user.emailVerified ? (
            <p className="mt-1 text-success-fg">✓ {user.email} is confirmed.</p>
          ) : (
            <form className="mt-2 space-y-3" onSubmit={(e) => { e.preventDefault(); void emailAction.run(async () => setUser(await api.auth.verifyEmail(emailCode))) }}>
              <p className="text-sm text-muted">We sent a 6-digit code to {user.email}.</p>
              <TextField label="Email code" inputMode="numeric" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} error={fieldErrors(emailAction.error).code} />
              <DemoNote>The test email code is <strong className="font-mono">{demo.codes.email}</strong>.</DemoNote>
              <Button type="submit" loading={emailAction.busy}>Confirm email</Button>
            </form>
          )}
        </section>
        {user.phone && (
          <section className="border-t border-line pt-6">
            <h2 className="font-semibold">Phone (optional)</h2>
            {user.phoneVerified ? (
              <p className="mt-1 text-success-fg">✓ {user.phone} is confirmed.</p>
            ) : (
              <form className="mt-2 space-y-3" onSubmit={(e) => { e.preventDefault(); void phoneAction.run(async () => setUser(await api.auth.verifyPhone(phoneCode))) }}>
                <TextField label="SMS code" inputMode="numeric" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} error={fieldErrors(phoneAction.error).code} />
                <DemoNote>The test SMS code is <strong className="font-mono">{demo.codes.phone}</strong>.</DemoNote>
                <Button type="submit" variant="secondary" loading={phoneAction.busy}>Confirm phone</Button>
              </form>
            )}
          </section>
        )}
        <Button className="w-full" variant={user.emailVerified ? 'primary' : 'ghost'} onClick={next}>
          {user.emailVerified ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </AuthFrame>
  )
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useAction()
  const f = fieldErrors(error)

  return (
    <AuthFrame title="Reset your password">
      {!sent ? (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => setSent(await api.auth.requestReset(email))) }}>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" className="w-full" loading={busy}>Send reset code</Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await api.auth.completeReset(email, code, password)
              toast('Password changed. Sign in with your new password.')
              navigate('/login')
            })
          }}
        >
          <p className="text-muted">{sent}</p>
          <TextField label="Code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} error={f.code} />
          <DemoNote>The test reset code is <strong className="font-mono">{demo.codes.reset}</strong>.</DemoNote>
          <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={f.password} hint="At least 12 characters." />
          {error && !Object.keys(f).length ? <ErrorAlert error={error} /> : null}
          <Button type="submit" className="w-full" loading={busy}>Change password</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link>
      </p>
    </AuthFrame>
  )
}
