/**
 * The one `api` object every screen uses. Screens import from here, never
 * from `backend/` directly, so this file is the only switch.
 *
 * Today it is the in-browser test backend with test data. When the real
 * backend exists, a client generated from its OpenAPI document replaces it
 * here with the same method names (CON-05, DEC-FE-03).
 */
import { accountApi, authApi, DEMO_CODES } from './backend/authApi'
import { adminApi } from './backend/adminApi'
import { buildSeed, DEMO_ACCOUNTS, DEMO_PASSWORD } from './backend/seed'
import { portalApi } from './backend/portalApi'
import { publicApi } from './backend/publicApi'
import { resetDb } from './backend/state'

export const api = { auth: authApi, account: accountApi, pub: publicApi, portal: portalApi, admin: adminApi }

export type Api = typeof api

/** Test-data helpers, shown only while the test backend is in use. */
export const demo = {
  password: DEMO_PASSWORD,
  codes: DEMO_CODES,
  accounts: DEMO_ACCOUNTS,
  reset: () => resetDb(buildSeed),
  environment: 'test' as const,
}
