# 墨坊 MoFang · 公众号写作工作台

Markdown 写作 + 公众号富排版 + 实时预览 + AI 配图，纯前端实现，数据只存本地浏览器。

## 功能

- **Markdown 编辑**：CodeMirror 6 编辑器，原生语法 + 墨坊扩展（`==高亮==` `++下划线++` `~波浪线~` `^上标^`、`:::tip` 自定义容器、`$公式$`、`[TOC]`、脚注、40+ emoji）
- **公众号模板模式**：一键切换「内容之外」橙主题，序号/引用/色条自动生效
- **实时预览**：右侧 390px 手机视图，编辑即渲染；一键内联样式复制到公众号后台
- **AI 配图**：内置免费通道（Pollinations，零配置出图），也可接自己的 API Key（硅基流动 / OpenAI 兼容 / ModelScope），6 个风格预设
- **选题看板 / 草稿库 / 灵感库**：拖拽管理选题，草稿与灵感分开沉淀
- **封面工作台**：2.35:1 大图 + 1:1 方图，Canvas 直出
- **实时保存**：输入 800ms 防抖落库 IndexedDB，关页面/切标签立即保存，刷新不丢
- **本地导出**：PDF / HTML / Markdown，可保存到指定文件夹（File System Access API）

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

推送 main 分支自动部署到 GitHub Pages。

## 技术栈

Vue 3 + Vite + TypeScript + CodeMirror 6 + marked 15 + DOMPurify + KaTeX + Pinia + IndexedDB + Tailwind CSS 4
