import { useEffect } from 'react'

/** Call `fn` every `ms` while `active`, pausing while the tab is hidden. */
export function usePoll(fn: () => void, ms: number, active = true) {
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') fn()
    }, ms)
    return () => window.clearInterval(id)
  }, [fn, ms, active])
}
