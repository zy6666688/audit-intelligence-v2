import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/main.scss'
import App from './App.vue'
import router from './router'
import './api/axios-config' // Initialize axios interceptors
import { useAuthStore } from './stores/auth'
import { useLanguageStore } from './store/useLanguageStore'
import { translator } from './utils/translator'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)

// Initialize auth state from localStorage
const authStore = useAuthStore()
authStore.initializeAuth()

// Initialize language state from localStorage
const languageStore = useLanguageStore()
translator.setLanguage(languageStore.language)

// Global Error Handler
app.config.errorHandler = (err, instance, info) => {
  console.error('[Global Error Handler]', err, info)
  // Prevent white screen by logging and potentially showing a toast/alert
  // In production, you might want to send this to Sentry/LogRocket
  if (import.meta.env.DEV) {
    console.group('Vue Error')
    console.log('Error:', err)
    console.log('Instance:', instance)
    console.log('Info:', info)
    console.groupEnd()
  }
}

// Global Unhandled Promise Rejection Handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason)
  event.preventDefault()
})

app.mount('#app')
