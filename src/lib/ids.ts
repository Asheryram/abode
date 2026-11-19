/** A random ID for things the browser creates, such as an idempotency key. */
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
