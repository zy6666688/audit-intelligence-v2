# 🛠️ 审计数智析重构执行方案 (Execution Plan)

**依据**: `ARCHITECTURE_ROADMAP.md`
**目标**: 平滑迁移至新架构，确保小程序与 Web 端兼容，提升性能。

---

## 📅 Phase 1: 协议标准化与适配 (当前阶段)

此阶段不破坏现有 UI，仅在底层建立新的数据流转标准。

### 1.1 引入核心协议 (已完成)
*   **文件**: `src/types/graph-protocol.ts`
*   **作用**: 定义了 `DataHandle` (数据句柄) 和 `GraphNode` (渲染节点)。
*   **变更点**: 
    *   原有 `any` 数据流 -> `DataHandle` 引用流。
    *   原有前端同步计算 -> 仅传递 `refId`。

### 1.2 建立适配层 (已完成)
*   **文件**: `src/composables/useGraphAdapter.ts`
*   **作用**: 
    *   `transformToGraph`: 将后端存储的 `NodeInstance[]` 转换为渲染引擎需要的格式。
    *   `syncFromGraph`: 监听画布变动，回写业务数据。
*   **冲突评估**: 🟢 **无冲突**。这是一个新增的 Composition API，不影响现有代码。

---

## 🚧 Phase 2: 渲染层并行重构 (Side-by-Side)

为了兼容小程序，我们将采用 **"双引擎"** 策略。

### 2.1 H5/Web 端：集成 Vue Flow (高性能)
1.  **安装依赖**:
    ```bash
    npm install @vue-flow/core @vue-flow/background @vue-flow/controls
    ```
2.  **创建组件**: `src/components/GraphCanvasWeb.vue`
3.  **集成逻辑**:
    *   使用 `useGraphAdapter` 将数据注入 Vue Flow。
    *   自定义节点 (`CustomNode.vue`) 使用 Slot 渲染业务内容。

### 2.2 小程序端：优化 Canvas 渲染 (轻量级)
1.  **保留/优化**: 继续维护 `NodeCanvasV2.vue` (基于 SVG/Canvas)。
2.  **性能优化**:
    *   **虚拟滚动**: 仅渲染视口(`viewport`)内的节点。
    *   **缩略图模式**: 缩小时仅绘制方块，不绘制文字详情。

### 2.3 统一入口
修改 `src/pages/flow/index.vue`:
```vue
<template>
  <!-- H5/PC 端使用 Vue Flow -->
  <GraphCanvasWeb v-if="isPC" :data="graphData" />
  
  <!-- 小程序端使用原生优化版 -->
  <NodeCanvasV2 v-else :nodes="nodes" :connections="connections" />
</template>
```

---

## ⚙️ Phase 3: 引擎后端化 (The Brain Transplant)

此阶段是将“计算”从前端剥离的关键。

### 3.1 改造 FlowEngine
*   **当前位置**: `src/utils/flowEngine.ts`
*   **修改计划**:
    1.  **移除计算逻辑**: 删除所有具体的业务计算（如过滤、求和）。
    2.  **增加调度逻辑**: 
        ```typescript
        // 修改 executeNode
        async executeNode(nodeId) {
           // 1. 收集输入 Ref
           const inputs = this.gatherInputs(nodeId);
           // 2. 发送给后端
           const resultRef = await api.post('/task/dispatch', { type, inputs });
           // 3. 更新输出
           this.nodeResults[nodeId] = resultRef;
        }
        ```

### 3.2 后端服务对接 (Python/Node)
*   **新增接口**: `/api/task/dispatch`
*   **逻辑**: 接收 `refId` -> 读取数据库 -> 执行 Pandas/SQL -> 写入新表 -> 返回新 `refId`。

---

## 🛡️ 冲突与风险评估

| 风险点 | 描述 | 解决方案 |
| :--- | :--- | :--- |
| **数据格式不兼容** | 旧存档是全量 JSON，新架构是 RefId。 | **迁移脚本**: 在加载旧存档时，自动将 JSON 数据存入 IndexedDB/后端，生成临时 RefId。 |
| **小程序性能瓶颈** | SVG 节点过多导致卡顿。 | **分页加载 + 简化渲染**: 小程序端强制开启“精简模式”，不显示过多节点细节。 |
| **团队协作冲突** | 多人同时修改 `FlowEngine.ts`。 | **模块化拆分**: 将 `executeNode` 拆分为多个 Strategy 文件，避免大文件冲突。 |

---

## ✅ 下一步立即执行 (Next Steps)

1.  **安装 Vue Flow (仅 H5 开发环境)**。
2.  **创建 `GraphCanvasWeb.vue`** 骨架。
3.  **测试适配器**: 编写单元测试验证 `useGraphAdapter` 能正确转换数据。

---
**执行建议**: 
优先在 **Web 端** 完成 Vue Flow 的集成验证，确认交互体验（缩放、拖拽）有质的飞跃后，再逐步移植回小程序端的简化版。
