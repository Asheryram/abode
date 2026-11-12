import { CircleUserRound, Compass, Heart, House, Luggage, Menu } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BRAND } from '../config'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { usingMockApi } from '../services/api'
import { Logo } from './Logo'
import { Avatar, cx } from './ui'

export function MainLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
    </div>
  )
}

function Header() {
  const { user } = useAuth()
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 md:h-20">
        <Logo />
        <nav className="flex items-center gap-1">
          <Link
            to="/host"
            className="hidden rounded-full px-4 py-2.5 text-sm font-semibold hover:bg-stone-100 md:block"
          >
            {user ? 'Switch to hosting' : `Host on ${BRAND}`}
          </Link>
          <UserMenu />
        </nav>
      </div>
    </header>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item = 'block w-full px-4 py-2.5 text-left text-sm hover:bg-stone-50'

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex items-center gap-2.5 rounded-full border border-line py-1.5 pr-1.5 pl-3 transition-shadow hover:shadow-md"
      >
        <Menu className="size-4" aria-hidden />
        {user ? <Avatar name={user.name} id={user.id} size="sm" /> : <CircleUserRound className="size-8 text-stone-500" strokeWidth={1.5} aria-hidden />}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-white py-2 shadow-xl">
          {user ? (
            <>
              <p className="px-4 pt-1 pb-2 text-xs text-muted">
                Signed in as <span className="font-semibold text-ink">{user.name}</span>
              </p>
              <Link role="menuitem" to="/trips" className={cx(item, 'font-semibold')}>
                Trips
              </Link>
              <Link role="menuitem" to="/wishlist" className={cx(item, 'font-semibold')}>
                Wishlist
              </Link>
              <hr className="my-2 border-line" />
              <Link role="menuitem" to="/host" className={item}>
                Hosting dashboard
              </Link>
              <Link role="menuitem" to="/host/listings/new" className={item}>
                List a new place
              </Link>
              <Link role="menuitem" to="/account" className={item}>
                Account
              </Link>
              <hr className="my-2 border-line" />
              <button
                role="menuitem"
                type="button"
                className={item}
                onClick={async () => {
                  await logout()
                  toast('You’re logged out')
                  navigate('/')
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link role="menuitem" to="/login" state={{ from: location }} className={cx(item, 'font-semibold')}>
                Log in
              </Link>
              <Link role="menuitem" to="/signup" state={{ from: location }} className={item}>
                Sign up
              </Link>
              <hr className="my-2 border-line" />
              <Link role="menuitem" to="/host" className={item}>
                Host your place
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MobileNav() {
  const { user } = useAuth()
  const tabs = [
    { to: '/', label: 'Explore', icon: Compass, end: true },
    { to: '/wishlist', label: 'Wishlist', icon: Heart },
    { to: '/trips', label: 'Trips', icon: Luggage },
    { to: '/host', label: 'Host', icon: House },
    user ? { to: '/account', label: 'Profile', icon: CircleUserRound } : { to: '/login', label: 'Log in', icon: CircleUserRound },
  ]
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white md:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cx('flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-semibold', isActive ? 'text-brand-700' : 'text-muted')
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="mb-16 border-t border-line bg-white md:mb-0">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-sm text-muted">Homes, villas and cabins to stay in across Ghana, from hosts who live there.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
          <p className="col-span-2 mb-1 font-semibold sm:col-span-1">Guests</p>
          <p className="hidden font-semibold sm:block">Hosts</p>
          <Link to="/" className="text-muted hover:text-ink">Explore stays</Link>
          <Link to="/host" className="text-muted hover:text-ink">Host your place</Link>
          <Link to="/trips" className="text-muted hover:text-ink">Your trips</Link>
          <Link to="/host/listings/new" className="text-muted hover:text-ink">Create a listing</Link>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted sm:px-6 lg:px-8">
          © {new Date().getFullYear()} {BRAND}.{' '}
          {usingMockApi && 'Demo build: all data stays in this browser and no real payments are taken.'}
        </p>
      </div>
    </footer>
  )
}
