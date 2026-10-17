<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'save'): void }>()

const host = ref<HTMLDivElement>()
const view = shallowRef<EditorView>()
let updating = false

const extensions: Extension[] = [
  lineNumbers(),
  highlightActiveLineGutter(),
  history(),
  bracketMatching(),
  indentOnInput(),
  markdown({ base: markdownLanguage, codeLanguages: [] }),
  syntaxHighlighting(defaultHighlightStyle),
  highlightActiveLine(),
  keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  EditorView.lineWrapping,
  EditorView.updateListener.of((u) => {
    if (u.docChanged && !updating) {
      emit('update:modelValue', u.state.doc.toString())
    }
  }),
  EditorView.theme({
    '&': { fontSize: '14px' },
    '.cm-content': { fontFamily: 'var(--font-mono)', padding: '0 14px' },
  }),
]

onMounted(() => {
  if (!host.value) return
  const state = EditorState.create({
    doc: props.modelValue,
    extensions,
  })
  view.value = new EditorView({ state, parent: host.value })
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
  /** 滚动容器（同步滚动用） */
  scrollEl: (): HTMLElement | undefined => view.value?.scrollDOM,
})
</script>

<template>
  <div ref="host" class="h-full w-full"></div>
</template>
