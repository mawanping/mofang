<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()

const docs = computed(() => store.docs.filter((d) => d.kind === 'doc'))
const drafts = computed(() => store.docs.filter((d) => d.kind === 'draft'))
const ideas = computed(() => store.docs.filter((d) => d.kind === 'idea'))

const items = computed(() => {
  if (store.leftPanel === 'drafts') return drafts.value
  if (store.leftPanel === 'ideas') return ideas.value
  return docs.value
})

const label = computed(() => {
  if (store.leftPanel === 'drafts') return '草稿库'
  if (store.leftPanel === 'ideas') return '选题库 / 灵感'
  return '全部文档'
})

function timeAgo(ts: number): string {
  const d = Date.now() - ts
  if (d < 6e4) return '刚刚'
  if (d < 36e5) return `${Math.floor(d / 6e4)} 分钟前`
  if (d < 864e5) return `${Math.floor(d / 36e5)} 小时前`
  return `${Math.floor(d / 864e5)} 天前`
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex border-b border-mf-line shrink-0">
      <button
        v-for="t in [['docs','文档'],['drafts','草稿'],['ideas','选题']]"
        :key="t[0]"
        class="flex-1 py-2 text-[11px] transition-colors"
        :class="store.leftPanel === t[0] ? 'text-mf-primary font-medium border-b-2 border-mf-primary' : 'text-mf-ink-3'"
        @click="store.leftPanel = t[0] as any"
      >{{ t[1] }}</button>
    </div>

    <div class="p-2 shrink-0">
      <button
        class="w-full py-1.5 rounded-md bg-mf-primary text-white text-xs font-medium hover:opacity-90 transition-opacity"
        @click="store.newDoc(store.leftPanel === 'drafts' ? 'draft' : store.leftPanel === 'ideas' ? 'idea' : 'doc')"
      >
        ＋ 新建{{ label }}
      </button>
    </div>

    <div class="mf-scroll flex-1 px-2 pb-3">
      <div
        v-for="d in items"
        :key="d.id"
        class="group px-2.5 py-2 rounded-md cursor-pointer mb-0.5 transition-colors"
        :class="store.currentId === d.id ? 'bg-mf-primary-soft' : 'hover:bg-black/[0.035]'"
        @click="store.openDoc(d.id)"
      >
        <div class="flex items-start justify-between gap-1">
          <p class="text-[12.5px] leading-snug truncate" :class="store.currentId === d.id ? 'text-mf-primary font-medium' : 'text-mf-ink'">
            {{ d.title || '未命名' }}
          </p>
          <button
            class="opacity-0 group-hover:opacity-100 text-mf-ink-4 hover:text-red-500 text-[11px] shrink-0 transition-opacity"
            title="删除"
            @click.stop="store.removeDoc(d.id)"
          >×</button>
        </div>
        <p class="text-[10.5px] text-mf-ink-4 mt-0.5">{{ d.wordCount }} 字 · {{ timeAgo(d.updatedAt) }}</p>
      </div>

      <p v-if="!items.length" class="text-[11px] text-mf-ink-4 text-center py-8 px-2 leading-relaxed">
        还没有{{ label }}<br />点上方按钮新建
      </p>
    </div>
  </div>
</template>
