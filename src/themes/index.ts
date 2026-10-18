import inkGreen from './ink-green.css?raw'
import plainWhite from './plain-white.css?raw'
import midnightInk from './midnight-ink.css?raw'
import beyondOrange from './beyond-orange.css?raw'
import darkOverride from './dark.css?raw'
import typography from './typography.css?raw'

export interface ThemeMeta {
  id: string
  name: string
  desc: string
  primary: string
  css: string
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'ink-green',
    name: '墨坊青绿',
    desc: '温润纸感 · 默认',
    primary: '#2F6B4F',
    css: inkGreen,
  },
  {
    id: 'beyond-orange',
    name: '内容之外橙',
    desc: '复刻 BeyondTheContent',
    primary: '#E8622C',
    css: beyondOrange,
  },
  {
    id: 'plain-white',
    name: '素白',
    desc: '极简无装饰',
    primary: '#1F1E1B',
    css: plainWhite,
  },
  {
    id: 'midnight-ink',
    name: '深夜墨',
    desc: '深底反白',
    primary: '#8FA89B',
    css: midnightInk,
  },
]

export function getTheme(id: string): ThemeMeta {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

/**
 * 主题 + 用户覆盖的主色，合成最终注入的 CSS。
 * @param dark 深色预览：在主题之后叠加 dark.css，把 --md-* 换成暗色系，
 *             让黑色工作台下预览也是深底浅字（不是反色滤镜，图片/品牌色保持原样）
 */
export function composeThemeCSS(themeId: string, primaryOverride?: string, dark = false): string {
  const t = getTheme(themeId)
  let css = t.css
  if (primaryOverride) {
    css = css
      .replace(/--md-primary-color:\s*[^;]+;/g, `--md-primary-color: ${primaryOverride};`)
      .replace(/--md-link-color:\s*[^;]+;/g, `--md-link-color: ${primaryOverride};`)
  }
  // 排版基线在所有主题之后注入：行高/段距/字距统一，主题只管配色与字体
  css = `${css}\n${typography}`
  return dark ? `${css}\n${darkOverride}` : css
}
