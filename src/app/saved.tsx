import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../services/api'
import { useAuth } from './auth'

interface SavedValue {
  ids: Set<string>
  toggle(listingId: string): Promise<void>
}

const SavedContext = createContext<SavedValue | null>(null)

/** The signed-in person's saved listings, shared by every heart button. */
export function SavedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [ids, setIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!user) {
      setIds(new Set())
      return
    }
    api.pub.saved().then((list) => setIds(new Set(list)), () => undefined)
  }, [user])
  const toggle = useCallback(async (listingId: string) => {
    setIds(new Set(await api.pub.toggleSaved(listingId)))
  }, [])
  const value = useMemo(() => ({ ids, toggle }), [ids, toggle])
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>
}

export function useSaved(): SavedValue {
  const ctx = useContext(SavedContext)
  if (!ctx) throw new Error('useSaved must be used inside <SavedProvider>')
  return ctx
}
