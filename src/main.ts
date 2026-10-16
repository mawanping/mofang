import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

/* 挂载前应用工作台配色，避免首屏闪烁 */
const wb = localStorage.getItem('mf-wb')
if (wb) document.documentElement.dataset.wb = wb

createApp(App).use(createPinia()).mount('#app')
