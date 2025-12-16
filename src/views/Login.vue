<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">审计数智析 v2</h1>
      <p class="login-subtitle">Audit Intelligence Platform</p>

      <!-- Login Form -->
      <form v-if="!showRegister" @submit.prevent="handleLogin" class="login-form">
        <h2>登录 / Login</h2>

        <div class="form-group">
          <label for="username">用户名 / Username</label>
          <input
            id="username"
            v-model="loginForm.username"
            type="text"
            placeholder="Enter username"
            required
            autocomplete="username"
            :disabled="authStore.loading"
          />
        </div>

        <div class="form-group">
          <label for="password">密码 / Password</label>
          <input
            id="password"
            v-model="loginForm.password"
            type="password"
            placeholder="Enter password"
            required
            autocomplete="current-password"
            :disabled="authStore.loading"
          />
        </div>

        <div v-if="authStore.error" class="error-message">
          {{ authStore.error }}
        </div>

        <button
          type="submit"
          class="btn-primary"
          :disabled="authStore.loading"
        >
          {{ authStore.loading ? '登录中...' : '登录 / Login' }}
        </button>

        <div class="form-footer">
          <span>没有账号？</span>
          <a href="#" @click.prevent="showRegister = true">注册</a>
        </div>
      </form>

      <!-- Register Form -->
      <form v-else @submit.prevent="handleRegister" class="login-form">
        <h2>注册 / Register</h2>

        <div class="form-group">
          <label for="reg-username">用户名 / Username *</label>
          <input
            id="reg-username"
            v-model="registerForm.username"
            type="text"
            placeholder="3-50 characters, alphanumeric"
            required
            pattern="[a-zA-Z0-9_-]{3,50}"
            :disabled="authStore.loading"
          />
          <small>3-50 个字符，字母、数字、短划线、下划线</small>
        </div>

        <div class="form-group">
          <label for="reg-email">邮箱 / Email *</label>
          <input
            id="reg-email"
            v-model="registerForm.email"
            type="email"
            placeholder="user@example.com"
            required
            :disabled="authStore.loading"
          />
        </div>

        <div class="form-group">
          <label for="reg-password">密码 / Password *</label>
          <input
            id="reg-password"
            v-model="registerForm.password"
            type="password"
            placeholder="Minimum 8 characters"
            required
            minlength="8"
            :disabled="authStore.loading"
          />
          <small>至少 8 个字符</small>
        </div>

        <div class="form-group">
          <label for="reg-fullname">姓名 / Full Name</label>
          <input
            id="reg-fullname"
            v-model="registerForm.full_name"
            type="text"
            placeholder="Optional"
            :disabled="authStore.loading"
          />
        </div>

        <div v-if="authStore.error" class="error-message">
          {{ authStore.error }}
        </div>

        <button
          type="submit"
          class="btn-primary"
          :disabled="authStore.loading"
        >
          {{ authStore.loading ? '注册中...' : '注册 / Register' }}
        </button>

        <div class="form-footer">
          <span>已有账号？</span>
          <a href="#" @click.prevent="showRegister = false">登录</a>
        </div>
      </form>

      <!-- Default Admin Notice -->
      <div class="default-admin-notice">
        <strong>⚠️ 默认管理员账号 / Default Admin:</strong><br>
        Username: <code>admin</code> | Password: <code>0000</code><br>
        <small>⚠️ 首次登录后请立即修改密码！</small>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const showRegister = ref(false)

const loginForm = ref({
  username: '',
  password: ''
})

const registerForm = ref({
  username: '',
  email: '',
  password: '',
  full_name: ''
})

onMounted(() => {
  // If already authenticated, redirect to home
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})

async function handleLogin() {
  const success = await authStore.login(loginForm.value)
  
  if (success) {
    // Redirect to home page
    const redirect = router.currentRoute.value.query.redirect as string
    router.push(redirect || '/')
  }
}

async function handleRegister() {
  const success = await authStore.register(registerForm.value)
  
  if (success) {
    // Redirect to home page after successful registration
    router.push('/')
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  padding: 40px;
  width: 100%;
  max-width: 450px;
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin: 0 0 8px 0;
  text-align: center;
}

.login-subtitle {
  font-size: 14px;
  color: #666;
  margin: 0 0 32px 0;
  text-align: center;
}

.login-form h2 {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin: 0 0 24px 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.form-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-group small {
  display: block;
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.error-message {
  background-color: #fee;
  border: 1px solid #fcc;
  color: #c33;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 16px;
}

.btn-primary {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.3s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #666;
}

.form-footer a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  margin-left: 8px;
}

.form-footer a:hover {
  text-decoration: underline;
}

.default-admin-notice {
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 16px;
  margin-top: 24px;
  font-size: 13px;
  color: #856404;
}

.default-admin-notice code {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}
</style>
