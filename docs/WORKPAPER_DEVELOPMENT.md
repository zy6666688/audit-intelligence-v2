# 底稿节点编辑器开发文档

## 🎨 设计参考：ComfyUI

本底稿编辑器的界面设计参考了 ComfyUI，采用节点工作流的方式进行审计底稿管理。

### ComfyUI 核心特点
- **暗色主题**：专业的深色界面设计
- **节点工作流**：拖拽式节点编辑
- **可视化连线**：SVG贝塞尔曲线连接
- **侧边面板**：左侧节点库 + 右侧属性面板
- **实时预览**：节点内容实时显示

---

## 📦 已完成功能（Phase 1）

### 1. 底稿详情页 ✅

**文件**: `src/pages/workpaper/detail.vue`

**功能特性**:
- ✅ 顶部工具栏（返回、标题、状态、操作按钮）
- ✅ 三栏布局（节点库 + 画布 + 属性）
- ✅ 面板折叠/展开
- ✅ 缩放控制（放大/缩小/重置）
- ✅ 模态弹窗（添加节点）
- ✅ 暗色主题设计

**关键代码**:
```vue
<view class="workpaper-detail">
  <view class="toolbar">...</view>
  <view class="main-workspace">
    <view class="node-panel">...</view>
    <view class="canvas-container">
      <NodeCanvas />
    </view>
    <view class="property-panel">...</view>
  </view>
</view>
```

---

### 2. 节点画布组件 ✅

**文件**: `src/components/workpaper/NodeCanvas.vue`

**功能特性**:
- ✅ 节点渲染（9种节点类型）
- ✅ 节点拖拽移动
- ✅ SVG连线绘制（贝塞尔曲线）
- ✅ 端口连接（输入/输出）
- ✅ 节点选中状态
- ✅ AI分析状态徽章
- ✅ 节点菜单操作

**节点类型**:

| 分类 | 节点类型 | 图标 | 颜色 | 说明 |
|------|---------|------|------|------|
| 审计节点 | voucher | 📝 | 紫色渐变 | 凭证审计 |
| 审计节点 | invoice | 🧾 | 粉红渐变 | 发票审核 |
| 审计节点 | contract | 📄 | 蓝色渐变 | 合同审核 |
| 审计节点 | bank_flow | 💰 | 绿色渐变 | 银行流水 |
| 分析节点 | data_analysis | 📊 | 橙粉渐变 | 数据分析 |
| 分析节点 | risk_assess | ⚠️ | 红橙渐变 | 风险评估 |
| 分析节点 | anomaly_detect | 🔍 | 青紫渐变 | 异常检测 |
| 输出节点 | summary | 📋 | 青粉渐变 | 总结报告 |
| 输出节点 | conclusion | ✅ | 青粉渐变 | 审计结论 |

**SVG连线算法**:
```typescript
const getConnectionPath = (conn: any) => {
  // 使用三次贝塞尔曲线
  const startX = fromNode.position.x + 260;
  const startY = fromNode.position.y + 60;
  const endX = toNode.position.x;
  const endY = toNode.position.y + 60;
  
  const controlX1 = startX + (endX - startX) / 3;
  const controlY1 = startY;
  const controlX2 = endX - (endX - startX) / 3;
  const controlY2 = endY;
  
  return `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
};
```

---

### 3. 交互功能 ✅

**节点操作**:
- 点击选中节点 → 右侧显示属性
- 拖拽移动节点 → 实时更新位置
- 从节点库添加 → 弹窗选择类型
- 右侧编辑内容 → 实时保存到节点数据

**连线操作**:
- 从输出端口拖拽 → 创建临时连线
- 连接到输入端口 → 建立连接关系
- 点击连线 → 选中连线（可删除）

**缩放控制**:
- 放大：+ 按钮（最大200%）
- 缩小：- 按钮（最小50%）
- 重置：⊙ 按钮（100%）

---

## 🎯 待开发功能（Phase 2）

### 1. 节点内容编辑器 ⏳

**需求**:
- 富文本编辑器（TinyMCE/Quill）
- 表格编辑器
- 公式编辑器
- Markdown支持

**实现建议**:
```vue
<template>
  <view class="node-editor-modal">
    <rich-text-editor v-model="nodeContent" />
    <table-editor v-if="hasTable" />
    <formula-editor v-if="hasFormula" />
  </view>
</template>
```

---

### 2. 自动布局算法 ⏳

**需求**:
- 层次布局（Hierarchical Layout）
- 力导向布局（Force-Directed Layout）
- 网格对齐

**算法参考**:
```typescript
const autoLayout = () => {
  // 使用 dagre 或 elk.js 库
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 100, ranksep: 150 });
  
  nodes.forEach(node => {
    g.setNode(node.id, { width: 260, height: 120 });
  });
  
  connections.forEach(conn => {
    g.setEdge(conn.from, conn.to);
  });
  
  dagre.layout(g);
  
  // 更新节点位置
  nodes.forEach(node => {
    const pos = g.node(node.id);
    node.position = { x: pos.x, y: pos.y };
  });
};
```

---

### 3. AI分析集成 ⏳

**需求**:
- 单节点AI分析
- 全流程AI分析
- 分析结果可视化
- 风险评分展示

**API调用**:
```typescript
const analyzeNode = async (nodeId: string) => {
  const node = nodes.find(n => n.id === nodeId);
  const context = {
    nodeType: node.type,
    content: node.data.content,
    connections: getNodeConnections(nodeId),
    evidences: getRelatedEvidences(nodeId)
  };
  
  const result = await AIService.analyzeNode(context);
  
  node.aiAnalysis = {
    riskLevel: result.riskLevel,
    findings: result.findings,
    suggestions: result.suggestions,
    confidence: result.confidence
  };
};
```

---

### 4. 数据持久化 ⏳

**需求**:
- 自动保存（防止数据丢失）
- 版本控制（历史记录）
- 离线缓存
- 云端同步

**实现方案**:
```typescript
// 自动保存（防抖）
const autoSave = debounce(async () => {
  const data = {
    nodes: nodes.value,
    connections: connections.value,
    metadata: {
      version: Date.now(),
      lastModified: new Date().toISOString()
    }
  };
  
  await workpaperApi.updateWorkpaper(workpaperId.value, data);
  
  // 同时保存到本地
  PlatformAdapter.setStorage(`workpaper_${workpaperId.value}`, data);
}, 2000);

// 监听变化
watch([nodes, connections], () => {
  autoSave();
}, { deep: true });
```

---

### 5. 协作功能 ⏳

**需求**:
- 实时协作（WebSocket）
- 光标位置同步
- 操作冲突解决
- 评论与批注

**技术方案**:
- 使用 Socket.io 或 原生WebSocket
- 实现 OT（Operational Transformation）算法
- 使用颜色区分不同用户

---

## 🛠️ 技术栈

### 已使用技术

| 技术 | 用途 | 说明 |
|------|------|------|
| Vue 3 | 框架 | Composition API |
| TypeScript | 类型系统 | 类型安全 |
| SVG | 连线渲染 | 贝塞尔曲线 |
| SCSS | 样式 | 变量、嵌套 |
| uni-app | 跨端 | H5 + 小程序 |

### 推荐引入技术

| 技术 | 用途 | 优先级 |
|------|------|--------|
| dagre | 自动布局 | P1 |
| @antv/g6 | 图形引擎 | P2 |
| TinyMCE | 富文本编辑 | P1 |
| Socket.io | 实时协作 | P2 |
| IndexedDB | 本地存储 | P1 |

---

## 📐 数据结构设计

### 底稿数据模型

```typescript
interface Workpaper {
  id: string;
  projectId: string;
  title: string;
  status: 'draft' | 'locked' | 'reviewed' | 'approved';
  nodes: WorkpaperNode[];
  connections: NodeConnection[];
  metadata: {
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    version: number;
  };
}

interface WorkpaperNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    title: string;
    content: string;
    fields?: Record<string, any>;
  };
  inputs?: string[];
  outputs?: string[];
  aiAnalysis?: AIAnalysisResult;
  metadata?: {
    createdAt: string;
    updatedAt: string;
  };
}

interface NodeConnection {
  id: string;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
  data?: any;
}

interface AIAnalysisResult {
  riskLevel: 'low' | 'medium' | 'high';
  findings: Finding[];
  suggestions: string[];
  confidence: number;
  analyzedAt: string;
}
```

---

## 🎨 UI/UX 优化建议

### 当前实现 ✅
- 暗色主题（#1e1e1e背景）
- 网格背景（20px间距）
- 节点渐变色（9种不同配色）
- 平滑动画（transition 0.2s）
- 悬停效果

### 待优化 ⏳
1. **性能优化**
   - 虚拟滚动（节点过多时）
   - Canvas替代SVG（节点>100）
   - 防抖节流（拖拽事件）

2. **交互优化**
   - 框选多个节点
   - 批量操作
   - 撤销/重做（Undo/Redo）
   - 快捷键支持

3. **视觉优化**
   - 缩略图导航
   - 小地图（Overview）
   - 节点动画效果
   - 连线动画

---

## 🔌 API接口设计

### 底稿CRUD

```typescript
// 获取底稿详情
GET /workpapers/:id
Response: {
  code: 200,
  data: Workpaper
}

// 更新底稿
PUT /workpapers/:id
Request: {
  title?: string,
  nodes: WorkpaperNode[],
  connections: NodeConnection[]
}
Response: {
  code: 200,
  data: Workpaper
}

// 创建底稿
POST /workpapers
Request: {
  projectId: string,
  title: string,
  type: string
}
Response: {
  code: 200,
  data: Workpaper
}
```

### 节点操作

```typescript
// 添加节点
POST /workpapers/:id/nodes
Request: {
  type: NodeType,
  position: { x: number, y: number },
  data: NodeData
}

// 更新节点
PUT /workpapers/:id/nodes/:nodeId
Request: {
  position?: { x: number, y: number },
  data?: NodeData
}

// 删除节点
DELETE /workpapers/:id/nodes/:nodeId
```

### AI分析

```typescript
// 分析单个节点
POST /ai/analyze-node
Request: {
  nodeId: string,
  workpaperId: string,
  context: AnalysisContext
}
Response: {
  code: 200,
  data: AIAnalysisResult
}

// 分析整个工作流
POST /ai/analyze-workflow
Request: {
  workpaperId: string
}
Response: {
  code: 200,
  data: {
    overallRisk: 'low' | 'medium' | 'high',
    nodeAnalyses: Record<string, AIAnalysisResult>,
    summary: string
  }
}
```

---

## 🚀 部署和测试

### 本地开发

```bash
# 启动H5开发
npm run dev:h5

# 访问底稿编辑器
http://localhost:8080/#/pages/workpaper/detail?id=test-workpaper-1
```

### 测试场景

1. **基础功能测试**
   - [ ] 创建新底稿
   - [ ] 添加各类型节点
   - [ ] 拖拽移动节点
   - [ ] 创建连接线
   - [ ] 编辑节点内容
   - [ ] 保存底稿

2. **交互测试**
   - [ ] 节点选中/取消
   - [ ] 面板折叠/展开
   - [ ] 缩放控制
   - [ ] 响应式布局

3. **性能测试**
   - [ ] 100个节点性能
   - [ ] 拖拽流畅度
   - [ ] 内存占用

---

## 📝 开发日志

### 2024-11-28
- ✅ 创建底稿详情页面结构
- ✅ 实现NodeCanvas画布组件
- ✅ 添加9种节点类型
- ✅ 实现SVG连线渲染
- ✅ 完成基本拖拽交互
- ✅ 实现属性面板编辑

### ✅ 已完成功能（v1.1）
- [x] 集成富文本编辑器 - ✅ 基于uni-app原生editor实现
- [x] 实现自动布局算法 - ✅ 层次/网格/力导向三种布局
- [x] 接入AI分析API - ✅ 千问API集成
- [x] 添加自动保存功能 - ✅ 防抖+版本管理
- [x] 实现历史版本管理 - ✅ 支持50个版本历史

---

## 🎓 参考资料

### ComfyUI相关
- ComfyUI GitHub: https://github.com/comfyanonymous/ComfyUI
- 节点工作流设计模式
- SVG连线算法

### 图形库
- D3.js: https://d3js.org/
- AntV G6: https://g6.antv.vision/
- dagre: https://github.com/dagrejs/dagre

### 编辑器
- TinyMCE: https://www.tiny.cloud/
- Quill: https://quilljs.com/
- ProseMirror: https://prosemirror.net/

---

**文档版本**: v1.1  
**创建日期**: 2024-11-28  
**最后更新**: 2024-11-29  
**作者**: AI Assistant  
**状态**: ✅ v1.1 完成
