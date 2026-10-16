<script setup lang="ts">
import { onMounted } from 'vue'
import { useEditorStore } from './stores/editor'
import WriteView from './views/WriteView.vue'
import BoardView from './views/BoardView.vue'
import StatsView from './views/StatsView.vue'
import CoverView from './views/CoverView.vue'
import AiImagePanel from './components/AiImagePanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'

const store = useEditorStore()

const nav = [
  { key: 'write', label: '写作', icon: '✎' },
  { key: 'board', label: '看板', icon: '▦' },
  { key: 'cover', label: '封面', icon: '▣' },
  { key: 'stats', label: '统计', icon: '▤' },
] as const

onMounted(async () => {
  await store.loadAll()
  if (!store.currentId) await store.newDoc('doc')
})
</script>

<template>
  <div class="h-full flex">
    <!-- 左侧图标导航 -->
    <nav class="w-12 shrink-0 bg-mf-side border-r border-mf-line flex flex-col items-center py-2.5 gap-1">
      <div class="w-7 h-7 rounded-md bg-mf-primary flex items-center justify-center mb-1.5">
        <span class="text-white text-[13px] font-serif leading-none">墨</span>
      </div>
      <button
        v-for="n in nav"
        :key="n.key"
        class="w-9 h-9 rounded-md flex flex-col items-center justify-center gap-0.5 transition-colors"
        :class="store.view === n.key ? 'bg-mf-primary-soft text-mf-primary' : 'text-mf-ink-3 hover:bg-black/[0.05]'"
        :title="n.label"
        @click="store.view = n.key"
      >
        <span class="text-[14px] leading-none">{{ n.icon }}</span>
        <span class="text-[8.5px] leading-none">{{ n.label }}</span>
      </button>
      <div class="flex-1"></div>
      <a
        href="https://github.com/doocs/md"
        target="_blank"
        rel="noopener"
        class="w-9 h-9 rounded-md flex items-center justify-center text-mf-ink-4 hover:bg-black/[0.05] text-[11px]"
        title="基于 doocs/md 排版内核"
      >◎</a>
    </nav>

    <!-- 主区 -->
    <div class="flex-1 min-w-0">
      <WriteView v-if="store.view === 'write'" />
      <BoardView v-else-if="store.view === 'board'" />
      <CoverView v-else-if="store.view === 'cover'" />
      <StatsView v-else-if="store.view === 'stats'" />
    </div>

    <AiImagePanel v-if="store.aiPanelOpen" />
    <SettingsPanel v-if="store.settingsOpen" />
  </div>
</template>
