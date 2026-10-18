/**
 * 微信公众号内联化引擎
 *
 * 原理：预览 HTML 已在真实 DOM 中渲染（主题 <style> 已生效），
 * 因此用 getComputedStyle 读取每个元素的计算样式，写进行内 style。
 * 这比 juice 更可靠——继承、级联、CSS 变量全部已由浏览器解析成最终值。
 *
 * 同时把 ::before / ::after 的 content 物化成真实 <span>，
 * 因为公众号会剥离伪元素。
 */

const INLINE_PROPS = [
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-align',
  'text-decoration',
  'text-indent',
  'white-space',
  'word-break',
  'overflow-x',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-right-width',
  'border-right-style',
  'border-right-color',
  'border-bottom-width',
  'border-bottom-style',
  'border-bottom-color',
  'border-left-width',
  'border-left-style',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  // 注意：不内联 width / max-width / min-height。
  // 预览容器是 390px 手机宽度，若把计算宽度写进每个块级元素的行内样式，
  // 粘贴到公众号全宽编辑器后会保持半屏宽度。块级元素在公众号里默认自适应满宽。
  'display',
  'vertical-align',
  'list-style-type',
  'box-sizing',
]

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'HEAD'])

function px(v: string): string {
  return v
}

/**
 * 行高转无单位相对值。
 * 预览容器字号 14px → 行高 21px 是绝对值，粘到公众号后：
 * ① 大字号文字（28px）配 21px 行高会被压扁；② 与公众号默认行距打架。
 * 用 px 行高 / 元素字号得到比例（如 1.5），输出 line-height:1.5，
 * 任何字号下比例恒定，公众号阅读行距正常。
 */
function relLineHeight(cs: CSSStyleDeclaration): string | null {
  const lh = cs.lineHeight
  if (!lh || lh === 'normal') return null
  const fs = parseFloat(cs.fontSize)
  const lhPx = parseFloat(lh)
  if (!fs || !lhPx) return null
  const ratio = lhPx / fs
  if (ratio < 1.2 || ratio > 2.4) return null
  return `line-height:${ratio.toFixed(2)}`
}

/** 块级标签集合：顶层强制 width:100%，对抗公众号粘贴容器的任何宽度限制 */
const BLOCK_TAGS = new Set([
  'P', 'SECTION', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'UL', 'OL', 'PRE', 'TABLE', 'FIGURE', 'HR', 'NAV',
])

function materializePseudo(el: Element, pseudo: '::before' | '::after'): void {
  const cs = getComputedStyle(el, pseudo)
  const content = cs.content
  if (!content || content === 'none' || content === 'normal' || content === '""') return

  const text = content.replace(/^["']|["']$/g, '')
  if (!text.trim()) return

  const span = document.createElement('span')
  span.className = 'mf-pseudo-materialized'
  span.textContent = text
  const decl: string[] = []
  INLINE_PROPS.forEach((p) => {
    const v = cs.getPropertyValue(p)
    if (v && v !== 'normal' && !v.startsWith('url(')) decl.push(`${p}:${px(v)}`)
  })
  span.setAttribute('style', decl.join(';'))

  if (pseudo === '::before') el.insertBefore(span, el.firstChild)
  else el.appendChild(span)
}

function inlineElement(el: Element): void {
  if (SKIP_TAGS.has(el.tagName)) return
  // SVG（含根元素与子树）用表现属性定义样式，不参与 CSS 计算内联，
  // 否则会把海量计算样式灌进行内 style，把 HTML 撑爆
  if (el.tagName.toLowerCase() === 'svg' || (el as SVGElement).ownerSVGElement) return
  // MathML 子树（KaTeX 的无障碍拷贝）同理：公众号用不到，跳过内联大幅瘦身
  if (el.namespaceURI === 'http://www.w3.org/1998/Math/MathML') return
  const cs = getComputedStyle(el)
  const decl: string[] = []
  INLINE_PROPS.forEach((p) => {
    const v = cs.getPropertyValue(p)
    if (!v) return
    if (v === 'normal' && (p === 'font-style' || p === 'text-decoration')) return
    decl.push(`${p}:${px(v)}`)
  })
  // 行高单独处理：转无单位相对值（见 relLineHeight 注释）
  const lh = relLineHeight(cs)
  if (lh) decl.push(lh)
  const existing = el.getAttribute('style')
  if (existing) decl.unshift(existing.replace(/;$/, ''))
  el.setAttribute('style', decl.join(';'))
}

/**
 * 把渲染容器转成公众号可粘贴的 HTML 字符串
 * @param root 已渲染的容器元素
 * @param opts.keepClass 是否保留 class（默认 false，公众号会剥）
 */
export function inlineForWechat(root: HTMLElement, opts: { keepClass?: boolean } = {}): string {
  const clone = root.cloneNode(true) as HTMLElement
  // 物化伪元素（在克隆上操作，不影响预览）；SVG / MathML 子树跳过（无伪元素）
  clone.querySelectorAll('*').forEach((el) => {
    if ((el as SVGElement).ownerSVGElement) return
    if (el.namespaceURI === 'http://www.w3.org/1998/Math/MathML') return
    materializePseudo(el, '::before')
    materializePseudo(el, '::after')
  })
  // 内联计算样式：需把克隆挂到文档中才能拿到计算样式
  const host = document.createElement('div')
  host.style.position = 'absolute'
  host.style.left = '-99999px'
  host.style.top = '0'
  host.style.width = root.clientWidth ? `${root.clientWidth}px` : '677px'
  host.appendChild(clone)
  document.body.appendChild(host)
  try {
    clone.querySelectorAll('*').forEach(inlineElement)
    inlineElement(clone)
  } finally {
    host.remove()
  }

  // 清理：去 class（除非保留）、去 data-*、去 script。
  // SVG 内部的 <style>（mermaid 图表样式）必须保留，否则图表样式全丢
  const out = clone
  out.querySelectorAll('script,style,link,meta').forEach((n) => {
    if (n.namespaceURI === 'http://www.w3.org/2000/svg') return
    n.remove()
  })
  /* 顶层块级元素强制满宽：对抗公众号粘贴容器可能继承的任何宽度限制 */
  Array.from(out.children).forEach((el) => {
    if (!BLOCK_TAGS.has(el.tagName)) return
    const s = el.getAttribute('style') || ''
    if (!/width:\s*100%/.test(s)) {
      el.setAttribute('style', s ? `${s.replace(/;$/, '')};width:100%` : 'width:100%')
    }
  })
  const all = [out, ...Array.from(out.querySelectorAll('*'))]
  all.forEach((n) => {
    for (const attr of Array.from(n.attributes)) {
      if (attr.name === 'class' && !opts.keepClass) n.removeAttribute('class')
      if (attr.name === 'id') n.removeAttribute('id')
      if (attr.name.startsWith('data-')) n.removeAttribute(attr.name)
    }
    // 宽度兜底清洗：块级元素的 px 绝对宽度会让公众号内容保持半屏。
    // 预览容器是 390px，KaTeX/mermaid 等的测量宽度全是 px，一并清掉，
    // 只保留百分比宽度（如 img width:100%）
    const s = n.getAttribute('style')
    if (s && /width\s*:/i.test(s)) {
      const cleaned = s
        .replace(/(?:^|;)\s*(?:max-|min-)?width:\s*[0-9.]+px\s*(?=;|$)/gi, '')
        .replace(/;\s*;$/, '')
        .replace(/^;|;$/g, '')
      if (cleaned.trim()) n.setAttribute('style', cleaned)
      else n.removeAttribute('style')
    }
    // 图片：公众号里必须自适应容器宽度，否则 data URI 的原始像素会撑爆排版
    if (n.tagName === 'IMG') {
      n.removeAttribute('width')
      n.removeAttribute('height')
      let st = n.getAttribute('style') || ''
      st = st
        .replace(/(?:^|;)\s*(?:max-|min-)?(?:width|height):\s*[0-9.]+px\s*(?=;|$)/gi, '')
        .replace(/^;+|;+$/g, '')
      n.setAttribute(
        'style',
        `${st ? `${st};` : ''}max-width:100%;height:auto;display:block;border-radius:4px;margin:12px auto`,
      )
    }
  })
  return out.innerHTML
}

/** 写入剪贴板为 text/html */
export async function copyHtmlToClipboard(html: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([html.replace(/<[^>]+>/g, '')], { type: 'text/plain' }),
      })
      await navigator.clipboard.write([item])
      return true
    }
  } catch {
    /* 降级 */
  }
  // 降级：用 contenteditable + execCommand
  try {
    const holder = document.createElement('div')
    holder.contentEditable = 'true'
    holder.innerHTML = html
    holder.style.position = 'fixed'
    holder.style.left = '-99999px'
    document.body.appendChild(holder)
    const range = document.createRange()
    range.selectNodeContents(holder)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    const ok = document.execCommand('copy')
    sel?.removeAllRanges()
    holder.remove()
    return ok
  } catch {
    return false
  }
}
