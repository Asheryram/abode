import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Membership, StaffRole } from '../contracts'
import { Spinner } from '../design-system'
import { useAuth } from './auth'

function FullPageSpinner() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner />
    </div>
  )
}

/** Signed-in users only. Others go to sign in and come back after. */
export function RequireAuth() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Abode staff only (ADM-001). The API still checks every action. */
export function RequireStaff({ roles }: { roles?: StaffRole[] }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (!user.staffRole) return <Navigate to="/" replace />
  if (roles && user.staffRole !== 'platform_admin' && !roles.includes(user.staffRole)) return <NoAccess />
  return <Outlet />
}

export function NoAccess() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-bold">You don’t have access to this</h1>
      <p className="mt-2 text-muted">Your role doesn’t include this area. Ask a platform administrator if you think it should.</p>
    </div>
  )
}

// ── The organization the portal is working in ──

interface OrgValue {
  org: Membership
  orgs: Membership[]
  switchTo(orgId: string): void
}

const OrgContext = createContext<OrgValue | null>(null)
const KEY = 'abode.portal-org'

/** Portal pages need a membership; the active organization is a remembered choice. */
export function RequirePortal({ children }: { children?: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  const [chosen, setChosen] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  })
  const switchTo = useCallback((orgId: string) => {
    setChosen(orgId)
    try {
      localStorage.setItem(KEY, orgId)
    } catch {
      /* Not remembered between visits. */
    }
  }, [])
  const orgs = useMemo(() => user?.memberships ?? [], [user])
  const org = orgs.find((m) => m.orgId === chosen) ?? orgs[0]
  useEffect(() => {
    if (org && org.orgId !== chosen) switchTo(org.orgId)
  }, [org, chosen, switchTo])

  const value = useMemo(() => (org ? { org, orgs, switchTo } : null), [org, orgs, switchTo])
  if (!ready) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (!value) return <Navigate to="/list-your-property" replace />
  return <OrgContext.Provider value={value}>{children ?? <Outlet />}</OrgContext.Provider>
}

export function useOrg(): OrgValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside <RequirePortal>')
  return ctx
}

/** Start each new page at the top, as a full page load would. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/** Where to send someone after they sign in. Only ever a path on this site. */
export function returnPath(state: unknown): string | null {
  const from = (state as { from?: { pathname?: string; search?: string } } | null)?.from
  if (!from?.pathname || !from.pathname.startsWith('/') || from.pathname.startsWith('//')) return null
  if (['/login', '/signup'].includes(from.pathname)) return null
  return from.pathname + (from.search ?? '')
}
