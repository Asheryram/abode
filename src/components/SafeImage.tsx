import { House } from 'lucide-react'
import { useState, type ImgHTMLAttributes } from 'react'
import { cx } from './ui'

/** An <img> that turns into a quiet placeholder instead of a broken-image icon. */
export function SafeImage({ className, alt, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false)
  if (failed || !rest.src) {
    return (
      <div role="img" aria-label={alt} className={cx('grid place-items-center bg-stone-200 text-stone-400', className)}>
        <House className="size-8" aria-hidden />
      </div>
    )
  }
  return <img loading="lazy" decoding="async" alt={alt} {...rest} className={cx('bg-stone-200 object-cover', className)} onError={() => setFailed(true)} />
}
