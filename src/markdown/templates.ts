/**
 * 公众号结构模板：模板模式下以快捷按钮形式一键插入，
 * 解决「模板模式到底有什么用」的问题。
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
    desc: '公众号主标题 + 副标题',
    md: '\n# 主标题写在这里\n\n> 一句话副标题，交代这篇文章解决什么问题\n\n',
  },
  {
    id: 'lead',
    name: '开篇导语',
    desc: '摘要式开场，读者一眼看到价值',
    md: '\n**开篇：** 用两三句话说清「这篇讲什么、你能拿走什么」。\n\n',
  },
  {
    id: 'section',
    name: '小标题',
    desc: '分节标题',
    md: '\n## 小标题：这一节讲什么\n\n',
  },
  {
    id: 'quote',
    name: '金句引用',
    desc: '突出观点的引用块',
    md: '\n> [!NOTE]\n> 值得被记住的一句话。\n\n',
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
    desc: '有序要点，适合罗列方法',
    md: '\n1. 第一点\n2. 第二点\n3. 第三点\n\n',
  },
  {
    id: 'points',
    name: '卡片清单',
    desc: '自定义样式清单（可勾选）',
    md: '\n- [ ] 待办项一\n- [ ] 待办项二\n\n',
  },
  {
    id: 'divider',
    name: '分隔线',
    desc: '章节之间的视觉呼吸',
    md: '\n---\n\n',
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
    desc: 'WARNING 警示块',
    md: '\n> [!WARNING]\n> 需要注意的地方。\n\n',
  },
  {
    id: 'ending',
    name: '结尾互动',
    desc: '留言引导 + 分割',
    md: '\n---\n\n**你在工作里最想吐槽的一件事是什么？欢迎留言聊聊。**\n\n',
  },
]