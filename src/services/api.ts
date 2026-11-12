/**
 * The one `api` object every screen uses. Screens import from here, never
 * from `mock/` or `http/` directly, so this file is the only switch.
 *
 * No `VITE_API_URL`: the in-browser mock with sample data.
 * With it, e.g. `VITE_API_URL=https://api.example.com`: the real backend.
 */
import type { AbodeApi } from '../contracts'
import { createHttpApi } from './http/httpApi'
import { mockApi, resetMockData } from './mock/mockApi'
import { DEMO_GUEST_EMAIL, DEMO_HOST_EMAIL, DEMO_PASSWORD } from './mock/seed'

const baseUrl = import.meta.env.VITE_API_URL as string | undefined

export const usingMockApi = !baseUrl

export const api: AbodeApi = baseUrl ? createHttpApi(baseUrl) : mockApi

/** Demo-only helpers. `null` against a real backend, so the UI hides them. */
export const demo = usingMockApi
  ? {
      password: DEMO_PASSWORD,
      accounts: [
        { label: 'Guest (Kofi)', email: DEMO_GUEST_EMAIL },
        { label: 'Host (Ama)', email: DEMO_HOST_EMAIL },
      ],
      reset: resetMockData,
    }
  : null

export { tokenStore } from './tokenStore'
