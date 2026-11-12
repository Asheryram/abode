/**
 * A tiny key-value store on IndexedDB, standing in for the server's database.
 *
 * IndexedDB rather than localStorage because hosts upload photos, and a
 * handful of photos alone would fill localStorage's ~5 MB.
 */

const DB_NAME = 'abode'
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(req.result as T)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const kvGet = <T>(key: string) => run<T | undefined>('readonly', (s) => s.get(key))
export const kvSet = (key: string, value: unknown) => run<void>('readwrite', (s) => s.put(value, key))
export const kvClear = () => run<void>('readwrite', (s) => s.clear())
