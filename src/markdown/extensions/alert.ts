/**
 * 提示框扩展：> [!NOTE] 标题 与 :::tip 容器式
 * 变体名大小写不敏感，支持任意自定义名（含中文）
 */

interface AlertToken {
  type: string
  raw: string
  variant: string
  title: string
  body: string
  tokens?: unknown[]
}

/** marked 把扩展 tokenizer 以 { lexer } 为 this 调用 */
interface AlertLexerCtx {
  lexer: {
    state: { top: boolean }
    blockTokens(src: string, tokens: unknown[]): void
  }
}

/** 自定义 renderer 以 { parser } 为 this 调用 */
interface AlertRendererCtx {
  parser: { parse(tokens: unknown[]): string }
}

const VARIANTS: Record<string, { icon: string; label: string }> = {
  note: { icon: 'i', label: '备注' },
  tip: { icon: '*', label: '提示' },
  info: { icon: 'i', label: '信息' },
  important: { icon: '!', label: '重要' },
  warning: { icon: '!', label: '注意' },
  caution: { icon: '!', label: '警告' },
  abstract: { icon: '=', label: '摘要' },
  summary: { icon: '=', label: '总结' },
  tldr: { icon: '=', label: '太长不看' },
  todo: { icon: 'v', label: '待办' },
  success: { icon: 'v', label: '成功' },
  done: { icon: 'v', label: '完成' },
  question: { icon: '?', label: '问题' },
  help: { icon: '?', label: '帮助' },
  faq: { icon: '?', label: '常见问题' },
  failure: { icon: 'x', label: '失败' },
  fail: { icon: 'x', label: '失败' },
  danger: { icon: 'x', label: '危险' },
  error: { icon: 'x', label: '错误' },
  bug: { icon: 'x', label: '缺陷' },
  example: { icon: 'e', label: '示例' },
  quote: { icon: 'q', label: '引用' },
  cite: { icon: 'q', label: '引文' },
  missing: { icon: '-', label: '缺失' },
}

const HEADER_RE = /^\[!([^\]\n]+)\][ \t]*([^\n]*)/
const CONTAINER_RE = /^:::([A-Za-z\u4e00-\u9fa5]+)[ \t]*([^\n]*)\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 把容器 body 按 block 级解析进 token.tokens，渲染期即可含加粗/列表/代码等 */
function lexBlockChildren(
  lexer: AlertLexerCtx['lexer'],
  token: AlertToken,
  body: string,
): void {
  const top = lexer.state.top
  lexer.state.top = true
  lexer.blockTokens(body, token.tokens ?? [])
  lexer.state.top = top
}

export function markedAlert(): { extensions: unknown[] } {
  return {
    extensions: [
      {
        name: 'alert',
        level: 'block',
        start(src: string) {
          const i = src.search(/^[ \t]*> \[!|^[ \t]*:::/m)
          return i === -1 ? undefined : i
        },
        tokenizer(this: AlertLexerCtx, src: string) {
          const cm = CONTAINER_RE.exec(src)
          if (cm) {
            const variant = cm[1].toLowerCase()
            const body = cm[3]
            const token: AlertToken = {
              type: 'alert',
              raw: cm[0],
              variant,
              title: cm[2] || VARIANTS[variant]?.label || '提示',
              body,
              tokens: [],
            }
            lexBlockChildren(this.lexer, token, body)
            return token
          }
          const line = /^[ \t]*> \[!([^\]\n]+)\][ \t]*([^\n]*)\n?((?:[ \t]*>.*(?:\n|$))*)/.exec(src)
          if (!line) return undefined
          const variant = line[1].toLowerCase()
          const body = line[3]
            .split('\n')
            .map((l) => l.replace(/^[ \t]*>[ \t]?/, ''))
            .join('\n')
            .trim()
          const token: AlertToken = {
            type: 'alert',
            raw: line[0],
            variant,
            title: line[2] || VARIANTS[variant]?.label || '提示',
            body,
            tokens: [],
          }
          lexBlockChildren(this.lexer, token, body)
          return token
        },
        renderer(this: AlertRendererCtx, token: AlertToken) {
          const v = VARIANTS[token.variant]
          const icon = v?.icon ?? '!'
          const label = token.title
          // body 已按 block 级子解析，内含加粗/列表/代码等都会正常渲染
          const body = this.parser.parse(token.tokens ?? [])
          return `<section class="markdown-alert markdown-alert-${escapeHtml(token.variant)}">
  <p class="markdown-alert-title"><span class="markdown-alert-icon">${icon}</span>${escapeHtml(label)}</p>
  <div class="markdown-alert-body">${body}</div>
</section>\n`
        },
      },
    ],
  }
}
