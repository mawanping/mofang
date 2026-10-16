<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import DOMPurify from 'dompurify'
import { renderMarkdown } from '../markdown/render'
import type { CustomRule } from '../markdown/customRules'
import { getTheme, composeThemeCSS } from '../themes'
import { listAssets, type AssetRecord } from '../stores/db'

const props = defineProps<{
  content: string
  themeId: string
  primaryColor: string
  mode: 'edit' | 'wechat'
  customRules: CustomRule[]
}>()

const emit = defineEmits<{ (e: 'copy') : void }>()

const output = ref<HTMLDivElement>()
const html = ref('')
const assets = ref<Map<string, AssetRecord>>(new Map())
const themeStyleEl = ref<HTMLStyleElement>()

async function loadAssets() {
  const list = await listAssets()
  assets.value = new Map(list.map((a) => [a.id, a]))
}

const clean = computed(() =>
  DOMPurify.sanitize(html.value, {
    ADD_TAGS: ['mark', 'u', 'sup', 'section', 'nav', 'ruby', 'rt', 'rp'],
    ADD_ATTR: ['id', 'class', 'style', 'href', 'src', 'target', 'rel', 'colspan', 'rowspan'],
  }),
)

async function build() {
  const { html: raw } = renderMarkdown(props.content, props.customRules)
  // 展开 asset: 引用为 data URL
  let expanded = raw
  if (assets.value.size) {
    expanded = expanded.replace(/!\[([^\]]*)\]\(asset:([^)]+)\)/g, (_m, alt, id) => {
      const a = assets.value.get(id.trim())
      if (!a) return `![${alt}]()`
      const url = URL.createObjectURL(a.blob)
      return `<img src="${url}" alt="${alt}" />`
    })
  }
  html.value = expanded

  // 注入主题 CSS
  const css = composeThemeCSS(props.themeId, props.primaryColor)
  if (!themeStyleEl.value) {
    themeStyleEl.value = document.createElement('style')
    themeStyleEl.value.id = 'mf-theme'
    document.head.appendChild(themeStyleEl.value)
  }
  themeStyleEl.value.textContent = css
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
  await loadAssets()
  await build()
  await nextTick()
})

defineExpose({ build, output })
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-3 h-9 border-b border-mf-line shrink-0">
      <div class="flex items-center gap-1 text-[11px]">
        <button
          class="px-2 py-0.5 rounded"
          :class="mode === 'edit' ? 'bg-mf-primary-soft text-mf-primary font-medium' : 'text-mf-ink-3'"
          @click="$emit('copy')"
        >
          编辑视图
        </button>
        <span class="text-mf-ink-4">/</span>
        <span
          class="px-2 py-0.5 rounded"
          :class="mode === 'wechat' ? 'bg-mf-primary-soft text-mf-primary font-medium' : 'text-mf-ink-3'"
        >微信视图</span>
      </div>
      <span class="text-[10px] text-mf-ink-4">390px · 公众号阅读宽度</span>
    </div>
    <div ref="output" class="mf-scroll flex-1 bg-white">
      <div id="output" class="mx-auto" style="max-width: 390px" v-html="clean"></div>
    </div>
  </div>
</template>
