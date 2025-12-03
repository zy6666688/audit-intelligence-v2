<template>
  <view class="page">
    <view class="container">
      <view class="logo">
        <image src="/static/logo.png" mode="aspectFit"></image>
      </view>
      <text class="app-name">审计数智析</text>
      <text class="app-desc">AI赋能专业审计</text>

      <!-- 小程序登录 -->
      <!-- #ifdef MP-WEIXIN -->
      <button class="login-btn primary" @click="handleWxLogin" :loading="loading">
        <text>微信一键登录</text>
      </button>
      <!-- #endif -->

      <!-- H5登录 -->
      <!-- #ifdef H5 -->
      <view class="form">
        <view class="form-item">
          <input 
            v-model="form.username" 
            type="text" 
            placeholder="请输入账号"
            placeholder-class="placeholder"
          />
        </view>
        <view class="form-item">
          <input 
            v-model="form.password" 
            type="password" 
            placeholder="请输入密码"
            placeholder-class="placeholder"
          />
        </view>
        <button class="login-btn primary" @click="handlePasswordLogin" :loading="loading">
          <text>登录</text>
        </button>
        <button class="login-btn secondary" @click="handleWxWorkLogin" :loading="loading">
          <text>企业微信登录</text>
        </button>
      </view>
      <!-- #endif -->

      <view class="footer">
        <text class="tips">登录即表示同意</text>
        <text class="link" @click="showAgreement">《用户协议》</text>
        <text class="tips">和</text>
        <text class="link" @click="showPrivacy">《隐私政策》</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { PlatformAdapter } from '@/utils/platform';
import { passwordLogin } from '@/api/auth';

// 表单数据
const form = ref({
  username: 'admin@audit.com', // 默认值方便测试
  password: 'admin123'
});

// 加载状态
const loading = ref(false);

// 微信小程序登录
async function handleWxLogin() {
  try {
    loading.value = true;
    
    const result = await PlatformAdapter.login();
    
    // TODO: 调用后端API验证登录
    // const res = await loginApi.wxLogin(result);
    
    // 保存用户信息
    await PlatformAdapter.setStorage('token', 'mock-token-123');
    await PlatformAdapter.setStorage('userInfo', {
      id: '1',
      name: '张审计',
      avatar: '/static/default-avatar.png'
    });
    
    PlatformAdapter.showToast({ title: '登录成功', icon: 'success' });
    
    // 跳转到首页
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' });
    }, 1500);
  } catch (error: any) {
    console.error('登录失败:', error);
    PlatformAdapter.showToast({ 
      title: error.message || '登录失败', 
      icon: 'none' 
    });
  } finally {
    loading.value = false;
  }
}

// 账号密码登录
async function handlePasswordLogin() {
  if (!form.value.username || !form.value.password) {
    PlatformAdapter.showToast({ title: '请输入账号和密码', icon: 'none' });
    return;
  }

  try {
    loading.value = true;
    
    // 调用后端API登录
    const res = await passwordLogin({
      email: form.value.username,
      password: form.value.password
    });
    
    console.log('登录成功:', res);
    
    // 保存用户信息
    await PlatformAdapter.setStorage('token', res.token);
    await PlatformAdapter.setStorage('userInfo', res.user);
    
    PlatformAdapter.showToast({ title: '登录成功', icon: 'success' });
    
    // 跳转到首页
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' });
    }, 1500);
  } catch (error: any) {
    console.error('登录失败:', error);
    PlatformAdapter.showToast({ 
      title: error.message || '登录失败', 
      icon: 'none' 
    });
  } finally {
    loading.value = false;
  }
}

// 企业微信登录
async function handleWxWorkLogin() {
  try {
    loading.value = true;
    
    // TODO: 实现企业微信登录
    PlatformAdapter.showToast({ title: '企业微信登录开发中', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

// 显示用户协议
function showAgreement() {
  PlatformAdapter.showToast({ title: '用户协议页面开发中', icon: 'none' });
}

// 显示隐私政策
function showPrivacy() {
  PlatformAdapter.showToast({ title: '隐私政策页面开发中', icon: 'none' });
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  width: 100%;
  padding: 0 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 40rpx;

  image {
    width: 100%;
    height: 100%;
  }
}

.app-name {
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 20rpx;
}

.app-desc {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 80rpx;
}

.form {
  width: 100%;
  margin-bottom: 40rpx;

  .form-item {
    width: 100%;
    height: 90rpx;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 45rpx;
    padding: 0 40rpx;
    margin-bottom: 30rpx;

    input {
      width: 100%;
      height: 100%;
      font-size: 28rpx;
    }

    .placeholder {
      color: #999;
    }
  }
}

.login-btn {
  width: 100%;
  height: 90rpx;
  border-radius: 45rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  margin-bottom: 30rpx;
  border: none;

  &.primary {
    background: #fff;
    color: #667eea;
    font-weight: bold;
  }

  &.secondary {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    border: 2rpx solid rgba(255, 255, 255, 0.5);
  }

  &::after {
    border: none;
  }
}

.footer {
  margin-top: 60rpx;
  text-align: center;

  .tips {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.7);
  }

  .link {
    font-size: 24rpx;
    color: #fff;
    text-decoration: underline;
  }
}
</style>
