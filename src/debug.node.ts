import { renderMarkdown } from './markdown/render'
import { DEFAULT_RULES } from './markdown/customRules'

function show(label: string, md: string) {
  const r = renderMarkdown(md, DEFAULT_RULES)
  console.log(`\n===== ${label} =====`)
  console.log(r.html.replace(/\n+/g, ' ').slice(0, 500))
}

show('wavy only', '文字 ~波浪线~ 结束')
show('tip only', ':::tip 小提示\n正文内容。\n:::')
show('highlight only', '文字 ==高亮== 结束')

const full = renderMarkdown('文字 ~波浪线~ 结束', DEFAULT_RULES)
console.log('\nwavy contains class:', full.html.includes('markup-wavyline'))
const full2 = renderMarkdown(':::tip 小提示\n正文内容。\n:::', DEFAULT_RULES)
console.log('tip contains mf-custom:', full2.html.includes('mf-custom'))
console.log('tip contains alert:', full2.html.includes('markdown-alert'))
console.log('tip raw:', JSON.stringify(full2.html.slice(0, 300)))
