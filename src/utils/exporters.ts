/** 保存与导出工具：File System Access API + HTML/PDF 导出 */

export interface SaveMeta {
  themeId: string
  primaryColor: string
}

const DIR_KEY = 'mofang_save_dir'

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>
  requestPermission: (d: { mode: 'readwrite' }) => Promise<PermissionState>
}

let dir: DirHandle | undefined

async function getDirHandle(): Promise<DirHandle | undefined> {
  if (!('showDirectoryPicker' in window)) return undefined
  const w = window as unknown as { showDirectoryPicker: (o?: unknown) => Promise<DirHandle> }
  return w.showDirectoryPicker({ mode: 'readwrite' })
}

async function getStoredDir(): Promise<DirHandle | undefined> {
  if (!('indexedDB' in window)) return undefined
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('mofang-fs', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('handles')
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly')
      const req = tx.objectStore('handles').get(DIR_KEY)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return undefined
  }
}

async function storeDir(h: DirHandle): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('mofang-fs', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('handles')
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite')
    tx.objectStore('handles').put(h, DIR_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function dirSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

function safeName(title: string): string {
  return (title || '未命名').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
}

function frontMatter(title: string, content: string, meta: SaveMeta): string {
  return `---\ntitle: ${title}\ntheme: ${meta.themeId}\nprimaryColor: "${meta.primaryColor}"\ndate: ${new Date().toISOString().slice(0, 10)}\n---\n\n${content}\n`
}

/** 保存 Markdown 到用户选定文件夹（首次选，之后记住） */
export async function saveToFolder(title: string, content: string, meta: SaveMeta): Promise<boolean> {
  let dir = await getStoredDir()
  if (!dir) {
    dir = await getDirHandle()
    if (!dir) return false
    await storeDir(dir)
  }
  // 校验权限（浏览器可能回收）
  if (dir.queryPermission && (await dir.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    const req = await dir.requestPermission({ mode: 'readwrite' })
    if (req !== 'granted') return false
  }
  const date = new Date().toISOString().slice(0, 10)
  const name = `${date}-${safeName(title)}.md`
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(frontMatter(title, content, meta))
  await w.close()
  return true
}

/** 让用户重新选择保存文件夹 */
export async function pickSaveDir(): Promise<boolean> {
  const dir = await getDirHandle()
  if (!dir) return false
  await storeDir(dir)
  return true
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportHtml(title: string, inlineHtml: string) {
  const date = new Date().toISOString().slice(0, 10)
  const full = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#ECEAE3}#output{max-width:677px;margin:0 auto;background:#fff;min-height:100vh}</style>
</head><body><div id="output">${inlineHtml}</div></body></html>`
  download(new Blob([full], { type: 'text/html;charset=utf-8' }), `${date}-${safeName(title)}.html`)
}

/** 导出 PDF：用当前预览页触发浏览器打印 */
export function exportPdf() {
  window.print()
}
