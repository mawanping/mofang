<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from '../stores/editor'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'block', text: string, select?: string): void
  (e: 'inline', style: string): void
  (e: 'close'): void
}>()

const store = useEditorStore()
const root = ref<HTMLDivElement>()
const customColor = ref('#2F6B4F')
const bgColor = ref('#E4EEE8')

/* 区块格式：一键插入完整语法，占位文字自动选中 */
const BLOCKS: { name: string; hint: string; text: string; select: string }[] = [
  { name: '彩色引用', hint: '左侧主色彩条 + 浅底', text: ':::quote 小标题\n正文写在这里\n:::', select: '正文写在这里' },
  { name: '提示条', hint: '圆角浅底 + 顶部标签', text: ':::tip 小提示\n正文写在这里\n:::', select: '正文写在这里' },
  { name: '主题卡', hint: '大圆角浅底卡片', text: ':::card\n正文写在这里\n:::', select: '正文写在这里' },
  { name: '深色横幅', hint: '暗底 + 顶部彩条，金句专用', text: ':::banner 重点\n正文写在这里\n:::', select: '正文写在这里' },
]

/* 行内色板 */
const COLORS = ['#2F6B4F', '#E8622C', '#C0392B', '#2C5F8A', '#7A6A3F', '#1F1E1B', '#8A867C', '#FFFFFF']
const BGS = ['#E4EEE8', '#FDEBD3', '#FADBD8', '#D6EAF8', '#FCF3CF', '#221F1B']
const SIZES = [16, 18, 22, 24]

const activeRules = computed(() => store.customRules.filter((r) => r.enabled))

function applyColor(c: string) {
  emit('inline', `color:${c}`)
}
function applyBg(c: string) {
  // 深底自动配白字，保证可读
  emit('inline', c === '#221F1B' ? `background:${c};color:#F2EFE8` : `background:${c}`)
}
function applySize(n: number) {
  emit('inline', `font-size:${n}px`)
}

/* 点击外部关闭 */
function onDocClick(e: MouseEvent) {
  if (!props.open) return
  if (root.value && !root.value.contains(e.target as Node)) emit('close')
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div v-if="open" ref="root" class="absolute top-full left-0 mt-1.5 w-[300px] rounded-lg bg-mf-card border border-mf-line shadow-xl z-30 mf-fade">
    <!-- 区块格式 -->
    <div class="p-2.5 border-b border-mf-line">
      <p class="text-[10.5px] text-mf-ink-4 mb-1.5 px-0.5">区块格式（插入后可改文字）</p>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="b in BLOCKS"
          :key="b.name"
          class="text-left px-2 py-1.5 rounded-md border border-mf-line hover:border-mf-primary hover:bg-mf-primary-soft/40 transition-colors"
          @click="emit('block', b.text, b.select)"
        >
          <span class="block text-[11.5px] font-medium text-mf-ink">{{ b.name }}</span>
          <span class="block text-[9.5px] text-mf-ink-4 leading-tight">{{ b.hint }}</span>
        </button>
      </div>
    </div>

    <!-- 行内样式 -->
    <div class="p-2.5 border-b border-mf-line space-y-2">
      <p class="text-[10.5px] text-mf-ink-4 px-0.5">行内样式（选中文字后点色块即可上色）</p>
      <div class="flex items-center gap-1.5">
        <span class="text-[10.5px] text-mf-ink-3 w-7 shrink-0">字色</span>
        <button
          v-for="c in COLORS"
          :key="c"
          class="w-5 h-5 rounded border border-mf-line-2 hover:scale-110 transition-transform"
          :style="{ background: c }"
          :title="c"
          @click="applyColor(c)"
        ></button>
        <input v-model="customColor" type="color" class="w-5 h-5 rounded cursor-pointer border border-mf-line-2" title="自定义字色" @change="applyColor(customColor)" />
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-[10.5px] text-mf-ink-3 w-7 shrink-0">底色</span>
        <button
          v-for="c in BGS"
          :key="c"
          class="w-5 h-5 rounded border border-mf-line-2 hover:scale-110 transition-transform"
          :style="{ background: c }"
          :title="c"
          @click="applyBg(c)"
        ></button>
        <input v-model="bgColor" type="color" class="w-5 h-5 rounded cursor-pointer border border-mf-line-2" title="自定义底色" @change="applyBg(bgColor)" />
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-[10.5px] text-mf-ink-3 w-7 shrink-0">字号</span>
        <button
          v-for="n in SIZES"
          :key="n"
          class="px-2 py-0.5 rounded border border-mf-line text-[10.5px] text-mf-ink-2 hover:border-mf-primary hover:text-mf-primary transition-colors"
          @click="applySize(n)"
        >{{ n }}</button>
      </div>
    </div>

    <!-- 我的自定义规则 -->
    <div v-if="activeRules.length" class="p-2.5">
      <p class="text-[10.5px] text-mf-ink-4 mb-1.5 px-0.5">我的规则（设置里可增删改）</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="r in activeRules"
          :key="r.id"
          class="px-2 py-1 rounded border border-mf-line font-mono text-[10.5px] text-mf-ink-2 hover:border-mf-primary hover:text-mf-primary transition-colors"
          @click="emit('block', `${r.symbol}${r.label && r.component === 'tip' ? ' ' + r.label : ''}\n正文写在这里\n:::`, '正文写在这里')"
        >{{ r.symbol }}</button>
      </div>
    </div>
  </div>
</template>
