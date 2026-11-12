import { Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { returnPath } from '../components/routing'
import { Button, InlineError, TextField } from '../components/ui'
import { BRAND } from '../config'
import { errorMessage } from '../contracts'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { demo } from '../services/api'

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10 md:py-16">
      <div className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <Logo compact />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </div>
    </div>
  )
}

function PasswordField({ value, onChange, autoComplete, hint }: { value: string; onChange(v: string): void; autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <TextField
        label="Password"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        hint={hint}
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute top-[30px] right-1.5 grid size-10 place-items-center rounded-lg text-muted hover:text-ink"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export function LoginPage() {
  const { user, login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const next = returnPath(location.state)

  if (user) return <Navigate to={next} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const u = await login({ email, password })
      toast(`Welcome back, ${u.name.split(' ')[0]}`)
      navigate(next, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle={`Log in to book stays and manage your places on ${BRAND}.`}>
      <form onSubmit={submit} className="space-y-4">
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        <InlineError>{error}</InlineError>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{' '}
        <Link to="/signup" state={location.state} className="font-semibold text-brand-700 underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>

      {demo && (
        <div className="mt-7 rounded-2xl bg-stone-50 p-4 text-sm">
          <p className="font-semibold">Demo accounts</p>
          <p className="mt-0.5 text-muted">Password for both: {demo.password}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {demo.accounts.map((d) => (
              <Button
                key={d.email}
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEmail(d.email)
                  setPassword(demo.password)
                }}
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </AuthCard>
  )
}

export function SignupPage() {
  const { user, signup } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const next = returnPath(location.state)

  if (user) return <Navigate to={next} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const u = await signup({ name, email, password })
      toast(`Welcome to ${BRAND}, ${u.name.split(' ')[0]}!`)
      navigate(next, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Create your account" subtitle="Book places to stay, or put your own place up for rent.">
      <form onSubmit={submit} className="space-y-4">
        <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." />
        <InlineError>{error}</InlineError>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" state={location.state} className="font-semibold text-brand-700 underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  )
}
