import type { InputMode, ParticleTheme, PatternParams, ReplayMeta } from '@/types/domain'

export interface LocalArtwork {
  id: string
  title: string
  author: string
  theme: ParticleTheme
  source: InputMode
  frequencyHz: number
  pattern: PatternParams
  replayMeta: ReplayMeta
  createdAt: number
  image: Blob
  state: ArrayBuffer
}

const DB_NAME = 'shape-of-sound'
const STORE = 'artworks'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('local_gallery_unavailable'))
        return
      }
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('local_gallery_unavailable'))
    })
    dbPromise.catch(() => {
      dbPromise = null
    })
  }
  return dbPromise
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = run(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('local_gallery_failed'))
      }),
  )
}

export const localGallery = {
  async save(artwork: LocalArtwork): Promise<void> {
    await tx('readwrite', (store) => store.put(artwork))
  },

  async list(): Promise<LocalArtwork[]> {
    const all = await tx('readonly', (store) => store.getAll() as IDBRequest<LocalArtwork[]>)
    return all.sort((a, b) => b.createdAt - a.createdAt)
  },

  async remove(id: string): Promise<void> {
    await tx('readwrite', (store) => store.delete(id))
  },
}
