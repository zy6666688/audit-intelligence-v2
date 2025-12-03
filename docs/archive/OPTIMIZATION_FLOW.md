# 🛡️ 核心引擎无债迁移流程与评估报告

**依据**: `ARCHITECTURE_ROADMAP.md`
**目标**: 在不破坏现有业务的前提下，将核心计算逻辑迁移至高性能架构，并建立永久性的质量防线。

---

## 🔄 1. 标准化优化流程 (SOP)

为了防止技术债蔓延，所有模块的重构必须遵循以下 **5步闭环流程**：

### 步骤一：建立契约 (Contract First)
在编写任何实现代码前，先定义**类型契约**。
*   **动作**: 在 `src/types/protocol/` 下定义输入/输出接口。
*   **防债机制**: 强制使用 TypeScript 严格模式，禁止 `any`。
*   **产出**: `*.d.ts` 文件。

### 步骤二：建立防腐层 (Anti-Corruption Layer, ACL)
不要直接修改旧代码，而是建立适配器。
*   **动作**: 创建 `Adapter` 将旧数据格式（`NodeInstance`）转换为新格式（`GraphNode` / `DataHandle`）。
*   **防债机制**: 隔离脏数据，确保新引擎只接收纯净、标准的数据。
*   **产出**: `useGraphAdapter.ts` (已完成原型)。

### 步骤三：双轨运行 (Parallel Run)
新旧引擎同时存在，通过**特性开关 (Feature Toggle)** 控制。
*   **动作**:
    ```typescript
    const execute = async (task) => {
      if (useNewEngine(task.type)) {
        return await NewBackendRunner.run(task);
      }
      return await LegacyFrontendRunner.run(task); // 旧逻辑兜底
    };
    ```
*   **防债机制**: 避免"大爆炸"式重构带来的系统瘫痪风险。

### 步骤四：契约测试 (Contract Testing)
*   **动作**: 编写单元测试，验证新旧引擎对相同的输入是否产生（逻辑上）一致的输出。
*   **防债机制**: 自动化回归测试是防止逻辑退化的唯一手段。

### 步骤五：逐步绞杀 (Strangle & Deprecate)
*   **动作**: 逐个节点类型迁移。每迁移一个，就标记旧代码为 `@deprecated`。
*   **最终状态**: 当所有节点都迁移完毕，一次性删除旧引擎代码。

---

## 📊 2. 方案评估 (Assessment)

### 2.1 代码冲突风险：**低 (Low)**
*   **原因**: 我们采用了 **增量式 (Additive)** 开发。
    *   新逻辑写在 `src/services/engine-v2/`。
    *   新类型写在 `src/types/graph-protocol.ts`。
    *   旧代码（`flowEngine.ts`）保持原样或仅作最小修改（路由分发）。
*   **兼容性**: 通过 `useGraphAdapter`，Vue Flow 组件可以无缝消费旧的存储数据。

### 2.2 技术债风险：**中 (Medium)** -> **低 (Low)**
*   **潜在风险**: 如果适配器逻辑过于复杂，适配器本身可能变成技术债。
*   **缓解措施**:
    *   适配器必须是纯函数 (Pure Function)。
    *   适配器不包含业务逻辑，只做字段映射。

### 2.3 性能收益：**极高 (Very High)**
*   **渲染**: Vue Flow 将 DOM 操作减少 90% 以上（虚拟滚动）。
*   **计算**: 数据引用传递消除了浏览器内存瓶颈，理论上支持 GB 级数据审计。

---

## 🛠️ 3. 下一步执行计划 (Action Plan)

基于此流程，我们将立即启动 **Phase 2 (数据层改造)** 的第一步。

1.  **重构 `DependencyGraph`**:
    *   **现状**: 强耦合于后端服务，测试依赖 Mock。
    *   **目标**: 抽象为纯逻辑的 `GraphCore`，不依赖具体数据库。
2.  **实现 `DataHandle` 机制**:
    *   修改 `DataBlock` 服务，使其返回 `refId` 而非 `data`。
3.  **迁移首个核心节点**:
    *   选择 **"数据过滤 (Filter)"** 节点作为试点，实现前后端分离执行。

---

**结论**: 此流程以**稳健性**为第一优先级。虽然初期会有少量胶水代码（适配器），但它保证了系统的可测试性和可维护性，是当前架构下的最优解。
