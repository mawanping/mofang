/**
 * 墨坊自定义行内标记扩展：==高亮== ++下划线++ ~波浪线~ ^上标^
 * 性能约定：start() 必须用 indexOf，禁止 new RegExp（start 在每个 inline 位置都会执行）
 */

interface MarkedToken {
  type: string
  raw: string
  text?: string
}

type Tokenizer = (src: string) => MarkedToken | undefined
type Renderer = (token: MarkedToken) => string

interface InlineExt {
  name: string
  level: 'inline'
  start(src: string): number | undefined
  tokenizer: Tokenizer
  renderer: Renderer
}

const CHARS: Record<string, string> = {
  markupHighlight: '==',
  markupUnderline: '++',
  markupWavyline: '~',
  markupSuperscript: '^',
}

function makeExt(name: string, rule: RegExp, cls: string, tag: string): InlineExt {
  const marker = CHARS[name]
  return {
    name,
    level: 'inline',
    start(src: string) {
      const i = src.indexOf(marker)
      return i === -1 ? undefined : i
    },
    tokenizer(src: string) {
      const m = rule.exec(src)
      if (!m) return undefined
      return { type: name, raw: m[0], text: m[1] }
    },
    renderer(token) {
      return `<${tag} class="${cls}">${token.text ?? ''}</${tag}>`
    },
  }
}

/** 墨坊自定义行内标记扩展：==高亮== ++下划线++ ~波浪线~ ^上标^ */

export const markupExtensions = {
  extensions: [
    makeExt('markupHighlight', /^==(?=\S)((?:[^=]|=(?!=))*[^\s=])==/, 'markup-highlight', 'mark'),
    makeExt('markupUnderline', /^\+\+(?=\S)((?:[^+]|\+(?!\+))*[^\s+])\+\+/, 'markup-underline', 'u'),
    // 单浪号 ~文本~ 走墨坊波浪线；双浪号 ~~文本~~ 让给 marked 内置 del（删除线）
    makeExt('markupWavyline', /^~(?=\S)([^~\n]*[^\s~])~/, 'markup-wavyline', 'span'),
    makeExt('markupSuperscript', /^\^(?=\S)([^\s^]+)\^/, 'markup-superscript', 'sup'),
  ],
}
