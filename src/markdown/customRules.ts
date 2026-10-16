/**
 * 自定义符号引擎：用户在设置里配置「触发符号 → 渲染组件」，
 * 运行时编译成 marked 扩展，无需改代码、无需重新构建。
 */

export interface CustomRule {
  id: string
  symbol: string
  component: 'quote' | 'tip' | 'card' | 'highlight' | 'html'
  color?: string
  borderWidth?: number
  background?: string
  label?: string
  html?: string
  enabled: boolean
}

const RULE_RE = (symbol: string) =>
  new RegExp(`^${escapeRe(symbol)}[ \\t]*([^\\n]*)\\n([\\s\\S]*?)\\n?:::[ \\t]*(?:\\n|$)`)

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildTemplate(rule: CustomRule, inner: string): string {
  const color = rule.color || 'var(--md-primary-color)'
  const bw = rule.borderWidth ?? 4
  const bg = rule.background || 'color-mix(in srgb, var(--md-primary-color) 8%, transparent)'
  switch (rule.component) {
    case 'quote':
      return `<section class="mf-custom mf-custom-quote" style="border-left:${bw}px solid ${color};background:${bg};padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;"><div class="mf-custom-body">${inner}</div></section>`
    case 'tip':
      return `<section class="mf-custom mf-custom-tip" style="background:${bg};border:0.5px solid ${color};border-radius:8px;padding:12px 16px;margin:16px 0;"><p class="mf-custom-label" style="color:${color};font-size:12px;font-weight:500;letter-spacing:1px;margin:0 0 6px;">${rule.label || '提示'}</p><div class="mf-custom-body">${inner}</div></section>`
    case 'card':
      return `<section class="mf-custom mf-custom-card" style="background:${bg};border-radius:10px;padding:18px 20px;margin:18px 0;"><div class="mf-custom-body">${inner}</div></section>`
    case 'highlight':
      return `<span class="mf-custom mf-custom-highlight" style="background:${bg};color:${color};padding:1px 5px;border-radius:3px;font-weight:500;">${inner}</span>`
    case 'html':
      return (rule.html || '').replace(/\{\{content\}\}/g, inner)
    default:
      return inner
  }
}

/** marked 把扩展 tokenizer 以 { lexer } 为 this 调用 */
interface RuleLexerCtx {
  lexer: {
    state: { top: boolean }
    inline(src: string, tokens: unknown[]): unknown[]
    blockTokens(src: string, tokens: unknown[]): void
  }
}

/** 自定义 renderer 以 { parser } 为 this 调用 */
interface RuleRendererCtx {
  parser: { parse(tokens: unknown[]): string; parseInline(tokens: unknown[]): string }
}

export function buildCustomExtensions(rules: CustomRule[]): unknown[] {
  return rules
    .filter((r) => r.enabled && r.symbol && r.symbol.length >= 2)
    .map((rule) => {
      const re = RULE_RE(rule.symbol)
      const isInline = rule.component === 'highlight'
      return {
        name: `mfRule_${rule.id}`,
        level: isInline ? 'inline' : 'block',
        start(src: string) {
          const i = src.indexOf(rule.symbol)
          return i === -1 ? undefined : i
        },
        tokenizer(this: RuleLexerCtx, src: string) {
          const m = re.exec(src)
          if (!m) return undefined
          // m[1] = 首行标题（可选），m[2] = 正文
          const token: { type: string; raw: string; text: string; title: string; tokens: unknown[] } = {
            type: `mfRule_${rule.id}`,
            raw: m[0],
            text: m[2] ?? '',
            title: m[1] ?? '',
            tokens: [],
          }
          const lexer = this.lexer
          if (isInline) {
            lexer.inline(token.text, token.tokens)
          } else {
            // 仿 marked blockquote 的写法：body 按 block 级解析，
            // 渲染期即可含加粗/列表/代码等，而不是把 ** 原文吐出去
            const top = lexer.state.top
            lexer.state.top = true
            lexer.blockTokens(token.text, token.tokens)
            lexer.state.top = top
          }
          return token
        },
        renderer(
          this: RuleRendererCtx,
          token: { text?: string; title?: string; tokens?: unknown[] },
        ) {
          const label = (token.title || '').trim()
          const body = isInline
            ? this.parser.parseInline(token.tokens ?? [])
            : this.parser.parse(token.tokens ?? [])
          if (label && rule.component !== 'card' && rule.component !== 'quote') {
            return buildTemplate({ ...rule, label }, body)
          }
          return buildTemplate(rule, body)
        },
      }
    })
}

export const DEFAULT_RULES: CustomRule[] = [
  {
    id: 'r-quote',
    symbol: ':::quote',
    component: 'quote',
    label: '引用',
    enabled: true,
  },
  {
    id: 'r-tip',
    symbol: ':::tip',
    component: 'tip',
    label: '提示',
    enabled: true,
  },
  {
    id: 'r-card',
    symbol: ':::card',
    component: 'card',
    enabled: true,
  },
]
