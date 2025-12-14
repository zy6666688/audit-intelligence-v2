# H5与小程序互通实现方案

## 一、方案概述

### 1.1 技术选型
采用 **uni-app** 框架实现一套代码多端运行：
- 编译为微信小程序（主要使用场景）
- 编译为H5网页（电脑端审核、大屏展示）
- 未来可扩展至App端

### 1.2 互通策略

```
┌─────────────────────────────────────────────────────────┐
│                    统一代码库                            │
│                 (uni-app + Vue3 + TS)                   │
└────────────┬────────────────────┬───────────────────────┘
             │                    │
    ┌────────▼────────┐   ┌──────▼────────┐
    │  编译为小程序    │   │   编译为H5     │
    │  (MP-WEIXIN)    │   │    (H5)       │
    └────────┬────────┘   └──────┬────────┘
             │                    │
             └────────┬───────────┘
                      │
         ┌────────────▼─────────────┐
         │     统一后端API服务       │
         │  - RESTful API           │
         │  - WebSocket             │
         │  - 统一认证/授权          │
         └──────────────────────────┘
```

---

## 二、核心实现

### 2.1 项目结构

```
audit-miniapp/
├── src/
│   ├── pages/                      # 页面
│   │   ├── index/                  # 首页
│   │   ├── project/                # 项目
│   │   ├── workpaper/              # 底稿
│   │   └── profile/                # 个人中心
│   │
│   ├── components/                 # 组件
│   │   ├── common/                 # 通用组件
│   │   ├── node/                   # 节点组件
│   │   └── platform/               # 平台专用组件
│   │       ├── mp/                 # 小程序专用
│   │       └── h5/                 # H5专用
│   │
│   ├── api/                        # API接口
│   │   ├── request.ts              # 请求封装
│   │   ├── project.ts              # 项目API
│   │   └── node.ts                 # 节点API
│   │
│   ├── store/                      # 状态管理 (Pinia)
│   │   ├── user.ts
│   │   ├── project.ts
│   │   └── node.ts
│   │
│   ├── utils/                      # 工具函数
│   │   ├── platform.ts             # 平台适配
│   │   ├── auth.ts                 # 认证工具
│   │   ├── storage.ts              # 存储适配
│   │   └── upload.ts               # 上传适配
│   │
│   ├── types/                      # TypeScript类型
│   │   ├── project.ts
│   │   ├── node.ts
│   │   └── common.ts
│   │
│   ├── static/                     # 静态资源
│   ├── App.vue                     # 应用入口
│   ├── main.ts                     # 主入口
│   ├── manifest.json               # 应用配置
│   └── pages.json                  # 页面配置
│
├── backend/                        # 后端服务
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 三、平台适配层实现

### 3.1 统一适配器

```typescript
// src/utils/platform.ts

/**
 * 平台类型
 */
export type PlatformType = 'mp-weixin' | 'h5' | 'app';

/**
 * 获取当前平台
 */
export function getPlatform(): PlatformType {
  // #ifdef MP-WEIXIN
  return 'mp-weixin';
  // #endif
  
  // #ifdef H5
  return 'h5';
  // #endif
  
  // #ifdef APP
  return 'app';
  // #endif
}

/**
 * 判断是否为小程序
 */
export function isMiniProgram(): boolean {
  return getPlatform() === 'mp-weixin';
}

/**
 * 判断是否为H5
 */
export function isH5(): boolean {
  return getPlatform() === 'h5';
}

/**
 * 平台适配器
 */
export class PlatformAdapter {
  
  /**
   * 统一的登录
   */
  static async login(): Promise<{
    token: string;
    userInfo: any;
  }> {
    // #ifdef MP-WEIXIN
    return this.wxLogin();
    // #endif
    
    // #ifdef H5
    return this.h5Login();
    // #endif
  }
  
  /**
   * 微信小程序登录
   */
  // #ifdef MP-WEIXIN
  private static async wxLogin() {
    // 1. 获取code
    const { code } = await uni.login({ provider: 'weixin' });
    
    // 2. 发送code到后端换取token
    const res = await uni.request({
      url: `${API_BASE}/auth/wx-login`,
      method: 'POST',
      data: { code }
    });
    
    return {
      token: res.data.token,
      userInfo: res.data.userInfo
    };
  }
  // #endif
  
  /**
   * H5登录（扫码或账号密码）
   */
  // #ifdef H5
  private static async h5Login() {
    // 方式1: 企业微信扫码登录
    if (this.isWeChatBrowser()) {
      return this.wxWorkLogin();
    }
    
    // 方式2: 账号密码登录
    return this.passwordLogin();
  }
  
  private static isWeChatBrowser(): boolean {
    const ua = navigator.userAgent.toLowerCase();
    return ua.indexOf('micromessenger') !== -1;
  }
  
  private static async wxWorkLogin() {
    // 企业微信OAuth2.0登录流程
    // ...实现略
  }
  
  private static async passwordLogin() {
    // 账号密码登录
    // ...实现略
  }
  // #endif
  
  /**
   * 统一的文件选择
   */
  static async chooseFile(options: {
    count?: number;
    type?: 'image' | 'video' | 'file';
  }): Promise<File[]> {
    // #ifdef MP-WEIXIN
    return this.wxChooseFile(options);
    // #endif
    
    // #ifdef H5
    return this.h5ChooseFile(options);
    // #endif
  }
  
  // #ifdef MP-WEIXIN
  private static async wxChooseFile(options: any) {
    if (options.type === 'image') {
      const res = await uni.chooseImage({
        count: options.count || 9,
        sourceType: ['album', 'camera']
      });
      return res.tempFilePaths.map(path => ({ path }));
    } else {
      const res = await uni.chooseMessageFile({
        count: options.count || 5,
        type: 'file'
      });
      return res.tempFiles;
    }
  }
  // #endif
  
  // #ifdef H5
  private static async h5ChooseFile(options: any): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = (options.count || 1) > 1;
      
      if (options.type === 'image') {
        input.accept = 'image/*';
      } else if (options.type === 'video') {
        input.accept = 'video/*';
      }
      
      input.onchange = (e: any) => {
        const files = Array.from(e.target.files);
        resolve(files as File[]);
      };
      
      input.click();
    });
  }
  // #endif
  
  /**
   * 统一的文件上传
   */
  static async uploadFile(file: any): Promise<{
    url: string;
    size: number;
    sha256?: string;
  }> {
    // #ifdef MP-WEIXIN
    return this.wxUploadFile(file);
    // #endif
    
    // #ifdef H5
    return this.h5UploadFile(file);
    // #endif
  }
  
  // #ifdef MP-WEIXIN
  private static async wxUploadFile(file: any) {
    const res = await uni.uploadFile({
      url: `${API_BASE}/upload`,
      filePath: file.path,
      name: 'file',
      header: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    return JSON.parse(res.data);
  }
  // #endif
  
  // #ifdef H5
  private static async h5UploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });
    
    return res.json();
  }
  // #endif
  
  /**
   * 统一的本地存储
   */
  static async setStorage(key: string, value: any): Promise<void> {
    // #ifdef MP-WEIXIN
    uni.setStorageSync(key, value);
    // #endif
    
    // #ifdef H5
    localStorage.setItem(key, JSON.stringify(value));
    // #endif
  }
  
  static async getStorage(key: string): Promise<any> {
    // #ifdef MP-WEIXIN
    return uni.getStorageSync(key);
    // #endif
    
    // #ifdef H5
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
    // #endif
  }
  
  static async removeStorage(key: string): Promise<void> {
    // #ifdef MP-WEIXIN
    uni.removeStorageSync(key);
    // #endif
    
    // #ifdef H5
    localStorage.removeItem(key);
    // #endif
  }
  
  /**
   * 统一的导航
   */
  static navigateTo(url: string) {
    // #ifdef MP-WEIXIN
    uni.navigateTo({ url });
    // #endif
    
    // #ifdef H5
    // 使用 vue-router (需在setup中调用)
    // router.push(url);
    window.location.href = url;
    // #endif
  }
  
  /**
   * 统一的分享
   */
  static async share(options: {
    title: string;
    desc?: string;
    imageUrl?: string;
    path?: string;
  }): Promise<void> {
    // #ifdef MP-WEIXIN
    await uni.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
    // 在页面的 onShareAppMessage 中处理
    // #endif
    
    // #ifdef H5
    if (navigator.share) {
      await navigator.share({
        title: options.title,
        text: options.desc,
        url: window.location.href
      });
    } else {
      // 降级：复制链接
      await this.copyText(window.location.href);
      this.showToast('链接已复制');
    }
    // #endif
  }
  
  /**
   * 统一的复制
   */
  static async copyText(text: string): Promise<void> {
    // #ifdef MP-WEIXIN
    await uni.setClipboardData({ data: text });
    // #endif
    
    // #ifdef H5
    await navigator.clipboard.writeText(text);
    // #endif
  }
  
  /**
   * 统一的提示
   */
  static showToast(title: string, icon: 'success' | 'error' | 'none' = 'none') {
    // #ifdef MP-WEIXIN
    uni.showToast({ title, icon });
    // #endif
    
    // #ifdef H5
    // 使用UI组件库的toast（如uView）
    // 或简单实现
    alert(title);
    // #endif
  }
  
  /**
   * 统一的确认框
   */
  static async showConfirm(options: {
    title: string;
    content: string;
  }): Promise<boolean> {
    // #ifdef MP-WEIXIN
    const res = await uni.showModal({
      title: options.title,
      content: options.content
    });
    return res.confirm;
    // #endif
    
    // #ifdef H5
    return confirm(`${options.title}\n${options.content}`);
    // #endif
  }
}

// 辅助函数
function getToken(): string {
  // #ifdef MP-WEIXIN
  return uni.getStorageSync('token');
  // #endif
  
  // #ifdef H5
  return localStorage.getItem('token') || '';
  // #endif
}

const API_BASE = process.env.VUE_APP_API_BASE || 'https://api.audit.com';
```

---

## 四、数据同步方案

### 4.1 离线存储策略

```typescript
// src/utils/storage.ts

import { PlatformAdapter } from './platform';

/**
 * 统一的存储管理器
 */
export class StorageManager {
  
  /**
   * 保存项目数据（支持离线）
   */
  static async saveProject(project: any): Promise<void> {
    // 1. 保存到本地
    await PlatformAdapter.setStorage(`project_${project.id}`, project);
    
    // 2. 添加到同步队列
    await this.addToSyncQueue({
      type: 'project',
      action: 'update',
      data: project,
      timestamp: Date.now()
    });
    
    // 3. 如果在线，立即同步
    if (this.isOnline()) {
      await this.syncNow();
    }
  }
  
  /**
   * 获取项目数据（优先本地）
   */
  static async getProject(id: string): Promise<any> {
    // 1. 先从本地读取
    const local = await PlatformAdapter.getStorage(`project_${id}`);
    if (local) {
      return local;
    }
    
    // 2. 本地没有，从服务器获取
    if (this.isOnline()) {
      const remote = await this.fetchFromServer(`/projects/${id}`);
      // 缓存到本地
      await PlatformAdapter.setStorage(`project_${id}`, remote);
      return remote;
    }
    
    return null;
  }
  
  /**
   * 同步队列
   */
  private static syncQueue: any[] = [];
  
  private static async addToSyncQueue(item: any) {
    this.syncQueue.push(item);
    await PlatformAdapter.setStorage('sync_queue', this.syncQueue);
  }
  
  /**
   * 立即同步
   */
  static async syncNow(): Promise<void> {
    const queue = await PlatformAdapter.getStorage('sync_queue') || [];
    
    for (const item of queue) {
      try {
        await this.syncItem(item);
        // 同步成功，从队列移除
        this.syncQueue = this.syncQueue.filter(i => i !== item);
      } catch (error) {
        console.error('同步失败:', error);
        // 保留在队列中，等待下次重试
      }
    }
    
    await PlatformAdapter.setStorage('sync_queue', this.syncQueue);
  }
  
  private static async syncItem(item: any) {
    // 根据类型调用不同的API
    if (item.type === 'project') {
      await this.fetchFromServer(`/projects/${item.data.id}`, {
        method: 'PUT',
        body: JSON.stringify(item.data)
      });
    }
    // ...其他类型
  }
  
  /**
   * 检查网络状态
   */
  static isOnline(): boolean {
    // #ifdef MP-WEIXIN
    const networkType = uni.getNetworkType();
    return networkType !== 'none';
    // #endif
    
    // #ifdef H5
    return navigator.onLine;
    // #endif
  }
  
  /**
   * 监听网络变化
   */
  static watchNetwork(callback: (isOnline: boolean) => void) {
    // #ifdef MP-WEIXIN
    uni.onNetworkStatusChange((res) => {
      callback(!res.isConnected);
    });
    // #endif
    
    // #ifdef H5
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
    // #endif
  }
  
  private static async fetchFromServer(url: string, options?: any) {
    // 实现API请求...
  }
}
```

### 4.2 数据冲突处理

```typescript
// src/utils/conflict.ts

/**
 * 冲突解决策略
 */
export class ConflictResolver {
  
  /**
   * Last-Write-Wins 策略
   */
  static lww(local: any, remote: any): any {
    return local.updatedAt > remote.updatedAt ? local : remote;
  }
  
  /**
   * 手动合并
   */
  static async manualMerge(local: any, remote: any): Promise<any> {
    // 显示合并UI让用户选择
    const result = await this.showMergeUI(local, remote);
    return result;
  }
  
  /**
   * 字段级合并
   */
  static fieldMerge(local: any, remote: any): any {
    const merged = { ...remote };
    
    // 比较每个字段的时间戳
    for (const key in local) {
      if (local[key]?.updatedAt > remote[key]?.updatedAt) {
        merged[key] = local[key];
      }
    }
    
    return merged;
  }
  
  private static async showMergeUI(local: any, remote: any): Promise<any> {
    // 实现合并UI...
  }
}
```

---

## 五、响应式布局

### 5.1 样式适配

```vue
<!-- src/pages/workpaper/detail.vue -->
<template>
  <view class="workpaper-detail">
    
    <!-- 小程序布局 -->
    <view class="mp-layout" v-if="isMiniProgram">
      <view class="header">节点详情</view>
      <scroll-view class="content" scroll-y>
        <node-card :data="nodeData" />
      </scroll-view>
    </view>
    
    <!-- H5布局 -->
    <view class="h5-layout" v-else>
      <view class="sidebar">
        <node-tree />
      </view>
      <view class="main">
        <view class="header">节点详情</view>
        <view class="content">
          <node-card :data="nodeData" />
        </view>
      </view>
    </view>
    
  </view>
</template>

<script setup lang="ts">
import { isMiniProgram } from '@/utils/platform';
import { ref } from 'vue';

const nodeData = ref({});
</script>

<style lang="scss" scoped>
.workpaper-detail {
  height: 100vh;
  
  // 小程序布局
  .mp-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    
    .header {
      height: 88rpx;
      background: #fff;
      border-bottom: 1px solid #eee;
    }
    
    .content {
      flex: 1;
      padding: 20rpx;
    }
  }
  
  // H5布局
  .h5-layout {
    display: flex;
    height: 100%;
    
    .sidebar {
      width: 300px;
      border-right: 1px solid #eee;
      overflow-y: auto;
      
      // 响应式：小屏隐藏
      @media (max-width: 768px) {
        display: none;
      }
    }
    
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      
      .header {
        height: 60px;
        border-bottom: 1px solid #eee;
      }
      
      .content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        
        // 响应式容器
        max-width: 1200px;
        margin: 0 auto;
      }
    }
  }
}
</style>
```

### 5.2 rpx单位适配

```scss
// src/styles/mixins.scss

/**
 * rpx转换（小程序750rpx设计稿）
 */
@mixin responsive-size($property, $rpx-value) {
  // 小程序使用rpx
  /* #ifdef MP-WEIXIN */
  #{$property}: #{$rpx-value}rpx;
  /* #endif */
  
  // H5转换为px（假设设计稿750px）
  /* #ifdef H5 */
  #{$property}: calc(#{$rpx-value} / 750 * 100vw);
  
  // 最大宽度限制（PC端）
  @media (min-width: 750px) {
    #{$property}: #{$rpx-value}px;
  }
  /* #endif */
}

// 使用示例
.container {
  @include responsive-size(width, 750);
  @include responsive-size(padding, 30);
}
```

---

## 六、路由与导航

### 6.1 路由配置

```json
// src/pages.json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "审计数智析"
      }
    },
    {
      "path": "pages/project/list",
      "style": {
        "navigationBarTitleText": "项目列表"
      }
    },
    {
      "path": "pages/workpaper/detail",
      "style": {
        "navigationBarTitleText": "底稿详情"
      }
    }
  ],
  
  "globalStyle": {
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "审计数智析",
    "navigationBarBackgroundColor": "#F8F8F8",
    "backgroundColor": "#F8F8F8"
  },
  
  "tabBar": {
    "color": "#7A7E83",
    "selectedColor": "#3cc51f",
    "borderStyle": "black",
    "backgroundColor": "#ffffff",
    "list": [
      {
        "pagePath": "pages/index/index",
        "iconPath": "static/tabbar/home.png",
        "selectedIconPath": "static/tabbar/home-active.png",
        "text": "首页"
      },
      {
        "pagePath": "pages/project/list",
        "iconPath": "static/tabbar/project.png",
        "selectedIconPath": "static/tabbar/project-active.png",
        "text": "项目"
      },
      {
        "pagePath": "pages/profile/index",
        "iconPath": "static/tabbar/profile.png",
        "selectedIconPath": "static/tabbar/profile-active.png",
        "text": "我的"
      }
    ]
  }
}
```

### 6.2 H5路由拦截

```typescript
// src/router/index.ts (仅H5使用)

// #ifdef H5
import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '@/utils/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/pages/index/index'
    },
    {
      path: '/pages/index/index',
      component: () => import('@/pages/index/index.vue')
    },
    // ...其他路由
  ]
});

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = getToken();
  
  // 需要登录的页面
  if (to.meta.requiresAuth && !token) {
    next('/pages/login/index');
  } else {
    next();
  }
});

export default router;
// #endif
```

---

## 七、性能优化

### 7.1 图片懒加载

```vue
<template>
  <view class="image-list">
    <!-- 小程序使用lazy-load -->
    <!-- #ifdef MP-WEIXIN -->
    <image 
      v-for="img in images" 
      :key="img.id"
      :src="img.url" 
      lazy-load
      mode="aspectFill"
    />
    <!-- #endif -->
    
    <!-- H5使用IntersectionObserver -->
    <!-- #ifdef H5 -->
    <img 
      v-for="img in images" 
      :key="img.id"
      :data-src="img.url"
      class="lazy-image"
      alt=""
    />
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

// #ifdef H5
onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        img.src = img.dataset.src!;
        observer.unobserve(img);
      }
    });
  });
  
  document.querySelectorAll('.lazy-image').forEach(img => {
    observer.observe(img);
  });
});
// #endif
</script>
```

### 7.2 分包加载

```json
// src/pages.json
{
  "pages": [
    // 主包页面
  ],
  
  "subPackages": [
    {
      "root": "pages-sub/analysis",
      "pages": [
        {
          "path": "fraud-detection",
          "style": {
            "navigationBarTitleText": "舞弊检测"
          }
        }
      ]
    },
    {
      "root": "pages-sub/admin",
      "pages": [
        {
          "path": "settings",
          "style": {
            "navigationBarTitleText": "系统设置"
          }
        }
      ]
    }
  ],
  
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["pages-sub/analysis"]
    }
  }
}
```

---

## 八、调试与测试

### 8.1 条件编译调试

```typescript
// src/config/env.ts

export const ENV_CONFIG = {
  // #ifdef MP-WEIXIN
  platform: 'mp-weixin',
  apiBase: 'https://mp-api.audit.com',
  // #endif
  
  // #ifdef H5
  platform: 'h5',
  apiBase: process.env.NODE_ENV === 'production' 
    ? 'https://api.audit.com'
    : 'http://localhost:3000',
  // #endif
  
  version: '1.0.0'
};

// 调试日志
export function debugLog(...args: any[]) {
  // #ifdef MP-WEIXIN
  console.log('[MP]', ...args);
  // #endif
  
  // #ifdef H5
  if (process.env.NODE_ENV === 'development') {
    console.log('[H5]', ...args);
  }
  // #endif
}
```

### 8.2 自动化测试

```typescript
// tests/platform.spec.ts

import { describe, it, expect } from 'vitest';
import { PlatformAdapter } from '@/utils/platform';

describe('PlatformAdapter', () => {
  it('should detect platform correctly', () => {
    const platform = PlatformAdapter.getPlatform();
    expect(['mp-weixin', 'h5', 'app']).toContain(platform);
  });
  
  it('should handle storage operations', async () => {
    await PlatformAdapter.setStorage('test-key', { value: 123 });
    const result = await PlatformAdapter.getStorage('test-key');
    expect(result.value).toBe(123);
  });
});
```

---

## 九、部署配置

### 9.1 小程序配置

```json
// src/manifest.json (小程序部分)
{
  "mp-weixin": {
    "appid": "wx1234567890abcdef",
    "setting": {
      "urlCheck": false,
      "es6": true,
      "minified": true
    },
    "permission": {
      "scope.userLocation": {
        "desc": "用于现场审计定位"
      }
    },
    "requiredBackgroundModes": ["audio"],
    "plugins": {},
    "usingComponents": true
  }
}
```

### 9.2 H5配置

```javascript
// vue.config.js
module.exports = {
  publicPath: process.env.NODE_ENV === 'production' 
    ? 'https://cdn.audit.com/' 
    : '/',
  
  outputDir: 'dist/h5',
  
  devServer: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  
  chainWebpack: config => {
    // H5特定优化
    if (process.env.UNI_PLATFORM === 'h5') {
      config.optimization.splitChunks({
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /node_modules/,
            name: 'vendor',
            priority: 10
          }
        }
      });
    }
  }
};
```

---

## 十、最佳实践

### 10.1 开发建议

1. **优先开发小程序版本**，再适配H5
2. **使用条件编译**处理平台差异，而非运行时判断
3. **关键业务逻辑**抽取为平台无关的工具函数
4. **UI组件**尽量使用uni-app内置组件，避免平台兼容问题
5. **性能敏感**的功能（如长列表）使用平台原生方案

### 10.2 避免的坑

❌ **不要直接使用wx.xxx API**
```javascript
// ❌ 错误
wx.request({ url: '...' });

// ✅ 正确
uni.request({ url: '...' });
```

❌ **不要使用仅H5支持的API**
```javascript
// ❌ 错误（小程序不支持）
document.querySelector('.btn');

// ✅ 正确（使用uni-app方案）
uni.createSelectorQuery().select('.btn').boundingClientRect();
```

❌ **不要硬编码rpx值**
```scss
// ❌ 错误
.container {
  width: 750px; /* H5会很宽 */
}

// ✅ 正确
.container {
  width: 750rpx; /* 小程序用rpx，H5自动转换 */
}
```

---

## 十一、FAQ

### Q1: 如何实现扫码功能？
```typescript
PlatformAdapter.scan = async () => {
  // #ifdef MP-WEIXIN
  const res = await uni.scanCode();
  return res.result;
  // #endif
  
  // #ifdef H5
  // 使用第三方库如 html5-qrcode
  // 或跳转到扫码页面
  // #endif
};
```

### Q2: 如何处理支付？
小程序使用微信支付，H5使用H5支付或扫码支付，需要分别接入。

### Q3: 如何实现推送通知？
```typescript
// 小程序：订阅消息
// H5：Web Push API 或轮询
```

---

**文档版本**: v1.0  
**最后更新**: 2024-11-28  
**维护者**: 前端团队
