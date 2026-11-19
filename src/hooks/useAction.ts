import { useCallback, useState } from 'react'

/**
 * Run one user action at a time and keep its error, for buttons and forms.
 * `run` ignores a second call while the first is still going, so a double
 * click never submits twice (FE-GLB-011).
 */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (busy) return undefined
      setBusy(true)
      setError(null)
      try {
        return await fn()
      } catch (e) {
        setError(e)
        return undefined
      } finally {
        setBusy(false)
      }
    },
    [busy],
  )
  return { busy, error, setError, run }
}
