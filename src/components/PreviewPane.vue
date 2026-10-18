<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import DOMPurify from 'dompurify'
import { renderMarkdown } from '../markdown/render'
import { inlineForWechat } from '../markdown/wechat'
import { hydrateMermaid } from '../markdown/extensions/mermaid'
import { hydratePlantuml } from '../markdown/extensions/plantuml'
import type { CustomRule } from '../markdown/customRules'
import { composeThemeCSS } from '../themes'
import { resolveAssetRefs } from '../utils/assets'

const props = defineProps<{
  content: string
  themeId: string
  primaryColor: string
  customRules: CustomRule[]
  /** 同步滚动开关（由 WriteView 持有，编辑器侧联动用） */
  syncScroll: boolean
  /** 统计信息（状态栏同源） */
  words: number
  minutes: number
  lastSavedAt: number
}>()

const output = ref<HTMLDivElement>()
const wechatHtml = ref('')
const themeStyleEl = ref<HTMLStyleElement>()

/** 桌面端预览：390px 手机宽 ↔ 全宽桌面，持久化 */
const desktopPreview = ref(localStorage.getItem('mf-desktop-preview') === '1')
watch(desktopPreview, (v) => localStorage.setItem('mf-desktop-preview', v ? '1' : '0'))

const clean = computed(() =>
  DOMPurify.sanitize(wechatHtml.value, {
    ADD_TAGS: ['mark', 'u', 'sup', 'section', 'nav', 'ruby', 'rt', 'rp', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'pre', 'code', 'ol', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'a', 'strong', 'em', 'del', 'hr', 'br', 'span', 'div', 'figure', 'figcaption'],
    ADD_ATTR: ['id', 'class', 'style', 'href', 'src', 'alt', 'target', 'rel', 'colspan', 'rowspan'],
  }),
)

async function build() {
  // 关键：在渲染「之前」把 ![alt](asset:id) 解析成 data URI。
  // 渲染后再拿 Markdown 正则去匹配 HTML 是匹配不到的，图片会一直是空 src。
  const resolved = await resolveAssetRefs(props.content)
  const { html: raw } = renderMarkdown(resolved, props.customRules)
  const expanded = raw

  // 注入主题 CSS：内联化在离屏 stage 上进行，head 里的主题样式对其生效
  const css = composeThemeCSS(props.themeId, props.primaryColor)
  if (!themeStyleEl.value) {
    themeStyleEl.value = document.createElement('style')
    themeStyleEl.value.id = 'mf-theme'
    document.head.appendChild(themeStyleEl.value)
  }
  themeStyleEl.value.textContent = css

  // 离屏渲染 class 版 → 预渲染图表（mermaid svg / plantuml 图定态）→ 行内化，
  // 得到与粘贴到公众号完全一致的 HTML
  const stage = document.createElement('div')
  stage.style.position = 'fixed'
  stage.style.left = '-99999px'
  stage.style.top = '0'
  stage.style.width = '390px'
  stage.innerHTML = expanded
  document.body.appendChild(stage)
  try {
    await hydrateMermaid(stage)
    await hydratePlantuml(stage)
    wechatHtml.value = inlineForWechat(stage)
  } finally {
    stage.remove()
  }
}

let debounce: number | undefined
watch(
  () => [props.content, props.themeId, props.primaryColor, props.customRules] as const,
  () => {
    if (debounce) window.clearTimeout(debounce)
    debounce = window.setTimeout(build, 150)
  },
  { deep: true },
)

onMounted(async () => {
  await build()
  await nextTick()
})

defineExpose({ build, output })
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 头行：单一「公众号预览」 -->
    <div class="flex items-center justify-between px-3 h-9 border-b border-mf-line shrink-0">
      <div class="flex items-center gap-1.5 text-[11px] font-medium text-mf-primary">
        <span class="w-1.5 h-1.5 rounded-full bg-mf-primary"></span>
        公众号预览
      </div>
      <span class="text-[10px] text-mf-ink-4">内联样式版 · 即粘贴后的真实效果</span>
    </div>

    <!-- 预览主体：默认 390px 手机宽，桌面预览时全宽 -->
    <div ref="output" class="mf-scroll flex-1 bg-white">
      <div
        id="output"
        :class="desktopPreview ? '' : 'mx-auto'"
        :style="desktopPreview ? '' : 'max-width: 390px'"
        v-html="clean"
      ></div>
    </div>

    <!-- 底部信息行：预览开关 + 统计 -->
    <div class="h-7 px-3 flex items-center gap-3 border-t border-mf-line bg-mf-side shrink-0 text-[10.5px] text-mf-ink-3 select-none">
      <button
        class="flex items-center gap-1 hover:text-mf-primary transition-colors"
        :class="desktopPreview ? 'text-mf-primary' : ''"
        :title="desktopPreview ? '切换为手机宽度预览' : '切换为桌面全宽预览'"
        @click="desktopPreview = !desktopPreview"
      >
        <span class="w-6 h-3 rounded-full relative transition-colors" :class="desktopPreview ? 'bg-mf-primary' : 'bg-black/15'">
          <span class="absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all" :class="desktopPreview ? 'left-3.5' : 'left-0.5'"></span>
        </span>
        桌面端预览
      </button>
      <button
        class="flex items-center gap-1 hover:text-mf-primary transition-colors"
        :class="syncScroll ? 'text-mf-primary' : ''"
        :title="syncScroll ? '关闭编辑区与预览区同步滚动' : '开启编辑区与预览区同步滚动'"
        @click="$emit('update:syncScroll', !syncScroll)"
      >
        <span class="w-6 h-3 rounded-full relative transition-colors" :class="syncScroll ? 'bg-mf-primary' : 'bg-black/15'">
          <span class="absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all" :class="syncScroll ? 'left-3.5' : 'left-0.5'"></span>
        </span>
        同步滚动
      </button>
      <div class="flex-1"></div>
      <span v-if="lastSavedAt">上次修改 {{ new Date(lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
      <span>{{ words }} 字 · 约 {{ minutes }} 分钟</span>
    </div>
  </div>
</template>
