<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../stores/editor'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'block', text: string, select?: string): void
  (e: 'inline', style: string): void
  (e: 'reset'): void
}>()

const store = useEditorStore()

/* 区块格式：一键插入完整语法，占位文字自动选中。
   强调色由「当前画笔色」决定，写在块标记后面 —— 换色不会破坏版式。
   注意：每个块都以换行开头，否则紧跟上一块的 `:::` 会拼成 `::::::banner` 导致语法失效。 */
const BLOCKS: { name: string; text: string; select: string }[] = [
  { name: '彩色引用', text: '\n:::quote 小标题 {{c}} {{bg}}\n正文写在这里\n:::\n', select: '正文写在这里' },
  { name: '提示条', text: '\n:::tip 小提示 {{c}} {{bg}}\n正文写在这里\n:::\n', select: '正文写在这里' },
  { name: '主题卡', text: '\n:::card bg={{soft}}\n正文写在这里\n:::\n', select: '正文写在这里' },
  { name: '深色横幅', text: '\n:::banner 重点 {{c}} {{bg}}\n正文写在这里\n:::\n', select: '正文写在这里' },
  { name: '要点列表', text: '\n:::points 要点 {{c}} {{bg}}\n第一点|补充说明\n第二点\n第三点\n:::\n', select: '第一点' },
]

/* 行内色板与字号档位 */
const COLORS = ['#2F6B4F', '#E8622C', '#C0392B', '#2C5F8A', '#7A6A3F', '#1F1E1B', '#8A867C', '#FFFFFF']
const BGS = ['#E4EEE8', '#FDEBD3', '#FADBD8', '#D6EAF8', '#FCF3CF', '#221F1B']
const SIZES = [12, 14, 16, 18, 20, 22, 24, 28]

const activeRules = computed(() => store.customRules.filter((r) => r.enabled && !r.hidden))

/** 把 hex 压成 6% 透明度的淡底，给 card/points 用（公众号不认 color-mix） */
function softOf(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(n)) return 'rgba(0,0,0,0.04)'
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.08)`
}

/** 用当前画笔色 / 画笔底色填充块语法 */
function fill(template: string): string {
  const c = store.brushColor
  const bg = store.brushBg
  let out = template.replace(/\{\{c\}\}/g, c).replace(/\{\{soft\}\}/g, softOf(c))
  // {{bg}} 只在设置了画笔底色时展开，否则整段消失（回到主题默认底色）
  out = out.replace(/\s*\{\{bg\}\}/g, bg ? ` bg=${bg}` : '')
  out = out.replace(/\{\{bg\}\}/g, bg)
  return out
}

function insertBlock(b: { text: string; select: string }) {
  emit('block', fill(b.text), b.select)
}

function insertRule(r: { symbol: string; label?: string; component: string }) {
  const head = r.label && r.component !== 'card' && r.component !== 'quote' ? ` ${r.label}` : ''
  emit('block', fill(`\n${r.symbol}${head} {{c}} {{bg}}\n正文写在这里\n:::\n`), '正文写在这里')
}

const colorTip = ref('')
const bgTip = ref('')
function flashTip(target: 'color' | 'bg', msg: string) {
  const r = target === 'color' ? colorTip : bgTip
  r.value = msg
  window.setTimeout(() => {
    if (r.value === msg) r.value = ''
  }, 2000)
}

function applyColor(c: string) {
  store.setBrushColor(c)
  emit('inline', `color:${c}`)
  flashTip('color', `画笔色已设为 ${c}`)
}

/** 底色 = 模板块的背景色（横幅、卡片、要点、引用通用） */
function applyBg(c: string) {
  store.setBrushBg(c)
  emit('inline', c === '#221F1B' ? `background:${c};color:#F2EFE8` : `background:${c}`)
  flashTip('bg', `块底色已设为 ${c}`)
}

function clearBg() {
  store.setBrushBg('')
  flashTip('bg', '已恢复主题默认底色')
}
</script>

<template>
  <div class="border-b border-mf-line bg-mf-side shrink-0 select-none">
    <!-- 行1：区块格式（折叠态时右下角放展开钮） -->
    <div class="h-7 flex items-center gap-1.5 px-2">
      <span class="text-[10.5px] text-mf-ink-4 w-11 shrink-0">区块格式</span>
      <button
        v-for="b in BLOCKS"
        :key="b.name"
        class="px-2 py-0.5 rounded border border-mf-line text-[11px] text-mf-ink-2 hover:border-mf-primary hover:text-mf-primary transition-colors"
        :title="`插入${b.name}（强调色用当前画笔色 ${store.brushColor}）`"
        @click="insertBlock(b)"
      >{{ b.name }}</button>
      <div class="flex-1"></div>
      <button
        v-if="!open"
        class="w-6 h-6 rounded flex items-center justify-center text-mf-ink-3 hover:bg-mf-primary-soft hover:text-mf-primary transition-colors"
        title="展开格式工具栏"
        @click="emit('toggle')"
      >
        <svg viewBox="0 0 16 16" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
      </button>
    </div>

    <!-- 展开：行内字色 / 底色 / 字号 / 我的规则 -->
    <template v-if="open">
      <div class="h-7 flex items-center gap-1.5 px-2 border-t border-mf-line/60">
        <span class="text-[10.5px] text-mf-ink-4 w-11 shrink-0">字色</span>
        <button
          v-for="c in COLORS"
          :key="c"
          class="w-4 h-4 rounded border hover:scale-110 transition-transform"
          :class="store.brushColor?.toLowerCase() === c.toLowerCase() ? 'border-mf-primary ring-1 ring-mf-primary ring-offset-1' : 'border-black/10'"
          :style="{ background: c }"
          :title="`字色 ${c}（同时设为模板块强调色）`"
          @click="applyColor(c)"
        ></button>
        <label class="w-4 h-4 rounded border border-dashed border-mf-ink-4 cursor-pointer flex items-center justify-center text-[8px] text-mf-ink-4 hover:border-mf-primary hover:text-mf-primary transition-colors" title="自定义字色（同时作为模板块强调色）">
          ＋<input type="color" class="w-0 h-0 opacity-0 absolute" @input="applyColor(($event.target as HTMLInputElement).value)" />
        </label>
        <span class="text-[10px] text-mf-ink-4 ml-1" :class="colorTip ? 'text-mf-primary' : ''">
          <template v-if="colorTip">{{ colorTip }} · 插入模板块时生效</template>
          <template v-else>选中文字上色；不选则只存为画笔色 <b class="font-mono text-mf-ink-3">{{ store.brushColor }}</b>，插入模板块时使用</template>
        </span>
      </div>

      <div class="h-7 flex items-center gap-1.5 px-2 border-t border-mf-line/60">
        <span class="text-[10.5px] text-mf-ink-4 w-11 shrink-0">底色</span>
        <button
          v-for="c in BGS"
          :key="c"
          class="w-4 h-4 rounded border hover:scale-110 transition-transform"
          :class="store.brushBg?.toLowerCase() === c.toLowerCase() ? 'border-mf-primary ring-1 ring-mf-primary ring-offset-1' : 'border-black/10'"
          :style="{ background: c }"
          :title="`块底色 ${c}（深色横幅/卡片/要点/引用通用）`"
          @click="applyBg(c)"
        ></button>
        <label class="w-4 h-4 rounded border border-dashed border-mf-ink-4 cursor-pointer flex items-center justify-center text-[8px] text-mf-ink-4 hover:border-mf-primary hover:text-mf-primary transition-colors" title="自定义块底色">
          ＋<input type="color" class="w-0 h-0 opacity-0 absolute" @input="applyBg(($event.target as HTMLInputElement).value)" />
        </label>
        <button
          class="px-1.5 py-0.5 rounded border text-[10px] transition-colors"
          :class="store.brushBg ? 'border-mf-line-2 text-mf-ink-3 hover:border-mf-primary hover:text-mf-primary' : 'border-mf-primary text-mf-primary'"
          title="不指定底色，用主题默认"
          @click="clearBg"
        >默认</button>
        <span class="text-[10px] ml-1" :class="bgTip ? 'text-mf-primary' : 'text-mf-ink-4'">
          <template v-if="bgTip">{{ bgTip }}</template>
          <template v-else-if="store.brushBg">当前块底色 <b class="font-mono text-mf-ink-3">{{ store.brushBg }}</b></template>
          <template v-else>选中文字上底色；不选则作为模板块底色（横幅不再是死黑）</template>
        </span>
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
            :title="`插入 ${r.symbol}（强调色用当前画笔色）`"
            @click="insertRule(r)"
          >{{ r.symbol }}</button>
        </template>
        <span v-else class="text-[10px] text-mf-ink-4">暂无启用的规则，去设置里添加</span>
        <div class="flex-1"></div>
        <button
          class="w-6 h-6 rounded flex items-center justify-center text-mf-ink-3 hover:bg-mf-primary-soft hover:text-mf-primary transition-colors"
          title="收起格式工具栏"
          @click="emit('toggle')"
        >
          <svg viewBox="0 0 16 16" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4-4 4 4"/></svg>
        </button>
      </div>
    </template>
  </div>
</template>
