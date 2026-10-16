<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '../stores/editor'
import { PROVIDERS, RATIOS, DEFAULT_PRESETS, applyTemplate, generateImage } from '../ai/providers'
import { putAsset, uid, type AssetRecord } from '../stores/db'

const store = useEditorStore()

const prompt = ref('')
const presetId = ref(DEFAULT_PRESETS[0].id)
const ratio = ref('1:1')
const count = ref(2)
const busy = ref(false)
const err = ref('')
const results = ref<{ url: string; provider: string }[]>([])
const localUrls = ref<Map<string, string>>(new Map())

const providerOptions = computed(() =>
  PROVIDERS.map((p) => ({ id: p.id, name: p.name, needsKey: p.needsKey, free: p.free })),
)

const activeProvider = computed(() => PROVIDERS.find((p) => p.id === store.aiProvider) ?? PROVIDERS[0])

const preset = computed(() => DEFAULT_PRESETS.find((p) => p.id === presetId.value) ?? DEFAULT_PRESETS[0])

function applyPreset() {
  const t = prompt.value.trim() || '主题'
  prompt.value = applyTemplate(preset.value.template, t)
}

async function generate() {
  if (!prompt.value.trim() || busy.value) return
  busy.value = true
  err.value = ''
  results.value = []
  const [w, h] = RATIOS[ratio.value] ?? RATIOS['1:1']
  const need = Number(count.value) || 1
  for (let i = 0; i < need; i++) {
    try {
      const r = await generateImage({
        provider: activeProvider.value.id,
        prompt: prompt.value,
        negative: preset.value.negative,
        width: w,
        height: h,
        apiKey: store.aiApiKey || undefined,
        model: store.aiModel || activeProvider.value.models[0],
        seed: Math.floor(Math.random() * 1e6),
      })
      results.value.push(r)
    } catch (e) {
      err.value = (e as Error).message
      break
    }
  }
  busy.value = false
}

async function useImage(r: { url: string }) {
  try {
    const res = await fetch(r.url)
    const blob = await res.blob()
    const id = uid()
    const a: AssetRecord = {
      id,
      name: `ai-${id}.png`,
      blob,
      type: blob.type || 'image/png',
      size: blob.size,
      createdAt: Date.now(),
    }
    await putAsset(a)
    localUrls.value.set(id, URL.createObjectURL(blob))
    const editor = (window as unknown as { __mfEditor?: { insert: (t: string) => void } }).__mfEditor
    editor?.insert(`\n![AI 配图](asset:${id})\n`)
    store.aiPanelOpen = false
  } catch {
    err.value = '图片保存失败，请重试'
  }
}

function saveConfig() {
  store.saveAiConfig()
}
</script>

<template>
  <div class="fixed top-12 right-0 bottom-0 w-[340px] bg-mf-card border-l border-mf-line shadow-xl mf-slide z-40 flex flex-col">
    <div class="h-11 px-3 flex items-center justify-between border-b border-mf-line shrink-0">
      <span class="text-[13px] font-medium">AI 配图</span>
      <button class="text-mf-ink-3 hover:text-mf-ink text-base leading-none" @click="store.aiPanelOpen = false">×</button>
    </div>

    <div class="mf-scroll flex-1 p-3 space-y-3">
      <div>
        <label class="block text-[11px] text-mf-ink-3 mb-1">Skill 预设</label>
        <div class="flex gap-1.5">
          <select v-model="presetId" class="flex-1 px-2 py-1.5 rounded-md border border-mf-line bg-white text-[12px] outline-none focus:border-mf-primary">
            <option v-for="p in DEFAULT_PRESETS" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <button class="px-2 py-1.5 rounded-md border border-mf-line-2 text-[11px] hover:border-mf-primary hover:text-mf-primary transition-colors" @click="applyPreset">套用</button>
        </div>
      </div>

      <div>
        <label class="block text-[11px] text-mf-ink-3 mb-1">提示词</label>
        <textarea
          v-model="prompt"
          rows="4"
          class="w-full px-2.5 py-2 rounded-md border border-mf-line bg-white text-[12px] leading-relaxed outline-none focus:border-mf-primary resize-none"
          placeholder="描述你想要的画面，例如：一只仙鹤掠过青绿山水，扁平色块"
        ></textarea>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div>
          <label class="block text-[11px] text-mf-ink-3 mb-1">比例</label>
          <select v-model="ratio" class="w-full px-2 py-1.5 rounded-md border border-mf-line bg-white text-[12px] outline-none">
            <option v-for="(_, k) in RATIOS" :key="k" :value="k">{{ k }}</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] text-mf-ink-3 mb-1">数量</label>
          <select v-model.number="count" class="w-full px-2 py-1.5 rounded-md border border-mf-line bg-white text-[12px] outline-none">
            <option :value="1">1</option><option :value="2">2</option><option :value="4">4</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] text-mf-ink-3 mb-1">渠道</label>
          <select v-model="store.aiProvider" class="w-full px-2 py-1.5 rounded-md border border-mf-line bg-white text-[12px] outline-none" @change="saveConfig">
            <option v-for="p in providerOptions" :key="p.id" :value="p.id">{{ p.free ? '免费 · ' : '' }}{{ p.name.split('（')[0] }}</option>
          </select>
        </div>
      </div>

      <div v-if="activeProvider.needsKey" class="rounded-md bg-amber-50 border border-amber-200 p-2.5">
        <label class="block text-[11px] text-amber-800 mb-1">{{ activeProvider.name }} 需要 API Key</label>
        <div class="flex gap-1.5">
          <input
            :value="store.aiApiKey"
            type="password"
            class="flex-1 px-2 py-1 rounded border border-amber-200 bg-white text-[11.5px] outline-none"
            placeholder="sk-..."
            @input="store.aiApiKey = ($event.target as HTMLInputElement).value"
          />
          <button class="px-2 py-1 rounded bg-amber-600 text-white text-[11px]" @click="saveConfig">存</button>
        </div>
        <p class="text-[10px] text-amber-700 mt-1 leading-snug">Key 只存在你自己浏览器，不经过任何服务器</p>
      </div>

      <button
        class="w-full py-2 rounded-md bg-mf-primary text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        :disabled="busy || !prompt.trim()"
        @click="generate"
      >{{ busy ? '生成中…' : '生成' }}</button>

      <p v-if="err" class="text-[11px] text-red-600 leading-snug">{{ err }}</p>

      <div v-if="results.length" class="space-y-2">
        <p class="text-[11px] text-mf-ink-3">生成结果（点图即插入光标处）</p>
        <div v-for="(r, i) in results" :key="i" class="group relative rounded-md overflow-hidden border border-mf-line">
          <img :src="r.url" class="w-full block" />
          <button
            class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[12px]"
            @click="useImage(r)"
          >点击插入文章</button>
        </div>
      </div>

      <div v-else-if="!busy" class="rounded-md bg-mf-app p-3 text-[11px] text-mf-ink-3 leading-relaxed">
        免费通道（Pollinations）无需配置，直接点「生成」即可出图。<br />
        需要更高质量或特定风格时，在右上角「设置」里切换渠道并填入自己的 API Key。
      </div>
    </div>
  </div>
</template>
