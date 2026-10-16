// Node 自检脚本：仅开发期使用，不进应用构建产物
declare const process: { exit(code?: number): never }

import { renderMarkdown } from './markdown/render'
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

| 列A | 列B |
|---|---|
| 甲 | 乙 |
`

const res = renderMarkdown(SAMPLE, DEFAULT_RULES)
// 补充回归用例：删除线与波浪线共存 / 容器内 markdown / 金额 $ 不误伤
const resDel = renderMarkdown('~~删除线~~ 与 ~波浪线~', DEFAULT_RULES)
const resTipBody = renderMarkdown(':::tip 小提示\n**加粗** 与 `代码`。\n:::', DEFAULT_RULES)
const resDollar = renderMarkdown('价格 $5 和 $10 而已', DEFAULT_RULES)
// 深色横幅 + 行内 span 样式（marked 行内 HTML 经 DOMPurify 保留 style）
const resBanner = renderMarkdown(':::banner 重点\n**金句**正文。\n:::', DEFAULT_RULES)
const resSpan = renderMarkdown('这是 <span style="color:#C0392B;font-size:18px">红色大字</span> 结尾', DEFAULT_RULES)

const checks: [string, boolean, string][] = [
  ['渲染体积合理', res.html.length > 500 && res.html.length < 30000, `${res.html.length}`],
  ['标题干净', res.headings[0]?.text.includes('奖赏系统') && !res.headings[0].text.includes('katex'), res.headings[0]?.text ?? 'none'],
  ['高亮==', res.html.includes('markup-highlight'), ''],
  ['下划线++', res.html.includes('markup-underline'), ''],
  ['波浪线~', res.html.includes('markup-wavyline'), ''],
  ['上标^', res.html.includes('markup-superscript'), ''],
  ['提示框', res.html.includes('markdown-alert-warning'), ''],
  ['自定义符号:::tip', res.html.includes('mf-custom-tip'), (res.html.match(/.{0,30}小提示.{0,80}/) || [''])[0].replace(/\n/g, ' ')],
  ['目录TOC', res.html.includes('markdown-toc'), ''],
  ['公式katex', res.html.includes('katex'), (res.html.match(/md-math-error[^>]*title="([^"]{0,120})/) || ['', ''])[1]],
  ['表格', res.html.includes('<table>'), ''],
  ['代码span', res.html.includes('<code>行内代码</code>'), ''],
  ['删除线~~仍在', resDel.html.includes('<del>'), ''],
  ['波浪线不抢删除线', resDel.html.includes('markup-wavyline'), ''],
  ['提示框内markdown', resTipBody.html.includes('<strong>加粗</strong>') && resTipBody.html.includes('<code>代码</code>'), ''],
  ['金额$不误伤', !resDollar.html.includes('katex') && resDollar.html.includes('$5'), ''],
  ['深色横幅banner', resBanner.html.includes('mf-custom-banner') && resBanner.html.includes('border-top:4px solid'), ''],
  ['横幅内markdown', resBanner.html.includes('<strong>金句</strong>'), ''],
  ['行内span样式', resSpan.html.includes('<span style="color:#C0392B;font-size:18px">红色大字</span>'), resSpan.html.match(/<span style="[^"]*">[^<]*<\/span>/)?.[0] ?? 'none'],
]

const fails = checks.filter((c) => !c[1])
console.log(fails.length === 0 ? `ALL PASS (${checks.length})` : `FAILS (${fails.length}/${checks.length})`)
for (const [n, okk, extra] of checks) {
  console.log(`${okk ? 'PASS' : 'FAIL'} | ${n}${extra ? ' | ' + extra : ''}`)
}
process.exit(fails.length ? 1 : 0)
