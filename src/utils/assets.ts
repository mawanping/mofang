/**
 * 图片资产桥接层。
 *
 * 之前的问题：编辑区插入的是 `![alt](asset:id)`，但预览区是在
 * **渲染后的 HTML** 上用 Markdown 正则去找 `![...](asset:...)`，
 * 永远匹配不到，img 的 src 一直是浏览器无法解析的 `asset:` 协议，
 * 于是「插入不显示、复制到公众号是空的」。
 *
 * 正确做法：渲染前先把 markdown 里的 asset 引用换成 data URI，
 * 这样预览、内联化、剪贴板 HTML 三处拿到的都是真实图片数据，
 * 粘贴进公众号编辑器时微信才会转存显示。
 */
import { getAsset, listAssets } from '../stores/db'

/** id → data URL 缓存（同一张图反复渲染不重复编码） */
const dataUrlCache = new Map<string, string>()

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error ?? new Error('图片读取失败'))
    fr.readAsDataURL(blob)
  })
}

export async function assetToDataUrl(id: string): Promise<string | null> {
  const key = id.trim()
  if (!key) return null
  const cached = dataUrlCache.get(key)
  if (cached) return cached
  const rec = await getAsset(key)
  if (!rec) return null
  const url = await blobToDataUrl(rec.blob)
  dataUrlCache.set(key, url)
  return url
}

/** 素材入库后主动写缓存，避免刚生成就插入时还要再读一次库 */
export async function primeAssetCache(id: string, blob: Blob): Promise<void> {
  dataUrlCache.set(id, await blobToDataUrl(blob))
}

export function invalidateAssetCache(id?: string): void {
  if (id) dataUrlCache.delete(id)
  else dataUrlCache.clear()
}

/** 同步读缓存（编辑器装饰器用，拿不到就先显示占位） */
export function getCachedDataUrl(id: string): string | undefined {
  return dataUrlCache.get(id.trim())
}

/** 从 markdown 里收集所有 asset id */
export function assetIdsIn(md: string): string[] {
  const ids: string[] = []
  for (const m of md.matchAll(/!\[[^\]]*\]\(asset:([^)\s]+)\)/g)) ids.push(m[1])
  return [...new Set(ids)]
}

const RE_ASSET_MD = /!\[([^\]]*)\]\(asset:([^)\s]+)\)/g
const RE_ASSET_HTML = /src=(["'])asset:([^"']+)\1/g

/**
 * 渲染前解析：把 markdown 里的 `![alt](asset:id)` 换成 data URI。
 * 找不到素材时降级为空 data URI（不破坏排版），并在 alt 上标注。
 */
export async function resolveAssetRefs(md: string): Promise<string> {
  if (!md.includes('asset:')) return md
  const ids = new Set<string>()
  for (const m of md.matchAll(RE_ASSET_MD)) ids.add(m[2])
  if (!ids.size) return md

  // 预热缓存（一次读全表，避免逐条查库）
  const missing = [...ids].filter((id) => !dataUrlCache.has(id))
  if (missing.length) {
    const all = await listAssets()
    for (const a of all) {
      if (missing.includes(a.id)) dataUrlCache.set(a.id, await blobToDataUrl(a.blob))
    }
  }

  return md.replace(RE_ASSET_MD, (whole, alt: string, id: string) => {
    const data = dataUrlCache.get(id)
    if (!data) return whole // 素材已删除：保留原样，由界面提示
    return `![${alt}](${data})`
  })
}

/**
 * 复制前的最后一道保险：把 DOM 里仍是 blob: / asset: 的图片转成 data URI。
 * 微信编辑器只认能自己抓到的图片地址，blob: 是本地会话地址，粘过去必然空白。
 */
export async function ensureInlineImages(root: HTMLElement): Promise<number> {
  const imgs = [...root.querySelectorAll('img')]
  let fixed = 0
  for (const img of imgs) {
    const src = img.getAttribute('src') || ''
    if (src.startsWith('data:')) continue
    try {
      if (src.startsWith('asset:')) {
        const data = await assetToDataUrl(src.slice(6))
        if (data) {
          img.setAttribute('src', data)
          fixed++
        }
      } else if (src.startsWith('blob:')) {
        const res = await fetch(src)
        const blob = await res.blob()
        img.setAttribute('src', await blobToDataUrl(blob))
        fixed++
      }
    } catch {
      /* 单张失败不影响其余 */
    }
  }
  return fixed
}

/** 把一张图写进系统剪贴板（image/png），可直接在公众号编辑器 Ctrl+V */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false
    // 非 png 先转 png，微信只稳定接受 png
    let out = blob
    if (blob.type !== 'image/png') {
      out = await convertToPng(blob)
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': out })])
    return true
  } catch {
    return false
  }
}

async function convertToPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return blob
  ctx.drawImage(bitmap, 0, 0)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? blob), 'image/png'))
}