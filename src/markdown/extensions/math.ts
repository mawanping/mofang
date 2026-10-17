/**
 * 行内/块级公式扩展：$行内$ 与 $$块级$$
 * 用 marked 扩展而非 walkTokens 后处理，避免把整段文本喂给 KaTeX
 */
import katex from 'katex'

interface MathToken {
  type: string
  raw: string
  text: string
  display: boolean
}

const INLINE_RE = /^\$(?!\$)((?:\\.|[^\\\n$])+?)\$(?!\$)/
const BLOCK_RE = /^\s{0,3}\$\$[ \t]*\n?([\s\S]+?)\n?[ \t]*\$\$[ \t]*(?:\n|$)/
/* LaTeX 标准格式：\(行内\) 与 \[块级\] */
const LATEX_INLINE_RE = /^\\\(([\s\S]+?)\\\)/
const LATEX_BLOCK_RE = /^[ \t]*\\\[[ \t]*\n?([\s\S]+?)\n?[ \t]*\\\][ \t]*(?:\n|$)/

function render(expr: string, display: boolean): string {
  const src = expr.trim()
  if (!src) return display ? '' : expr
  try {
    return katex.renderToString(src, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      trust: false,
      output: 'htmlAndMathml',
    })
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e)
    return display
      ? `<p class="md-math-error">${esc(src)}</p>`
      : `<span class="md-math-error" title="${esc(msg)}">${esc(expr)}</span>`
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function markedMath(): { extensions: unknown[] } {
  return {
    extensions: [
      {
        name: 'mathBlock',
        level: 'block',
        start(src: string) {
          const i = src.indexOf('$$')
          return i === -1 ? undefined : i
        },
        tokenizer(src: string) {
          const m = BLOCK_RE.exec(src)
          if (!m) return undefined
          return { type: 'mathBlock', raw: m[0], text: m[1], display: true } as MathToken
        },
        renderer(token: MathToken) {
          return render(token.text, true) + '\n'
        },
      },
      {
        name: 'mathInline',
        level: 'inline',
        start(src: string) {
          const i = src.indexOf('$')
          return i === -1 ? undefined : i
        },
        tokenizer(src: string) {
          const m = INLINE_RE.exec(src)
          if (!m) return undefined
          // 中文写作里 $ 常被当普通字符（金额、价格等），
          // 表达式含 CJK 的一律不按公式处理，避免误伤正文
          if (/[\u4e00-\u9fa5]/.test(m[1])) return undefined
          return { type: 'mathInline', raw: m[0], text: m[1], display: false } as MathToken
        },
        renderer(token: MathToken) {
          return render(token.text, false)
        },
      },
      /* LaTeX 标准行内格式：\( ... \) */
      {
        name: 'latexInline',
        level: 'inline',
        start(src: string) {
          const i = src.indexOf('\\(')
          return i === -1 ? undefined : i
        },
        tokenizer(src: string) {
          const m = LATEX_INLINE_RE.exec(src)
          if (!m) return undefined
          return { type: 'mathInline', raw: m[0], text: m[1], display: false } as MathToken
        },
        renderer(token: MathToken) {
          return render(token.text, false)
        },
      },
      /* LaTeX 标准块级格式：\[ ... \] */
      {
        name: 'latexBlock',
        level: 'block',
        start(src: string) {
          const i = src.indexOf('\\[')
          return i === -1 ? undefined : i
        },
        tokenizer(src: string) {
          const m = LATEX_BLOCK_RE.exec(src)
          if (!m) return undefined
          return { type: 'mathBlock', raw: m[0], text: m[1], display: true } as MathToken
        },
        renderer(token: MathToken) {
          return render(token.text, true) + '\n'
        },
      },
    ],
  }
}
