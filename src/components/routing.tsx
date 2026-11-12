import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui'

/** Pages behind this need a logged-in user. Others go to /login and come back after. */
export function RequireAuth() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Spinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Start each new page at the top, as a full page load would. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

/** Where to send someone after they log in. Only ever a path on this site. */
export function returnPath(state: unknown, fallback = '/'): string {
  const from = (state as { from?: { pathname?: string; search?: string } } | null)?.from
  if (!from?.pathname || !from.pathname.startsWith('/') || from.pathname.startsWith('//')) return fallback
  if (from.pathname === '/login' || from.pathname === '/signup') return fallback
  return from.pathname + (from.search ?? '')
}
