import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '../contracts'
import { api } from '../services/api'

type LoginOutcome = { status: 'ok'; user: User } | { status: 'mfa'; challengeId: string }

interface AuthValue {
  user: User | null
  /** False until we know whether a session exists. */
  ready: boolean
  login(email: string, password: string): Promise<LoginOutcome>
  verifyMfa(challengeId: string, code: string): Promise<User>
  signup(input: Parameters<typeof api.auth.signup>[0]): Promise<User>
  logout(): Promise<void>
  setUser(user: User): void
  refresh(): Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setUser(await api.auth.me())
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.auth.login(email, password)
    if (r.status === 'ok') setUser(r.user)
    return r
  }, [])

  const verifyMfa = useCallback(async (challengeId: string, code: string) => {
    const u = await api.auth.verifyMfa(challengeId, code)
    setUser(u)
    return u
  }, [])

  const signup = useCallback(async (input: Parameters<typeof api.auth.signup>[0]) => {
    const u = await api.auth.signup(input)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({ user, ready, login, verifyMfa, signup, logout, setUser, refresh }), [user, ready, login, verifyMfa, signup, logout, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Where each kind of user lands after signing in. */
export function homeFor(user: User): string {
  if (user.staffRole) return '/admin'
  if (user.memberships.length) return '/portal'
  return '/'
}
