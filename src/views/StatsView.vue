<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEditorStore } from '../stores/editor'
import { listDocs, listTodos, putTodo, deleteTodo, uid, type TodoRecord, type DocRecord } from '../stores/db'
import { THEMES } from '../themes'

const store = useEditorStore()
const todos = ref<TodoRecord[]>([])
const text = ref('')
const docs = ref<DocRecord[]>([])

async function load() {
  todos.value = await listTodos()
  docs.value = await listDocs()
}

async function add() {
  const t = text.value.trim()
  if (!t) return
  await putTodo({ id: uid(), text: t, done: false, createdAt: Date.now() })
  text.value = ''
  await load()
}

async function toggle(t: TodoRecord) {
  await putTodo({ ...t, done: !t.done })
  await load()
}

async function remove(id: string) {
  await deleteTodo(id)
  await load()
}

const stats = computed(() => {
  const total = docs.value.length
  const words = docs.value.reduce((s, d) => s + d.wordCount, 0)
  const days = new Set(docs.value.map((d) => new Date(d.updatedAt).toDateString())).size
  const todosDone = todos.value.filter((t) => t.done).length
  return { total, words, days, todosDone }
})

const byDay = computed(() => {
  const m = new Map<string, number>()
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    m.set(d.toDateString(), 0)
  }
  docs.value.forEach((d) => {
    const k = new Date(d.updatedAt).toDateString()
    if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1)
  })
  const arr = Array.from(m.entries()).map(([k, v]) => ({ k, v }))
  const max = Math.max(1, ...arr.map((a) => a.v))
  return { arr, max }
})

const themesUsed = computed(() => {
  const m = new Map<string, number>()
  docs.value.forEach((d) => m.set(d.themeId, (m.get(d.themeId) ?? 0) + 1))
  return Array.from(m.entries()).map(([id, n]) => ({ name: THEMES.find((t) => t.id === id)?.name ?? id, n }))
})

onMounted(load)
</script>

<template>
  <div class="h-full mf-scroll bg-mf-canvas p-4">
    <div class="max-w-3xl mx-auto space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-[15px] font-medium">工作台概览</h2>
        <button class="px-2.5 py-1 rounded-md border border-mf-line-2 text-[12px] hover:border-mf-primary hover:text-mf-primary" @click="store.view = 'write'">返回写作</button>
      </div>

      <div class="grid grid-cols-4 gap-3">
        <div v-for="s in [[stats.total,'篇文档'],[stats.words,'总字数'],[stats.days,'活跃天数'],[stats.todosDone,'已完成待办']]" :key="s[1]" class="bg-mf-card rounded-lg border border-mf-line p-3.5">
          <p class="text-[11px] text-mf-ink-3">{{ s[1] }}</p>
          <p class="text-2xl font-medium mt-1 tabular-nums">{{ s[0] }}</p>
        </div>
      </div>

      <div class="bg-mf-card rounded-lg border border-mf-line p-4">
        <p class="text-[12px] font-medium mb-3">近 14 天写作活跃度</p>
        <div class="flex items-end gap-1.5 h-24">
          <div v-for="d in byDay.arr" :key="d.k" class="flex-1 flex flex-col items-center gap-1">
            <div
              class="w-full rounded-t transition-all"
              :style="{ height: `${(d.v / byDay.max) * 80}px`, background: d.v ? 'var(--color-mf-primary)' : 'var(--color-mf-line)' }"
            ></div>
            <span class="text-[9px] text-mf-ink-4">{{ new Date(d.k).getDate() }}</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="bg-mf-card rounded-lg border border-mf-line p-4">
          <p class="text-[12px] font-medium mb-3">待办清单</p>
          <div class="flex gap-1.5 mb-3">
            <input v-model="text" class="flex-1 px-2 py-1.5 rounded-md border border-mf-line text-[12px] outline-none focus:border-mf-primary" placeholder="添加待办，回车" @keyup.enter="add" />
            <button class="px-2.5 py-1.5 rounded-md bg-mf-primary text-white text-[12px]" @click="add">加</button>
          </div>
          <div class="space-y-1.5 max-h-52 mf-scroll">
            <div v-for="t in todos" :key="t.id" class="flex items-center gap-2 group">
              <input :checked="t.done" type="checkbox" class="accent-mf-primary" @change="toggle(t)" />
              <span class="flex-1 text-[12px]" :class="t.done ? 'line-through text-mf-ink-4' : ''">{{ t.text }}</span>
              <button class="opacity-0 group-hover:opacity-100 text-mf-ink-4 hover:text-red-500 text-[12px]" @click="remove(t.id)">×</button>
            </div>
            <p v-if="!todos.length" class="text-[11px] text-mf-ink-4 py-3">暂无待办</p>
          </div>
        </div>

        <div class="bg-mf-card rounded-lg border border-mf-line p-4">
          <p class="text-[12px] font-medium mb-3">主题使用分布</p>
          <div class="space-y-2">
            <div v-for="t in themesUsed" :key="t.name" class="flex items-center gap-2">
              <span class="w-20 text-[11.5px] text-mf-ink-2">{{ t.name }}</span>
              <div class="flex-1 h-2 rounded-full bg-mf-line overflow-hidden">
                <div class="h-full rounded-full bg-mf-primary" :style="{ width: `${(t.n / stats.total) * 100}%` }"></div>
              </div>
              <span class="text-[11px] text-mf-ink-3 tabular-nums w-6 text-right">{{ t.n }}</span>
            </div>
            <p v-if="!themesUsed.length" class="text-[11px] text-mf-ink-4 py-3">暂无数据</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
