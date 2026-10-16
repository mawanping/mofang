/** 脚注扩展：[^1] 引用 + [^1]: 定义 */

interface FootnoteState {
  defs: Map<string, string>
  order: string[]
}

const state: FootnoteState = { defs: new Map(), order: [] }

export function resetFootnotes(): void {
  state.defs.clear()
  state.order.length = 0
}

export function markedFootnotes(): { extensions: unknown[] } {
  return {
    extensions: [
      {
        name: 'footnoteRef',
        level: 'inline',
        start(src: string) {
          const i = src.indexOf('[^')
          return i === -1 ? undefined : i
        },
        tokenizer(src: string) {
          const m = /^\[\^([^\]\n]+)\]/.exec(src)
          if (!m) return undefined
          const id = m[1]
          if (!state.order.includes(id)) state.order.push(id)
          return { type: 'footnoteRef', raw: m[0], text: id }
        },
        renderer(token: { text?: string }) {
          const id = token.text ?? ''
          const n = state.order.indexOf(id) + 1
          return `<sup class="md-footnote-ref"><a href="#fn-${id}" id="fnref-${id}">[${n}]</a></sup>`
        },
      },
      {
        name: 'footnoteDef',
        level: 'block',
        start(src: string) {
          const i = src.search(/^\[\^[^\]\n]+\]:/m)
          return i === -1 ? undefined : i
        },
        tokenizer(src: string) {
          const m = /^\[\^([^\]\n]+)\]:[ \t]*([^\n]*(?:\n(?!\[\^)[^\n]*)*)/.exec(src)
          if (!m) return undefined
          state.defs.set(m[1], m[2].trim())
          return { type: 'footnoteDef', raw: m[0] }
        },
        renderer() {
          return ''
        },
      },
    ],
  }
}

export function renderFootnoteList(): string {
  if (state.order.length === 0) return ''
  const items = state.order
    .map((id, i) => {
      const body = state.defs.get(id) ?? ''
      return `<li id="fn-${id}"><span class="md-footnote-num">[${i + 1}]</span> ${body} <a href="#fnref-${id}" class="md-footnote-back">↩</a></li>`
    })
    .join('')
  return `<section class="md-footnotes"><p class="md-footnotes-title">脚注</p><ol>${items}</ol></section>\n`
}
