/**
 * Authentication Store - Pinia
 * Manages user authentication state, JWT tokens, and login/logout
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/axios-config'

export interface User {
  id: string
  username: string
  email: string
  full_name?: string
  is_active: boolean
  is_superuser: boolean
  created_at: string
  last_login?: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
  full_name?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export const useAuthStore = defineStore('auth', () => {
  // State
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.is_superuser ?? false)

  // Actions
  
  /**
   * Login with username and password
   */
  async function login(credentials: LoginCredentials): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      // OAuth2 password flow requires form data
      const formData = new URLSearchParams()
      formData.append('username', credentials.username)
      formData.append('password', credentials.password)

      const response = await apiClient.post<TokenResponse>(
        '/auth/login',
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      const { access_token, expires_in } = response.data

      // Save token
      token.value = access_token
      localStorage.setItem(TOKEN_KEY, access_token)

      // Set token expiration timer
      setTokenExpirationTimer(expires_in)

      // Fetch user info
      await fetchUserInfo()

      loading.value = false
      return true
    } catch (err: any) {
      loading.value = false
      error.value = err.response?.data?.detail || 'Login failed'
      console.error('Login error:', err)
      return false
    }
  }

  /**
   * Register new user
   */
  async function register(data: RegisterData): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      await apiClient.post('/auth/register', data)
      
      // Auto-login after registration
      const loginSuccess = await login({
        username: data.username,
        password: data.password
      })

      loading.value = false
      return loginSuccess
    } catch (err: any) {
      loading.value = false
      error.value = err.response?.data?.detail || 'Registration failed'
      console.error('Registration error:', err)
      return false
    }
  }

  /**
   * Logout current user
   */
  async function logout() {
    try {
      // Call logout endpoint (for audit logging)
      if (token.value) {
        await apiClient.post('/auth/logout')
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      // Clear state regardless of API call success
      clearAuth()
    }
  }

  /**
   * Fetch current user information
   */
  async function fetchUserInfo(): Promise<void> {
    if (!token.value) {
      return
    }

    try {
      const response = await apiClient.get<User>('/auth/me')
      user.value = response.data
      localStorage.setItem(USER_KEY, JSON.stringify(response.data))
    } catch (err) {
      console.error('Failed to fetch user info:', err)
      clearAuth()
      throw err
    }
  }

  /**
   * Refresh access token
   */
  async function refreshToken(): Promise<boolean> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:165',message:'refreshToken called',data:{has_token:!!token.value},timestamp:Date.now(),sessionId:'debug-session',runId:'auth-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!token.value) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:168',message:'No token to refresh',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'auth-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return false
    }

    try {
      const response = await apiClient.post<TokenResponse>('/auth/refresh')
      const { access_token, expires_in } = response.data

      token.value = access_token
      localStorage.setItem(TOKEN_KEY, access_token)
      setTokenExpirationTimer(expires_in)

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:178',message:'Token refresh successful',data:{expires_in},timestamp:Date.now(),sessionId:'debug-session',runId:'auth-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      return true
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:182',message:'Token refresh failed',data:{status:err.response?.status,message:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'auth-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.error('Token refresh failed:', err)
      clearAuth()
      return false
    }
  }

  /**
   * Update current user profile
   */
  async function updateProfile(updates: Partial<RegisterData>): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.put<User>('/auth/me', updates)
      user.value = response.data
      localStorage.setItem(USER_KEY, JSON.stringify(response.data))
      
      loading.value = false
      return true
    } catch (err: any) {
      loading.value = false
      error.value = err.response?.data?.detail || 'Update failed'
      console.error('Update profile error:', err)
      return false
    }
  }

  /**
   * Initialize auth state from localStorage
   */
  function initializeAuth() {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedUser = localStorage.getItem(USER_KEY)

    if (savedToken && savedUser) {
      token.value = savedToken
      try {
        user.value = JSON.parse(savedUser)
      } catch (err) {
        console.error('Failed to parse saved user:', err)
        clearAuth()
      }
    }
  }

  /**
   * Clear authentication state
   */
  function clearAuth() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    clearTokenExpirationTimer()
  }

  /**
   * Set timer to auto-refresh token before expiration
   */
  let tokenExpirationTimer: number | null = null

  function setTokenExpirationTimer(expiresIn: number) {
    clearTokenExpirationTimer()

    // Refresh token 1 minute before expiration
    const refreshTime = (expiresIn - 60) * 1000
    
    if (refreshTime > 0) {
      tokenExpirationTimer = window.setTimeout(() => {
        refreshToken()
      }, refreshTime)
    }
  }

  function clearTokenExpirationTimer() {
    if (tokenExpirationTimer !== null) {
      clearTimeout(tokenExpirationTimer)
      tokenExpirationTimer = null
    }
  }

  /**
   * Check if token is valid (not expired)
   */
  function isTokenValid(): boolean {
    // Simple check - token exists
    // Could decode JWT to check exp claim
    return !!token.value
  }

  return {
    // State
    token,
    user,
    loading,
    error,
    
    // Computed
    isAuthenticated,
    isAdmin,
    
    // Actions
    login,
    register,
    logout,
    fetchUserInfo,
    refreshToken,
    updateProfile,
    initializeAuth,
    clearAuth,
    isTokenValid
  }
})
