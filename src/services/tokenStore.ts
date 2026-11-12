/**
 * Where the login token lives between visits. Both the mock and the HTTP
 * client read it from here, so signing in works the same way with either.
 */
const KEY = 'abode.token'

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(KEY, token)
      else localStorage.removeItem(KEY)
    } catch {
      /* Private mode: the session just won't survive a reload. */
    }
  },
}
