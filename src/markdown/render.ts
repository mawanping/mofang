/**
 * 渲染管线：Markdown → HTML（带 class）
 * 预览期用 <style> + class，导出期由 inlineForWechat 展平为行内样式
 */
import { Marked } from 'marked'
import { markupExtensions } from './extensions/markup'
import { markedAlert } from './extensions/alert'
import { markedEmoji } from './extensions/emoji'
import { markedToc } from './extensions/toc'
import { markedFootnotes, renderFootnoteList, resetFootnotes } from './extensions/footnote'
import { markedMath } from './extensions/math'
import { buildCustomExtensions, type CustomRule } from './customRules'

export interface RenderResult {
  html: string
  headings: { level: number; text: string; id: string }[]
}

const parsers = new Map<string, Marked>()

function buildParser(customRules: CustomRule[]): Marked {
  const m = new Marked({ gfm: true, breaks: true })
  m.use({ gfm: true, breaks: true })
  // 注意：marked 的 use() 需要 { extensions: [...] } 包装，裸扩展对象会被静默忽略。
  // 另外 marked v15 对同 level 扩展是 unshift（后注册的先执行），
  // 所以这里按「优先级从低到高」注册：内置类扩展最先，用户自定义规则次之，
  // 墨坊自带行内标记（==/++/~/^）最后注册、最高优先级。
  m.use(markedAlert() as never)
  m.use(markedEmoji() as never)
  m.use(markedMath() as never)
  m.use(markedToc() as never)
  m.use(markedFootnotes() as never)
  m.use({ extensions: buildCustomExtensions(customRules) } as never)
  m.use(markupExtensions as never)
  return m
}

function getParser(key: string, customRules: CustomRule[]): Marked {
  let p = parsers.get(key)
  if (!p) {
    p = buildParser(customRules)
    parsers.set(key, p)
  }
  return p
}

/** 自定义规则变更时调用，让缓存失效 */
export function invalidateParsers(): void {
  parsers.clear()
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40) || 'h'
  )
}

export function renderMarkdown(src: string, customRules: CustomRule[] = []): RenderResult {
  resetFootnotes()
  const key = JSON.stringify(customRules)
  const p = getParser(key, customRules)
  const html = p.parse(src, { async: false }) as string

  const headings: RenderResult['headings'] = []
  const withIds = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_m, lvl: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '')
    const id = slugify(text)
    headings.push({ level: Number(lvl), text, id })
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`
  })

  let out = withIds
  if (out.includes('data-toc')) {
    const list = headings
      .map((h) => `<li class="toc-l${h.level}"><a href="#${h.id}">${h.text}</a></li>`)
      .join('')
    out = out.replace(
      '<nav class="markdown-toc" data-toc></nav>',
      `<nav class="markdown-toc"><p class="markdown-toc-title">目录</p><ul>${list}</ul></nav>`,
    )
  }

  out += renderFootnoteList()
  return { html: out, headings }
}
