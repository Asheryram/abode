import { MapPinOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonClass } from '../components/ui'

export function NotFoundPage({ message = 'We can’t find the page you’re looking for.' }: { message?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <MapPinOff className="size-12 text-brand-700" strokeWidth={1.5} aria-hidden />
      <h1 className="mt-5 text-2xl font-bold">Nothing here</h1>
      <p className="mt-2 text-muted">{message}</p>
      <Link to="/" className={buttonClass('primary', 'md', 'mt-6')}>
        Back to exploring
      </Link>
    </div>
  )
}

export default NotFoundPage
