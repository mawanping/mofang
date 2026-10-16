<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditorStore } from '../stores/editor'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import PreviewPane from '../components/PreviewPane.vue'
import DocList from '../components/DocList.vue'
import AssetPanel from '../components/AssetPanel.vue'
import TopBar from '../components/TopBar.vue'

const store = useEditorStore()
const editorRef = ref<InstanceType<typeof MarkdownEditor>>()
const previewRef = ref<InstanceType<typeof PreviewPane>>()

const panelTab = ref<'docs' | 'assets'>('docs')

const modeLabel = computed(() => (store.editorMode === 'markdown' ? 'Markdown 编辑' : '公众号模板'))

function switchMode(m: 'markdown' | 'template') {
  store.editorMode = m
  if (m === 'template') {
    store.themeId = 'beyond-orange'
    store.markDirty()
  }
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
  ;(window as unknown as { __mfEditor?: unknown }).__mfEditor = {
    insert: (t: string) => {
      store.content = store.content + t
      store.markDirty()
    },
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
    store.previewMode = 'wechat'
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

    <div class="flex-1 flex min-h-0 gap-2 px-2 pb-2">
      <!-- 左栏 -->
      <aside
        v-if="!store.focusMode"
        class="w-[212px] shrink-0 bg-mf-side rounded-lg border border-mf-line overflow-hidden flex flex-col"
      >
        <div class="flex border-b border-mf-line shrink-0">
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

      <!-- 中栏：编辑器 -->
      <main class="flex-1 min-w-0 bg-mf-card rounded-lg border border-mf-line flex flex-col overflow-hidden">
        <!-- 编辑模式切换 -->
        <div class="h-9 px-2.5 flex items-center gap-2 border-b border-mf-line shrink-0 bg-mf-side">
          <div class="flex items-center p-0.5 rounded-md bg-black/[0.05]">
            <button
              class="px-2.5 py-0.5 rounded text-[11.5px] transition-colors"
              :class="store.editorMode === 'markdown' ? 'bg-white text-mf-primary font-medium shadow-sm' : 'text-mf-ink-3'"
              @click="switchMode('markdown')"
            >Markdown</button>
            <button
              class="px-2.5 py-0.5 rounded text-[11.5px] transition-colors"
              :class="store.editorMode === 'template' ? 'bg-white text-mf-primary font-medium shadow-sm' : 'text-mf-ink-3'"
              @click="switchMode('template')"
            >公众号模板</button>
          </div>
          <span class="text-[10.5px] text-mf-ink-4">
            {{ store.editorMode === 'markdown' ? '写 Markdown，右侧出公众号效果' : '已切到内容之外橙主题，序号/引用/色条自动生效' }}
          </span>
          <div class="flex-1"></div>
          <span class="text-[10.5px] text-mf-ink-4">{{ store.wordCount }} 字 · {{ store.readMinutes }} 分钟</span>
        </div>

        <div class="flex-1 min-h-0">
          <MarkdownEditor :model-value="store.content" @update:model-value="onInput" ref="editorRef" />
        </div>
      </main>

      <!-- 右栏：实时预览 -->
      <section
        v-if="!store.focusMode"
        class="w-[400px] shrink-0 bg-mf-card rounded-lg border border-mf-line overflow-hidden flex flex-col"
      >
        <PreviewPane
          ref="previewRef"
          :content="store.content"
          :theme-id="store.themeId"
          :primary-color="store.primaryColor"
          :mode="store.previewMode"
          :custom-rules="store.customRules"
          @copy="store.previewMode = 'wechat'"
        />
      </section>
    </div>

    <!-- 状态栏 -->
    <div class="h-6 px-3 flex items-center gap-3 text-[10.5px] text-mf-ink-4 border-t border-mf-line bg-mf-side shrink-0">
      <span class="flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full" :class="store.saveState === 'saved' ? 'bg-emerald-500' : store.saveState === 'dirty' ? 'bg-amber-400' : 'bg-mf-primary'"></span>
        {{ store.saveState === 'saved' ? '已自动保存' : store.saveState === 'dirty' ? '正在输入…' : '保存中' }}
      </span>
      <span>主题 {{ modeLabel }}</span>
      <span v-if="store.lastSavedAt">上次保存 {{ new Date(store.lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
      <div class="flex-1"></div>
      <span>数据仅存本地浏览器</span>
    </div>
  </div>
</template>
