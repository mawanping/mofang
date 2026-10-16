<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '../stores/editor'
import { THEMES } from '../themes'
import { invalidateParsers } from '../markdown/render'
import { copyHtmlToClipboard, inlineForWechat } from '../markdown/wechat'
import { countWords } from '../stores/db'
import { saveToFolder, exportHtml, exportPdf, dirSupported } from '../utils/exporters'

const store = useEditorStore()
const toast = ref('')
const saving = ref(false)

const themeOptions = computed(() =>
  THEMES.map((t) => ({ id: t.id, name: t.name, desc: t.desc, primary: t.primary })),
)

const activeTheme = computed(() => THEMES.find((t) => t.id === store.themeId) ?? THEMES[0])

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
  store.previewMode = 'wechat'
  await new Promise((r) => setTimeout(r, 250))
  exportPdf()
}

function onPrimaryChange(e: Event) {
  const v = (e.target as HTMLInputElement).value
  store.primaryColor = v
  store.markDirty()
}

function resetPrimary() {
  store.primaryColor = ''
  store.markDirty()
}
</script>

<template>
  <div class="h-12 px-3 flex items-center gap-2 bg-mf-card border-b border-mf-line shrink-0">
    <div class="flex items-center gap-1.5 mr-1">
      <div class="w-6 h-6 rounded-md bg-mf-primary flex items-center justify-center">
        <span class="text-white text-[13px] font-serif leading-none">墨</span>
      </div>
      <span class="text-[13px] font-medium tracking-wide">墨坊</span>
    </div>

    <input
      :value="store.title"
      class="w-44 px-2.5 py-1 text-[13px] rounded-md bg-mf-app border border-mf-line focus:border-mf-primary outline-none transition-colors"
      placeholder="文章标题"
      @input="store.title = ($event.target as HTMLInputElement).value; store.markDirty()"
    />

    <div class="flex items-center gap-1 px-2 py-1 rounded-md bg-mf-app border border-mf-line">
      <span class="text-[11px] text-mf-ink-3">主题</span>
      <select
        :value="store.themeId"
        class="bg-transparent text-[11.5px] outline-none cursor-pointer"
        @change="store.themeId = ($event.target as HTMLSelectElement).value; store.markDirty()"
      >
        <option v-for="t in themeOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
    </div>

    <label class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-mf-app border border-mf-line cursor-pointer" title="主色，改动全篇联动">
      <span class="w-3.5 h-3.5 rounded-sm border border-mf-line-2" :style="{ background: store.primaryColor || activeTheme.primary }"></span>
      <input type="color" class="w-0 h-0 opacity-0 absolute" :value="store.primaryColor || activeTheme.primary" @input="onPrimaryChange" />
      <span class="text-[11px] text-mf-ink-3">{{ store.primaryColor || activeTheme.primary }}</span>
      <button v-if="store.primaryColor" class="text-[10px] text-mf-ink-4 hover:text-mf-primary" @click.prevent="resetPrimary">重置</button>
    </label>

    <div class="flex-1"></div>

    <button
      class="px-2.5 py-1 rounded-md text-[12px] border border-mf-line-2 hover:border-mf-primary hover:text-mf-primary transition-colors"
      @click="store.aiPanelOpen = !store.aiPanelOpen"
    >AI 配图</button>

    <div class="relative">
      <button
        class="px-2.5 py-1 rounded-md text-[12px] border border-mf-line-2 hover:border-mf-primary hover:text-mf-primary transition-colors disabled:opacity-50"
        :disabled="saving"
        @click="onSaveMd"
      >{{ saving ? '…' : '保存' }}</button>
    </div>

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
      class="absolute right-3 top-12 px-3 py-1.5 rounded-md bg-mf-ink text-white text-[11.5px] mf-fade z-50 shadow-lg"
    >{{ toast }}</div>
  </div>
</template>
