<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEditorStore } from '../stores/editor'
import { listAssets, putAsset, deleteAsset, uid, type AssetRecord } from '../stores/db'

const store = useEditorStore()
const assets = ref<AssetRecord[]>([])
const urls = ref<Map<string, string>>(new Map())
const dragging = ref(false)

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

function fmtSize(n: number): string {
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

onMounted(load)
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="px-2.5 py-2 border-b border-mf-line flex items-center justify-between shrink-0">
      <span class="text-[11px] font-medium text-mf-ink-2">素材库</span>
      <label class="text-[11px] text-mf-primary cursor-pointer hover:underline">
        上传
        <input type="file" accept="image/*" multiple class="hidden" @change="onFiles(($event.target as HTMLInputElement).files)" />
      </label>
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
      <div v-for="a in assets" :key="a.id" class="group relative mb-2">
        <img :src="urls.get(a.id)" class="w-full h-20 object-cover rounded-md border border-mf-line" :alt="a.name" />
        <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-1.5">
          <button class="px-1.5 py-0.5 rounded bg-white text-[10px] text-mf-ink" @click="insertAtCursor(a)">插入</button>
          <button class="px-1.5 py-0.5 rounded bg-white text-[10px] text-mf-ink" @click="copyRef(a)">复制引用</button>
          <button class="px-1.5 py-0.5 rounded bg-white text-[10px] text-red-600" @click="deleteAsset(a.id).then(load)">删</button>
        </div>
        <p class="text-[10px] text-mf-ink-4 mt-0.5 truncate">{{ a.name }} · {{ fmtSize(a.size) }}</p>
      </div>
      <p v-if="!assets.length" class="text-[11px] text-mf-ink-4 text-center py-5">暂无素材</p>
    </div>
  </div>
</template>
