/**
 * Axios Configuration with JWT Interceptor
 * Automatically adds Authorization header and handles token refresh
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/auth'
import router from '../router'

// Base URL from environment or default
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Create axios instance
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - Add JWT token to headers
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authStore = useAuthStore()
    
    // Add Authorization header if token exists
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor - Handle 401 errors and token refresh
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    // #region agent log
    const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh')
    fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'axios-config.ts:44',message:'Response interceptor error',data:{status:error.response?.status,url:originalRequest.url,is_refresh_endpoint:isRefreshEndpoint,already_retried:!!originalRequest._retry},timestamp:Date.now(),sessionId:'debug-session',runId:'auth-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // If 401 Unauthorized and not already retried
    // IMPORTANT: Don't retry if the request itself is /auth/refresh to avoid infinite loop
    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshEndpoint) {
      originalRequest._retry = true
      
      const authStore = useAuthStore()
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'axios-config.ts:52',message:'Attempting token refresh',data:{has_token:!!authStore.token},timestamp:Date.now(),sessionId:'debug-session',runId:'auth-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Try to refresh token
      const refreshed = await authStore.refreshToken()
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'axios-config.ts:58',message:'Token refresh result',data:{refreshed,has_token_after:!!authStore.token},timestamp:Date.now(),sessionId:'debug-session',runId:'auth-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      if (refreshed && originalRequest.headers) {
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${authStore.token}`
        return apiClient(originalRequest)
      } else {
        // Refresh failed, logout and redirect to login
        authStore.clearAuth()
        router.push({
          path: '/login',
          query: { redirect: router.currentRoute.value.fullPath }
        })
        return Promise.reject(error)
      }
    }
    
    // For other errors, just reject
    return Promise.reject(error)
  }
)

// Set default axios instance
axios.defaults.baseURL = BASE_URL
axios.defaults.timeout = 30000

export default apiClient
export { BASE_URL }
