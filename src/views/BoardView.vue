<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useEditorStore } from '../stores/editor'
import { listDocs, putDoc, deleteDoc, uid, type DocRecord } from '../stores/db'

const store = useEditorStore()

const columns = ref<{ key: DocRecord['status']; name: string }[]>([
  { key: 'writing', name: '选题中' },
  { key: 'done', name: '成稿中' },
  { key: 'published', name: '已发布' },
])

const ideas = ref<DocRecord[]>([])
const newIdea = ref('')
const dragging = ref<string | null>(null)
const over = ref<string | null>(null)

async function load() {
  const all = await listDocs('idea')
  ideas.value = all
}

async function addIdea() {
  const t = newIdea.value.trim()
  if (!t) return
  const now = Date.now()
  await putDoc({
    id: uid(),
    title: t,
    content: '',
    kind: 'idea',
    status: 'writing',
    themeId: store.themeId,
    createdAt: now,
    updatedAt: now,
    wordCount: 0,
  })
  newIdea.value = ''
  await load()
}

async function setStatus(id: string, status: DocRecord['status']) {
  const d = ideas.value.find((x) => x.id === id)
  if (!d) return
  await putDoc({ ...d, status, updatedAt: Date.now() })
  await load()
}

function onDragStart(id: string) { dragging.value = id }
function onDragOver(key: string) { over.value = key }
async function onDrop(key: string) {
  if (dragging.value) await setStatus(dragging.value, key as DocRecord['status'])
  dragging.value = null
  over.value = null
}

async function remove(id: string) {
  await deleteDoc(id)
  await load()
}

const counts = (key: string) => ideas.value.filter((i) => i.status === key).length

onMounted(load)
</script>

<template>
  <div class="h-full flex flex-col bg-mf-canvas">
    <div class="h-11 px-3 flex items-center gap-2 bg-mf-card border-b border-mf-line shrink-0">
      <span class="text-[13px] font-medium">选题看板</span>
      <div class="flex-1"></div>
      <input
        v-model="newIdea"
        class="w-64 px-2.5 py-1 rounded-md border border-mf-line text-[12px] outline-none focus:border-mf-primary"
        placeholder="记一个选题，回车加入灵感池"
        @keyup.enter="addIdea"
      />
      <button class="px-2.5 py-1 rounded-md bg-mf-primary text-white text-[12px]" @click="addIdea">＋ 加入</button>
      <button class="px-2.5 py-1 rounded-md border border-mf-line-2 text-[12px] hover:border-mf-primary hover:text-mf-primary" @click="store.view = 'write'">返回写作</button>
    </div>

    <div class="flex-1 min-h-0 flex gap-3 p-3 overflow-x-auto">
      <div
        v-for="col in columns"
        :key="col.key"
        class="w-64 shrink-0 rounded-lg p-2 flex flex-col transition-colors"
        :class="over === col.key ? 'bg-mf-primary-soft ring-1 ring-mf-primary' : 'bg-black/[0.035]'"
        @dragover.prevent="onDragOver(col.key)"
        @dragleave="over = null"
        @drop.prevent="onDrop(col.key)"
      >
        <div class="flex items-center gap-2 px-1 py-1.5">
          <span class="text-[12px] font-medium">{{ col.name }}</span>
          <span class="px-1.5 rounded bg-white text-[10px] text-mf-ink-3">{{ counts(col.key) }}</span>
        </div>
        <div class="mf-scroll flex-1 space-y-2">
          <div
            v-for="i in ideas.filter((x) => x.status === col.key)"
            :key="i.id"
            class="group bg-white rounded-md border border-mf-line p-2.5 cursor-grab active:cursor-grabbing"
            draggable="true"
            @dragstart="onDragStart(i.id)"
            @dragend="dragging = null"
          >
            <div class="flex items-start justify-between gap-1">
              <p class="text-[12px] leading-snug">{{ i.title }}</p>
              <button class="opacity-0 group-hover:opacity-100 text-mf-ink-4 hover:text-red-500 text-[11px]" @click="remove(i.id)">×</button>
            </div>
            <div class="flex items-center gap-1 mt-2">
              <button
                v-for="c in columns.filter((x) => x.key !== col.key)"
                :key="c.key"
                class="px-1.5 py-0.5 rounded border border-mf-line text-[10px] text-mf-ink-3 hover:border-mf-primary hover:text-mf-primary"
                @click="setStatus(i.id, c.key as DocRecord['status'])"
              >→ {{ c.name }}</button>
            </div>
          </div>
          <p v-if="!counts(col.key)" class="text-[11px] text-mf-ink-4 text-center py-6">拖卡片到这里</p>
        </div>
      </div>
    </div>
  </div>
</template>
