/** 目录扩展：[TOC] 独占一行时渲染目录容器，渲染管线随后填充 */

export function markedToc(): { extensions: unknown[] } {
  return {
    extensions: [
      {
        name: 'toc',
        level: 'block',
        start(src: string) {
          const i = src.indexOf('[TOC]')
          return i === -1 ? undefined : i
        },
        tokenizer(src: string) {
          const m = /^\[TOC\][ \t]*(?:\n|$)/.exec(src)
          if (!m) return undefined
          return { type: 'toc', raw: m[0] }
        },
        renderer() {
          return `<nav class="markdown-toc" data-toc></nav>\n`
        },
      },
    ],
  }
}
