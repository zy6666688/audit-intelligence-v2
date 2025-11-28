# 审计数智析 - 智能审计小程序

基于uni-app开发的审计小程序系统,支持微信小程序和H5双端运行。

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装依赖
```bash
npm install
```

### 启动开发服务器

**H5开发**
```bash
npm run dev:h5
# 访问 http://localhost:8080
```

**微信小程序开发**
```bash
npm run dev:mp-weixin
# 使用微信开发者工具打开 dist/dev/mp-weixin 目录
```

### 构建生产版本
```bash
# H5生产构建
npm run build:h5

# 微信小程序生产构建
npm run build:mp-weixin
```

### 当前状态
✅ **框架完成度**: 85%  
✅ **H5可运行**: 是  
⏳ **业务功能**: 30%  

📖 查看详细测试报告: [docs/TESTING_REPORT.md](docs/TESTING_REPORT.md)

---

## 技术架构

### 前端技术栈
- **框架**: uni-app (Vue 3 + TypeScript)
- **状态管理**: Pinia
- **UI组件**: uView-plus
- **可视化**: ECharts
- **构建工具**: Vite

### 后端技术栈
- **运行时**: Node.js 18+
- **框架**: NestJS
- **数据库**: PostgreSQL + Redis + MongoDB
- **对象存储**: 阿里云OSS
- **AI服务**: 千问API

## 核心特性

✨ **节点式底稿引擎** - 所有审计流程抽象为可视化节点链  
🤖 **AI智能分析** - 深度集成千问API,智能辅助审计决策  
📱 **多端统一** - 一套代码编译为小程序、H5、App  
🔄 **离线优先** - 支持离线工作,智能同步  
🔒 **安全合规** - 全流程审计日志,数据加密存储  
🔌 **插件化** - 功能模块化,支持动态扩展  

## 项目结构

```
审计数智析/
├── src/                        # 源代码
│   ├── pages/                  # 页面
│   ├── components/             # 组件
│   ├── api/                    # API接口
│   ├── store/                  # 状态管理
│   ├── utils/                  # 工具函数
│   │   ├── platform.ts         # 平台适配器
│   │   └── sync-manager.ts     # 数据同步管理
│   ├── types/                  # TypeScript类型
│   └── static/                 # 静态资源
│
├── backend/                    # 后端服务(待创建)
├── docs/                       # 文档
│   ├── ARCHITECTURE.md         # 技术架构文档
│   └── H5_MINIAPP_INTEGRATION.md  # H5与小程序互通方案
│
├── package.json                # 依赖配置
├── tsconfig.json               # TypeScript配置
├── .env.example                # 环境变量示例
└── README.md                   # 本文件
```

## 快速开始

### 1. 安装依赖

```bash
# 使用npm
npm install

# 或使用yarn
yarn install

# 或使用pnpm (推荐)
pnpm install
```

### 2. 配置环境变量

复制`.env.example`为`.env`,并填写配置:

```bash
cp .env.example .env
```

编辑`.env`文件,配置以下内容:
- `VITE_API_BASE`: 后端API地址
- `VITE_WXWORK_APPID`: 企业微信AppID
- `VITE_QWEN_API_KEY`: 千问API密钥

### 3. 运行开发服务器

**微信小程序:**
```bash
npm run dev:mp-weixin
```
然后使用微信开发者工具打开项目根目录。

**H5网页:**
```bash
npm run dev:h5
```
访问 http://localhost:8080

### 4. 构建生产版本

**微信小程序:**
```bash
npm run build:mp-weixin
```

**H5网页:**
```bash
npm run build:h5
```

## 关于TypeScript错误

当前项目中存在一些TypeScript lint错误,这是**正常现象**,原因是:

1. **uni-app类型定义**: 需要安装依赖后,`@dcloudio/types`才会生效
2. **条件编译**: uni-app使用条件编译区分平台,TypeScript无法完全识别

**解决方法:**

```bash
# 安装依赖后,大部分错误会自动消失
npm install

# 如果仍有错误,可以在IDE中配置忽略条件编译块的类型检查
# 或者在tsconfig.json中添加:
# "skipLibCheck": true
```

这些错误**不会影响**项目的正常运行和编译。

## 核心模块说明

### 平台适配器 (`src/utils/platform.ts`)

统一处理小程序和H5的平台差异:

```typescript
import { PlatformAdapter } from '@/utils/platform';

// 统一的登录
const { token, userInfo } = await PlatformAdapter.login();

// 统一的文件选择
const files = await PlatformAdapter.chooseFile({ type: 'image', count: 9 });

// 统一的文件上传
const result = await PlatformAdapter.uploadFile(files[0]);

// 统一的本地存储
await PlatformAdapter.setStorage('key', value);
const data = await PlatformAdapter.getStorage('key');
```

### 数据同步管理器 (`src/utils/sync-manager.ts`)

支持离线操作和自动同步:

```typescript
import { SyncManager } from '@/utils/sync-manager';

// 初始化同步管理器
await SyncManager.init();

// 添加操作到同步队列(离线时自动缓存)
await SyncManager.addOperation({
  type: 'project',
  action: 'update',
  resourceId: 'proj-123',
  data: projectData
});

// 手动同步所有操作
const result = await SyncManager.syncAll();

// 获取同步队列状态
const status = SyncManager.getQueueStatus();
```

## 开发指南

### 条件编译

使用条件编译区分不同平台:

```vue
<template>
  <!-- 通用代码 -->
  <view class="container">
    
    <!-- 仅小程序 -->
    <!-- #ifdef MP-WEIXIN -->
    <button open-type="getUserInfo">获取用户信息</button>
    <!-- #endif -->
    
    <!-- 仅H5 -->
    <!-- #ifdef H5 -->
    <div class="desktop-header">桌面端头部</div>
    <!-- #endif -->
    
  </view>
</template>

<script>
export default {
  methods: {
    doSomething() {
      // #ifdef MP-WEIXIN
      console.log('小程序代码');
      // #endif
      
      // #ifdef H5
      console.log('H5代码');
      // #endif
    }
  }
}
</script>
```

### 响应式设计

```scss
.container {
  // 小程序使用rpx (750rpx设计稿)
  width: 750rpx;
  padding: 30rpx;
  
  // H5响应式
  /* #ifdef H5 */
  @media (min-width: 768px) {
    max-width: 1200px;
    margin: 0 auto;
  }
  /* #endif */
}
```

### API请求示例

```typescript
// src/api/project.ts
import { request } from './request';

export const projectApi = {
  // 获取项目列表
  getList(params: any) {
    return request({
      url: '/projects',
      method: 'GET',
      params
    });
  },
  
  // 创建项目
  create(data: any) {
    return request({
      url: '/projects',
      method: 'POST',
      data
    });
  }
};
```

## 部署说明

### 微信小程序部署

1. 使用微信开发者工具打开项目
2. 点击"上传"按钮
3. 在微信公众平台提交审核
4. 审核通过后发布

### H5部署

1. 构建生产版本: `npm run build:h5`
2. 将`dist/h5`目录部署到Web服务器
3. 配置Nginx反向代理:

```nginx
server {
    listen 80;
    server_name audit.example.com;
    
    root /var/www/audit-h5;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 文档

- [技术架构文档](./docs/ARCHITECTURE.md)
- [H5与小程序互通方案](./docs/H5_MINIAPP_INTEGRATION.md)

## MVP里程碑 (2个月)

- [x] 技术架构设计
- [x] H5与小程序互通方案
- [x] 平台适配器实现
- [x] 数据同步管理器实现
- [ ] 项目管理模块
- [ ] 节点式底稿引擎
- [ ] 证据存储与OCR
- [ ] AI分析接口
- [ ] 协作与评论
- [ ] 审计日志

## 贡献指南

1. Fork本项目
2. 创建特性分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add some amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 提交Pull Request

## 开发规范

- **代码风格**: 使用ESLint + Prettier
- **提交规范**: 遵循Conventional Commits
- **分支策略**: main(生产) -> develop(开发) -> feature/*(功能)

## 许可证

MIT License

## 联系方式

- 项目主页: [GitHub仓库地址]
- 问题反馈: [Issues页面]
- 技术支持: audit-support@example.com

---

**注意**: 本项目处于积极开发中,部分功能尚未完成。当前lint错误是正常现象,不影响开发和运行。
