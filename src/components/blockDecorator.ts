/**
 * 块级 Markdown 实时样式：让编辑区里的 `#` 标题、`>` 引用、列表、代码块、
 * 表格、分隔线「一敲完标记就变成对应格式」，而不是只做语法高亮。
 *
 * 原则：
 * - 标记字符（### / > / - / 1.）保留可见但淡化缩小，方便继续编辑与删改；
 * - 标记后面的正文按层级换字号/字重/字体，视觉上 ≈ 稿子已经排好版；
 * - 只处理 viewport 内的行，长文不卡。
 */
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import type { Range } from '@codemirror/state'

const lineDeco = (cls: string, style?: string) =>
  Decoration.line(style ? { class: cls, attributes: { style } } : { class: cls })
const markDeco = (cls: string) => Decoration.mark({ class: cls })

const RE_HEADING = /^(#{1,6})([ \t]+)(.*)$/
const RE_QUOTE = /^([ \t]*)((?:>[ \t]?)+)(.*)$/
const RE_UL = /^([ \t]*)([-*+])([ \t]+)(.*)$/
const RE_OL = /^([ \t]*)(\d{1,3}[.)])([ \t]+)(.*)$/
const RE_FENCE = /^[ \t]*(?:```|~~~)/
const RE_HR = /^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/
const RE_TABLE = /^[ \t]*\|/
const RE_TABLE_SEP = /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/

/** 缩进层级（1 tab = 2 空格），用于列表悬挂缩进 */
function indentOf(s: string): number {
  let n = 0
  for (const ch of s) n += ch === '\t' ? 2 : ch === ' ' ? 1 : 0
  return n
}

/**
 * 行内标记一次扫描（不重叠）：
 * `代码` / **粗体** / ==高亮== / ++下划线++ / ~~删除~~ / ^上标^ / *斜体*
 * 标记字符淡化，内容上样式 —— 选中打字即成型。
 */
const RE_INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(==[^=\n]+==)|(\+\+[^+\n]+\+\+)|(~~[^~\n]+~~)|(\^[^^\n]+\^)|(\*[^*\n]+\*)/g

function inlineDecos(text: string, offset: number, out: Range<Decoration>[]): void {
  RE_INLINE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RE_INLINE.exec(text))) {
    const start = offset + m.index
    const raw = m[0]
    // 开闭标记长度：行内代码/粗体/高亮/下划线/删除/上标 = 1 或 2
    const mlen = raw.startsWith('**') ? 2 : raw.startsWith('==') ? 1 : raw.startsWith('++') ? 2 : raw.startsWith('~~') ? 2 : raw.startsWith('^') ? 1 : 1
    const mlenClose = raw.startsWith('**') ? 2 : raw.startsWith('++') ? 2 : raw.startsWith('~~') ? 2 : 1
    const innerStart = start + mlen
    const innerEnd = start + raw.length - mlenClose
    if (innerEnd <= innerStart) continue

    let cls = 'cm-mf-inline-code'
    if (raw.startsWith('**')) cls = 'cm-mf-strong'
    else if (raw.startsWith('==')) cls = 'cm-mf-highlight'
    else if (raw.startsWith('++')) cls = 'cm-mf-underline'
    else if (raw.startsWith('~~')) cls = 'cm-mf-strike'
    else if (raw.startsWith('^')) cls = 'cm-mf-sup'
    else if (raw.startsWith('*')) cls = 'cm-mf-em'

    out.push(markDeco('cm-mf-mark').range(start, innerStart))
    out.push(markDeco(cls).range(innerStart, innerEnd))
    out.push(markDeco('cm-mf-mark').range(innerEnd, start + raw.length))
  }
}

function build(view: EditorView): DecorationSet {
  const doc = view.state.doc
  const { from, to } = view.viewport
  const startLine = doc.lineAt(from).number
  const endLine = doc.lineAt(Math.min(to, doc.length)).number

  const items: Range<Decoration>[] = []
  let inFence = false

  for (let n = 1; n <= endLine; n++) {
    const line = doc.line(n)
    const text = line.text
    const visible = n >= startLine

    /* 代码围栏状态机（需要从头扫，才能知道可见范围起点是否已在块内） */
    const wasInFence = inFence
    const isFence = RE_FENCE.test(text)
    if (isFence) inFence = !inFence
    const insideCode = wasInFence && !isFence

    if (!visible) continue

    /* 该行整体不做行内解析（代码块 / 分隔线 / 表格） */
    let suppressInline = false

    /* ---- 代码块 ---- */
    if (isFence) {
      items.push(lineDeco('cm-mf-code-line cm-mf-code-fence').range(line.from))
      if (text.trim()) {
        items.push(markDeco('cm-mf-mark').range(line.from, line.from + text.length))
      }
      suppressInline = true
    } else if (insideCode) {
      items.push(lineDeco('cm-mf-code-line').range(line.from))
      suppressInline = true
    } else if (RE_HR.test(text) && !RE_UL.test(text)) {
      /* ---- 分隔线 ---- */
      items.push(lineDeco('cm-mf-hr').range(line.from))
      items.push(markDeco('cm-mf-mark').range(line.from, line.from + text.length))
      suppressInline = true
    } else {
      const q = RE_QUOTE.exec(text)
      const h = RE_HEADING.exec(text)
      const ul = RE_UL.exec(text)
      const ol = RE_OL.exec(text)

      if (q && q[2]) {
        /* ---- 引用（含 alert 卡片） ---- */
        items.push(lineDeco('cm-mf-quote').range(line.from))
        const markEnd = line.from + q[1].length + q[2].length
        const isAlert = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(q[3])
        items.push(markDeco(isAlert ? 'cm-mf-alert' : 'cm-mf-mark').range(line.from + q[1].length, markEnd))
        if (markEnd < line.to) {
          items.push(markDeco(isAlert ? 'cm-mf-alert-text' : 'cm-mf-quote-text').range(markEnd, line.to))
        }
      } else if (h) {
        /* ---- 标题 ---- */
        const level = h[1].length
        const markEnd = line.from + h[1].length + h[2].length
        const style = `padding-top:${level <= 2 ? 10 : 6}px;padding-bottom:2px`
        items.push(lineDeco(`cm-mf-h${level}-line`, style).range(line.from))
        items.push(markDeco('cm-mf-mark').range(line.from, markEnd))
        if (markEnd < line.to) {
          items.push(markDeco(`cm-mf-h${level}`).range(markEnd, line.to))
        }
      } else if (ul) {
        /* ---- 无序列表 ---- */
        const ind = indentOf(ul[1])
        items.push(
          lineDeco('cm-mf-li-line', `padding-left:${1.5 + ind * 1.6}em;text-indent:-1.1em`).range(line.from),
        )
        items.push(markDeco('cm-mf-mark').range(line.from + ul[1].length, line.from + ul[1].length + ul[2].length))
        if (ul[4]) items.push(markDeco('cm-mf-li-text').range(line.from + ul[1].length + ul[2].length + ul[3].length, line.to))
      } else if (ol) {
        /* ---- 有序列表 ---- */
        const ind = indentOf(ol[1])
        items.push(
          lineDeco('cm-mf-li-line', `padding-left:${1.5 + ind * 1.6}em;text-indent:-1.6em`).range(line.from),
        )
        items.push(markDeco('cm-mf-mark').range(line.from + ol[1].length, line.from + ol[1].length + ol[2].length))
        if (ol[4]) items.push(markDeco('cm-mf-li-text').range(line.from + ol[1].length + ol[2].length + ol[3].length, line.to))
      } else if (RE_TABLE.test(text)) {
        /* ---- 表格 ---- */
        const isSep = RE_TABLE_SEP.test(text)
        items.push(lineDeco(isSep ? 'cm-mf-table-sep' : 'cm-mf-table').range(line.from))
        suppressInline = true
      }
    }

    /* ---- 行内标记：**粗体** / `代码` / ==高亮== / ++下划线++ / ~~删除~~ / ^上标^ / *斜体* ---- */
    if (!suppressInline) inlineDecos(text, line.from, items)
  }

  return Decoration.set(items, true)
}

class BlockStylePlugin {
  decorations: DecorationSet
  constructor(view: EditorView) {
    this.decorations = build(view)
  }
  update(u: ViewUpdate) {
    if (u.docChanged || u.viewportChanged) {
      this.decorations = build(u.view)
    }
  }
}

export const blockStyleDecorator = ViewPlugin.fromClass(BlockStylePlugin, {
  decorations: (v) => v.decorations,
})