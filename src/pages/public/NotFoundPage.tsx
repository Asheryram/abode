import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-sm font-semibold text-brand-700">Page not found</p>
      <h1 className="mt-2 text-3xl font-bold">We couldn’t find that page</h1>
      <p className="mt-2 text-muted">The link may be old, or the page may have moved.</p>
      <Link to="/" className="mt-6 inline-block rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800">
        Go to the home page
      </Link>
    </div>
  )
}
