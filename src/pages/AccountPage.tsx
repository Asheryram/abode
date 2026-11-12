import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Button, ConfirmDialog, InlineError, TextArea, TextField } from '../components/ui'
import { errorMessage } from '../contracts'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { memberSince } from '../lib/format'
import { api, demo } from '../services/api'

export default function AccountPage() {
  const { user, setUser, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)

  if (!user) return null

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setUser(await api.auth.updateProfile({ name, phone, bio }))
      toast('Profile saved')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} id={user.id} size="lg" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-muted">
            {user.email} · Member since {memberSince(user.createdAt)}
          </p>
        </div>
      </div>

      <form onSubmit={save} className="mt-10 space-y-5 rounded-3xl border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        <TextField
          label="Phone number"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="024 000 0000"
          hint="Hosts see this after you book with them, and guests see it after booking with you."
          autoComplete="tel"
        />
        <TextArea
          label="About you"
          value={bio}
          maxLength={400}
          onChange={(e) => setBio(e.target.value)}
          hint="Shown on your listings if you host. A sentence or two is plenty."
        />
        <InlineError>{error}</InlineError>
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            Save profile
          </Button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={async () => {
            await logout()
            navigate('/')
          }}
        >
          Log out
        </Button>
        {demo && (
          <Button variant="ghost" onClick={() => setResetOpen(true)}>
            Reset demo data
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Reset all demo data?"
        body="Every account, listing and booking made in this browser is deleted, and the sample data is loaded again. You will be logged out."
        confirmLabel="Reset everything"
        danger
        onClose={() => setResetOpen(false)}
        onConfirm={async () => {
          await demo?.reset()
          window.location.assign('/')
        }}
      />
    </div>
  )
}
