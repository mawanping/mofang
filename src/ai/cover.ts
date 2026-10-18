import { useEditorStore } from '../stores/editor'
import { generateImage, RATIOS } from './providers'
import { putAsset, uid, type AssetRecord } from '../stores/db'
import { primeAssetCache } from '../utils/assets'

export type CoverRatio = 'big' | 'square'

export interface CoverMeta {
  /** 2.35:1 头条封面尺寸说明 */
  label: string
  /** 中文比例名 */
  name: string
  ratio: CoverRatio
  /** 展示用宽高比 */
  css: string
}

/** 公众号两种封面规格 */
export const COVER_SPECS: CoverMeta[] = [
  { label: '2.35:1', name: '头条封面', ratio: 'big', css: '2.35 / 1' },
  { label: '1:1', name: '次条方图', ratio: 'square', css: '1 / 1' },
]

function specOf(ratio: CoverRatio): CoverMeta {
  return COVER_SPECS.find((s) => s.ratio === ratio) ?? COVER_SPECS[0]
}

/** 生成封面图，返回可访问 URL */
export async function generateCover(prompt: string, ratio: CoverRatio): Promise<string> {
  const store = useEditorStore()
  const p = prompt.trim()
  if (!p) throw new Error('请先描述封面画面')
  const [w, h] = RATIOS[ratio === 'big' ? '2.35:1' : '1:1']
  const r = await generateImage({
    prompt: `公众号封面图，${p}，横版构图，主体居中，留出上方空间给标题文字，高质量`,
    width: w,
    height: h,
    apiKey: store.aiApiKey || undefined,
    model: store.aiProvider === 'pollinations' ? undefined : store.aiModel || undefined,
    seed: Math.floor(Math.random() * 1e6),
  })
  return r.url
}

/** 把生成结果存入素材库，返回资产记录 */
export async function saveCoverToAssets(url: string, ratio: CoverRatio): Promise<AssetRecord> {
  const res = await fetch(url)
  const blob = await res.blob()
  const id = uid()
  const rec: AssetRecord = {
    id,
    name: `封面-${specOf(ratio).label}-${id}.png`,
    blob,
    type: blob.type || 'image/png',
    size: blob.size,
    createdAt: Date.now(),
  }
  await putAsset(rec)
  await primeAssetCache(id, blob)
  return rec
}

/** 生成并入库一步到位 */
export async function makeCover(prompt: string, ratio: CoverRatio): Promise<AssetRecord> {
  const url = await generateCover(prompt, ratio)
  return saveCoverToAssets(url, ratio)
}