/** IndexedDB 存储层：文档、草稿、选题、待办、素材、设置 */
import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'mofang'
const DB_VERSION = 1

export interface DocRecord {
  id: string
  title: string
  content: string
  kind: 'doc' | 'draft' | 'idea'
  status: 'writing' | 'done' | 'published'
  themeId: string
  primaryColor?: string
  createdAt: number
  updatedAt: number
  wordCount: number
}

export interface AssetRecord {
  id: string
  name: string
  blob: Blob
  type: string
  size: number
  createdAt: number
}

export interface TodoRecord {
  id: string
  text: string
  done: boolean
  createdAt: number
}

export interface SettingsRecord {
  key: string
  value: unknown
}

let dbp: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('docs')) {
          const s = db.createObjectStore('docs', { keyPath: 'id' })
          s.createIndex('updatedAt', 'updatedAt')
          s.createIndex('kind', 'kind')
        }
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('todos')) {
          db.createObjectStore('todos', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      },
    })
  }
  return dbp
}

/* ---------- 文档 ---------- */

export async function listDocs(kind?: DocRecord['kind']): Promise<DocRecord[]> {
  const db = await getDB()
  const all = (await db.getAll('docs')) as DocRecord[]
  const filtered = kind ? all.filter((d) => d.kind === kind) : all
  return filtered.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getDoc(id: string): Promise<DocRecord | undefined> {
  const db = await getDB()
  return (await db.get('docs', id)) as DocRecord | undefined
}

export async function putDoc(doc: DocRecord): Promise<void> {
  const db = await getDB()
  await db.put('docs', doc)
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('docs', id)
}

/* ---------- 素材 ---------- */

export async function listAssets(): Promise<AssetRecord[]> {
  const db = await getDB()
  const all = (await db.getAll('assets')) as AssetRecord[]
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function putAsset(a: AssetRecord): Promise<void> {
  const db = await getDB()
  await db.put('assets', a)
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('assets', id)
}

/* ---------- 待办 ---------- */

export async function listTodos(): Promise<TodoRecord[]> {
  const db = await getDB()
  const all = (await db.getAll('todos')) as TodoRecord[]
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function putTodo(t: TodoRecord): Promise<void> {
  const db = await getDB()
  await db.put('todos', t)
}

export async function deleteTodo(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('todos', id)
}

/* ---------- 设置 ---------- */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDB()
  const row = (await db.get('settings', key)) as SettingsRecord | undefined
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key, value })
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function countWords(s: string): number {
  const cjk = (s.match(/[\u4e00-\u9fa5]/g) || []).length
  const en = (s.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  return cjk + en
}
