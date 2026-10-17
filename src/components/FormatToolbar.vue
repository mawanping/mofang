<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '../stores/editor'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'block', text: string, select?: string): void
  (e: 'inline', style: string): void
  (e: 'reset'): void
}>()

const store = useEditorStore()

/* 区块格式：一键插入完整语法，占位文字自动选中 */
const BLOCKS: { name: string; text: string; select: string }[] = [
  { name: '彩色引用', text: ':::quote 小标题\n正文写在这里\n:::', select: '正文写在这里' },
  { name: '提示条', text: ':::tip 小提示\n正文写在这里\n:::', select: '正文写在这里' },
  { name: '主题卡', text: ':::card\n正文写在这里\n:::', select: '正文写在这里' },
  { name: '深色横幅', text: ':::banner 重点\n正文写在这里\n:::', select: '正文写在这里' },
]

/* 行内色板与字号档位 */
const COLORS = ['#2F6B4F', '#E8622C', '#C0392B', '#2C5F8A', '#7A6A3F', '#1F1E1B', '#8A867C', '#FFFFFF']
const BGS = ['#E4EEE8', '#FDEBD3', '#FADBD8', '#D6EAF8', '#FCF3CF', '#221F1B']
const SIZES = [12, 14, 16, 18, 20, 22, 24, 28]

const activeRules = computed(() => store.customRules.filter((r) => r.enabled))

function applyColor(c: string) {
  emit('inline', `color:${c}`)
}
function applyBg(c: string) {
  emit('inline', c === '#221F1B' ? `background:${c};color:#F2EFE8` : `background:${c}`)
}
</script>

<template>
  <div class="border-b border-mf-line bg-mf-side shrink-0 select-none">
    <!-- 行1：折叠开关 + 区块格式 -->
    <div class="h-7 flex items-center gap-1.5 px-2">
      <button
        class="w-5 h-5 rounded flex items-center justify-center text-mf-ink-3 hover:bg-mf-primary-soft hover:text-mf-primary transition-colors text-[10px]"
        :title="open ? '收起格式工具栏' : '展开格式工具栏'"
        @click="emit('toggle')"
      >{{ open ? '▴' : '▾' }}</button>
      <span class="text-[10.5px] text-mf-ink-4 w-11 shrink-0">区块格式</span>
      <button
        v-for="b in BLOCKS"
        :key="b.name"
        class="px-2 py-0.5 rounded border border-mf-line text-[11px] text-mf-ink-2 hover:border-mf-primary hover:text-mf-primary transition-colors"
        @click="emit('block', b.text, b.select)"
      >{{ b.name }}</button>
    </div>

    <!-- 展开：行内字色 / 底色 / 字号 / 我的规则 -->
    <template v-if="open">
      <div class="h-7 flex items-center gap-1.5 px-2 border-t border-mf-line/60">
        <span class="text-[10.5px] text-mf-ink-4 w-11 shrink-0">字色</span>
        <button
          v-for="c in COLORS"
          :key="c"
          class="w-4 h-4 rounded border border-black/10 hover:scale-110 transition-transform"
          :style="{ background: c }"
          :title="`字色 ${c}`"
          @click="applyColor(c)"
        ></button>
        <label class="w-4 h-4 rounded border border-dashed border-mf-ink-4 cursor-pointer flex items-center justify-center text-[8px] text-mf-ink-4 hover:border-mf-primary hover:text-mf-primary transition-colors" title="自定义字色">
          ＋<input type="color" class="w-0 h-0 opacity-0 absolute" @input="applyColor(($event.target as HTMLInputElement).value)" />
        </label>
        <span class="text-[10px] text-mf-ink-4 ml-1">选中文字后点色块即可上色</span>
      </div>

      <div class="h-7 flex items-center gap-1.5 px-2 border-t border-mf-line/60">
        <span class="text-[10.5px] text-mf-ink-4 w-11 shrink-0">底色</span>
        <button
          v-for="c in BGS"
          :key="c"
          class="w-4 h-4 rounded border border-black/10 hover:scale-110 transition-transform"
          :style="{ background: c }"
          :title="`底色 ${c}`"
          @click="applyBg(c)"
        ></button>
        <label class="w-4 h-4 rounded border border-dashed border-mf-ink-4 cursor-pointer flex items-center justify-center text-[8px] text-mf-ink-4 hover:border-mf-primary hover:text-mf-primary transition-colors" title="自定义底色">
          ＋<input type="color" class="w-0 h-0 opacity-0 absolute" @input="applyBg(($event.target as HTMLInputElement).value)" />
        </label>
      </div>

      <div class="h-7 flex items-center gap-1.5 px-2 border-t border-mf-line/60">
        <span class="text-[10.5px] text-mf-ink-4 w-11 shrink-0">字号</span>
        <button
          v-for="n in SIZES"
          :key="n"
          class="px-1.5 py-0.5 rounded border border-mf-line text-[10.5px] text-mf-ink-2 hover:border-mf-primary hover:text-mf-primary transition-colors"
          @click="emit('inline', `font-size:${n}px`)"
        >{{ n }}</button>
        <div class="flex-1"></div>
        <button
          class="px-2 py-0.5 rounded border border-mf-line text-[10.5px] text-mf-ink-3 hover:border-mf-primary hover:text-mf-primary transition-colors"
          title="恢复主题默认主色"
          @click="emit('reset')"
        >重置主色</button>
      </div>

      <div class="h-7 flex items-center gap-1.5 px-2 border-t border-mf-line/60">
        <span class="text-[10.5px] text-mf-ink-4 w-11 shrink-0">我的规则</span>
        <template v-if="activeRules.length">
          <button
            v-for="r in activeRules"
            :key="r.id"
            class="px-2 py-0.5 rounded border border-mf-line font-mono text-[10.5px] text-mf-ink-2 hover:border-mf-primary hover:text-mf-primary transition-colors"
            @click="emit('block', `${r.symbol}${r.label && r.component === 'tip' ? ' ' + r.label : ''}\n正文写在这里\n:::`, '正文写在这里')"
          >{{ r.symbol }}</button>
        </template>
        <span v-else class="text-[10px] text-mf-ink-4">暂无启用的规则，去设置里添加</span>
      </div>
    </template>
  </div>
</template>
