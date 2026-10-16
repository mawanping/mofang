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

defineExpose({ insert })
</script>

<template>
  <div ref="host" class="h-full w-full"></div>
</template>
