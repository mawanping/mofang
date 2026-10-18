<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useEditorStore } from '../stores/editor'
import { listAssets, type AssetRecord } from '../stores/db'
import { COVER_SPECS, generateCover, saveCoverToAssets, type CoverRatio } from '../ai/cover'

const store = useEditorStore()
const assets = ref<AssetRecord[]>([])
const prompt = ref('')
const busy = ref<CoverRatio | ''>('')
const err = ref('')
const result = ref<Map<CoverRatio, string>>(new Map())

async function load() {
  assets.value = await listAssets()
}

async function gen(which: CoverRatio) {
  const p = prompt.value.trim()
  if (!p || busy.value) return
  busy.value = which
  err.value = ''
  try {
    const url = await generateCover(p, which)
    result.value = new Map(result.value).set(which, url)
  } catch (e) {
    err.value = (e as Error).message
  } finally {
    busy.value = ''
  }
}

async function useAs(ratio: CoverRatio) {
  const url = result.value.get(ratio)
  if (!url) return
  await saveCoverToAssets(url, ratio)
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
          公众号封面两种尺寸：头条 2.35:1（900×383），次条 1:1。AI 生成后可一键存入素材库（素材库内也新增了「封面生成」入口，两边同源）。
        </p>
        <div class="flex gap-2">
          <input v-model="prompt" class="flex-1 px-2.5 py-1.5 rounded-md border border-mf-line text-[12px] outline-none focus:border-mf-primary" placeholder="描述封面画面，例如：青绿山水间一只仙鹤掠过" @keyup.enter="gen('big')" />
          <button class="px-3 py-1.5 rounded-md bg-mf-primary text-white text-[12px] disabled:opacity-50" :disabled="!!busy || !prompt.trim()" @click="gen('big')">{{ busy === 'big' ? '…' : '生成头条' }}</button>
          <button class="px-3 py-1.5 rounded-md border border-mf-line-2 text-[12px] disabled:opacity-50" :disabled="!!busy || !prompt.trim()" @click="gen('square')">{{ busy === 'square' ? '…' : '生成方图' }}</button>
        </div>
        <p v-if="err" class="text-[11px] text-red-600">{{ err }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div v-for="s in COVER_SPECS" :key="s.ratio" class="bg-mf-card rounded-lg border border-mf-line p-3">
          <p class="text-[11px] text-mf-ink-3 mb-2">{{ s.label }} {{ s.name }}</p>
          <div class="rounded-md bg-mf-app border border-mf-line overflow-hidden flex items-center justify-center" :style="{ aspectRatio: s.css }">
            <img v-if="result.get(s.ratio)" :src="result.get(s.ratio)" class="w-full h-full object-cover" />
            <span v-else class="text-[11px] text-mf-ink-4">未生成</span>
          </div>
          <button v-if="result.get(s.ratio)" class="mt-2 w-full py-1.5 rounded-md border border-mf-line-2 text-[12px] hover:border-mf-primary hover:text-mf-primary" @click="useAs(s.ratio)">存入素材库</button>
        </div>
      </div>

      <div class="bg-mf-card rounded-lg border border-mf-line p-4">
        <p class="text-[12px] text-mf-ink-3 mb-2">素材库中的封面（{{ assets.filter((a) => a.name.startsWith('封面-')).length }} 张）</p>
        <div class="grid grid-cols-4 gap-2">
          <img v-for="a in assets.filter((x) => x.name.startsWith('封面-'))" :key="a.id" class="w-full h-14 object-cover rounded border border-mf-line" :alt="a.name" />
          <p v-if="!assets.filter((a) => a.name.startsWith('封面-')).length" class="text-[11px] text-mf-ink-4 col-span-4">还没有封面素材</p>
        </div>
      </div>
    </div>
  </div>
</template>