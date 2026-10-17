/**
 * Ruby 注音扩展：[文字]{注音} 与 [文字]^(注音)
 * 渲染为 <ruby>文字<rt>注音</rt></ruby>，公众号客户端支持 ruby 标签
 */

interface RubyToken {
  type: string
  raw: string
  text: string
  ruby: string
}

/* [文字]{注音} */
const RUBY_BRACE_RE = /^\[([^\]\n]+)\]\{([^}\n]+)\}/
/* [文字]^(注音) */
const RUBY_CARET_RE = /^\[([^\]\n]+)\]\^\(([^)\n]+)\)/

export function markedRuby(): { extensions: unknown[] } {
  return {
    extensions: [
      {
        name: 'ruby',
        level: 'inline',
        start(src: string) {
          /* 找第一个可能触发 ruby 的 [ */
          const i = src.search(/\[[^\]\n]*\][{(^]/)
          return i === -1 ? undefined : i
        },
        tokenizer(src: string) {
          const m = RUBY_BRACE_RE.exec(src) || RUBY_CARET_RE.exec(src)
          if (!m) return undefined
          return { type: 'ruby', raw: m[0], text: m[1], ruby: m[2] } as RubyToken
        },
        renderer(token: RubyToken) {
          const text = esc(token.text.trim())
          const ruby = esc(token.ruby.trim())
          if (!text || !ruby) return esc(token.raw)
          return `<ruby class="mf-ruby">${text}<rt>${ruby}</rt></ruby>`
        },
      },
    ],
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
