# 审计数智析 - 技术架构文档 v1.0

## 一、架构总览

### 1.1 系统定位
审计数智析是一款基于节点式底稿引擎的智能审计系统，支持微信小程序和H5双端访问，实现审计流程的数字化、智能化和可视化。

### 1.2 核心设计原则
- **多端统一**: uni-app框架实现一套代码多端运行（微信小程序、H5、App）
- **节点驱动**: 所有审计流程抽象为节点链，可视化、可追溯
- **插件化**: 功能模块化，支持动态加载和扩展
- **AI优先**: 深度集成千问API，智能辅助审计决策
- **离线优先**: 支持离线工作，智能同步
- **安全合规**: 全流程审计日志，数据加密存储

---

## 二、技术栈选型

### 2.1 前端技术栈
```
框架层:
├── uni-app (Vue3 + TypeScript)         # 多端统一框架
├── Vue Router                          # 路由管理
├── Pinia                               # 状态管理
└── Vite                                # 构建工具

UI层:
├── uView-plus                          # UI组件库
├── ECharts                             # 数据可视化
└── TailwindCSS (optional)              # 样式工具

工具层:
├── axios                               # HTTP客户端
├── dayjs                               # 日期处理
├── crypto-js                           # 加密工具
└── localforage                         # 离线存储
```

### 2.2 后端技术栈
```
运行时:
├── Node.js 18+                         # 运行环境
└── TypeScript                          # 开发语言

框架:
├── NestJS                              # 企业级框架
├── Express                             # Web框架（NestJS底层）
└── Socket.io                           # 实时通信

数据库:
├── PostgreSQL 14+                      # 关系型数据库（主）
│   ├── 项目/用户/权限数据
│   └── JSONB存储节点数据
├── Redis 6+                            # 缓存/会话
└── MongoDB (optional)                  # 文档存储（审计日志）

对象存储:
└── 阿里云OSS / 腾讯云COS              # 文件存储

AI服务:
├── 千问API (Qwen-Max/Plus)            # 大语言模型
├── 腾讯云OCR                           # 文字识别
└── 腾讯云ASR                           # 语音识别
```

### 2.3 DevOps技术栈
```
容器化:
├── Docker                              # 容器
└── Docker Compose                      # 本地编排

部署:
├── 阿里云/腾讯云                       # 云平台
├── Nginx                               # 反向代理
└── PM2                                 # 进程管理

监控:
├── 日志: Winston + 云日志服务
└── 监控: Prometheus + Grafana (optional)
```

---

## 三、系统架构图

### 3.1 整体架构
```
┌─────────────────────────────────────────────────────────────┐
│                      客户端层 (Client Layer)                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 微信小程序    │  │   H5网页     │  │  App (未来)   │      │
│  │ (uni-app)    │  │  (uni-app)   │  │  (uni-app)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                            │                                  │
└────────────────────────────┼──────────────────────────────────┘
                             │ HTTPS/WSS
┌────────────────────────────┼──────────────────────────────────┐
│                    网关层 (Gateway Layer)                      │
├────────────────────────────┼──────────────────────────────────┤
│                            │                                  │
│               ┌────────────▼──────────┐                       │
│               │   Nginx 反向代理       │                       │
│               │  - 负载均衡             │                       │
│               │  - SSL终止             │                       │
│               │  - 静态资源服务         │                       │
│               └────────────┬──────────┘                       │
│                            │                                  │
└────────────────────────────┼──────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────┐
│                   应用层 (Application Layer)                   │
├────────────────────────────┼──────────────────────────────────┤
│                            │                                  │
│  ┌─────────────────────────▼────────────────────────┐         │
│  │            NestJS 应用服务                        │         │
│  ├───────────────────────────────────────────────────┤         │
│  │                                                   │         │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │         │
│  │  │ 鉴权模块     │  │ 项目管理     │  │ 用户模块  │ │         │
│  │  │ Auth Module │  │Project Module│  │User Module│ │         │
│  │  └─────────────┘  └─────────────┘  └──────────┘ │         │
│  │                                                   │         │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │         │
│  │  │ 节点引擎     │  │ 插件系统     │  │ AI代理层  │ │         │
│  │  │NodeChain Eng│  │Plugin Registry│  │AI Gateway│ │         │
│  │  └─────────────┘  └─────────────┘  └──────────┘ │         │
│  │                                                   │         │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │         │
│  │  │ 风险引擎     │  │ 文件处理     │  │ 实时通信  │ │         │
│  │  │Risk Engine  │  │File Handler  │  │WebSocket │ │         │
│  │  └─────────────┘  └─────────────┘  └──────────┘ │         │
│  │                                                   │         │
│  └───────────────────────────────────────────────────┘         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────┐
│                   数据层 (Data Layer)                          │
├────────────────────────────┼──────────────────────────────────┤
│                            │                                  │
│  ┌──────────────┐  ┌───────▼──────┐  ┌──────────────┐        │
│  │   Redis      │  │  PostgreSQL   │  │   MongoDB    │        │
│  │   缓存/会话   │  │  主数据库     │  │   审计日志    │        │
│  └──────────────┘  └───────────────┘  └──────────────┘        │
│                                                               │
│  ┌──────────────────────────────────────────────────┐         │
│  │            对象存储 (OSS/COS)                     │         │
│  │  - 文件/图片/PDF/附件                             │         │
│  └──────────────────────────────────────────────────┘         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────┐
│                   外部服务层 (External Services)               │
├────────────────────────────┼──────────────────────────────────┤
│                            │                                  │
│  ┌──────────────┐  ┌───────▼──────┐  ┌──────────────┐        │
│  │  千问API      │  │  腾讯云OCR   │  │  企业微信     │        │
│  │  (AI分析)    │  │  (文字识别)  │  │  (登录/通知)  │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 3.2 模块分层
```
┌────────────────────────────────────────────┐
│          表现层 (Presentation)              │
│  - Pages (页面组件)                         │
│  - Components (UI组件)                      │
│  - Utils (工具函数)                         │
└────────────────┬───────────────────────────┘
                 │
┌────────────────▼───────────────────────────┐
│          业务层 (Business Logic)            │
│  - Services (业务服务)                      │
│  - Stores (状态管理)                        │
│  - Hooks/Composables (逻辑复用)            │
└────────────────┬───────────────────────────┘
                 │
┌────────────────▼───────────────────────────┐
│          数据层 (Data Access)               │
│  - API (接口请求)                           │
│  - Models (数据模型)                        │
│  - Cache (缓存策略)                         │
└────────────────────────────────────────────┘
```

---

## 四、核心模块设计

### 4.1 节点式底稿引擎 (NodeChain Engine)

#### 数据模型
```typescript
// 节点定义
interface WorkpaperNode {
  nodeId: string;                    // 唯一ID
  shortName: string;                 // 短名称 (如 AR1)
  type: NodeType;                    // 节点类型
  title: string;                     // 标题
  blocks: Block[];                   // 内容块
  state: NodeState;                  // 状态
  evidenceIds: string[];             // 证据ID列表
  aiAnalyses: AIAnalysis[];          // AI分析结果
  meta: Record<string, any>;         // 插件元数据
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// 节点链
interface NodeChain {
  chainId: string;
  projectId: string;
  nodes: WorkpaperNode[];
  edges: NodeEdge[];                 // 节点关系
  meta: {
    version: string;
    description: string;
  };
}

// 节点关系
interface NodeEdge {
  from: string;                      // 源节点ID
  to: string;                        // 目标节点ID
  relation: 'depends' | 'supports' | 'links';
  label?: string;
}
```

#### 核心功能
- **节点CRUD**: 创建、读取、更新、删除节点
- **关系管理**: 建立节点间的依赖、支持、关联关系
- **状态机**: 草稿→锁定→审核→批准
- **版本控制**: 节点修改历史追踪

### 4.2 插件系统 (Plugin Registry)

#### 插件契约
```typescript
interface NodePlugin {
  pluginId: string;
  version: string;
  name: string;
  description: string;
  
  // 能力声明
  capabilities: {
    supportsOffline: boolean;
    requiresOCR: boolean;
    requiresAI: boolean;
  };
  
  // 插件生命周期
  init(nodeMeta: any): Promise<void>;
  render(container: HTMLElement): void;
  onSave(nodeData: any): Promise<void>;
  onDestroy(): void;
  
  // API端点
  apiEndpoint: string;              // /api/plugins/{pluginId}/run
  schema: JSONSchema;               // 输入输出schema
}
```

#### 内置插件
1. **VoucherPlugin**: 凭证处理
2. **InvoicePlugin**: 发票识别
3. **ContractPlugin**: 合同分析
4. **BankFlowPlugin**: 银行流水分析
5. **RiskAnalysisPlugin**: 风险评估

### 4.3 AI 代理层 (AI Gateway)

#### 统一接口
```typescript
interface AIGateway {
  // 通用调用
  call(params: {
    model: 'qwen-max' | 'qwen-plus' | 'qwen-turbo';
    prompt: string;
    context?: any;
    temperature?: number;
  }): Promise<AIResponse>;
  
  // OCR调用
  ocr(file: File, type: 'voucher' | 'invoice' | 'statement'): Promise<OCRResult>;
  
  // 结构化提取
  extract(text: string, schema: JSONSchema): Promise<any>;
}
```

#### 特性
- **请求缓存**: promptHash缓存相同请求
- **重试机制**: 自动重试3次
- **降级策略**: AI失败时返回规则结果
- **审计追踪**: 记录所有AI调用

### 4.4 风险引擎 (Risk Engine)

#### 舞弊检测规则
```typescript
interface FraudRule {
  ruleId: string;
  name: string;
  category: 'revenue' | 'inventory' | 'cashflow' | 'asset';
  
  // 检测逻辑
  detect(data: any): Promise<RiskResult[]>;
  
  // 规则配置
  config: {
    threshold: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
}
```

#### 内置规则集
1. **资金空转检测**: 循环交易、闭环资金链
2. **收入舞弊**: 提前确认、虚构销售
3. **存货异常**: 零库存有入库、周转异常
4. **关联方循环**: 往来款异常聚类

---

## 五、H5与小程序互通方案

### 5.1 核心策略
使用 **uni-app** 实现一套代码，编译为：
- 微信小程序 (主要场景)
- H5网页 (电脑端审核)
- App (未来扩展)

### 5.2 条件编译
```vue
<template>
  <!-- 通用代码 -->
  <view class="container">
    
    <!-- 小程序专用 -->
    <!-- #ifdef MP-WEIXIN -->
    <button open-type="getUserInfo">获取用户信息</button>
    <!-- #endif -->
    
    <!-- H5专用 -->
    <!-- #ifdef H5 -->
    <div class="desktop-header">桌面端头部</div>
    <!-- #endif -->
    
  </view>
</template>

<script>
export default {
  methods: {
    // 条件编译代码
    login() {
      // #ifdef MP-WEIXIN
      uni.login({ provider: 'weixin' });
      // #endif
      
      // #ifdef H5
      this.$router.push('/h5-login');
      // #endif
    }
  }
}
</script>
```

### 5.3 平台适配层
```typescript
// utils/platform-adapter.ts
export class PlatformAdapter {
  // 统一的登录接口
  static async login(): Promise<LoginResult> {
    // #ifdef MP-WEIXIN
    return this.wxLogin();
    // #endif
    
    // #ifdef H5
    return this.h5Login();
    // #endif
  }
  
  // 统一的文件上传
  static async uploadFile(file: File): Promise<string> {
    // #ifdef MP-WEIXIN
    return this.wxUpload(file);
    // #endif
    
    // #ifdef H5
    return this.h5Upload(file);
    // #endif
  }
  
  // 统一的本地存储
  static async setStorage(key: string, value: any): Promise<void> {
    // #ifdef MP-WEIXIN
    uni.setStorageSync(key, value);
    // #endif
    
    // #ifdef H5
    localStorage.setItem(key, JSON.stringify(value));
    // #endif
  }
}
```

### 5.4 响应式适配
```scss
// 小程序样式（750rpx设计稿）
.container {
  width: 750rpx;
  
  // H5响应式
  /* #ifdef H5 */
  @media (min-width: 768px) {
    max-width: 1200px;
    margin: 0 auto;
  }
  /* #endif */
}
```

---

## 六、数据同步方案

### 6.1 离线优先架构
```typescript
// 数据同步管理器
class SyncManager {
  // 本地操作队列
  private operationQueue: Operation[] = [];
  
  // 添加操作到队列
  async addOperation(op: Operation) {
    this.operationQueue.push(op);
    await this.saveQueue();
    
    // 如果在线，立即同步
    if (navigator.onLine) {
      await this.sync();
    }
  }
  
  // 同步操作
  async sync() {
    while (this.operationQueue.length > 0) {
      const op = this.operationQueue[0];
      
      try {
        await this.executeOperation(op);
        this.operationQueue.shift();
      } catch (error) {
        // 同步失败，停止并等待下次重试
        break;
      }
    }
  }
}
```

### 6.2 冲突解决策略
- **Last-Write-Wins (LWW)**: 默认策略，最后修改者获胜
- **Manual Merge**: 关键数据人工合并
- **Version Vector**: 复杂场景使用版本向量

---

## 七、安全设计

### 7.1 认证授权
```typescript
// JWT Token 结构
interface JWTPayload {
  userId: string;
  role: 'auditor' | 'manager' | 'partner';
  projectIds: string[];           // 可访问的项目列表
  permissions: string[];          // 权限列表
  exp: number;                    // 过期时间
}

// RBAC 权限控制
const permissions = {
  'auditor': ['node.create', 'node.edit', 'comment.create'],
  'manager': ['node.create', 'node.edit', 'node.review', 'task.assign'],
  'partner': ['*'],               // 全部权限
};
```

### 7.2 数据加密
- **传输加密**: HTTPS/TLS 1.3
- **存储加密**: 敏感字段AES-256加密
- **证据完整性**: SHA-256哈希校验

### 7.3 审计日志
```typescript
interface AuditLog {
  logId: string;
  userId: string;
  action: string;                 // 'node.create', 'node.update'
  resourceType: string;           // 'node', 'project'
  resourceId: string;
  changes: any;                   // 变更内容
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  signature?: string;             // RSA签名（可选）
}
```

---

## 八、性能优化

### 8.1 前端优化
- **懒加载**: 路由、图片、组件按需加载
- **虚拟列表**: 长列表使用虚拟滚动
- **缓存策略**: 
  - API缓存（5分钟）
  - 静态资源CDN缓存
  - IndexedDB本地缓存

### 8.2 后端优化
- **数据库索引**: 
  - `projects.id`, `nodes.projectId`, `nodes.nodeId`
  - `evidences.sha256`, `audit_logs.timestamp`
- **查询优化**: 
  - 分页查询（limit/offset）
  - 只查询必要字段
- **缓存策略**:
  - 热点项目缓存（Redis）
  - 用户会话缓存
  - AI结果缓存（promptHash）

### 8.3 文件处理
- **图片压缩**: 上传前压缩至800KB以内
- **PDF分片**: 大文件分片上传
- **CDN加速**: 静态资源走CDN

---

## 九、部署架构

### 9.1 开发环境
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  postgres:
    image: postgres:14
    ports: ["5432:5432"]
    
  redis:
    image: redis:6
    ports: ["6379:6379"]
    
  backend:
    build: ./backend
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    
  frontend:
    build: ./frontend
    ports: ["8080:8080"]
```

### 9.2 生产环境
```
阿里云/腾讯云部署方案:

1. 云服务器 (ECS)
   - 应用服务器: 2C4G x 2（负载均衡）
   - 数据库: RDS PostgreSQL 4C8G
   - 缓存: Redis 2C4G

2. 对象存储 (OSS/COS)
   - 存储文件/图片/PDF

3. CDN
   - H5静态资源分发

4. 负载均衡 (SLB/CLB)
   - 应用服务器负载均衡
```

---

## 十、监控与运维

### 10.1 日志方案
```typescript
// 使用 Winston
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

### 10.2 监控指标
- **应用监控**: CPU、内存、响应时间
- **业务监控**: 项目数、节点数、AI调用次数
- **错误监控**: 错误率、异常堆栈

---

## 十一、开发规范

### 11.1 代码规范
- **前端**: ESLint + Prettier
- **后端**: ESLint + Prettier
- **Git**: Conventional Commits

### 11.2 分支策略
```
main          (生产环境)
  ↑
develop       (开发环境)
  ↑
feature/*     (功能分支)
hotfix/*      (紧急修复)
```

### 11.3 测试策略
- **单元测试**: Jest (覆盖率 >80%)
- **E2E测试**: Playwright
- **API测试**: Postman/Newman

---

## 十二、项目里程碑

### MVP (2个月)
- ✅ 项目管理基础
- ✅ 节点引擎核心
- ✅ 证据上传+OCR
- ✅ 基础插件系统
- ✅ AI分析PoC
- ✅ 协作评论

### V1.0 (4个月)
- ⬜ 完整插件市场
- ⬜ 舞弊检测引擎
- ⬜ 离线同步
- ⬜ 报表生成
- ⬜ 移动端优化

### V2.0 (6个月)
- ⬜ 多租户支持
- ⬜ 高级数据分析
- ⬜ 第三方集成
- ⬜ 私有化部署方案

---

## 附录

### A. 术语表
- **NodeChain**: 节点链，审计底稿的组织形式
- **Evidence**: 证据，支持审计结论的文档/数据
- **Plugin**: 插件，可扩展的功能模块
- **Fraud Rule**: 舞弊规则，自动检测风险的规则

### B. 参考资料
- uni-app官方文档: https://uniapp.dcloud.net.cn/
- NestJS官方文档: https://nestjs.com/
- 千问API文档: https://help.aliyun.com/zh/dashscope/

---

**文档版本**: v1.0  
**最后更新**: 2024-11-28  
**维护者**: 开发团队
