<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from '../stores/editor'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import PreviewPane from '../components/PreviewPane.vue'
import DocList from '../components/DocList.vue'
import AssetPanel from '../components/AssetPanel.vue'
import TopBar from '../components/TopBar.vue'
import FormatToolbar from '../components/FormatToolbar.vue'
import { TEMPLATE_BLOCKS } from '../markdown/templates'

/** 模板模式：插入结构块 */
function insertTemplate(md: string): void {
  editorRef.value?.insertAndSelect(md)
}

const store = useEditorStore()
const editorRef = ref<InstanceType<typeof MarkdownEditor>>()
const previewRef = ref<InstanceType<typeof PreviewPane>>()

const panelTab = ref<'docs' | 'assets'>('docs')

/* ---------- 三栏宽度（可拖拽，持久化） ---------- */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const leftWidth = ref(clamp(Number(localStorage.getItem('mf-left-w')) || 212, 150, 420))
const previewWidth = ref(clamp(Number(localStorage.getItem('mf-right-w')) || 400, 320, 560))

/* ---------- 格式工具栏展开态（Word 式，持久化） ---------- */
const toolbarOpen = ref(localStorage.getItem('mf-toolbar-open') !== '0')

function toggleToolbar() {
  toolbarOpen.value = !toolbarOpen.value
  localStorage.setItem('mf-toolbar-open', toolbarOpen.value ? '1' : '0')
}

/* ---------- 同步滚动（编辑器 ↔ 公众号预览，双向带锁） ---------- */
const syncScroll = ref(localStorage.getItem('mf-sync-scroll') !== '0')
watch(syncScroll, (v) => localStorage.setItem('mf-sync-scroll', v ? '1' : '0'))

let scrollSyncing = false
function bindSyncScroll() {
  const ed = editorRef.value?.scrollEl?.()
  const pv = previewRef.value?.output
  if (!ed || !pv) return
  const ratioOf = (el: HTMLElement) => el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)
  const applyRatio = (from: HTMLElement, to: HTMLElement) => {
    to.scrollTop = ratioOf(from) * Math.max(0, to.scrollHeight - to.clientHeight)
  }
  ed.addEventListener('scroll', () => {
    if (!syncScroll.value || scrollSyncing) return
    scrollSyncing = true
    applyRatio(ed, pv)
    requestAnimationFrame(() => (scrollSyncing = false))
  })
  pv.addEventListener('scroll', () => {
    if (!syncScroll.value || scrollSyncing) return
    scrollSyncing = true
    applyRatio(pv, ed)
    requestAnimationFrame(() => (scrollSyncing = false))
  })
}

/* ---------- 左栏独立配色（CSS 变量作用域映射，子组件零改动） ---------- */
const panelTinted = computed(() => store.panelTheme !== 'ink' || !!store.panelCustom)
const panelVars = computed(() => {
  const c = store.panelColors
  if (!c) return {}
  return {
    '--pn-primary': c.primary,
    '--pn-soft': c.soft,
    '--pn-bg': c.bg,
    '--pn-line': c.soft,
  }
})

function startResize(side: 'left' | 'right') {
  const e = window.event
  const startX = e && e instanceof MouseEvent ? e.clientX : 0
  const startW = side === 'left' ? leftWidth.value : previewWidth.value
  const onMove = (ev: MouseEvent) => {
    const dx = ev.clientX - startX
    if (side === 'left') leftWidth.value = clamp(startW + dx, 150, 420)
    else previewWidth.value = clamp(startW - dx, 320, 560)
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    localStorage.setItem('mf-left-w', String(leftWidth.value))
    localStorage.setItem('mf-right-w', String(previewWidth.value))
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

/* ---------- 格式工具栏动作 ---------- */
function onFormatBlock(text: string, selectText?: string) {
  editorRef.value?.insertAndSelect(text, selectText)
}

function onFormatInline(style: string) {
  const ed = editorRef.value
  if (!ed) return
  const sel = ed.getSelected()
  if (sel) {
    ed.insertAndSelect(`<span style="${style}">${sel}</span>`)
  } else {
    ed.insertAndSelect(`<span style="${style}">文字</span>`, '文字')
  }
}

function onFormatReset() {
  store.primaryColor = ''
  store.markDirty()
}

/* 实时保存：输入即标记脏，800ms 后落库；失焦/关闭立即落库 */
function onInput(v: string) {
  store.content = v
  store.markDirty()
}

async function beforeUnload(e: BeforeUnloadEvent) {
  if (store.saveState !== 'saved') {
    e.preventDefault()
    e.returnValue = ''
    await store.flushSave()
  }
}

watch(
  () => store.leftPanel,
  (v) => { panelTab.value = v === 'assets' ? 'assets' : 'docs' },
)

onMounted(async () => {
  await store.loadAll()
  if (!store.currentId) await store.newDoc('doc')
  bindSyncScroll()
  /* AI 配图等外部入口的光标插入桥接 */
  ;(window as unknown as { __mfEditor?: { insert: (t: string) => void } }).__mfEditor = {
    insert: (t: string) => editorRef.value?.insert(t),
  }
  window.addEventListener('beforeunload', beforeUnload)
  /* 页面隐藏（切标签/最小化）时也立即保存 */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void store.flushSave()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  void store.flushSave()
})

/* 快捷键 */
function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    store.focusMode = !store.focusMode
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    setTimeout(() => window.print(), 200)
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    void store.flushSave()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="h-full flex flex-col bg-mf-canvas">
    <TopBar />

    <div class="flex-1 flex min-h-0 gap-2 px-2 pb-2 relative">
      <!-- 左栏：可独立配色，左上角图标折叠（折叠/展开开关在 TopBar 墨坊旁） -->
      <aside
        v-if="!store.leftCollapsed && !store.focusMode"
        class="shrink-0 bg-mf-side rounded-lg border border-mf-line overflow-hidden flex flex-col"
        :class="panelTinted ? 'mf-panel-tint--on' : ''"
        :style="[panelTinted ? panelVars : {}, { width: leftWidth + 'px' }]"
      >
        <div class="flex items-center border-b border-mf-line shrink-0">
          <button
            class="flex-1 py-1.5 text-[11px]"
            :class="panelTab === 'docs' ? 'text-mf-primary font-medium border-b-2 border-mf-primary' : 'text-mf-ink-3'"
            @click="panelTab = 'docs'; store.leftPanel = 'docs'"
          >文档</button>
          <button
            class="flex-1 py-1.5 text-[11px]"
            :class="panelTab === 'assets' ? 'text-mf-primary font-medium border-b-2 border-mf-primary' : 'text-mf-ink-3'"
            @click="panelTab = 'assets'; store.leftPanel = 'assets'"
          >素材库</button>
        </div>
        <div class="flex-1 min-h-0">
          <DocList v-show="panelTab === 'docs'" />
          <AssetPanel v-show="panelTab === 'assets'" />
        </div>
      </aside>

      <!-- 左分隔条：拖拽调宽 -->
      <div
        v-if="!store.leftCollapsed && !store.focusMode"
        class="group w-1.5 shrink-0 cursor-col-resize flex flex-col items-center justify-center rounded-full hover:bg-mf-primary/30 transition-colors"
        title="左右拖动调节宽度"
        @mousedown.prevent="startResize('left')"
      ></div>

      <!-- 中栏：格式工具栏 + 编辑器 -->
      <main class="flex-1 min-w-0 bg-mf-card rounded-lg border border-mf-line flex flex-col overflow-hidden relative">
        <FormatToolbar
          :open="toolbarOpen"
          @toggle="toggleToolbar"
          @block="onFormatBlock"
          @inline="onFormatInline"
          @reset="onFormatReset"
        />
        <!-- 模板模式专属：公众号结构块一键插入 -->
        <div
          v-if="store.editorMode === 'template'"
          class="shrink-0 px-2.5 py-1.5 border-b border-mf-line bg-mf-side/60 flex items-center gap-1.5 overflow-x-auto mf-scroll"
        >
          <span class="text-[10.5px] text-mf-ink-4 shrink-0 pr-1">结构模板</span>
          <button
            v-for="b in TEMPLATE_BLOCKS"
            :key="b.id"
            class="shrink-0 px-2 py-1 rounded-md text-[11px] border border-mf-line-2 text-mf-ink-2 hover:border-mf-primary hover:text-mf-primary hover:bg-mf-primary-soft transition-colors"
            :title="b.desc"
            @click="insertTemplate(b.md)"
          >{{ b.name }}</button>
        </div>

        <div class="flex-1 min-h-0">
          <MarkdownEditor :model-value="store.content" @update:model-value="onInput" ref="editorRef" />
        </div>
      </main>

      <!-- 右栏：实时预览 -->
      <template v-if="!store.focusMode">
        <div
          class="w-1.5 shrink-0 cursor-col-resize rounded-full hover:bg-mf-primary/30 transition-colors"
          title="左右拖动调节宽度"
          @mousedown.prevent="startResize('right')"
        ></div>
        <section
          class="shrink-0 bg-mf-card rounded-lg border border-mf-line overflow-hidden flex flex-col"
          :style="{ width: previewWidth + 'px' }"
        >
          <PreviewPane
            ref="previewRef"
            :content="store.content"
            :theme-id="store.themeId"
            :primary-color="store.primaryColor"
            :custom-rules="store.customRules"
            :sync-scroll="syncScroll"
            :words="store.wordCount"
            :minutes="store.readMinutes"
            :last-saved-at="store.lastSavedAt"
            @update:sync-scroll="syncScroll = $event"
          />
        </section>
      </template>
    </div>

    <!-- 状态栏 -->
    <div class="h-6 px-3 flex items-center gap-3 text-[10.5px] text-mf-ink-4 border-t border-mf-line bg-mf-side shrink-0">
      <span class="flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full" :class="store.saveState === 'saved' ? 'bg-emerald-500' : store.saveState === 'dirty' ? 'bg-amber-400' : 'bg-mf-primary'"></span>
        {{ store.saveState === 'saved' ? '已自动保存' : store.saveState === 'dirty' ? '正在输入…' : '保存中' }}
      </span>
      <span>{{ store.wordCount }} 字 · {{ store.readMinutes }} 分钟</span>
      <span v-if="store.lastSavedAt">上次保存 {{ new Date(store.lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
      <div class="flex-1"></div>
      <span>数据仅存本地浏览器</span>
    </div>
  </div>
</template>
