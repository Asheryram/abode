import { useCallback, useEffect, useState } from 'react'

interface AsyncState<T> {
  data: T | undefined
  error: unknown
  loading: boolean
}

/**
 * Run an async call when `deps` change and track its result. Keeps the last
 * data while reloading, so a list doesn't flash empty between searches, and
 * ignores answers that arrive after the deps have moved on.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: undefined, loading: true })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let current = true
    setState((s) => ({ data: s.data, error: undefined, loading: true }))
    fn().then(
      (data) => current && setState({ data, error: undefined, loading: false }),
      (error: unknown) => current && setState((s) => ({ data: s.data, error, loading: false })),
    )
    return () => {
      current = false
    }
    // `fn` is a fresh closure every render; `deps` says when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const setData = useCallback((data: T) => setState({ data, error: undefined, loading: false }), [])

  return { ...state, reload, setData }
}
