/**
 * The frame around every page: the public site, the supply portal and the
 * back office each get their own navigation, built from one set of parts.
 */
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  CircleUserRound,
  ClipboardCheck,
  Compass,
  Flag,
  Heart,
  House,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Luggage,
  Menu,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { BRAND, INTENTS, ORG_ROLE_LABEL, STAFF_ROLE_LABEL } from '../config'
import { useToast } from '../context/ToastContext'
import type { Notification, OrgRole, StaffRole } from '../contracts'
import { Avatar, cx, EnvironmentBanner, SharingBanner } from '../design-system'
import { useAsync } from '../hooks/useAsync'
import { usePoll } from '../hooks/usePoll'
import { formatTime, timeAgo } from '../lib/format'
import { api } from '../services/api'
import { useAuth } from './auth'
import { useOrg } from './guards'

// ── Shared parts ────────────────────────────────────────────────────────────

function useCloseOnOutside(open: boolean, close: () => void) {
  const root = useRef<HTMLDivElement>(null)
  const location = useLocation()
  useEffect(() => {
    close()
  }, [location.pathname, close])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && close()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return root
}

function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const root = useCloseOnOutside(open, close)
  const { data, reload } = useAsync<Notification[]>(() => api.pub.notifications(), [user?.id])
  usePoll(reload, 20_000, !!user)
  const unread = data?.filter((n) => !n.read).length ?? 0
  if (!user) return null
  const toggle = async () => {
    setOpen((o) => !o)
    if (!open && unread) {
      await api.pub.markNotificationsRead()
      reload()
    }
  }
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={toggle} className="relative grid size-11 place-items-center rounded-full hover:bg-stone-100" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open}>
        <Bell className="size-5" aria-hidden />
        {unread > 0 && <span className="absolute top-2 right-2 grid min-w-4 place-items-center rounded-full bg-danger-solid px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          <p className="border-b border-line px-4 py-3 font-semibold">Notifications</p>
          <div className="max-h-96 overflow-y-auto">
            {!data?.length && <p className="px-4 py-6 text-center text-sm text-muted">You’re all caught up.</p>}
            {data?.map((n) => (
              <Link key={n.id} to={n.link ?? '#'} className="block border-b border-line px-4 py-3 last:border-0 hover:bg-stone-50">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-sm text-muted">{n.body}</p>
                <p className="mt-0.5 text-xs text-muted">{timeAgo(n.at)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const root = useCloseOnOutside(open, close)

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Link to="/login" className="rounded-full px-4 py-2.5 text-sm font-semibold hover:bg-stone-100">
          Sign in
        </Link>
        <Link to="/signup" className="hidden rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 sm:block">
          Sign up
        </Link>
      </div>
    )
  }

  const item = 'block rounded-lg px-3 py-2.5 text-[15px] hover:bg-stone-100'
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-line py-1.5 pr-1.5 pl-3 hover:shadow-md" aria-expanded={open} aria-label="Account menu">
        <Menu className="size-4" aria-hidden />
        <Avatar name={user.name} id={user.id} size="sm" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-line bg-white p-2 shadow-xl">
          <div className="border-b border-line px-3 pt-1 pb-3">
            <p className="font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
            {user.staffRole && <p className="mt-1 text-xs font-semibold text-brand-700">{STAFF_ROLE_LABEL[user.staffRole]}</p>}
          </div>
          <div className="py-1">
            {user.staffRole && (
              <Link to="/admin" className={cx(item, 'font-semibold')}>
                Back office
              </Link>
            )}
            {user.memberships.length > 0 && (
              <Link to="/portal" className={cx(item, 'font-semibold')}>
                Supply portal
              </Link>
            )}
            <Link to="/trips" className={item}>
              Trips and bookings
            </Link>
            <Link to="/enquiries" className={item}>
              Enquiries and viewings
            </Link>
            <Link to="/messages" className={item}>
              Messages
            </Link>
            <Link to="/saved" className={item}>
              Saved
            </Link>
            <Link to="/account" className={item}>
              Account and privacy
            </Link>
            {!user.memberships.length && !user.staffRole && (
              <Link to="/list-your-property" className={item}>
                List your property
              </Link>
            )}
          </div>
          <div className="border-t border-line pt-1">
            <button
              type="button"
              className={cx(item, 'w-full text-left')}
              onClick={async () => {
                await logout()
                toast('You’re signed out.')
                navigate('/')
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Public site ─────────────────────────────────────────────────────────────

export function PublicLayout() {
  const { user } = useAuth()
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Browse">
              {INTENTS.map((i) => (
                <NavLink key={i.id} to={`/search?intent=${i.id}`} className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:bg-stone-100 hover:text-ink">
                  {i.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <Link to={user?.memberships.length ? '/portal' : '/list-your-property'} className="hidden rounded-full px-4 py-2.5 text-sm font-semibold hover:bg-stone-100 md:block">
              {user?.memberships.length ? 'Supply portal' : 'List your property'}
            </Link>
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-3 sm:px-6 lg:px-8">
          <div>
            <p className="font-semibold text-ink">{BRAND}</p>
            <p className="mt-1">Homes, stays and commercial space across Ghana.</p>
          </div>
          <div className="space-y-1.5">
            <Link to="/trust" className="block hover:text-ink">
              What our badges mean
            </Link>
            <Link to="/list-your-property" className="block hover:text-ink">
              List your property
            </Link>
            <Link to="/design-system" className="block hover:text-ink">
              Design system
            </Link>
          </div>
          <p>Test version with sample data. No real bookings or payments are made.</p>
        </div>
      </footer>
      <MobileTabs />
    </div>
  )
}

function MobileTabs() {
  const { user } = useAuth()
  const tabs: [string, string, LucideIcon][] = [
    ['/', 'Explore', Compass],
    ['/saved', 'Saved', Heart],
    ['/trips', 'Trips', Luggage],
    ['/messages', 'Messages', MessageSquare],
    [user ? '/account' : '/login', user ? 'Account' : 'Sign in', CircleUserRound],
  ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
      <div className="grid grid-cols-5">
        {tabs.map(([to, label, Icon]) => (
          <NavLink key={label} to={to} end={to === '/'} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', isActive ? 'text-brand-700' : 'text-muted')}>
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

// ── Sidebar layout used by the portal and the back office ───────────────────

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

function SideNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5" aria-label="Sections">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium', isActive ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink hover:bg-stone-100')}>
          <i.icon className="size-[18px] shrink-0" aria-hidden />
          {i.label}
        </NavLink>
      ))}
    </nav>
  )
}

function WorkspaceLayout({ banner, label, top, items, children }: { banner?: ReactNode; label: string; top?: ReactNode; items: NavItem[]; children?: ReactNode }) {
  const [menu, setMenu] = useState(false)
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {banner}
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button type="button" className="grid size-10 place-items-center rounded-xl hover:bg-stone-100 lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <Logo />
            <span className="hidden rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 sm:inline">{label}</span>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/" className="hidden rounded-full px-3 py-2 text-sm font-semibold hover:bg-stone-100 md:block">
              View site
            </Link>
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-line bg-white p-4 lg:block">
          {top}
          <SideNav items={items} />
        </aside>
        {menu && (
          <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onMouseDown={() => setMenu(false)}>
            <div className="h-full w-72 overflow-y-auto bg-white p-4 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <span className="font-semibold">{label}</span>
                <button type="button" className="grid size-10 place-items-center rounded-xl hover:bg-stone-100" onClick={() => setMenu(false)} aria-label="Close menu">
                  <X className="size-5" />
                </button>
              </div>
              {top}
              <SideNav items={items} onNavigate={() => setMenu(false)} />
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">{children ?? <Outlet />}</div>
        </main>
      </div>
    </div>
  )
}

// ── Supply portal ───────────────────────────────────────────────────────────

const PORTAL_NAV: (NavItem & { roles: OrgRole[]; agencyOnly?: boolean })[] = [
  { to: '/portal', label: 'Dashboard', icon: LayoutDashboard, end: true, roles: ['admin', 'agent', 'finance'] },
  { to: '/portal/listings', label: 'Listings', icon: House, roles: ['admin', 'agent'] },
  { to: '/portal/leads', label: 'Enquiries', icon: Inbox, roles: ['admin', 'agent'] },
  { to: '/portal/viewings', label: 'Viewings', icon: CalendarDays, roles: ['admin', 'agent'] },
  { to: '/portal/bookings', label: 'Bookings', icon: BookOpen, roles: ['admin', 'finance'] },
  { to: '/portal/messages', label: 'Messages', icon: MessageSquare, roles: ['admin', 'agent'] },
  { to: '/portal/team', label: 'Team', icon: Users, roles: ['admin'] },
  { to: '/portal/mandates', label: 'Mandates', icon: KeyRound, roles: ['admin'], agencyOnly: true },
  { to: '/portal/organization', label: 'Organization', icon: Building2, roles: ['admin'] },
  { to: '/portal/payouts', label: 'Payouts', icon: Wallet, roles: ['admin', 'finance'] },
]

export function PortalLayout() {
  const { org, orgs, switchTo } = useOrg()
  const navigate = useNavigate()
  const items = PORTAL_NAV.filter((n) => n.roles.includes(org.role) && (!n.agencyOnly || org.orgKind === 'agency'))
  const sharing = useAsync(() => api.portal.mySharing(), [])
  usePoll(sharing.reload, 10_000)
  const [stopping, setStopping] = useState(false)
  const toast = useToast()
  const active = sharing.data

  const banner = active ? (
    <SharingBanner
      visibleTo={[active.seekerName]}
      stopsAt={formatTime(active.endsAt)}
      stopping={stopping}
      onStop={async () => {
        setStopping(true)
        try {
          await api.portal.stopSharing(active.viewingId)
          toast('Location sharing stopped.')
          sharing.reload()
        } finally {
          setStopping(false)
        }
      }}
    />
  ) : undefined

  const switcher = (
    <div className="mb-4 border-b border-line pb-4">
      <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Organization</p>
      {orgs.length > 1 ? (
        <select
          aria-label="Switch organization"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold"
          value={org.orgId}
          onChange={(e) => {
            switchTo(e.target.value)
            navigate('/portal')
          }}
        >
          {orgs.map((o) => (
            <option key={o.orgId} value={o.orgId}>
              {o.orgName}
            </option>
          ))}
        </select>
      ) : (
        <p className="font-semibold">{org.orgName}</p>
      )}
      <p className="mt-1 text-xs text-muted">You are: {ORG_ROLE_LABEL[org.role]}</p>
    </div>
  )

  return <WorkspaceLayout banner={banner} label="Supply portal" top={switcher} items={items} />
}

// ── Back office ─────────────────────────────────────────────────────────────

const ADMIN_NAV: (NavItem & { roles: StaffRole[] })[] = [
  { to: '/admin', label: 'Overview', icon: ChartNoAxesColumn, end: true, roles: ['moderator', 'verification_officer', 'finance_operator', 'support_agent', 'analyst'] },
  { to: '/admin/verification', label: 'Verification', icon: ShieldCheck, roles: ['verification_officer', 'analyst'] },
  { to: '/admin/listings', label: 'Listing review', icon: ClipboardCheck, roles: ['moderator', 'analyst'] },
  { to: '/admin/reports', label: 'Reports', icon: Flag, roles: ['moderator', 'support_agent', 'analyst'] },
  { to: '/admin/finance', label: 'Finance', icon: Wallet, roles: ['finance_operator', 'analyst'] },
  { to: '/admin/support', label: 'Support', icon: Users, roles: ['support_agent', 'analyst'] },
  { to: '/admin/flags', label: 'Feature switches', icon: SlidersHorizontal, roles: ['analyst'] },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText, roles: ['analyst'] },
]

export function AdminLayout() {
  const { user } = useAuth()
  const role = user!.staffRole!
  const items = ADMIN_NAV.filter((n) => role === 'platform_admin' || n.roles.includes(role))
  return (
    <WorkspaceLayout
      banner={<EnvironmentBanner environment="test" paymentMode="sandbox" />}
      label="Back office"
      top={
        <div className="mb-4 border-b border-line pb-4">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Signed in as</p>
          <p className="font-semibold">{user!.name}</p>
          <p className="text-xs text-muted">{STAFF_ROLE_LABEL[role]}</p>
        </div>
      }
      items={items}
    />
  )
}
