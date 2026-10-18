/**
 * 自定义符号引擎：用户在设置里配置「触发符号 → 渲染组件」，
 * 运行时编译成 marked 扩展，无需改代码、无需重新构建。
 */

export interface CustomRule {
  id: string
  symbol: string
  component: 'quote' | 'tip' | 'card' | 'banner' | 'highlight' | 'points' | 'html'
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

/**
 * 首行头部解析，支持在标题后面追加单块配色：
 *   `:::banner 重点 #E8622C`        → 强调色
 *   `:::points 要点 #E8622C bg=#FFF7ED` → 强调色 + 底色
 * 这样颜色写在块标记上，而不是包在文字上 —— 包 span 会打断 Markdown 列表/标题语法。
 */
function parseHead(raw: string): { label: string; color?: string; bg?: string } {
  let label = (raw || '').trim()
  let color: string | undefined
  let bg: string | undefined
  label = label.replace(/\s*\bbg=(#[0-9a-fA-F]{3,8})\s*/g, (_m, c: string) => {
    bg = c
    return ' '
  })
  label = label.replace(/\s*(#[0-9a-fA-F]{3,8})\s*$/, (_m, c: string) => {
    color = c
    return ''
  })
  return { label: label.trim(), color, bg }
}

/** hex → rgba，用于生成淡底（公众号不认 color-mix） */
function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

function buildTemplate(rule: CustomRule, inner: string, rawText?: string): string {
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
    case 'banner':
      // 深色横幅：暗底 + 顶部一条强调色线，正文反白，适合金句/章节分隔
      return `<section class="mf-custom mf-custom-banner" style="background:${rule.background || '#221F1B'};border-top:4px solid ${color};border-radius:10px;padding:16px 18px;margin:18px 0;"><p class="mf-custom-label" style="color:${color};font-size:12px;font-weight:600;letter-spacing:1.5px;margin:0 0 6px;">${rule.label || 'BANNER'}</p><div class="mf-custom-body" style="color:#F2EFE8;">${inner}</div></section>`
    case 'points': {
      // 彩色编号要点：每行 `标题|补充说明`，编号与强调色一致
      const lines = (rawText || '').split('\n').map((s) => s.trim()).filter(Boolean)
      const soft = rule.background || (rule.color ? tint(rule.color, 0.07) : 'rgba(0,0,0,0.03)')
      const rows = lines
        .map((line, i) => {
          const [title, desc] = line.split('|')
          const num = String(i + 1).padStart(2, '0')
          return `<section style="display:flex;align-items:flex-start;gap:10px;margin:0 0 10px;line-height:1.6;"><span style="color:${color};font-size:15px;font-weight:700;letter-spacing:0.5px;min-width:24px;">${num}</span><span style="flex:1;color:var(--md-text-primary);">${escapeHtml(title.trim())}${desc ? `<br><span style="font-size:13px;color:var(--md-text-tertiary);">${escapeHtml(desc.trim())}</span>` : ''}</span></section>`
        })
        .join('')
      return `<section class="mf-custom mf-custom-points" style="background:${soft};border-radius:10px;padding:16px 18px;margin:16px 0;">${rows}</section>`
    }
    case 'highlight':
      return `<span class="mf-custom mf-custom-highlight" style="background:${bg};color:${color};padding:1px 5px;border-radius:3px;font-weight:500;">${inner}</span>`
    case 'html':
      return (rule.html || '').replace(/\{\{content\}\}/g, inner)
    default:
      return inner
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
          const head = parseHead(token.title || '')
          // 行首带的颜色/底色覆盖规则默认值
          const merged: CustomRule = {
            ...rule,
            ...(head.color ? { color: head.color } : {}),
            ...(head.bg ? { background: head.bg } : {}),
            ...(head.label ? { label: head.label } : {}),
          }
          // 要点块按原始文本逐行解析，不需要块级 HTML
          if (rule.component === 'points') {
            return buildTemplate(merged, '', token.text || '')
          }
          const body = isInline
            ? this.parser.parseInline(token.tokens ?? [])
            : this.parser.parse(token.tokens ?? [])
          return buildTemplate(merged, body, token.text)
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
  {
    id: 'r-banner',
    symbol: ':::banner',
    component: 'banner',
    label: '重点',
    enabled: true,
  },
  {
    id: 'r-points',
    symbol: ':::points',
    component: 'points',
    label: '要点',
    enabled: true,
  },
]
