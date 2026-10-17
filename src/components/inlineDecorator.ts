/**
 * 行内样式装饰器：把 <span style="...">文字</span> 等行内 HTML
 * 的「标签」隐藏（零宽 widget）、「内容」直接渲染出效果（mark decoration）。
 *
 * 用户选中文字点颜色/字号后，编辑器里看到的就是文字直接变色/变大，
 * 不再裸露编程标记；源码里 span 保留，复制/导出链路不变。
 */
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

class ZeroWidth extends WidgetType {
  toDOM(): HTMLElement {
    const s = document.createElement('span')
    s.style.cssText = 'display:inline-block;width:0;height:0;overflow:hidden;line-height:0;font-size:0'
    s.setAttribute('aria-hidden', 'true')
    return s
  }
  ignoreEvent(): boolean {
    return true
  }
}
const ZERO = Decoration.replace({ widget: new ZeroWidth() })

/** 允许透传的行内样式属性（白名单，防注入） */
const STYLE_ALLOW = new Set([
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
])

/** 无 style 属性的标签的默认呈现 */
const TAG_STYLE: Record<string, string> = {
  mark: 'background-color:#FCF3CF;',
  u: 'text-decoration:underline;',
  sup: 'vertical-align:super;font-size:0.72em;',
  sub: 'vertical-align:sub;font-size:0.72em;',
  del: 'text-decoration:line-through;',
  rt: 'vertical-align:super;font-size:0.7em;opacity:0.7;',
  code: 'font-family:var(--font-mono,monospace);background-color:rgba(0,0,0,0.05);border-radius:2px;',
}

function parseSpanStyle(style: string): string {
  const out: string[] = []
  for (const part of style.split(';')) {
    const i = part.indexOf(':')
    if (i < 0) continue
    const k = part.slice(0, i).trim().toLowerCase()
    const v = part.slice(i + 1).trim()
    if (STYLE_ALLOW.has(k) && v && !/[<>"']/.test(v)) out.push(`${k}:${v}`)
  }
  return out.join(';')
}

/** class 里识别墨坊自定义标记的呈现（如波浪线） */
function classStyle(cls: string): string {
  if (cls.includes('markup-wavyline')) return 'text-decoration:underline wavy;'
  if (cls.includes('markup-highlight')) return 'background-color:#FCF3CF;'
  if (cls.includes('markup-underline')) return 'text-decoration:underline;'
  if (cls.includes('markup-superscript')) return 'vertical-align:super;font-size:0.72em;'
  return ''
}

interface OpenTag {
  tag: string
  from: number
  end: number
  style: string
}

function buildDecorations(view: EditorView): DecorationSet {
  const text = view.state.doc.toString()
  if (!text.includes('<')) return Decoration.none
  const items: { from: number; to: number; deco: Decoration; order: number }[] = []
  const TAG_RE = /<(\/?)(span|mark|u|sup|sub|ruby|rt|del|code)\b([^>]*)>/g
  const stack: OpenTag[] = []
  let m: RegExpExecArray | null
  while ((m = TAG_RE.exec(text))) {
    const [raw, slash, tag, attrs] = m
    const from = m.index
    const to = from + raw.length
    if (slash) {
      /* 闭标签：与栈上最近的同名开标签配对 */
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          const open = stack[i]
          items.push({ from: open.from, to: open.end, deco: ZERO, order: 0 })
          items.push({ from, to, deco: ZERO, order: 0 })
          const css = open.tag === 'span' ? parseSpanStyle(open.style) : TAG_STYLE[open.tag] || ''
          if (css && open.end < from) {
            items.push({ from: open.end, to: from, deco: Decoration.mark({ attributes: { style: css } }), order: 1 })
          }
          stack.splice(i, 1)
          break
        }
      }
    } else {
      const style = (attrs.match(/style="([^"]*)"/) || [])[1] || ''
      const cls = (attrs.match(/class="([^"]*)"/) || [])[1] || ''
      stack.push({ tag, from, end: to, style: style || classStyle(cls) })
    }
  }
  /* 未闭合的标签也隐藏，避免编辑中间态露出半个标签 */
  for (const s of stack) items.push({ from: s.from, to: s.end, deco: ZERO, order: 0 })

  items.sort((a, b) => a.from - b.from || a.order - b.order)
  const builder = new RangeSetBuilder<Decoration>()
  for (const it of items) {
    if (it.from >= it.to) continue
    try {
      builder.add(it.from, it.to, it.deco)
    } catch {
      /* 单条异常不影响整体 */
    }
  }
  return builder.finish()
}

export const inlineStyleDecorator = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = buildDecorations(u.view)
    }
  },
  { decorations: (v) => v.decorations },
)
