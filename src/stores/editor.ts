import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  listDocs,
  getDoc,
  putDoc,
  deleteDoc,
  uid,
  countWords,
  getSetting,
  setSetting,
  type DocRecord,
} from './db'
import { DEFAULT_RULES, type CustomRule } from '../markdown/customRules'

export type EditorMode = 'markdown' | 'template'

/** 工作台配色 */
export type WbTheme = 'green' | 'white' | 'dark'

export const useEditorStore = defineStore('editor', () => {
  /* ---------- 文档 ---------- */
  const docs = ref<DocRecord[]>([])
  const currentId = ref<string>('')
  const title = ref('未命名文章')
  const content = ref('')
  const kind = ref<DocRecord['kind']>('doc')
  const themeId = ref('ink-green')
  const primaryColor = ref('')
  const saveState = ref<'saved' | 'saving' | 'dirty'>('saved')
  const lastSavedAt = ref(0)

  const wordCount = computed(() => countWords(content.value))
  const readMinutes = computed(() => Math.max(1, Math.round(wordCount.value / 350)))

  /* ---------- 视图 ---------- */
  const view = ref<'write' | 'board' | 'todo' | 'cover' | 'stats' | 'ideas'>('write')
  const editorMode = ref<EditorMode>('markdown')
  const previewMode = ref<'edit' | 'wechat'>('edit')
  const focusMode = ref(false)
  const leftPanel = ref<'docs' | 'drafts' | 'ideas' | 'assets'>('docs')
  const aiPanelOpen = ref(false)
  const settingsOpen = ref(false)

  /* ---------- 自定义符号 ---------- */
  const customRules = ref<CustomRule[]>([])

  /* ---------- AI 配置 ---------- */
  const aiProvider = ref('pollinations')
  const aiApiKey = ref('')
  const aiModel = ref('')
  const aiPresets = ref<unknown[]>([])

  /* ---------- 工作台配色：green 浅绿 / white 纯白 / dark 黑色 ---------- */
  const wbTheme = ref<WbTheme>((localStorage.getItem('mf-wb') as WbTheme) || 'green')

  function applyWb(): void {
    document.documentElement.dataset.wb = wbTheme.value
  }

  function setWbTheme(t: WbTheme): void {
    wbTheme.value = t
    localStorage.setItem('mf-wb', t)
    applyWb()
  }

  let saveTimer: number | undefined

  async function loadAll(): Promise<void> {
    applyWb()
    const [allDocs, rules, s] = await Promise.all([
      listDocs(),
      getSetting<CustomRule[]>('customRules', DEFAULT_RULES),
      getSetting<Record<string, unknown>>('ai', {}),
    ])
    docs.value = allDocs
    customRules.value = rules
    const ai = s as Record<string, string>
    aiProvider.value = ai.provider || 'pollinations'
    aiApiKey.value = ai.apiKey || ''
    aiModel.value = ai.model || ''
  }

  async function openDoc(id: string): Promise<void> {
    await flushSave()
    const d = await getDoc(id)
    if (!d) return
    currentId.value = d.id
    title.value = d.title
    content.value = d.content
    kind.value = d.kind
    themeId.value = d.themeId
    primaryColor.value = d.primaryColor ?? ''
    saveState.value = 'saved'
    view.value = 'write'
  }

  async function newDoc(k: DocRecord['kind'] = 'doc'): Promise<void> {
    await flushSave()
    const id = uid()
    const now = Date.now()
    const doc: DocRecord = {
      id,
      title: k === 'draft' ? '未命名草稿' : k === 'idea' ? '未命名灵感' : '未命名文章',
      content: '',
      kind: k,
      status: 'writing',
      themeId: themeId.value,
      primaryColor: primaryColor.value || undefined,
      createdAt: now,
      updatedAt: now,
      wordCount: 0,
    }
    await putDoc(doc)
    docs.value.unshift(doc)
    currentId.value = id
    title.value = doc.title
    content.value = ''
    kind.value = k
    saveState.value = 'saved'
    view.value = 'write'
  }

  function markDirty(): void {
    saveState.value = 'dirty'
    if (saveTimer) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => void flushSave(), 800)
  }

  async function flushSave(): Promise<void> {
    if (saveTimer) {
      window.clearTimeout(saveTimer)
      saveTimer = undefined
    }
    if (!currentId.value) return
    if (saveState.value === 'saved') return
    saveState.value = 'saving'
    const now = Date.now()
    const doc: DocRecord = {
      id: currentId.value,
      title: title.value,
      content: content.value,
      kind: kind.value,
      status: 'writing',
      themeId: themeId.value,
      primaryColor: primaryColor.value || undefined,
      createdAt: docs.value.find((d) => d.id === currentId.value)?.createdAt ?? now,
      updatedAt: now,
      wordCount: wordCount.value,
    }
    await putDoc(doc)
    const i = docs.value.findIndex((d) => d.id === doc.id)
    if (i >= 0) docs.value[i] = doc
    else docs.value.unshift(doc)
    saveState.value = 'saved'
    lastSavedAt.value = now
  }

  async function removeDoc(id: string): Promise<void> {
    await deleteDoc(id)
    docs.value = docs.value.filter((d) => d.id !== id)
    if (currentId.value === id) {
      currentId.value = ''
      content.value = ''
      title.value = '未命名文章'
    }
  }

  async function saveRules(rules: CustomRule[]): Promise<void> {
    customRules.value = rules
    await setSetting('customRules', rules)
  }

  async function saveAiConfig(): Promise<void> {
    await setSetting('ai', {
      provider: aiProvider.value,
      apiKey: aiApiKey.value,
      model: aiModel.value,
    })
  }

  return {
    docs, currentId, title, content, kind, themeId, primaryColor,
    saveState, lastSavedAt, wordCount, readMinutes,
    view, editorMode, previewMode, focusMode, leftPanel, aiPanelOpen, settingsOpen,
    customRules, aiProvider, aiApiKey, aiModel, aiPresets,
    wbTheme, setWbTheme,
    loadAll, openDoc, newDoc, markDirty, flushSave, removeDoc, saveRules, saveAiConfig,
  }
})
