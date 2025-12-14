# 审计数智析 - 功能开发详细文档

## 📋 功能模块总览

基于业务逻辑的强关联性，将功能分为5大核心模块：

1. **用户认证与权限模块** (已完成70%)
2. **项目管理模块** (已完成40%)
3. **底稿与证据管理模块** (已完成30%)
4. **AI智能分析模块** (未开始)
5. **协作与审批模块** (未开始)

---

## 🎯 模块一：用户认证与权限管理

### 功能关联图
```
用户认证
  ├── 登录认证 ✅
  ├── 权限管理 ⏳
  ├── 角色管理 ⏳
  └── 用户设置 ⏳
```

### 1.1 登录认证 ✅ (已完成)

**相关文件**:
- `src/pages/login/index.vue`
- `src/api/auth.ts`
- `src/store/user.ts`

**已实现功能**:
- [x] 微信小程序登录
- [x] H5密码登录
- [x] 企业微信登录（接口预留）
- [x] Token持久化存储
- [x] 登录状态管理

**API接口**:
```typescript
// POST /auth/wx/login - 微信登录
{
  code: string
}

// POST /auth/login - 账号密码登录
{
  username: string,
  password: string
}

// POST /auth/wxwork/login - 企业微信登录
{
  code: string
}
```

---

### 1.2 权限管理 ⏳ (待开发)

**开发优先级**: P1 (高)  
**预计工时**: 2天  
**依赖**: 登录认证 ✅

#### 功能需求

1. **角色定义**
   ```typescript
   enum UserRole {
     ADMIN = 'admin',           // 管理员
     AUDITOR = 'auditor',       // 审计师
     ASSISTANT = 'assistant',   // 助理
     REVIEWER = 'reviewer'      // 复核员
   }
   ```

2. **权限配置**
   ```typescript
   interface Permission {
     module: string;           // 模块名
     actions: string[];        // 操作权限 ['view', 'create', 'edit', 'delete']
   }
   
   // 示例配置
   const rolePermissions = {
     admin: ['*'],  // 所有权限
     auditor: ['project:*', 'workpaper:*', 'evidence:*'],
     assistant: ['project:view', 'evidence:create', 'evidence:upload'],
     reviewer: ['project:view', 'workpaper:view', 'workpaper:review']
   };
   ```

3. **权限检查工具**
   ```typescript
   // src/utils/permission.ts
   export class PermissionChecker {
     static hasPermission(permission: string): boolean
     static hasRole(role: UserRole): boolean
     static canAccess(module: string, action: string): boolean
   }
   ```

#### 开发任务

- [ ] **Task 1.2.1**: 创建权限配置文件 `src/config/permissions.ts`
- [ ] **Task 1.2.2**: 实现权限检查工具 `src/utils/permission.ts`
- [ ] **Task 1.2.3**: 添加路由守卫 `src/router/guards.ts`
- [ ] **Task 1.2.4**: 在用户Store中集成权限数据
- [ ] **Task 1.2.5**: 创建权限指令 `v-permission`

#### API接口需求
```typescript
// GET /auth/permissions - 获取当前用户权限
Response: {
  role: UserRole,
  permissions: Permission[]
}
```

---

### 1.3 用户设置 ⏳ (待开发)

**开发优先级**: P2 (中)  
**预计工时**: 1天

#### 功能清单

- [ ] **个人信息编辑**
  - 头像上传
  - 昵称修改
  - 联系方式更新

- [ ] **密码修改**
  - 验证旧密码
  - 设置新密码
  - 密码强度检查

- [ ] **通知设置**
  - 项目通知开关
  - 评论提醒开关
  - 任务通知开关

#### 页面文件
- `src/pages/profile/settings.vue` (待创建)
- `src/pages/profile/password.vue` (待创建)

---

## 🎯 模块二：项目管理

### 功能关联图
```
项目管理
  ├── 项目列表 ✅
  ├── 项目详情 ⏳
  ├── 项目创建/编辑 ⏳
  ├── 成员管理 ⏳
  └── 项目统计 ⏳
```

### 2.1 项目CRUD ⏳ (核心功能)

**开发优先级**: P0 (最高)  
**预计工时**: 3天  
**强关联功能**: 项目详情 + 项目编辑 + 成员管理

#### 数据模型

```typescript
interface Project {
  id: string;
  name: string;                    // 项目名称
  client: string;                  // 客户名称
  type: ProjectType;               // 项目类型
  status: ProjectStatus;           // 项目状态
  description?: string;            // 项目描述
  startDate: string;               // 开始日期
  endDate?: string;                // 结束日期
  progress: number;                // 进度 0-100
  members: ProjectMember[];        // 成员列表
  statistics: ProjectStatistics;   // 统计数据
  createdBy: string;              
  createdAt: string;
  updatedAt: string;
}

enum ProjectType {
  ANNUAL_AUDIT = 'annual_audit',           // 年度审计
  SPECIAL_AUDIT = 'special_audit',         // 专项审计
  INTERNAL_CONTROL = 'internal_control',   // 内部控制审计
  DUE_DILIGENCE = 'due_diligence'         // 尽职调查
}

enum ProjectStatus {
  DRAFT = 'draft',                 // 草稿
  IN_PROGRESS = 'in_progress',     // 进行中
  REVIEW = 'review',               // 待审核
  APPROVED = 'approved',           // 已批准
  COMPLETED = 'completed',         // 已完成
  ARCHIVED = 'archived'            // 已归档
}

interface ProjectMember {
  userId: string;
  userName: string;
  role: UserRole;
  joinedAt: string;
}

interface ProjectStatistics {
  workpaperCount: number;      // 底稿数量
  evidenceCount: number;       // 证据数量
  taskCount: number;           // 任务数量
  completedTaskCount: number;  // 已完成任务
}
```

#### 开发任务拆分

**Phase 2.1 - 项目详情页 (1.5天)**

- [ ] **Task 2.1.1**: 创建项目详情页面 `src/pages/project/detail.vue`
  - 项目基本信息展示
  - 统计数据卡片
  - 成员列表展示
  - 底稿列表预览
  - 操作按钮（编辑、归档、删除）

- [ ] **Task 2.1.2**: 实现项目详情API
  ```typescript
  // GET /projects/:id
  // PUT /projects/:id
  // DELETE /projects/:id
  ```

**Phase 2.2 - 项目创建/编辑 (1天)**

- [ ] **Task 2.2.1**: 创建项目表单组件 `src/components/project/ProjectForm.vue`
  - 项目信息表单
  - 客户选择/创建
  - 日期选择器
  - 表单验证

- [ ] **Task 2.2.2**: 实现创建/编辑逻辑
  - 表单提交处理
  - 数据校验
  - 成功/失败提示

**Phase 2.3 - 成员管理 (0.5天)**

- [ ] **Task 2.3.1**: 创建成员管理组件 `src/components/project/MemberManager.vue`
  - 成员列表
  - 添加成员（搜索用户）
  - 修改成员角色
  - 移除成员
  
- [ ] **Task 2.3.2**: 实现成员管理API
  ```typescript
  // GET /projects/:id/members
  // POST /projects/:id/members
  // PUT /projects/:id/members/:userId
  // DELETE /projects/:id/members/:userId
  ```

#### 页面路由

```typescript
// pages.json 新增
{
  path: 'pages/project/form',
  style: {
    navigationBarTitleText: '项目信息'
  }
}
```

---

### 2.2 项目统计看板 ⏳

**开发优先级**: P2 (中)  
**预计工时**: 1天

#### 功能需求

- [ ] **统计卡片**
  - 底稿完成度
  - 证据数量统计
  - 任务进度
  - 风险评分

- [ ] **图表展示**
  - 进度趋势图（ECharts）
  - 成员工作量分布
  - 风险分类统计

#### 相关文件
- `src/components/project/StatisticsCard.vue` (待创建)
- `src/components/project/ProgressChart.vue` (待创建)

---

## 🎯 模块三：底稿与证据管理

### 功能关联图
```
底稿管理
  ├── 底稿CRUD ⏳
  ├── 节点编辑器 ⏳
  └── 节点关系管理 ⏳

证据管理
  ├── 证据上传 ⏳
  ├── 证据预览 ⏳
  ├── OCR识别 ⏳
  └── 证据分类 ⏳
```

### 3.1 底稿管理 (强关联：节点引擎)

**开发优先级**: P0 (最高)  
**预计工时**: 4天  
**核心价值**: 系统最核心的业务功能

#### 数据模型

```typescript
interface Workpaper {
  id: string;
  projectId: string;
  title: string;
  type: WorkpaperType;
  status: WorkpaperStatus;
  nodes: WorkpaperNode[];          // 节点列表
  evidenceIds: string[];           // 关联证据
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

enum WorkpaperType {
  VOUCHER = 'voucher',           // 凭证审计
  INVOICE = 'invoice',           // 发票审计
  CONTRACT = 'contract',         // 合同审计
  BANK_FLOW = 'bank_flow',       // 银行流水
  ANALYSIS = 'analysis'          // 分析报告
}

enum WorkpaperStatus {
  DRAFT = 'draft',               // 草稿
  LOCKED = 'locked',             // 已锁定
  REVIEWED = 'reviewed',         // 已复核
  APPROVED = 'approved'          // 已批准
}

interface WorkpaperNode {
  nodeId: string;
  title: string;
  type: string;
  content: NodeContent;
  position: { x: number; y: number };
  inputs: NodeConnection[];      // 输入连接
  outputs: NodeConnection[];     // 输出连接
  aiAnalysis?: AIAnalysisResult;
}

interface NodeContent {
  blocks: ContentBlock[];
}

interface ContentBlock {
  id: string;
  type: 'text' | 'table' | 'image' | 'formula';
  data: any;
}

interface NodeConnection {
  nodeId: string;
  portId: string;
}
```

#### 开发任务拆分

**Phase 3.1 - 底稿列表与详情 (1.5天)**

- [ ] **Task 3.1.1**: 完善底稿列表页 `src/pages/workpaper/list.vue`
  - 底稿卡片展示
  - 筛选（按类型、状态）
  - 搜索功能
  - 新建底稿按钮

- [ ] **Task 3.1.2**: 实现底稿详情页 `src/pages/workpaper/detail.vue`
  - 节点画布展示
  - 底稿信息面板
  - 关联证据列表
  - 操作工具栏

**Phase 3.2 - 节点编辑器 (2天)**

- [ ] **Task 3.2.1**: 创建节点画布组件 `src/components/workpaper/NodeCanvas.vue`
  - 使用 Canvas 或 SVG 渲染
  - 节点拖拽
  - 连线绘制
  - 缩放和平移

- [ ] **Task 3.2.2**: 创建节点编辑器 `src/components/workpaper/NodeEditor.vue`
  - 富文本编辑器
  - 表格编辑器
  - 公式编辑器
  - 图片上传

- [ ] **Task 3.2.3**: 实现节点类型库
  ```typescript
  // src/config/node-types.ts
  export const nodeTypes = {
    voucher: { name: '凭证节点', icon: '📝', color: '#1890ff' },
    invoice: { name: '发票节点', icon: '🧾', color: '#52c41a' },
    analysis: { name: '分析节点', icon: '📊', color: '#faad14' }
  };
  ```

**Phase 3.3 - 节点关系管理 (0.5天)**

- [ ] **Task 3.3.1**: 实现节点连接逻辑
  - 拖拽连线
  - 连接验证
  - 自动布局

- [ ] **Task 3.3.2**: 节点数据流
  - 数据传递
  - 依赖计算

#### API接口

```typescript
// 底稿CRUD
GET    /workpapers?projectId=xxx
GET    /workpapers/:id
POST   /workpapers
PUT    /workpapers/:id
DELETE /workpapers/:id

// 节点操作
POST   /workpapers/:id/nodes
PUT    /workpapers/:id/nodes/:nodeId
DELETE /workpapers/:id/nodes/:nodeId
POST   /workpapers/:id/nodes/connect
```

---

### 3.2 证据管理 (强关联：文件上传 + OCR)

**开发优先级**: P0 (最高)  
**预计工时**: 3天

#### 数据模型

```typescript
interface Evidence {
  id: string;
  projectId: string;
  workpaperId?: string;
  title: string;
  description?: string;
  type: EvidenceType;
  fileInfo: FileInfo;
  ocrResult?: OCRResult;
  tags: string[];
  uploadedBy: string;
  uploadedAt: string;
}

enum EvidenceType {
  IMAGE = 'image',
  PDF = 'pdf',
  EXCEL = 'excel',
  WORD = 'word',
  OTHER = 'other'
}

interface FileInfo {
  url: string;
  size: number;
  mimeType: string;
  sha256: string;
  thumbnail?: string;
}

interface OCRResult {
  type: 'invoice' | 'voucher' | 'contract';
  confidence: number;
  data: any;
  recognizedAt: string;
}
```

#### 开发任务拆分

**Phase 3.2.1 - 证据上传 (1.5天)**

- [ ] **Task 3.2.1.1**: 实现证据上传页 `src/pages/evidence/upload.vue`
  - 文件选择（图片/PDF/文档）
  - 批量上传
  - 上传进度显示
  - 缩略图预览
  - SHA256计算

- [ ] **Task 3.2.1.2**: 创建上传组件 `src/components/evidence/EvidenceUploader.vue`
  - 拖拽上传
  - 文件大小限制
  - 文件类型验证
  - 压缩处理（图片）

**Phase 3.2.2 - 证据预览 (0.5天)**

- [ ] **Task 3.2.2.1**: 创建预览组件 `src/components/evidence/EvidencePreview.vue`
  - 图片预览（放大、旋转）
  - PDF预览
  - 文档预览
  - 下载功能

**Phase 3.2.3 - OCR识别 (1天)**

- [ ] **Task 3.2.3.1**: 集成腾讯云OCR
  ```typescript
  // src/utils/ocr.ts
  export class OCRService {
    static async recognizeInvoice(imageUrl: string): Promise<InvoiceOCRResult>
    static async recognizeVoucher(imageUrl: string): Promise<VoucherOCRResult>
  }
  ```

- [ ] **Task 3.2.3.2**: 创建OCR结果展示组件
  - 识别结果展示
  - 字段编辑
  - 结果确认

#### API接口

```typescript
// 证据管理
GET    /evidences?projectId=xxx&workpaperId=xxx
GET    /evidences/:id
POST   /evidences/upload
DELETE /evidences/:id

// OCR识别
POST   /evidences/:id/ocr
GET    /evidences/:id/ocr-result
```

---

## 🎯 模块四：AI智能分析

### 功能关联图
```
AI分析
  ├── 节点AI分析 ⏳
  ├── 风险识别 ⏳
  ├── 异常检测 ⏳
  └── 智能建议 ⏳
```

### 4.1 AI分析引擎

**开发优先级**: P1 (高)  
**预计工时**: 3天  
**依赖**: 底稿管理 ✅, 证据管理 ✅

#### 功能需求

```typescript
interface AIAnalysisRequest {
  nodeId: string;
  type: AnalysisType;
  context: {
    evidences: Evidence[];
    relatedNodes: WorkpaperNode[];
    projectInfo: Project;
  };
}

enum AnalysisType {
  RISK_ASSESSMENT = 'risk_assessment',     // 风险评估
  ANOMALY_DETECTION = 'anomaly_detection', // 异常检测
  SUMMARY = 'summary',                     // 智能总结
  SUGGESTION = 'suggestion'                // 审计建议
}

interface AIAnalysisResult {
  type: AnalysisType;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  findings: Finding[];
  suggestions: string[];
  confidence: number;
  analyzedAt: string;
}

interface Finding {
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  evidence?: string;
}
```

#### 开发任务

- [ ] **Task 4.1.1**: 创建AI服务封装 `src/services/ai.service.ts`
  ```typescript
  export class AIService {
    // 千问API封装
    static async analyzeNode(request: AIAnalysisRequest): Promise<AIAnalysisResult>
    static async generatePrompt(context: any): string
    static async parseResponse(response: string): AIAnalysisResult
  }
  ```

- [ ] **Task 4.1.2**: Prompt模板管理 `src/config/ai-prompts.ts`
  - 风险评估模板
  - 异常检测模板
  - 总结生成模板

- [ ] **Task 4.1.3**: 创建AI分析结果组件
  - 分析进度显示
  - 结果卡片
  - 发现列表
  - 建议操作

#### API接口

```typescript
// AI分析
POST   /ai/analyze
GET    /ai/analysis/:id
POST   /ai/batch-analyze
```

---

## 🎯 模块五：协作与审批

### 功能关联图
```
协作功能
  ├── 评论系统 ⏳
  ├── 任务管理 ⏳
  ├── 审批流程 ⏳
  └── 操作日志 ⏳
```

### 5.1 评论与讨论

**开发优先级**: P2 (中)  
**预计工时**: 2天

#### 数据模型

```typescript
interface Comment {
  id: string;
  targetType: 'project' | 'workpaper' | 'evidence';
  targetId: string;
  content: string;
  mentions: string[];        // @用户
  attachments?: string[];
  createdBy: string;
  createdAt: string;
  replies?: Comment[];
}
```

#### 开发任务

- [ ] **Task 5.1.1**: 创建评论组件 `src/components/common/CommentList.vue`
- [ ] **Task 5.1.2**: @提醒功能
- [ ] **Task 5.1.3**: 评论通知

---

### 5.2 任务管理

**开发优先级**: P2 (中)  
**预计工时**: 2天

#### 数据模型

```typescript
interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assignee: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  relatedWorkpaper?: string;
}

enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done'
}

enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}
```

---

### 5.3 审批流程

**开发优先级**: P1 (高)  
**预计工时**: 3天

#### 流程设计

```typescript
interface ApprovalFlow {
  id: string;
  name: string;
  steps: ApprovalStep[];
}

interface ApprovalStep {
  stepId: string;
  name: string;
  approvers: string[];       // 审批人
  type: 'sequential' | 'parallel';  // 串行/并行
  condition?: string;
}

interface ApprovalRecord {
  id: string;
  flowId: string;
  targetType: 'workpaper' | 'project';
  targetId: string;
  currentStep: number;
  status: 'pending' | 'approved' | 'rejected';
  history: ApprovalHistory[];
}
```

---

## 📊 开发优先级总览

### Sprint 1 (Week 1-2) - 核心功能

**目标**: 完成项目和底稿的基本CRUD

| 任务 | 优先级 | 工时 | 负责人 |
|------|--------|------|--------|
| 2.1 项目详情页 | P0 | 1.5天 | - |
| 2.2 项目创建/编辑 | P0 | 1天 | - |
| 2.3 成员管理 | P0 | 0.5天 | - |
| 3.1 底稿管理 | P0 | 4天 | - |
| **总计** | - | **7天** | - |

### Sprint 2 (Week 3-4) - 证据与AI

**目标**: 完成证据上传和AI分析

| 任务 | 优先级 | 工时 | 负责人 |
|------|--------|------|--------|
| 3.2 证据管理 | P0 | 3天 | - |
| 4.1 AI分析引擎 | P1 | 3天 | - |
| 1.2 权限管理 | P1 | 2天 | - |
| **总计** | - | **8天** | - |

### Sprint 3 (Week 5-6) - 协作功能

**目标**: 完成协作和审批

| 任务 | 优先级 | 工时 | 负责人 |
|------|--------|------|--------|
| 5.3 审批流程 | P1 | 3天 | - |
| 5.1 评论系统 | P2 | 2天 | - |
| 5.2 任务管理 | P2 | 2天 | - |
| 2.2 项目统计 | P2 | 1天 | - |
| **总计** | - | **8天** | - |

---

## 🔧 技术实现规范

### 代码规范

```typescript
// 1. 组件命名：大驼峰
ProjectDetail.vue
NodeEditor.vue

// 2. API文件：小驼峰
projectApi.ts
workpaperApi.ts

// 3. 工具类：小驼峰
permission.ts
validator.ts

// 4. 常量：大写下划线
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
```

### API响应格式

```typescript
// 成功响应
{
  code: 200,
  data: any,
  message: 'success'
}

// 错误响应
{
  code: 400,
  data: null,
  message: '错误信息'
}
```

### 错误处理

```typescript
try {
  const result = await api.call();
} catch (error) {
  // 1. 记录错误日志
  console.error('操作失败:', error);
  
  // 2. 用户友好提示
  PlatformAdapter.showToast('操作失败，请重试', 'none');
  
  // 3. 上报错误（生产环境）
  if (process.env.NODE_ENV === 'production') {
    errorReport.send(error);
  }
}
```

---

## 📝 文档更新要求

每完成一个模块，需要更新：

1. **README.md** - 更新功能完成度
2. **TESTING_REPORT.md** - 添加测试结果
3. **API文档** - 补充接口说明
4. **CHANGELOG.md** - 记录版本变更

---

**文档版本**: v2.0  
**创建日期**: 2024-11-28  
**最后更新**: 2024-11-28
