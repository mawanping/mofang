/**
 * 公众号结构模板：模板模式下以快捷按钮形式一键插入，
 * 解决「模板模式到底有什么用」的问题。
 *
 * `{{c}}` = 当前画笔色，`{{soft}}` = 该色的淡底，插入时由 WriteView 替换。
 * 颜色写在块标记上（:::points 要点 #E8622C），而不是选中文字包 span ——
 * 包 span 会打断 `1.` 这类行首语法，导致版式直接失效。
 */

export interface TemplateBlock {
  id: string
  name: string
  /** 插入到光标处的 Markdown 源码 */
  md: string
  desc: string
}

export const TEMPLATE_BLOCKS: TemplateBlock[] = [
  {
    id: 'headline',
    name: '大标题',
    desc: '标题（可换色）+ 副标题引用',
    md: '\n:::h1 主标题写在这里 {{c}}\n:::\n\n> 一句话副标题，交代这篇文章解决什么问题\n\n',
  },
  {
    id: 'lead',
    name: '开篇导语',
    desc: '摘要式开场，读者一眼看到价值',
    md: '\n:::tip 开篇 {{c}} {{bg}}\n用两三句话说清「这篇讲什么、你能拿走什么」。\n:::\n\n',
  },
  {
    id: 'section',
    name: '小标题',
    desc: '分节标题（可换色）',
    md: '\n:::h2 小标题：这一节讲什么 {{c}}\n:::\n\n',
  },
  {
    id: 'quote',
    name: '金句引用',
    desc: '突出观点的引用块（可换色 + 底色）',
    md: '\n:::quote 记一句 {{c}} {{bg}}\n值得被记住的一句话。\n:::\n\n',
  },
  {
    id: 'image',
    name: '配图',
    desc: '图片占位，插入后可从素材库选图',
    md: '\n![配图说明](asset:)\n\n',
  },
  {
    id: 'list',
    name: '要点列表',
    desc: '彩色编号要点，强调色与底色都可换',
    md: '\n:::points 要点 {{c}} {{bg}}\n第一点|一句话补充说明\n第二点\n第三点\n:::\n\n',
  },
  {
    id: 'points',
    name: '卡片清单',
    desc: '主题卡片包裹的清单（可换底色）',
    md: '\n:::card {{bg}}\n- 第一项\n- 第二项\n- 第三项\n:::\n\n',
  },
  {
    id: 'divider',
    name: '分隔线',
    desc: '可换色的章节分隔线',
    md: '\n:::hr {{c}}\n:::\n\n',
  },
  {
    id: 'code',
    name: '代码块',
    desc: '带语言标注的代码',
    md: '\n```js\n// 代码\n```\n\n',
  },
  {
    id: 'table',
    name: '表格',
    desc: '对比类内容',
    md: '\n| 项目 | 说明 | 备注 |\n| --- | --- | --- |\n| A |  |  |\n| B |  |  |\n\n',
  },
  {
    id: 'callout',
    name: '提示卡片',
    desc: '警示卡片（可换色 + 底色）',
    md: '\n:::warn 注意 {{c}} {{bg}}\n需要注意的地方。\n:::\n\n',
  },
  {
    id: 'banner',
    name: '深色横幅',
    desc: '横幅，强调线 + 底底色都能换',
    md: '\n:::banner 金句 {{c}} {{bg}}\n这里是需要在深色底上强调的一句话。\n:::\n\n',
  },
  {
    id: 'ending',
    name: '结尾互动',
    desc: '留言引导 + 可换色分隔',
    md: '\n:::hr {{c}}\n:::\n\n**你在工作里最想吐槽的一件事是什么？欢迎留言聊聊。**\n\n',
  },
]