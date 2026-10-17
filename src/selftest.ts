import { renderMarkdown } from './markdown/render'
import { composeThemeCSS, THEMES } from './themes'
import { inlineForWechat } from './markdown/wechat'
import { DEFAULT_RULES } from './markdown/customRules'

const SAMPLE = `# 奖赏系统如何劫载你的动力

> [!WARNING]
> 这是彩色左边框引用块，浅色底，带图标。

正文包含 ==高亮标记== 和 ++下划线++ 和 ~波浪线~，还有 x^2^ 上标。

1. 序号一，数字染主色
2. 序号二，条间细分隔线
3. 序号三

- 无序列表项甲
- 无序列表项乙

\`行内代码\` 与公式 $E = mc^2$。

:::tip 小提示
这是自定义符号触发的提示条。
:::

[TOC]
`

/* 扩展规则样例：LaTeX 标准格式 / 幻灯片 / Ruby 注音 / Mermaid / PlantUML */
const SAMPLE2 = `## 进阶规则自检

LaTeX 行内 \\(x^2 + y^2 = z^2\\) 与块级：

\\[
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
\\]

Ruby 注音：[你好]{nǐ hǎo} 与 [世界]^(shì jiè)。

横屏幻灯片：

<![图一](https://example.com/1.png),![图二](https://example.com/2.png)>

\`\`\`mermaid
graph LR
  A[开始] --> B[结束]
\`\`\`

\`\`\`plantuml
@startuml
Alice -> Bob: 你好
@enduml
\`\`\`
`

const log: string[] = []
function ok(name: string, cond: boolean, extra = '') {
  log.push(`${cond ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)
}

const res = renderMarkdown(SAMPLE, DEFAULT_RULES)
ok('marked 渲染', res.html.length > 100 && res.html.length < 20000, `${res.html.length} chars`)
ok('标题收集', res.headings.length >= 1 && res.headings[0].text.includes('奖赏系统'),
  JSON.stringify(res.headings.map((h) => h.text)))
ok('高亮 ==', res.html.includes('markup-highlight'))
ok('下划线 ++', res.html.includes('markup-underline'))
ok('波浪线 ~', res.html.includes('markup-wavyline'))
ok('上标 ^', res.html.includes('markup-superscript'))
ok('提示框 > [!WARNING]', res.html.includes('markdown-alert-warning'))
ok('自定义符号 :::tip', res.html.includes('mf-custom-tip'))
ok('目录 [TOC]', res.html.includes('markdown-toc'))
ok('公式 $', res.html.includes('katex'))
{
  const m = res.html.match(/<span class="md-math-error"[^>]*title="([^"]*)"/)
  ok('调试-公式错误', true, m ? m[1].slice(0, 200) : 'no error span')
}
ok('调试-公式片段', true, (res.html.match(/.{0,60}公式.{0,120}/) || ['NONE'])[0].replace(/\n/g, ' '))
ok('调试-tip片段', true, (res.html.match(/.{0,40}小提示.{0,160}/) || ['NONE'])[0].replace(/\n/g, ' '))

/* ---------- 扩展规则自检（SAMPLE2） ---------- */
const res2 = renderMarkdown(SAMPLE2, DEFAULT_RULES)
ok('LaTeX 行内 \\(...\\) 渲染 katex', res2.html.includes('katex') && /\\\(/.test(SAMPLE2) && !res2.html.includes('\\(x'))
ok('LaTeX 块级 \\[...\\] 渲染 katex', (res2.html.match(/katex-display/g) || []).length >= 1, `display 块数: ${(res2.html.match(/katex-display/g) || []).length}`)
ok('Ruby 花括号注音', res2.html.includes('<ruby') && res2.html.includes('<rt>nǐ hǎo</rt>'))
ok('Ruby 脱字注音 ^', res2.html.includes('<rt>shì jiè</rt>'))
ok('幻灯片渲染', res2.html.includes('mf-slideshow') && (res2.html.match(/<img /g) || []).length >= 2, `img 数: ${(res2.html.match(/<img /g) || []).length}`)
ok('幻灯片 overflow-x 行内', /overflow-x:auto/.test(res2.html))
ok('Mermaid 占位', res2.html.includes('mf-mermaid') && decodeURIComponent(res2.html.match(/data-mermaid="([^"]*)"/)?.[1] || '').includes('graph LR'))
ok('PlantUML 渲染为在线图', res2.html.includes('mf-plantuml') && /src="https:\/\/www\.plantuml\.com\/plantuml\/png\/[0-9A-Za-z_-]+"/.test(res2.html))
ok('PlantUML 源码兜底', res2.html.includes('mf-plantuml-src') && res2.html.includes('Alice'))

/* 注入主题并渲染到 DOM */
const style = document.createElement('style')
style.textContent = composeThemeCSS('beyond-orange')
document.head.appendChild(style)

const host = document.createElement('div')
host.id = 'output'
host.innerHTML = res.html
document.body.appendChild(host)

const alertEl = host.querySelector('.markdown-alert-warning') as HTMLElement
ok('引用块有左边框', !!alertEl && getComputedStyle(alertEl).borderLeftWidth === '4px',
  alertEl ? getComputedStyle(alertEl).borderLeftColor : 'missing')
ok('引用块有背景', !!alertEl && getComputedStyle(alertEl).backgroundColor !== 'rgba(0, 0, 0, 0)',
  alertEl ? getComputedStyle(alertEl).backgroundColor : 'missing')

const hl = host.querySelector('.markup-highlight') as HTMLElement
ok('高亮有背景色', !!hl && getComputedStyle(hl).backgroundColor !== 'rgba(0, 0, 0, 0)',
  hl ? getComputedStyle(hl).backgroundColor : 'missing')

const h1 = host.querySelector('h1') as HTMLElement
ok('衬线标题', !!h1 && /serif|Optima|Songti|Georgia/i.test(getComputedStyle(h1).fontFamily),
  h1 ? getComputedStyle(h1).fontFamily.slice(0, 60) : 'missing')

const ol = host.querySelector('ol') as HTMLElement
ok('序号列表去默认符号', !!ol && getComputedStyle(ol).listStyleType === 'none',
  ol ? getComputedStyle(ol).listStyleType : 'missing')

/* 内联化 */
const inline = inlineForWechat(host)
ok('内联后无 class', !/\sclass="/.test(inline))
ok('内联后有 style', /style="[^"]*color/.test(inline))
ok('内联后无 <style>', !/<style/i.test(inline))
ok('内联无 px 宽度（修复公众号半屏）', !/(?:^|;)\s*(?:max-|min-)?width:\s*\d+(?:\.\d+)?px/.test(inline),
  (inline.match(/(?:^|;)\s*(?:max-|min-)?width:[^;"]+/g) || []).slice(0, 5).join(' '))
ok('序号被物化为真实文本', /0[123]/.test(inline))
ok('引用块边宽内联', /border-left:4px|border-left-width:4px/.test(inline))
ok('引用块底色内联', /background-color:rgb/.test(inline))
ok('高亮底色内联', /background-color:rgb/.test(inline))

const fails = log.filter((l) => l.startsWith('FAIL'))
const brief = fails.length
  ? `FAILS(${fails.length}): ` + fails.map((f) => f.split('|')[1].trim()).join(',') + ' ||| ' + fails.map((f) => (f.split('|')[2] || '').trim()).join(' ~ ').slice(0, 300)
  : `ALL PASS (${log.length})`

document.body.innerHTML = ''
const pre = document.createElement('pre')
pre.id = 'brief'
pre.textContent = brief
document.body.appendChild(pre)
const full = document.createElement('pre')
full.id = 'result'
full.textContent = log.join('\n')
full.style.display = 'none'
document.body.appendChild(full)
;(window as unknown as { __done: boolean }).__done = true
