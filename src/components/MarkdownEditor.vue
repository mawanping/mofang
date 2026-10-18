<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorState, Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language'
import { inlineStyleDecorator } from './inlineDecorator'
import { blockStyleDecorator, refreshAssetImages } from './blockDecorator'
import { assetIdsIn, assetToDataUrl, getCachedDataUrl } from '../utils/assets'

/**
 * 空列表项按回车 → 跳出列表（清掉 `- ` / `1. ` 标记）。
 * lang-markdown 自带的续行在空项时不会自动退出，会导致后面想写
 * 标题时被续成 `- ### 标题`，看起来像「标记不生效」。
 */
const exitEmptyListOnEnter = Prec.highest(
  keymap.of([
    {
      key: 'Enter',
      run: (view) => {
        const { state } = view
        const sel = state.selection.main
        if (!sel.empty) return false
        const line = state.doc.lineAt(sel.from)
        if (sel.from !== line.to) return false
        if (!/^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]+$/.test(line.text)) return false
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: '' },
          selection: { anchor: line.from },
          userEvent: 'input',
        })
        return true
      },
    },
  ]),
)

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'save'): void }>()

const host = ref<HTMLDivElement>()
const view = shallowRef<EditorView>()
let updating = false

/**
 * 把正文里出现的素材图片读进缓存，让编辑区能直接显示图片本身。
 * 装饰器是同步的，所以先异步预热，就绪后 dispatch 一个 effect 触发重建。
 */
async function primeImages(ctx: { state: EditorState; view: EditorView }): Promise<void> {
  const ids = assetIdsIn(ctx.state.doc.toString()).filter((id) => !getCachedDataUrl(id))
  if (!ids.length) return
  const loaded = await Promise.all(ids.map((id) => assetToDataUrl(id).catch(() => null)))
  if (!loaded.some(Boolean)) return
  try {
    ctx.view.dispatch({ effects: refreshAssetImages.of(null) })
  } catch {
    /* 编辑器已销毁 */
  }
}

const extensions: Extension[] = [
  lineNumbers(),
  highlightActiveLineGutter(),
  history(),
  bracketMatching(),
  indentOnInput(),
  markdown({ base: markdownLanguage, codeLanguages: [] }),
  syntaxHighlighting(defaultHighlightStyle),
  highlightActiveLine(),
  blockStyleDecorator,
  inlineStyleDecorator,
  exitEmptyListOnEnter,
  keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  EditorView.lineWrapping,
  EditorView.updateListener.of((u) => {
    if (u.docChanged && !updating) {
      emit('update:modelValue', u.state.doc.toString())
      void primeImages(u)
    }
  }),
  EditorView.theme({
    // 与公众号排版基线对齐：16px / 行高 1.85 / 字距 0.5px
    '&': { fontSize: '16px' },
    '.cm-content': { fontFamily: 'var(--font-mono)', padding: '0 14px' },
    '.cm-line': { lineHeight: '1.85', letterSpacing: '0.5px' },
  }),
]

onMounted(() => {
  if (!host.value) return
  const state = EditorState.create({
    doc: props.modelValue,
    extensions,
  })
  view.value = new EditorView({ state, parent: host.value })
  // 已有正文里的图片也要能显示
  void primeImages({ state: view.value.state, view: view.value })
})

onBeforeUnmount(() => view.value?.destroy())

watch(
  () => props.modelValue,
  (v) => {
    const cur = view.value?.state.doc.toString() ?? ''
    if (v !== cur) {
      updating = true
      view.value?.dispatch({ changes: { from: 0, to: cur.length, insert: v } })
      updating = false
    }
  },
)

function insert(text: string, cursorOffset = 0) {
  const v = view.value
  if (!v) return
  const sel = v.state.selection.main
  v.dispatch({
    changes: { from: sel.from, to: sel.to, insert: text },
    selection: { anchor: sel.from + text.length + cursorOffset },
  })
  v.focus()
  emit('update:modelValue', v.state.doc.toString())
}

/** 取当前选中文本（行内样式包裹用） */
function getSelected(): string {
  const v = view.value
  if (!v) return ''
  const { from, to } = v.state.selection.main
  return v.state.sliceDoc(from, to)
}

/**
 * 光标/选区是否落在 `:::xxx ... :::` 块内部。
 * 块内不要做行内上色 —— 包一层 span 会把 `1.` 这类行首语法打断，
 * 或者把块内容变成转义后的纯文本，版式直接失效。
 */
function selectionInCustomBlock(): boolean {
  const v = view.value
  if (!v) return false
  const { from } = v.state.selection.main
  const before = v.state.sliceDoc(0, from)
  const opens = (before.match(/^:::[a-zA-Z]/gm) || []).length
  const closes = (before.match(/^:::[ \t]*$/gm) || []).length
  return opens > closes
}

/** 插入文本并把其中的占位符选中，方便直接打字覆盖 */
function insertAndSelect(text: string, selectText?: string) {
  const v = view.value
  if (!v) return
  const sel = v.state.selection.main
  v.dispatch({ changes: { from: sel.from, to: sel.to, insert: text } })
  if (selectText) {
    const idx = text.indexOf(selectText)
    if (idx >= 0) {
      v.dispatch({
        selection: { anchor: sel.from + idx, head: sel.from + idx + selectText.length },
      })
    }
  }
  v.focus()
  emit('update:modelValue', v.state.doc.toString())
}

defineExpose({
  insert,
  getSelected,
  insertAndSelect,
  selectionInCustomBlock,
  /** 滚动容器（同步滚动用） */
  scrollEl: (): HTMLElement | undefined => view.value?.scrollDOM,
})
</script>

<template>
  <div ref="host" class="h-full w-full"></div>
</template>
