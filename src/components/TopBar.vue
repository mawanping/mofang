<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore, PANEL_PRESETS } from '../stores/editor'
import { copyHtmlToClipboard, inlineForWechat } from '../markdown/wechat'
import { saveToFolder, exportHtml, exportPdf, dirSupported } from '../utils/exporters'

const store = useEditorStore()
const toast = ref('')
const saving = ref(false)

const saveLabel = computed(() => {
  if (store.saveState === 'saving') return '保存中…'
  if (store.saveState === 'dirty') return '未保存'
  return store.lastSavedAt ? '已保存' : '已就绪'
})

function flash(msg: string) {
  toast.value = msg
  window.setTimeout(() => (toast.value = ''), 2400)
}

async function onCopy() {
  await store.flushSave()
  const el = document.querySelector('#output')
  if (!el) return
  const inline = inlineForWechat(el as HTMLElement)
  const ok = await copyHtmlToClipboard(inline)
  flash(ok ? '已复制，去公众号后台 Ctrl+V 粘贴' : '复制失败，请用下方「导出 HTML」手动复制')
}

async function onSaveMd() {
  saving.value = true
  try {
    await store.flushSave()
    const ok = await saveToFolder(store.title, store.content, {
      themeId: store.themeId,
      primaryColor: store.primaryColor,
    })
    flash(ok ? '已保存到本地文件夹' : '保存取消或失败')
  } finally {
    saving.value = false
  }
}

async function onExportHtml() {
  await store.flushSave()
  const el = document.querySelector('#output')
  if (!el) return
  const inline = inlineForWechat(el as HTMLElement, { keepClass: true })
  await exportHtml(store.title, inline)
  flash('已导出 HTML')
}

async function onExportPdf() {
  await store.flushSave()
  await new Promise((r) => setTimeout(r, 250))
  exportPdf()
}
</script>

<template>
  <div class="bg-mf-card border-b border-mf-line shrink-0">
    <!-- 行1：品牌 / 标题 / 操作 -->
    <div class="h-11 px-3 flex items-center gap-2">
      <div class="flex items-center gap-1.5 mr-1">
        <div class="w-6 h-6 rounded-md bg-mf-primary flex items-center justify-center">
          <span class="text-white text-[13px] font-serif leading-none">墨</span>
        </div>
        <span class="text-[13px] font-medium tracking-wide">墨坊</span>
      </div>

      <!-- 左栏折叠开关：常驻顶栏，不遮挡编辑区内容 -->
      <button
        class="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
        :class="store.leftCollapsed ? 'bg-black/[0.06] text-mf-primary' : 'text-mf-ink-3 hover:bg-black/[0.05] hover:text-mf-primary'"
        :title="store.leftCollapsed ? '展开左栏' : '收起左栏'"
        @click="store.toggleLeftPanel"
      >
        <svg viewBox="0 0 16 16" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
          <rect x="2" y="3" width="12" height="10" rx="1.8"/><line x1="6.2" y1="3" x2="6.2" y2="13"/>
        </svg>
      </button>

      <input
        :value="store.title"
        class="w-44 px-2.5 py-1 text-[13px] rounded-md bg-mf-app border border-mf-line focus:border-mf-primary outline-none transition-colors"
        placeholder="文章标题"
        @input="store.title = ($event.target as HTMLInputElement).value; store.markDirty()"
      />

      <div class="flex-1"></div>

      <button
        class="px-2.5 py-1 rounded-md text-[12px] border border-mf-line-2 hover:border-mf-primary hover:text-mf-primary transition-colors"
        @click="store.aiPanelOpen = !store.aiPanelOpen"
      >AI 配图</button>

      <button
        class="px-2.5 py-1 rounded-md text-[12px] border border-mf-line-2 hover:border-mf-primary hover:text-mf-primary transition-colors disabled:opacity-50"
        :disabled="saving"
        @click="onSaveMd"
      >{{ saving ? '…' : '保存' }}</button>

      <button
        class="px-2.5 py-1 rounded-md text-[12px] border border-mf-line-2 hover:border-mf-primary hover:text-mf-primary transition-colors"
        @click="onExportPdf"
      >PDF</button>

      <button
        class="px-2.5 py-1 rounded-md text-[12px] border border-mf-line-2 hover:border-mf-primary hover:text-mf-primary transition-colors"
        @click="onExportHtml"
      >HTML</button>

      <button
        class="px-3 py-1 rounded-md text-[12px] bg-mf-primary text-white font-medium hover:opacity-90 transition-opacity"
        @click="onCopy"
      >复制到公众号</button>

      <button
        class="w-7 h-7 rounded-md text-[13px] text-mf-ink-3 hover:bg-black/[0.05] transition-colors"
        title="设置"
        @click="store.settingsOpen = !store.settingsOpen"
      >⚙</button>

      <div
        v-if="toast"
        class="absolute right-3 top-11 px-3 py-1.5 rounded-md bg-mf-ink text-white text-[11.5px] mf-fade z-50 shadow-lg"
      >{{ toast }}</div>
    </div>

    <!-- 行2：编辑模式切换 + 左栏配色 -->
    <div class="h-9 px-3 flex items-center gap-3 border-t border-mf-line bg-mf-side">
      <div class="flex items-center p-0.5 rounded-md bg-black/[0.05]" title="编辑模式">
        <button
          class="px-2.5 py-0.5 rounded text-[11.5px] transition-colors"
          :class="store.editorMode === 'markdown' ? 'bg-white text-mf-primary font-medium shadow-sm' : 'text-mf-ink-3'"
          title="Markdown 模式：纯源码编辑，适合熟练手写语法"
          @click="store.switchMode('markdown')"
        >Markdown</button>
        <button
          class="px-2.5 py-0.5 rounded text-[11.5px] transition-colors"
          :class="store.editorMode === 'template' ? 'bg-white text-mf-primary font-medium shadow-sm' : 'text-mf-ink-3'"
          title="公众号模板模式：编辑器上方多一行结构模板按钮（大标题/导语/金句/引用卡片/结尾互动等），一键插入成稿骨架，并自动套用橙色调"
          @click="store.switchMode('template')"
        >公众号模板</button>
      </div>
      <span class="text-[10.5px] text-mf-ink-4 shrink-0 -ml-1 hidden xl:inline">
        {{ store.editorMode === 'template' ? '上方结构模板已启用' : '纯 Markdown 源码' }}
      </span>

      <div class="w-px h-4 bg-mf-line-2"></div>

      <span class="text-[11px] text-mf-ink-3 shrink-0">左栏配色</span>
      <div class="flex items-center gap-1.5">
        <button
          v-for="p in PANEL_PRESETS"
          :key="p.id"
          class="w-4 h-4 rounded-full border transition-transform hover:scale-110"
          :class="!store.panelCustom && store.panelTheme === p.id ? 'ring-1.5 ring-offset-1 ring-mf-primary border-transparent' : 'border-black/10'"
          :style="{ background: p.primary }"
          :title="`左栏配色：${p.name}`"
          @click="store.setPanelTheme(p.id)"
        ></button>
        <label
          class="w-4 h-4 rounded-full cursor-pointer border flex items-center justify-center text-[9px] transition-colors"
          :class="store.panelCustom ? 'border-transparent ring-1.5 ring-offset-1 ring-mf-primary text-mf-ink-4' : 'border-dashed border-mf-ink-4 text-mf-ink-4 hover:border-mf-primary hover:text-mf-primary'"
          title="自定义左栏主色"
        >
          ＋
          <input type="color" class="w-0 h-0 opacity-0 absolute" :value="store.panelCustom || '#2F6B4F'" @input="store.setPanelCustom(($event.target as HTMLInputElement).value)" />
        </label>
      </div>

      <div class="flex-1"></div>
      <span class="text-[10px] text-mf-ink-4">{{ saveLabel }}</span>
    </div>
  </div>
</template>
