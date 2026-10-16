<script setup lang="ts">
import { ref } from 'vue'
import { useEditorStore } from '../stores/editor'
import { DEFAULT_RULES, type CustomRule } from '../markdown/customRules'
import { invalidateParsers } from '../markdown/render'
import { dirSupported, pickSaveDir } from '../utils/exporters'
import { listTodos, putTodo, deleteTodo, uid, type TodoRecord } from '../stores/db'

const store = useEditorStore()
const tab = ref<'syntax' | 'ai' | 'about'>('syntax')

const rules = ref<CustomRule[]>(JSON.parse(JSON.stringify(store.customRules)))

function addRule() {
  rules.value.push({
    id: uid(),
    symbol: ':::note',
    component: 'tip',
    label: '提示',
    enabled: true,
  })
}

function removeRule(id: string) {
  rules.value = rules.value.filter((r) => r.id !== id)
}

async function saveRules() {
  await store.saveRules(rules.value)
  invalidateParsers()
}

function resetRules() {
  rules.value = JSON.parse(JSON.stringify(DEFAULT_RULES))
}

/* 待办 */
const todos = ref<TodoRecord[]>([])
const todoText = ref('')

async function loadTodos() {
  todos.value = await listTodos()
}

async function addTodo() {
  const t = todoText.value.trim()
  if (!t) return
  await putTodo({ id: uid(), text: t, done: false, createdAt: Date.now() })
  todoText.value = ''
  await loadTodos()
}

async function toggleTodo(t: TodoRecord) {
  await putTodo({ ...t, done: !t.done })
  await loadTodos()
}

async function delTodo(id: string) {
  await deleteTodo(id)
  await loadTodos()
}

async function chooseDir() {
  const ok = await pickSaveDir()
  if (ok) alert('已记住保存文件夹，之后点「保存」直接写入')
}
</script>

<template>
  <div class="fixed top-12 right-0 bottom-0 w-[380px] bg-mf-card border-l border-mf-line shadow-xl mf-slide z-40 flex flex-col">
    <div class="h-11 px-3 flex items-center justify-between border-b border-mf-line shrink-0">
      <span class="text-[13px] font-medium">设置</span>
      <button class="text-mf-ink-3 hover:text-mf-ink text-base leading-none" @click="store.settingsOpen = false">×</button>
    </div>

    <div class="flex border-b border-mf-line shrink-0">
      <button
        v-for="t in [['syntax','自定义符号'],['ai','AI 与保存'],['about','关于']]"
        :key="t[0]"
        class="flex-1 py-2 text-[12px] transition-colors"
        :class="tab === t[0] ? 'text-mf-primary font-medium border-b-2 border-mf-primary' : 'text-mf-ink-3'"
        @click="tab = t[0] as any; if (t[0] === 'ai') loadTodos()"
      >{{ t[1] }}</button>
    </div>

    <div class="mf-scroll flex-1 p-3.5 space-y-4">
      <!-- 自定义符号 -->
      <div v-if="tab === 'syntax'" class="space-y-3">
        <p class="text-[11.5px] text-mf-ink-2 leading-relaxed">
          输入触发符号即可渲染对应组件。配置即时生效，无需刷新页面。
        </p>
        <div v-for="r in rules" :key="r.id" class="rounded-md border border-mf-line p-2.5 space-y-2">
          <div class="flex items-center gap-2">
            <input v-model="r.symbol" class="w-24 px-2 py-1 rounded border border-mf-line text-[12px] font-mono outline-none focus:border-mf-primary" placeholder=":::note" />
            <select v-model="r.component" class="flex-1 px-2 py-1 rounded border border-mf-line bg-white text-[11.5px] outline-none">
              <option value="quote">彩色引用卡</option>
              <option value="tip">提示条</option>
              <option value="card">主题卡</option>
              <option value="highlight">行内高亮</option>
            </select>
            <label class="flex items-center gap-1 text-[11px] text-mf-ink-3 cursor-pointer">
              <input v-model="r.enabled" type="checkbox" class="accent-mf-primary" />
              启用
            </label>
            <button class="text-mf-ink-4 hover:text-red-500 text-[13px]" @click="removeRule(r.id)">×</button>
          </div>
          <div v-if="r.component === 'tip'" class="flex items-center gap-2">
            <span class="text-[11px] text-mf-ink-3 w-10">标签</span>
            <input v-model="r.label" class="flex-1 px-2 py-1 rounded border border-mf-line text-[12px] outline-none" placeholder="提示" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] text-mf-ink-3 w-10">颜色</span>
            <input v-model="r.color" class="flex-1 px-2 py-1 rounded border border-mf-line text-[11.5px] font-mono outline-none" placeholder="留空 = 跟随主色" />
          </div>
        </div>

        <div class="flex gap-2">
          <button class="flex-1 py-1.5 rounded-md border border-mf-line-2 text-[12px] hover:border-mf-primary hover:text-mf-primary transition-colors" @click="addRule">＋ 新建规则</button>
          <button class="flex-1 py-1.5 rounded-md border border-mf-line-2 text-[12px] hover:border-mf-primary hover:text-mf-primary transition-colors" @click="resetRules">恢复默认</button>
        </div>
        <button class="w-full py-2 rounded-md bg-mf-primary text-white text-[13px] font-medium hover:opacity-90 transition-opacity" @click="saveRules">保存并生效</button>
      </div>

      <!-- AI 与保存 -->
      <div v-if="tab === 'ai'" class="space-y-4">
        <div class="space-y-2">
          <p class="text-[12px] font-medium">AI 配图渠道</p>
          <label class="block text-[11px] text-mf-ink-3">API Key（仅存本地）</label>
          <input :value="store.aiApiKey" type="password" class="w-full px-2 py-1.5 rounded-md border border-mf-line text-[12px] outline-none focus:border-mf-primary" @input="store.aiApiKey = ($event.target as HTMLInputElement).value" />
          <button class="w-full py-1.5 rounded-md border border-mf-line-2 text-[12px] hover:border-mf-primary hover:text-mf-primary transition-colors" @click="store.saveAiConfig()">保存配置</button>
        </div>

        <div class="space-y-2 pt-2 border-t border-mf-line">
          <p class="text-[12px] font-medium">保存位置</p>
          <p class="text-[11px] text-mf-ink-3 leading-relaxed">
            {{ dirSupported() ? '已支持选择本地文件夹保存（Edge / Chrome）' : '当前浏览器不支持文件夹选择，将使用下载方式保存' }}
          </p>
          <button v-if="dirSupported()" class="w-full py-1.5 rounded-md border border-mf-line-2 text-[12px] hover:border-mf-primary hover:text-mf-primary transition-colors" @click="chooseDir">重新选择保存文件夹</button>
        </div>

        <div class="space-y-2 pt-2 border-t border-mf-line">
          <p class="text-[12px] font-medium">写作待办</p>
          <div class="flex gap-1.5">
            <input v-model="todoText" class="flex-1 px-2 py-1.5 rounded-md border border-mf-line text-[12px] outline-none focus:border-mf-primary" placeholder="添加待办，回车" @keyup.enter="addTodo" />
            <button class="px-2.5 py-1.5 rounded-md bg-mf-primary text-white text-[12px]" @click="addTodo">加</button>
          </div>
          <div v-for="t in todos" :key="t.id" class="flex items-center gap-2 group">
            <input :checked="t.done" type="checkbox" class="accent-mf-primary" @change="toggleTodo(t)" />
            <span class="flex-1 text-[12px]" :class="t.done ? 'line-through text-mf-ink-4' : 'text-mf-ink-2'">{{ t.text }}</span>
            <button class="opacity-0 group-hover:opacity-100 text-mf-ink-4 hover:text-red-500 text-[12px]" @click="delTodo(t.id)">×</button>
          </div>
          <p v-if="!todos.length" class="text-[11px] text-mf-ink-4">暂无待办</p>
        </div>
      </div>

      <!-- 关于 -->
      <div v-if="tab === 'about'" class="space-y-2.5 text-[12px] text-mf-ink-2 leading-relaxed">
        <p class="text-[13px] font-medium text-mf-ink">墨坊 MoFang 1.0</p>
        <p>面向公众号创作者的 Markdown 写作工作台。左侧写 Markdown，右侧实时预览公众号效果，一键复制到公众号后台版式不丢。</p>
        <p class="text-[11.5px] text-mf-ink-3">所有数据只存在你自己浏览器的 IndexedDB，不上传任何服务器。</p>
        <div class="pt-2 border-t border-mf-line space-y-1 text-[11.5px] text-mf-ink-3">
          <p><b class="text-mf-ink-2">快捷键</b></p>
          <p>Ctrl+S 保存 · Ctrl+Shift+F 专注模式 · Ctrl+P 导出 PDF</p>
          <p><b class="text-mf-ink-2">内置语法</b></p>
          <p class="font-mono text-[11px] leading-relaxed">==高亮== ++下划线++ ~波浪~ x^2^<br />&gt; [!NOTE] 提示框 · :::tip 容器<br />$公式$ · [TOC] · [^脚注] · :emoji:</p>
        </div>
      </div>
    </div>
  </div>
</template>
