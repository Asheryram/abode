/**
 * - `BAD_REQUEST`: the input was wrong. `message` says what to fix.
 * - `UNAUTHORIZED`: not logged in, or the token expired.
 * - `FORBIDDEN`: logged in, but not allowed (e.g. booking your own place).
 * - `NOT_FOUND`: no such thing, or not visible to this user.
 * - `CONFLICT`: clashes with existing data (email taken, dates just booked).
 * - `NETWORK`: never sent by the server. The client could not reach it.
 * - `SERVER`: anything else that went wrong on the server.
 */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'NETWORK'
  | 'SERVER'

/** The JSON body the backend returns with every non-2xx response. */
export interface ApiErrorBody {
  code: ApiErrorCode
  /** Plain-language and safe to show the user as is. */
  message: string
}

const STATUS_FOR: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  NETWORK: 0,
  SERVER: 500,
}

export function codeForStatus(status: number): ApiErrorCode {
  const match = (Object.keys(STATUS_FOR) as ApiErrorCode[]).find((c) => STATUS_FOR[c] === status)
  return match ?? (status >= 500 ? 'SERVER' : 'BAD_REQUEST')
}

/** What every API call throws, whichever implementation is behind it. */
export class ApiError extends Error {
  code: ApiErrorCode
  status: number
  constructor(code: ApiErrorCode, message: string, status = STATUS_FOR[code]) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Please try again.'
