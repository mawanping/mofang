<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEditorStore } from '../stores/editor'
import { listAssets, putAsset, deleteAsset, uid, type AssetRecord } from '../stores/db'
import { COVER_SPECS, makeCover, type CoverRatio } from '../ai/cover'
import { primeAssetCache, copyImageToClipboard, invalidateAssetCache } from '../utils/assets'

const store = useEditorStore()
const assets = ref<AssetRecord[]>([])
const urls = ref<Map<string, string>>(new Map())
const dragging = ref(false)
/** 操作反馈（复制图片等） */
const hint = ref('')

/* ---------- 封面生成 ---------- */
const showCover = ref(false)
const coverPrompt = ref('')
const coverBusy = ref<CoverRatio | ''>('')
const coverErr = ref('')
const coverFresh = ref<Map<CoverRatio, string>>(new Map())
const hasKey = computed(() => store.aiProvider === 'pollinations' || !!store.aiApiKey)

async function load() {
  assets.value = await listAssets()
  urls.value = new Map(assets.value.map((a) => [a.id, URL.createObjectURL(a.blob)]))
}

async function onFiles(files: FileList | null) {
  if (!files) return
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('image/')) continue
    const a: AssetRecord = {
      id: uid(),
      name: f.name,
      blob: f,
      type: f.type,
      size: f.size,
      createdAt: Date.now(),
    }
    await putAsset(a)
    await primeAssetCache(a.id, f)
  }
  await load()
}

function onDrop(e: DragEvent) {
  dragging.value = false
  onFiles(e.dataTransfer?.files ?? null)
}

function insertAtCursor(asset: AssetRecord) {
  const md = `\n![${asset.name}](asset:${asset.id})\n`
  const editor = (window as unknown as { __mfEditor?: { insert: (t: string) => void } }).__mfEditor
  if (editor) editor.insert(md)
}

function copyRef(a: AssetRecord) {
  navigator.clipboard.writeText(`![${a.name}](asset:${a.id})`)
}

/** 复制图片本体，可直接粘进公众号编辑器 */
async function copyImage(a: AssetRecord) {
  const ok = await copyImageToClipboard(a.blob)
  hint.value = ok ? '图片已复制，去公众号 Ctrl+V' : '浏览器不支持写图片剪贴板'
  window.setTimeout(() => (hint.value = ''), 2200)
}

async function removeAsset(id: string) {
  await deleteAsset(id)
  invalidateAssetCache(id)
  await load()
}

function fmtSize(n: number): string {
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

/** 生成封面并直接入库 */
async function gen(ratio: CoverRatio) {
  const p = coverPrompt.value.trim()
  if (!p || coverBusy.value) return
  coverBusy.value = ratio
  coverErr.value = ''
  try {
    await makeCover(p, ratio)
    coverFresh.value = new Map(coverFresh.value).set(ratio, '1')
    await load()
  } catch (e) {
    coverErr.value = (e as Error).message
  } finally {
    coverBusy.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="px-2.5 py-2 border-b border-mf-line flex items-center justify-between shrink-0">
      <span class="text-[11px] font-medium text-mf-ink-2">素材库</span>
      <div class="flex items-center gap-2.5">
        <button
          class="text-[11px] transition-colors"
          :class="showCover ? 'text-mf-primary font-medium' : 'text-mf-primary hover:underline'"
          @click="showCover = !showCover"
        >{{ showCover ? '收起封面生成' : '封面生成' }}</button>
        <label class="text-[11px] text-mf-ink-3 cursor-pointer hover:text-mf-primary">
          上传
          <input type="file" accept="image/*" multiple class="hidden" @change="onFiles(($event.target as HTMLInputElement).files)" />
        </label>
      </div>
    </div>

    <!-- 封面生成 -->
    <div v-if="showCover" class="mx-2.5 mt-2 rounded-md border border-mf-primary/30 bg-mf-primary-soft/40 p-2 shrink-0">
      <p class="text-[10.5px] text-mf-ink-3 leading-relaxed mb-1.5">
        AI 生成公众号封面：<b class="text-mf-ink-2">2.35:1</b> 头条（900×383）/ <b class="text-mf-ink-2">1:1</b> 次条，生成后自动存入素材库。
      </p>
      <textarea
        v-model="coverPrompt"
        rows="2"
        class="w-full px-2 py-1.5 rounded-md border border-mf-line bg-white text-[11px] leading-relaxed outline-none focus:border-mf-primary resize-none"
        placeholder="描述封面画面，例如：青绿山水间一只仙鹤掠过"
      />
      <div class="flex gap-1.5 mt-1.5">
        <button
          v-for="s in COVER_SPECS"
          :key="s.ratio"
          class="flex-1 py-1 rounded-md text-[10.5px] transition-colors border"
          :class="coverFresh.has(s.ratio) ? 'border-mf-primary bg-mf-primary text-white' : 'border-mf-line-2 text-mf-ink-2 hover:border-mf-primary hover:text-mf-primary'"
          :disabled="!!coverBusy || !coverPrompt.trim()"
          :title="`生成 ${s.name}（${s.label}）`"
          @click="gen(s.ratio)"
        >
          {{ coverBusy === s.ratio ? '生成中…' : coverFresh.has(s.ratio) ? `${s.name} 已入库` : `生成${s.name}` }}
        </button>
      </div>
      <p v-if="!hasKey" class="text-[10px] text-amber-700 mt-1.5">
        当前渠道 <b>{{ store.aiProvider }}</b> 需要 API Key，请到设置里填写。
      </p>
      <p v-if="coverErr" class="text-[10px] text-red-600 mt-1.5">{{ coverErr }}</p>
    </div>

    <div
      class="mx-2.5 my-2 rounded-md border border-dashed px-2 py-4 text-center text-[11px] transition-colors shrink-0"
      :class="dragging ? 'border-mf-primary bg-mf-primary-soft text-mf-primary' : 'border-mf-line-2 text-mf-ink-4'"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      拖图片到这里收集
    </div>

    <div class="mf-scroll flex-1 px-2.5 pb-3">
      <p v-if="hint" class="text-[10.5px] text-mf-primary mb-1.5">{{ hint }}</p>
      <div v-for="a in assets" :key="a.id" class="group relative mb-2">
        <img :src="urls.get(a.id)" class="w-full h-20 object-cover rounded-md border border-mf-line" :alt="a.name" />
        <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-1 flex-wrap px-1">
          <button class="px-1.5 py-0.5 rounded bg-white text-[10px] text-mf-ink" title="插入到光标处" @click="insertAtCursor(a)">插入</button>
          <button class="px-1.5 py-0.5 rounded bg-white text-[10px] text-mf-ink" title="复制图片本体，可粘进公众号" @click="copyImage(a)">复制图</button>
          <button class="px-1.5 py-0.5 rounded bg-white text-[10px] text-mf-ink" title="复制 Markdown 引用" @click="copyRef(a)">引用</button>
          <button class="px-1.5 py-0.5 rounded bg-white text-[10px] text-red-600" @click="removeAsset(a.id)">删</button>
        </div>
        <p class="text-[10px] text-mf-ink-4 mt-0.5 truncate">{{ a.name }} · {{ fmtSize(a.size) }}</p>
      </div>
      <p v-if="!assets.length" class="text-[11px] text-mf-ink-4 text-center py-5">暂无素材</p>
    </div>
  </div>
</template>