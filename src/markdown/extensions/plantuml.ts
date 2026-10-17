/**
 * PlantUML 扩展：```plantuml 代码块
 * 用 PlantUML 在线服务渲染（deflate + 专用 base64 编码），
 * 加载失败时降级显示源码，保证内容不丢。
 */
import { deflateRaw } from 'pako'

interface PlantUmlToken {
  type: string
  raw: string
  text: string
}

const FENCE_RE = /^ {0,3}(`{3,})plantuml[ \t]*\n([\s\S]*?)\n?[ \t]*\1[ \t]*(?:\n|$)/

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

function encode64(data: Uint8Array): string {
  let r = ''
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i]
    const b2 = i + 1 < data.length ? data[i + 1] : 0
    const b3 = i + 2 < data.length ? data[i + 2] : 0
    r += ALPHABET[b1 >> 2]
    r += ALPHABET[((b1 & 0x3) << 4) | (b2 >> 4)]
    r += ALPHABET[((b2 & 0xf) << 2) | (b3 >> 6)]
    r += ALPHABET[b3 & 0x3f]
  }
  return r
}

/** PlantUML 文本 → 服务 URL（PNG） */
export function plantumlUrl(src: string): string {
  const deflated = deflateRaw(new TextEncoder().encode(src), { level: 9 })
  return `https://www.plantuml.com/plantuml/png/${encode64(deflated)}`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function markedPlantuml(): { extensions: unknown[] } {
  return {
    extensions: [
      {
        name: 'plantuml',
        level: 'block',
        start(src: string) {
          const i = src.indexOf('```plantuml')
          return i === -1 ? undefined : i
        },
        tokenizer(src: string) {
          const m = FENCE_RE.exec(src)
          if (!m) return undefined
          return { type: 'plantuml', raw: m[0], text: m[2] } as PlantUmlToken
        },
        renderer(token: PlantUmlToken) {
          const src = token.text.trim()
          const url = plantumlUrl(src)
          return `<div class="mf-plantuml" style="margin:16px 0;"><img src="${url}" alt="PlantUML 图" style="display:block;max-width:100%;border-radius:6px;" /><pre class="mf-plantuml-src" style="display:none;font-size:12px;background:#221F1B;color:#F2EFE8;padding:12px 14px;border-radius:6px;overflow-x:auto;white-space:pre;">${esc(src)}</pre></div>\n`
        },
      },
    ],
  }
}

/** 图片加载失败时降级为源码展示；返回 Promise，等所有图定态（在 inlineForWechat 之前 await） */
export function hydratePlantuml(root: HTMLElement): Promise<void> {
  const boxes = [...root.querySelectorAll<HTMLElement>('.mf-plantuml')]
  if (!boxes.length) return Promise.resolve()
  return Promise.all(
    boxes.map(
      (box) =>
        new Promise<void>((resolve) => {
          const img = box.querySelector('img')
          const pre = box.querySelector('pre')
          if (!img || !pre) return resolve()
          let settled = false
          const finish = () => {
            if (!settled) {
              settled = true
              resolve()
            }
          }
          const fail = () => {
            img.style.display = 'none'
            pre.style.display = 'block'
            finish()
          }
          if (img.complete) {
            if (img.naturalWidth === 0) fail()
            else finish()
            return
          }
          img.addEventListener('load', finish, { once: true })
          img.addEventListener('error', fail, { once: true })
          setTimeout(finish, 5000) /* 网络卡住时超时兜底，保留 img 形态 */
        }),
    ),
  ).then(() => undefined)
}
