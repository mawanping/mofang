<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useEditorStore } from '../stores/editor'
import { listAssets, putAsset, uid, type AssetRecord } from '../stores/db'
import { generateImage } from '../ai/providers'
import { RATIOS } from '../ai/providers'

const store = useEditorStore()
const assets = ref<AssetRecord[]>([])
const urls = ref<Map<string, string>>(new Map())
const prompt = ref('')
const busy = ref(false)
const err = ref('')
const big = ref<{ url: string } | null>(null)
const square = ref<{ url: string } | null>(null)

async function load() {
  assets.value = await listAssets()
  urls.value = new Map(assets.value.map((a) => [a.id, URL.createObjectURL(a.blob)]))
}

async function gen(which: 'big' | 'square') {
  const p = prompt.value.trim()
  if (!p || busy.value) return
  busy.value = true
  err.value = ''
  try {
    const [w, h] = RATIOS[which === 'big' ? '2.35:1' : '1:1']
    const r = await generateImage({
      prompt: `公众号封面图，${p}，横版构图，主体居中，留出上方空间给标题文字，高质量`,
      width: w,
      height: h,
      apiKey: store.aiApiKey || undefined,
      model: store.aiProvider === 'pollinations' ? undefined : (store.aiModel || undefined),
      seed: Math.floor(Math.random() * 1e6),
    })
    if (which === 'big') big.value = r
    else square.value = r
  } catch (e) {
    err.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function useAs(r: { url: string }, label: string) {
  const res = await fetch(r.url)
  const blob = await res.blob()
  const id = uid()
  await putAsset({ id, name: `cover-${label}-${id}.png`, blob, type: blob.type, size: blob.size, createdAt: Date.now() })
  await load()
}

onMounted(load)
</script>

<template>
  <div class="h-full mf-scroll bg-mf-canvas p-4">
    <div class="max-w-3xl mx-auto space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-[15px] font-medium">封面工作台</h2>
        <button class="px-2.5 py-1 rounded-md border border-mf-line-2 text-[12px] hover:border-mf-primary hover:text-mf-primary" @click="store.view = 'write'">返回写作</button>
      </div>

      <div class="bg-mf-card rounded-lg border border-mf-line p-4 space-y-3">
        <p class="text-[12px] text-mf-ink-3 leading-relaxed">
          公众号封面两种尺寸：头条 2.35:1（900×383），次条 1:1。AI 生成后可一键存入素材库。
        </p>
        <div class="flex gap-2">
          <input v-model="prompt" class="flex-1 px-2.5 py-1.5 rounded-md border border-mf-line text-[12px] outline-none focus:border-mf-primary" placeholder="描述封面画面，例如：青绿山水间一只仙鹤掠过" @keyup.enter="gen('big')" />
          <button class="px-3 py-1.5 rounded-md bg-mf-primary text-white text-[12px] disabled:opacity-50" :disabled="busy || !prompt.trim()" @click="gen('big')">{{ busy ? '…' : '生成头条' }}</button>
          <button class="px-3 py-1.5 rounded-md border border-mf-line-2 text-[12px] disabled:opacity-50" :disabled="busy || !prompt.trim()" @click="gen('square')">{{ busy ? '…' : '生成方图' }}</button>
        </div>
        <p v-if="err" class="text-[11px] text-red-600">{{ err }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="bg-mf-card rounded-lg border border-mf-line p-3">
          <p class="text-[11px] text-mf-ink-3 mb-2">2.35 : 1 头条封面</p>
          <div class="aspect-[2.35/1] rounded-md bg-mf-app border border-mf-line overflow-hidden flex items-center justify-center">
            <img v-if="big" :src="big.url" class="w-full h-full object-cover" />
            <span v-else class="text-[11px] text-mf-ink-4">未生成</span>
          </div>
          <button v-if="big" class="mt-2 w-full py-1.5 rounded-md border border-mf-line-2 text-[12px] hover:border-mf-primary hover:text-mf-primary" @click="useAs(big, 'big')">存入素材库</button>
        </div>
        <div class="bg-mf-card rounded-lg border border-mf-line p-3">
          <p class="text-[11px] text-mf-ink-3 mb-2">1 : 1 次条封面</p>
          <div class="aspect-square rounded-md bg-mf-app border border-mf-line overflow-hidden flex items-center justify-center">
            <img v-if="square" :src="square.url" class="w-full h-full object-cover" />
            <span v-else class="text-[11px] text-mf-ink-4">未生成</span>
          </div>
          <button v-if="square" class="mt-2 w-full py-1.5 rounded-md border border-mf-line-2 text-[12px] hover:border-mf-primary hover:text-mf-primary" @click="useAs(square, 'square')">存入素材库</button>
        </div>
      </div>
    </div>
  </div>
</template>
