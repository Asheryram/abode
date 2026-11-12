import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { errorMessage } from '../contracts'
import { api } from '../services/api'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

interface WishlistValue {
  ids: ReadonlySet<string>
  /** Optimistic: the heart fills at once and un-fills if the server says no. */
  toggle(listingId: string): void
}

const WishlistContext = createContext<WishlistValue | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const toast = useToast()
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (!user) {
      setIds(new Set())
      return
    }
    let current = true
    api.wishlist
      .ids()
      .then((list) => current && setIds(new Set(list)))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [user])

  const toggle = useCallback(
    (listingId: string) => {
      const saved = ids.has(listingId)
      const flip = (s: ReadonlySet<string>) => {
        const n = new Set(s)
        if (n.has(listingId)) n.delete(listingId)
        else n.add(listingId)
        return n
      }
      setIds(flip)
      const call = saved ? api.wishlist.remove(listingId) : api.wishlist.add(listingId)
      call.then(
        (list) => {
          setIds(new Set(list))
          toast(saved ? 'Removed from your wishlist' : 'Saved to your wishlist')
        },
        (e: unknown) => {
          setIds(flip)
          toast(errorMessage(e), 'error')
        },
      )
    },
    [ids, toast],
  )

  const value = useMemo(() => ({ ids, toggle }), [ids, toggle])
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist(): WishlistValue {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used inside <WishlistProvider>')
  return ctx
}
