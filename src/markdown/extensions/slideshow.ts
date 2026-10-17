/**
 * 横屏滑动幻灯片扩展：<![alt](url),![alt](url),![alt](url)>
 * 一组图片横向排列、可左右滑动，公众号客户端支持 overflow-x:auto
 */

interface SlideToken {
  type: string
  raw: string
  images: { alt: string; url: string }[]
}

/* 至少两张图片，用英文逗号分隔 */
const SLIDESHOW_RE =
  /^<(!\[[^\]]*\]\([^)\s]+\)(?:[ \t]*,[ \t]*!\[[^\]]*\]\([^)\s]+\))+)>[ \t]*(?:\n|$)/

const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g

interface SlideLexerCtx {
  lexer: { state: { top: boolean } }
}

export function markedSlideshow(): { extensions: unknown[] } {
  return {
    extensions: [
      {
        name: 'slideshow',
        level: 'block',
        start(src: string) {
          const i = src.indexOf('<![')
          return i === -1 ? undefined : i
        },
        tokenizer(this: SlideLexerCtx, src: string) {
          const m = SLIDESHOW_RE.exec(src)
          if (!m) return undefined
          const images: { alt: string; url: string }[] = []
          IMG_RE.lastIndex = 0
          let im: RegExpExecArray | null
          while ((im = IMG_RE.exec(m[1]))) {
            images.push({ alt: im[1] || '', url: im[2] })
          }
          if (images.length < 2) return undefined
          return { type: 'slideshow', raw: m[0], images } as SlideToken
        },
        renderer(token: SlideToken) {
          const items = token.images
            .map(
              (im) =>
                `<img src="${im.url}" alt="${im.alt}" style="display:inline-block;width:88%;margin-right:10px;border-radius:8px;vertical-align:top;" />`,
            )
            .join('')
          return `<section class="mf-slideshow" style="overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch;padding:4px 0;">${items}</section>\n`
        },
      },
    ],
  }
}
