/**
 * AI 配图 provider 抽象
 * 免费通道：Pollinations 匿名可用，零配置
 * 自定义通道：OpenAI 兼容 / 硅基流动 / 即梦 / 可灵 / ModelScope
 */

export interface ImageRequest {
  provider?: string
  prompt: string
  negative?: string
  width: number
  height: number
  model?: string
  apiKey?: string
  seed?: number
  reference?: string
}

export interface ImageResult {
  url: string
  provider: string
}

export interface ProviderMeta {
  id: string
  name: string
  needsKey: boolean
  free: boolean
  models: string[]
  buildUrl(r: ImageRequest): string
  buildBody?(r: ImageRequest): unknown
  parseResponse?(data: unknown): string
  mode: 'get' | 'post'
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'pollinations',
    name: '免费通道（Pollinations）',
    needsKey: false,
    free: true,
    models: ['flux', 'turbo'],
    mode: 'get',
    buildUrl(r) {
      const p = encodeURIComponent(r.prompt + (r.negative ? ` --no ${r.negative}` : ''))
      const seed = r.seed ?? Math.floor(Math.random() * 1e6)
      return `https://image.pollinations.ai/prompt/${p}?width=${r.width}&height=${r.height}&seed=${seed}&nologo=true&model=${r.model || 'flux'}`
    },
  },
  {
    id: 'siliconflow',
    name: '硅基流动（注册送额度）',
    needsKey: true,
    free: true,
    models: ['black-forest-labs/FLUX.1-schnell', 'stabilityai/stable-diffusion-3-medium'],
    mode: 'post',
    buildUrl: () => 'https://api.siliconflow.cn/v1/images/generations',
    buildBody(r) {
      return {
        model: r.model || 'black-forest-labs/FLUX.1-schnell',
        prompt: r.prompt,
        negative_prompt: r.negative || undefined,
        image_size: `${r.width}x${r.height}`,
        batch_size: 1,
      }
    },
    parseResponse(d) {
      const data = d as { images?: { url?: string }[]; data?: { url?: string }[] }
      return data.images?.[0]?.url || data.data?.[0]?.url || ''
    },
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI 兼容（gpt-image / DALL·E）',
    needsKey: true,
    free: false,
    models: ['gpt-image-1', 'dall-e-3'],
    mode: 'post',
    buildUrl: () => 'https://api.openai.com/v1/images/generations',
    buildBody(r) {
      return {
        model: r.model || 'gpt-image-1',
        prompt: r.prompt,
        n: 1,
        size: r.width === r.height ? '1024x1024' : r.width > r.height ? '1536x1024' : '1024x1536',
      }
    },
    parseResponse(d) {
      const data = d as { data?: { url?: string; b64_json?: string }[] }
      const item = data.data?.[0]
      if (!item) return ''
      return item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '')
    },
  },
  {
    id: 'modelscope',
    name: 'ModelScope 魔搭（每日免费额度）',
    needsKey: true,
    free: true,
    models: ['AI-ModelScope/FLUX.1-schnell'],
    mode: 'post',
    buildUrl: () => 'https://api-inference.modelscope.cn/v1/images/generations',
    buildBody(r) {
      return { model: r.model || 'AI-ModelScope/FLUX.1-schnell', prompt: r.prompt }
    },
    parseResponse(d) {
      const data = d as { images?: { url?: string }[]; output?: { image_url?: string } }
      return data.images?.[0]?.url || data.output?.image_url || ''
    },
  },
]

export function getProvider(id: string): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]
}

/** 生成单张图，返回可访问 URL */
export async function generateImage(req: ImageRequest): Promise<ImageResult> {
  const provider = getProvider(req.provider || 'pollinations')
  if (provider.mode === 'get') {
    const url = provider.buildUrl(req)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`生成失败 HTTP ${res.status}`)
    const blob = await res.blob()
    return { url: URL.createObjectURL(blob), provider: provider.id }
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (req.apiKey) headers.Authorization = `Bearer ${req.apiKey}`
  const res = await fetch(provider.buildUrl(req), {
    method: 'POST',
    headers,
    body: JSON.stringify(provider.buildBody?.(req) ?? {}),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`${provider.name} 返回 ${res.status}：${t.slice(0, 200)}`)
  }
  const data = await res.json()
  const url = provider.parseResponse?.(data) ?? ''
  if (!url) throw new Error('接口未返回图片地址')
  return { url, provider: provider.id }
}

export interface AiPreset {
  id: string
  name: string
  template: string
  negative: string
  ratio: string
}

export const DEFAULT_PRESETS: AiPreset[] = [
  {
    id: 'guofeng',
    name: '国风青绿',
    template:
      '极简国风数字插画，{{主题}}，青绿主色（#2F6B4F 石青 #3A6B8C 石绿），扁平色块，留白构图，无边框，宣纸质感底',
    negative: '写实, 3D渲染, 文字, 水印, 杂乱背景',
    ratio: '1:1',
  },
  {
    id: 'flat',
    name: '扁平插画',
    template: '扁平风格矢量插画，{{主题}}， limited 配色，几何形体，干净背景，现代设计感',
    negative: '写实, 照片, 复杂细节, 文字',
    ratio: '16:9',
  },
  {
    id: 'photo',
    name: '写实摄影',
    template: '高质量摄影作品，{{主题}}，自然光，浅景深，胶片颗粒，杂志摄影质感',
    negative: '插画, 卡通, 变形, 文字',
    ratio: '3:4',
  },
  {
    id: 'magazine',
    name: '杂志封面',
    template: '杂志封面摄影，{{主题}}，高级感构图，暗调背景，戏剧性光影， editorial 风格',
    negative: '廉价, 杂乱, 文字, 水印',
    ratio: '2.35:1',
  },
  {
    id: 'cyber',
    name: '赛博朋克',
    template: '赛博朋克风格，{{主题}}，霓虹灯，青紫对比色，层次化空间，未来感',
    negative: '自然光, 田园, 朴素',
    ratio: '16:9',
  },
  {
    id: 'line',
    name: '极简线稿',
    template: '极简单线插画，{{主题}}，细线条，大量留白，黑白为主点缀一点主色',
    negative: '填充色块, 写实, 复杂',
    ratio: '1:1',
  },
]

export const RATIOS: Record<string, [number, number]> = {
  '1:1': [1024, 1024],
  '16:9': [1344, 768],
  '2.35:1': [1536, 653],
  '3:4': [896, 1152],
  '9:16': [768, 1344],
}

export function applyTemplate(template: string, topic: string): string {
  return template
    .replace(/\{\{主题\}\}/g, topic)
    .replace(/\{\{风格\}\}/g, '')
    .replace(/\{\{配色\}\}/g, '')
    .trim()
}
