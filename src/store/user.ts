/**
 * 用户状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { PlatformAdapter } from '@/utils/platform';
import * as authApi from '@/api/auth';

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref('');
  const userInfo = ref<any>(null);
  const isLoggedIn = computed(() => !!token.value);

  // 初始化（从本地存储恢复）
  async function init() {
    const savedToken = await PlatformAdapter.getStorage('token');
    const savedUserInfo = await PlatformAdapter.getStorage('userInfo');

    if (savedToken) {
      token.value = savedToken;
      userInfo.value = savedUserInfo;
    }
  }

  // 登录
  async function login(loginData: { token: string; userInfo: any }) {
    token.value = loginData.token;
    userInfo.value = loginData.userInfo;

    // 保存到本地存储
    await PlatformAdapter.setStorage('token', loginData.token);
    await PlatformAdapter.setStorage('userInfo', loginData.userInfo);
  }

  // 退出登录
  async function logout() {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('退出登录失败:', error);
    } finally {
      token.value = '';
      userInfo.value = null;

      await PlatformAdapter.removeStorage('token');
      await PlatformAdapter.removeStorage('userInfo');
    }
  }

  // 更新用户信息
  async function updateUserInfo(data: any) {
    userInfo.value = { ...userInfo.value, ...data };
    await PlatformAdapter.setStorage('userInfo', userInfo.value);
  }

  // 刷新用户信息
  async function refreshUserInfo() {
    try {
      const data = await authApi.getUserInfo();
      await updateUserInfo(data);
      return data;
    } catch (error) {
      console.error('刷新用户信息失败:', error);
      throw error;
    }
  }

  return {
    // 状态
    token,
    userInfo,
    isLoggedIn,

    // 方法
    init,
    login,
    logout,
    updateUserInfo,
    refreshUserInfo
  };
});
