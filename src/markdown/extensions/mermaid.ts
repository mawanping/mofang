/**
 * Mermaid 流程图扩展：```mermaid 代码块
 * 渲染期输出占位 div（内含源码兜底），hydrateMermaid() 用 mermaid 渲染成 svg。
 * 动态 import：只有文档里真出现 mermaid 块时才加载 mermaid 包。
 */

interface MermaidToken {
  type: string
  raw: string
  text: string
}

const FENCE_RE = /^ {0,3}(`{3,})mermaid[ \t]*\n([\s\S]*?)\n?[ \t]*\1[ \t]*(?:\n|$)/

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function markedMermaid(): { extensions: unknown[] } {
  return {
    extensions: [
      {
        name: 'mermaid',
        level: 'block',
        start(src: string) {
          const i = src.indexOf('```mermaid')
          return i === -1 ? undefined : i
        },
        tokenizer(src: string) {
          const m = FENCE_RE.exec(src)
          if (!m) return undefined
          return { type: 'mermaid', raw: m[0], text: m[2] } as MermaidToken
        },
        renderer(token: MermaidToken) {
          const src = token.text.trim()
          return `<div class="mf-mermaid" data-mermaid="${encodeURIComponent(src)}"><pre class="mf-mermaid-src">${esc(src)}</pre></div>\n`
        },
      },
    ],
  }
}

let mermaidPromise: Promise<typeof import('mermaid')['default']> | undefined
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const m = mod.default
      m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' })
      return m
    })
  }
  return mermaidPromise
}

/**
 * 把容器内所有 .mf-mermaid 占位块渲染成 svg（原地替换）。
 * 内联化（inlineForWechat）之前调用，保证复制到公众号的也是渲染结果。
 */
export async function hydrateMermaid(root: HTMLElement): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>('.mf-mermaid')]
  if (!blocks.length) return
  let mermaid: Awaited<ReturnType<typeof loadMermaid>>
  try {
    mermaid = await loadMermaid()
  } catch {
    return /* 包加载失败就保留源码兜底 */
  }
  await Promise.all(
    blocks.map(async (el, i) => {
      const src = decodeURIComponent(el.dataset.mermaid || '')
      if (!src) return
      try {
        const { svg } = await mermaid.render(`mf-mermaid-${Date.now()}-${i}`, src)
        el.innerHTML = svg
        el.removeAttribute('data-mermaid')
        // mermaid 默认 useMaxWidth 会给 svg 加 max-width:200px，粘到公众号会把图憋小，
        // 改成满宽（块级 100% 在公众号全宽容器里自适应）
        const svgEl = el.querySelector('svg')
        if (svgEl) {
          const s = svgEl.getAttribute('style')
          if (s) {
            svgEl.setAttribute('style', s.replace(/max-width:\s*[0-9.]+px/g, 'width:100%'))
          } else {
            svgEl.setAttribute('style', 'width:100%;height:auto;')
          }
        }
      } catch (e) {
        el.classList.add('mf-mermaid-error')
        el.title = `Mermaid 渲染失败：${(e as Error)?.message ?? ''}`
      }
    }),
  )
}
