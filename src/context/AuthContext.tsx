import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, type LoginRequest, type SignupRequest, type User } from '../contracts'
import { api, tokenStore } from '../services/api'

interface AuthValue {
  user: User | null
  /** False until we know whether a saved token is still good. */
  ready: boolean
  login(body: LoginRequest): Promise<User>
  signup(body: SignupRequest): Promise<User>
  logout(): Promise<void>
  /** After the profile is edited elsewhere. */
  setUser(user: User): void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!tokenStore.get()) {
      setReady(true)
      return
    }
    api.auth
      .me()
      .then(setUser)
      .catch((e: unknown) => {
        // Only a rejected token logs you out. A dropped connection shouldn't.
        if (e instanceof ApiError && e.code === 'UNAUTHORIZED') tokenStore.set(null)
      })
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (body: LoginRequest) => {
    const session = await api.auth.login(body)
    tokenStore.set(session.token)
    setUser(session.user)
    return session.user
  }, [])

  const signup = useCallback(async (body: SignupRequest) => {
    const session = await api.auth.signup(body)
    tokenStore.set(session.token)
    setUser(session.user)
    return session.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } catch {
      /* Forget the token locally whatever the server says. */
    }
    tokenStore.set(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, ready, login, signup, logout, setUser }), [user, ready, login, signup, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
