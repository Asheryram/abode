import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { DirectionSwitcher } from './components/DirectionSwitcher'
import { MainLayout } from './components/Layout'
import { RequireAuth, ScrollToTop } from './components/routing'
import { Spinner } from './components/ui'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { WishlistProvider } from './context/WishlistContext'
import { LoginPage, SignupPage } from './pages/AuthPages'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'

const ListingPage = lazy(() => import('./pages/ListingPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const TripsPage = lazy(() => import('./pages/TripsPage'))
const WishlistPage = lazy(() => import('./pages/WishlistPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))
const HostDashboard = lazy(() => import('./pages/host/HostDashboard'))
const ListingEditor = lazy(() => import('./pages/host/ListingEditor'))
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'))
const TrustPage = lazy(() => import('./pages/TrustPage'))

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ToastProvider>
        <AuthProvider>
          <WishlistProvider>
            <ScrollToTop />
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route element={<MainLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="listings/:id" element={<ListingPage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="signup" element={<SignupPage />} />
                  <Route path="trust" element={<TrustPage />} />
                  <Route path="design-system" element={<DesignSystemPage />} />
                  <Route element={<RequireAuth />}>
                    <Route path="book/:id" element={<CheckoutPage />} />
                    <Route path="trips" element={<TripsPage />} />
                    <Route path="wishlist" element={<WishlistPage />} />
                    <Route path="account" element={<AccountPage />} />
                    <Route path="host" element={<HostDashboard />} />
                  </Route>
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
                <Route element={<RequireAuth />}>
                  <Route path="host/listings/new" element={<ListingEditor />} />
                  <Route path="host/listings/:id/edit" element={<ListingEditor />} />
                </Route>
              </Routes>
            </Suspense>
            <DirectionSwitcher />
          </WishlistProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
