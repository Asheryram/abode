/**
 * Every page and who may open it:
 *   /           public site: seekers and guests (some pages need sign-in)
 *   /portal     supply portal: owners, hosts, agents, agency staff
 *   /admin      back office: Abode staff, by staff role
 */
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './app/auth'
import { RequireAuth, RequirePortal, RequireStaff, ScrollToTop } from './app/guards'
import { SavedProvider } from './app/saved'
import { AdminLayout, PortalLayout, PublicLayout } from './app/shell'
import { ToastProvider } from './context/ToastContext'
import { Spinner } from './design-system'
import { ForgotPasswordPage, LoginPage, SignupPage, VerifyPage } from './pages/auth/AuthPages'
import { HomePage } from './pages/public/HomePage'
import { NotFoundPage } from './pages/public/NotFoundPage'

/** Lazy-load one named page export, so each area downloads only when visited. */
const page = (load: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(async () => ({ default: (await load())[name] as React.ComponentType }))

// Public
const SearchPage = page(() => import('./pages/public/SearchPage'), 'SearchPage')
const ListingPage = page(() => import('./pages/public/ListingPage'), 'ListingPage')
const CheckoutPage = page(() => import('./pages/public/CheckoutPage'), 'CheckoutPage')
const TripsPage = page(() => import('./pages/public/TripsPages'), 'TripsPage')
const TripPage = page(() => import('./pages/public/TripsPages'), 'TripPage')
const EnquiriesPage = page(() => import('./pages/public/EngagePages'), 'EnquiriesPage')
const ViewingPage = page(() => import('./pages/public/EngagePages'), 'ViewingPage')
const SavedPage = page(() => import('./pages/public/EngagePages'), 'SavedPage')
const SeekerMessages = page(() => import('./pages/shared/MessagesPage'), 'SeekerMessages')
const AccountPage = page(() => import('./pages/account/AccountPages'), 'AccountPage')
const ListYourPropertyPage = page(() => import('./pages/account/AccountPages'), 'ListYourPropertyPage')
const TrustPage = lazy(() => import('./pages/TrustPage'))
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'))

// Portal
const PortalDashboard = page(() => import('./pages/portal/DashboardPage'), 'DashboardPage')
const PortalListings = page(() => import('./pages/portal/ListingsPages'), 'ListingsPage')
const ListingEditor = page(() => import('./pages/portal/ListingsPages'), 'ListingEditorPage')
const NewListing = page(() => import('./pages/portal/ListingsPages'), 'NewListingPage')
const AvailabilityPage = page(() => import('./pages/portal/AvailabilityPage'), 'AvailabilityPage')
const LeadsPage = page(() => import('./pages/portal/LeadsPages'), 'LeadsPage')
const LeadPage = page(() => import('./pages/portal/LeadsPages'), 'LeadPage')
const PortalViewings = page(() => import('./pages/portal/ViewingsPages'), 'ViewingsPage')
const PortalViewing = page(() => import('./pages/portal/ViewingsPages'), 'ViewingPage')
const PortalBookings = page(() => import('./pages/portal/BookingsPages'), 'BookingsPage')
const PortalBooking = page(() => import('./pages/portal/BookingsPages'), 'BookingPage')
const PortalMessages = page(() => import('./pages/shared/MessagesPage'), 'PortalMessages')
const TeamPage = page(() => import('./pages/portal/OrgPages'), 'TeamPage')
const OrganizationPage = page(() => import('./pages/portal/OrgPages'), 'OrganizationPage')
const MandatesPage = page(() => import('./pages/portal/OrgPages'), 'MandatesPage')
const PayoutsPage = page(() => import('./pages/portal/BookingsPages'), 'PayoutsPage')

// Back office
const AdminOverview = page(() => import('./pages/admin/AdminPages'), 'OverviewPage')
const VerificationQueue = page(() => import('./pages/admin/AdminPages'), 'VerificationQueuePage')
const VerificationCasePage = page(() => import('./pages/admin/AdminPages'), 'VerificationCasePage')
const ListingReview = page(() => import('./pages/admin/AdminPages'), 'ListingReviewPage')
const ReportsPage = page(() => import('./pages/admin/AdminPages'), 'ReportsPage')
const FinancePage = page(() => import('./pages/admin/FinancePage'), 'FinancePage')
const SupportPage = page(() => import('./pages/admin/AdminPages'), 'SupportPage')
const FlagsPage = page(() => import('./pages/admin/AdminPages'), 'FlagsPage')
const AuditPage = page(() => import('./pages/admin/AdminPages'), 'AuditPage')

function Loading() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ScrollToTop />
      <ToastProvider>
        <AuthProvider>
          <SavedProvider>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="login" element={<LoginPage />} />
                <Route path="signup" element={<SignupPage />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />

                <Route element={<PublicLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="listings/:id" element={<ListingPage />} />
                  <Route path="trust" element={<TrustPage />} />
                  <Route path="design-system" element={<DesignSystemPage />} />
                  <Route path="list-your-property" element={<ListYourPropertyPage />} />
                  <Route element={<RequireAuth />}>
                    <Route path="verify" element={<VerifyPage />} />
                    <Route path="checkout/:holdId" element={<CheckoutPage />} />
                    <Route path="trips" element={<TripsPage />} />
                    <Route path="trips/:id" element={<TripPage />} />
                    <Route path="enquiries" element={<EnquiriesPage />} />
                    <Route path="viewings/:id" element={<ViewingPage />} />
                    <Route path="saved" element={<SavedPage />} />
                    <Route path="messages" element={<SeekerMessages />} />
                    <Route path="messages/:threadId" element={<SeekerMessages />} />
                    <Route path="account" element={<AccountPage />} />
                  </Route>
                  <Route path="*" element={<NotFoundPage />} />
                </Route>

                <Route path="portal" element={<RequirePortal />}>
                  <Route element={<PortalLayout />}>
                    <Route index element={<PortalDashboard />} />
                    <Route path="listings" element={<PortalListings />} />
                    <Route path="listings/new" element={<NewListing />} />
                    <Route path="listings/:id" element={<ListingEditor />} />
                    <Route path="listings/:id/calendar" element={<AvailabilityPage />} />
                    <Route path="leads" element={<LeadsPage />} />
                    <Route path="leads/:id" element={<LeadPage />} />
                    <Route path="viewings" element={<PortalViewings />} />
                    <Route path="viewings/:id" element={<PortalViewing />} />
                    <Route path="bookings" element={<PortalBookings />} />
                    <Route path="bookings/:id" element={<PortalBooking />} />
                    <Route path="messages" element={<PortalMessages />} />
                    <Route path="messages/:threadId" element={<PortalMessages />} />
                    <Route path="team" element={<TeamPage />} />
                    <Route path="organization" element={<OrganizationPage />} />
                    <Route path="mandates" element={<MandatesPage />} />
                    <Route path="payouts" element={<PayoutsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>

                <Route path="admin" element={<RequireStaff />}>
                  <Route element={<AdminLayout />}>
                    <Route index element={<AdminOverview />} />
                    <Route path="verification" element={<VerificationQueue />} />
                    <Route path="verification/:id" element={<VerificationCasePage />} />
                    <Route path="listings" element={<ListingReview />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="finance" element={<FinancePage />} />
                    <Route path="support" element={<SupportPage />} />
                    <Route path="flags" element={<FlagsPage />} />
                    <Route path="audit" element={<AuditPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </SavedProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
