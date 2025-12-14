# 快速开始指南

## 项目初始化

### 1. 环境要求

**必需**:
- Node.js >= 18.0.0
- npm >= 9.0.0 或 pnpm >= 8.0.0（推荐）

**可选**:
- 微信开发者工具（小程序开发）
- HBuilderX（uni-app官方IDE）
- VS Code（推荐，配合插件）

### 2. VS Code插件推荐

打开项目后，VS Code会提示安装推荐插件，或手动安装：

```json
{
  "recommendations": [
    "Vue.volar",                    // Vue 3语法支持
    "dbaeumer.vscode-eslint",       // ESLint
    "esbenp.prettier-vscode",       // Prettier
    "vue.vscode-typescript-vue-plugin" // Vue TS支持
  ]
}
```

### 3. 克隆项目

```bash
# 克隆仓库
git clone <repository-url>
cd 审计数智析

# 或直接使用当前目录（已有项目文件）
cd d:/审计数智析
```

### 4. 安装依赖

```bash
# 使用pnpm（推荐，速度快）
pnpm install

# 或使用npm
npm install

# 或使用yarn
yarn install
```

**注意**: 安装完成后，TypeScript类型错误会自动消失。

### 5. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑.env文件
# Windows用户可以用记事本打开
notepad .env
```

填写以下配置：

```env
# 后端API地址（开发环境）
VITE_API_BASE=http://localhost:3000

# 企业微信AppID（H5登录用）
VITE_WXWORK_APPID=ww1234567890abcdef

# 千问API密钥
VITE_QWEN_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx

# 对象存储配置
VITE_OSS_BUCKET=audit-dev
VITE_OSS_REGION=oss-cn-hangzhou
```

---

## 开发指南

### 微信小程序开发

#### 1. 启动开发服务器

```bash
npm run dev:mp-weixin
```

终端会显示：
```
✔ Built in 1.23s
监听文件变化中...
```

#### 2. 打开微信开发者工具

1. 打开微信开发者工具
2. 选择"导入项目"
3. 项目目录选择: `d:/审计数智析/dist/dev/mp-weixin`
4. AppID: 使用测试号或填写您的AppID
5. 点击"导入"

#### 3. 开发调试

- 修改`src/`下的代码会自动编译
- 微信开发者工具会自动刷新
- 查看Console面板查看日志

#### 4. 真机调试

1. 微信开发者工具点击"预览"
2. 手机微信扫码
3. 在手机上查看效果

---

### H5网页开发

#### 1. 启动开发服务器

```bash
npm run dev:h5
```

终端会显示：
```
VITE v5.0.0  ready in 823 ms

➜  Local:   http://localhost:8080/
➜  Network: http://192.168.1.100:8080/
```

#### 2. 打开浏览器

访问 http://localhost:8080

推荐使用Chrome浏览器的设备模拟器：
1. 按F12打开开发者工具
2. 点击"设备工具栏"图标（或Ctrl+Shift+M）
3. 选择iPhone或Android设备

#### 3. 开发调试

- 修改代码会自动热重载
- 查看Console面板查看日志
- Network面板查看API请求

---

## 项目结构说明

```
src/
├── pages/              # 页面目录
│   ├── index/         # 首页
│   ├── project/       # 项目相关页面
│   ├── workpaper/     # 底稿相关页面
│   └── profile/       # 个人中心
│
├── components/         # 组件目录
│   ├── common/        # 通用组件
│   └── node/          # 节点相关组件
│
├── api/               # API接口
│   ├── request.ts     # 请求封装
│   ├── auth.ts        # 认证接口
│   └── project.ts     # 项目接口
│
├── store/             # 状态管理（Pinia）
│   ├── user.ts        # 用户状态
│   └── project.ts     # 项目状态
│
├── utils/             # 工具函数
│   ├── platform.ts    # 平台适配器
│   └── sync-manager.ts # 数据同步管理
│
├── types/             # TypeScript类型
│   └── global.d.ts    # 全局类型定义
│
├── static/            # 静态资源
│   └── images/        # 图片
│
├── App.vue            # 应用入口
├── main.ts            # 主入口文件
├── manifest.json      # 应用配置
└── pages.json         # 页面路由配置
```

---

## 第一个功能：创建页面

### 1. 在pages.json中添加路由

```json
{
  "pages": [
    // ...其他页面
    {
      "path": "pages/demo/index",
      "style": {
        "navigationBarTitleText": "演示页面"
      }
    }
  ]
}
```

### 2. 创建页面文件

创建 `src/pages/demo/index.vue`:

```vue
<template>
  <view class="demo-page">
    <view class="title">{{ message }}</view>
    
    <!-- 平台标识 -->
    <view class="platform">
      当前平台: {{ platformName }}
    </view>
    
    <!-- 测试按钮 -->
    <button @click="handleTest">测试平台适配器</button>
    
    <!-- 显示结果 -->
    <view class="result" v-if="result">
      {{ result }}
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { PlatformAdapter, getPlatform } from '@/utils/platform';

const message = ref('Hello 审计数智析!');
const platformName = ref(getPlatform());
const result = ref('');

const handleTest = async () => {
  try {
    // 测试存储
    await PlatformAdapter.setStorage('test-key', { 
      value: 'test-value',
      timestamp: Date.now()
    });
    
    const data = await PlatformAdapter.getStorage('test-key');
    result.value = `存储测试成功: ${JSON.stringify(data)}`;
    
    PlatformAdapter.showToast('测试成功', 'success');
  } catch (error) {
    result.value = `测试失败: ${error.message}`;
    PlatformAdapter.showToast('测试失败', 'error');
  }
};
</script>

<style lang="scss" scoped>
.demo-page {
  padding: 40rpx;
  
  .title {
    font-size: 36rpx;
    font-weight: bold;
    margin-bottom: 20rpx;
  }
  
  .platform {
    color: #666;
    margin-bottom: 40rpx;
  }
  
  button {
    width: 100%;
    margin-bottom: 20rpx;
  }
  
  .result {
    padding: 20rpx;
    background: #f5f5f5;
    border-radius: 8rpx;
    word-break: break-all;
  }
}
</style>
```

### 3. 访问页面

**小程序**: 在微信开发者工具中，编译选项里添加 `/pages/demo/index`

**H5**: 访问 http://localhost:8080/#/pages/demo/index

---

## 使用平台适配器

### 登录示例

```typescript
import { PlatformAdapter } from '@/utils/platform';

// 登录
const login = async () => {
  try {
    const { token, userInfo } = await PlatformAdapter.login();
    console.log('登录成功:', userInfo);
    
    // 保存用户信息
    await PlatformAdapter.setStorage('userInfo', userInfo);
    
    // 跳转到首页
    PlatformAdapter.navigateTo('/pages/index/index');
  } catch (error) {
    PlatformAdapter.showToast('登录失败', 'error');
  }
};
```

### 文件上传示例

```typescript
import { PlatformAdapter } from '@/utils/platform';

// 选择并上传图片
const uploadImage = async () => {
  try {
    // 1. 选择图片
    const files = await PlatformAdapter.chooseFile({
      type: 'image',
      count: 1
    });
    
    if (files.length === 0) return;
    
    // 2. 显示加载
    PlatformAdapter.showLoading('上传中...');
    
    // 3. 上传文件
    const result = await PlatformAdapter.uploadFile(files[0]);
    
    PlatformAdapter.hideLoading();
    PlatformAdapter.showToast('上传成功', 'success');
    
    console.log('文件URL:', result.url);
    console.log('文件ID:', result.fileId);
    
  } catch (error) {
    PlatformAdapter.hideLoading();
    PlatformAdapter.showToast('上传失败', 'error');
  }
};
```

### 离线同步示例

```typescript
import { SyncManager } from '@/utils/sync-manager';

// 初始化（在App.vue的onLaunch中调用）
await SyncManager.init();

// 保存数据（会自动同步）
const saveProject = async (projectData: any) => {
  try {
    // 1. 保存到本地
    await PlatformAdapter.setStorage(`project_${projectData.id}`, projectData);
    
    // 2. 添加到同步队列
    await SyncManager.addOperation({
      type: 'project',
      action: 'update',
      resourceId: projectData.id,
      data: projectData
    });
    
    PlatformAdapter.showToast('保存成功', 'success');
  } catch (error) {
    PlatformAdapter.showToast('保存失败', 'error');
  }
};

// 查看同步状态
const checkSyncStatus = () => {
  const status = SyncManager.getQueueStatus();
  console.log('待同步:', status.pending);
  console.log('同步中:', status.syncing);
  console.log('失败:', status.failed);
};
```

---

## 常见问题

### Q1: TypeScript报错

**现象**: 编辑器显示大量类型错误

**原因**: 
1. 未安装依赖
2. uni-app类型定义未加载

**解决**:
```bash
# 1. 安装依赖
npm install

# 2. 重启VS Code
# 3. 如果仍有错误，在tsconfig.json添加:
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

### Q2: 小程序编译失败

**现象**: 微信开发者工具报错

**解决**:
1. 检查`npm run dev:mp-weixin`是否正常运行
2. 检查微信开发者工具的项目路径是否正确
3. 尝试"清缓存→全部清除"
4. 重新编译

### Q3: H5页面空白

**现象**: 浏览器打开后页面空白

**解决**:
1. 检查浏览器Console是否有错误
2. 检查`.env`配置是否正确
3. 检查后端API是否启动
4. 尝试清除浏览器缓存

### Q4: API请求失败

**现象**: 网络请求报错

**解决**:
1. 检查`.env`中的`VITE_API_BASE`配置
2. 检查后端服务是否启动
3. 小程序需要配置request合法域名
4. H5检查CORS跨域配置

### Q5: 文件上传失败

**现象**: 上传文件时报错

**解决**:
1. 检查后端上传接口是否正常
2. 检查文件大小是否超限
3. 小程序检查uploadFile合法域名
4. 检查token是否有效

---

## 调试技巧

### 小程序调试

1. **查看日志**:
   - 微信开发者工具→Console面板
   - 真机调试时，打开vconsole

2. **网络请求**:
   - Network面板查看请求详情
   - 检查请求头、响应数据

3. **存储查看**:
   - Storage面板查看本地存储
   - 可以手动修改/删除数据

### H5调试

1. **Chrome DevTools**:
   - F12打开开发者工具
   - Console查看日志
   - Network查看请求
   - Application查看localStorage

2. **移动端调试**:
   - Chrome设备模拟器（Ctrl+Shift+M）
   - 真机调试：手机和电脑在同一WiFi，访问电脑IP

3. **Vue DevTools**:
   - 安装Vue DevTools浏览器插件
   - 查看组件状态、Pinia数据

---

## 下一步

完成快速开始后，建议：

1. **阅读架构文档**: `docs/ARCHITECTURE.md`
2. **了解互通方案**: `docs/H5_MINIAPP_INTEGRATION.md`
3. **查看实施总结**: `docs/IMPLEMENTATION_SUMMARY.md`
4. **开始开发功能**: 参考实施总结中的Phase 1计划

---

## 获取帮助

- **项目文档**: `docs/` 目录
- **代码注释**: 核心代码都有详细注释
- **示例代码**: `src/pages/demo/` (需自行创建)
- **Issue反馈**: GitHub Issues

---

**祝开发顺利！** 🚀
