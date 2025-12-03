# 🎯 审计底稿引擎 - 功能总结

**更新时间**: 2023-12-05  
**版本**: v1.0.1

---

## 📊 新增功能（基于现有代码改进）

### 1. 实用审计节点 ✅

已添加3个专业审计节点：

#### 📊 数据对比节点 (`audit.data_compare`)
- **功能**: 对比两组数据，找出差异项
- **用途**: 账面与实际数据对比、期初期末对比
- **输入**: source1, source2, keyField
- **输出**: matches, onlyInSource1, onlyInSource2, differences
- **特性**:
  - 支持自定义主键字段
  - 可指定对比字段列表
  - 支持忽略大小写
  - 自动生成对比摘要

#### 💰 金额计算节点 (`audit.amount_calculate`)
- **功能**: 对金额数据进行统计计算
- **用途**: 金额汇总、平均值计算、异常金额识别
- **输入**: data, amountField
- **输出**: sum, average, max, min, count
- **特性**:
  - 支持分组计算
  - 可控制小数精度
  - 自动处理空值
  - 适用于财务审计

#### 🎲 审计抽样节点 (`audit.sampling`)
- **功能**: 按审计标准进行数据抽样
- **用途**: 样本选择、风险导向抽样
- **输入**: data
- **输出**: samples, samplingRate
- **特性**:
  - 4种抽样方法：
    - `random` - 随机抽样
    - `systematic` - 系统抽样
    - `stratified` - 分层抽样
    - `top` - Top-N抽样
  - 灵活配置样本量
  - 支持分层字段
  - 自动计算抽样率

### 2. 数据处理节点 ✅

已添加4个数据处理节点：

#### 📄 CSV读取节点 (`data.csv_reader`)
- CSV文件读取和解析
- 支持自定义分隔符
- 支持多种编码格式
- 自动识别列标题

#### 🔍 数据过滤节点 (`data.filter`)
- 按条件过滤数据行
- 支持7种比较操作符
- 同时输出过滤和拒绝数据
- 适用于数据清洗

#### 🔄 数据映射节点 (`data.map`)
- 字段名称转换
- 字段重命名
- 支持保留原始字段
- 灵活的映射规则

#### 📊 数据聚合节点 (`data.aggregate`)
- 分组聚合计算
- 支持5种聚合函数
- 多字段分组
- 自定义聚合规则

---

## 📚 完整使用示例

### 示例1: 数据对比审计工作流

```typescript
import { NodeRegistryV2 } from './services/NodeRegistryV2';
import { ExecutionEngineV2 } from './services/ExecutionEngineV2';
import { allNodes } from './nodes';

// 注册所有节点
const registry = new NodeRegistryV2();
allNodes.forEach(nodeDef => registry.register(nodeDef));

// 构建工作流
const workflow = {
  nodes: [
    { id: 'csv1', type: 'data.csv_reader', config: {...} },
    { id: 'csv2', type: 'data.csv_reader', config: {...} },
    { id: 'compare', type: 'audit.data_compare', config: {...} },
    { id: 'calc', type: 'audit.amount_calculate', config: {...} }
  ],
  edges: [
    { from: 'csv1.data', to: 'compare.source1' },
    { from: 'csv2.data', to: 'compare.source2' },
    { from: 'compare.differences', to: 'calc.data' }
  ]
};

// 执行
const engine = new ExecutionEngineV2(registry);
const result = await engine.executeGraph(workflow);
```

### 示例2: 过滤和聚合流程

```typescript
const workflow = {
  nodes: [
    { id: 'reader', type: 'data.csv_reader' },
    { id: 'filter', type: 'data.filter', config: {
      field: 'amount',
      operator: 'greaterThan',
      value: 1000
    }},
    { id: 'aggregate', type: 'data.aggregate', config: {
      groupBy: ['department'],
      aggregations: {
        total: { function: 'sum', sourceField: 'amount' }
      }
    }},
    { id: 'sampling', type: 'audit.sampling', config: {
      method: 'top',
      sampleSize: 5
    }}
  ]
};
```

---

## 🎯 节点统计

### 按类别

| 类别 | 节点数量 | 说明 |
|------|---------|------|
| 数据输入 | 1 | CSV读取 |
| 数据转换 | 3 | 过滤、映射、聚合 |
| 审计专用 | 3 | 对比、计算、抽样 |
| AI智能 | 9 | 文本分析、数据分析、审计检查 |
| 测试节点 | 3 | 简单加法、乘法、回显 |
| **总计** | **19** | - |

### 按功能

- **数据读取**: 1个
- **数据清洗**: 2个
- **数据转换**: 2个
- **数据分析**: 3个
- **审计专用**: 3个
- **AI智能**: 9个

---

## 📂 文件结构

```
packages/backend/src/
├── nodes/
│   ├── AuditNodes.ts        ✅ 新增 - 审计专用节点
│   ├── DataNodes.ts          ✅ 新增 - 数据处理节点
│   ├── index.ts              ✅ 更新 - 导出所有节点
│   ├── simple_add.ts         已有 - 测试节点
│   ├── simple_multiply.ts    已有 - 测试节点
│   └── echo.ts               已有 - 测试节点
├── examples/
│   ├── auditWorkflowExample.ts  ✅ 新增 - 完整示例
│   └── README.md                ✅ 新增 - 示例文档
├── ai/                       已有 - AI集成
├── services/                 已有 - 核心服务
└── collaboration/            已有 - 协作系统
```

---

## 🚀 使用指南

### 快速开始

```bash
# 1. 查看示例
cd packages/backend/src/examples
cat README.md

# 2. 运行示例（需要先编译）
npm run build
node dist/examples/auditWorkflowExample.js

# 3. 使用ts-node直接运行
npx ts-node src/examples/auditWorkflowExample.ts
```

### 注册节点

```typescript
import { allNodes } from './nodes';
import { NodeRegistryV2 } from './services/NodeRegistryV2';

const registry = new NodeRegistryV2();

// 方式1: 注册所有节点
allNodes.forEach(node => registry.register(node));

// 方式2: 按类别注册
import { auditNodes, dataNodes } from './nodes';
auditNodes.forEach(node => registry.register(node));
dataNodes.forEach(node => registry.register(node));

// 方式3: 单独注册
import { createDataCompareNode } from './nodes/AuditNodes';
registry.register(createDataCompareNode());
```

### 使用节点

```typescript
// 构建节点实例
const compareNode: NodeInstance = {
  id: 'compare_1',
  type: 'audit.data_compare',
  position: { x: 400, y: 200 },
  config: {
    compareFields: ['amount', 'date'],
    ignoreCase: true
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// 执行单个节点
const result = await registry.execute(
  'audit.data_compare',
  {
    source1: data1,
    source2: data2,
    keyField: 'id'
  },
  compareNode.config
);
```

---

## 💡 最佳实践

### 1. 节点组合

**数据清洗流程**:
```
CSV读取 → 数据过滤 → 数据映射 → 输出
```

**审计对比流程**:
```
CSV读取1 ┐
         ├→ 数据对比 → 金额计算 → 抽样 → 输出
CSV读取2 ┘
```

**综合分析流程**:
```
CSV读取 → 过滤 → 聚合 → AI分析 → 审计检查 → 报告生成
```

### 2. 配置建议

```typescript
// ✅ 好的配置
{
  field: 'amount',
  operator: 'greaterThan',
  value: 1000,
  precision: 2
}

// ❌ 避免
{
  value: 1000  // 缺少必要的field和operator
}
```

### 3. 错误处理

```typescript
try {
  const result = await engine.executeGraph(graph);
} catch (error) {
  if (error.nodeId) {
    console.error(`节点 ${error.nodeId} 执行失败:`, error.message);
  }
}
```

---

## 📈 性能建议

### 大数据处理

```typescript
// 1. 启用流式处理
config: {
  streaming: true,
  batchSize: 1000
}

// 2. 使用过滤减少数据量
CSV读取 → 立即过滤 → 后续处理

// 3. 合理使用聚合
先聚合降维 → 再进行复杂计算
```

### 并行优化

```typescript
// 利用执行引擎的并行能力
// 无依赖关系的节点会自动并行执行
CSV1 ┐
CSV2 ├→ 对比  // CSV1和CSV2会并行执行
CSV3 ┘
```

---

## 🔧 扩展开发

### 创建自定义节点

```typescript
export function createCustomNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'custom.my_node',
    version: '1.0.0',
    category: 'audit',
    label: { zh: '自定义节点', en: 'Custom Node' },
    description: { zh: '自定义审计逻辑', en: 'Custom audit logic' },
    inputsSchema: {
      data: { type: 'array', required: true }
    },
    outputsSchema: {
      result: { type: 'any' }
    },
    capabilities: ['cpu-bound'],
    metadata: {
      author: 'Your Name',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['custom', 'audit']
    }
  };

  const execute = async (inputs: any, config: any, context: ExecutionContext) => {
    // 实现自定义逻辑
    const { data } = inputs;
    const result = data.map((item: any) => {
      // 处理逻辑
      return item;
    });
    
    return { result };
  };

  return { manifest, execute };
}
```

---

## 📞 技术支持

- 📚 详细文档: `packages/backend/src/examples/README.md`
- 💻 示例代码: `packages/backend/src/examples/auditWorkflowExample.ts`
- 🐛 问题反馈: 查看 `CURRENT_STATUS.md`

---

**新增节点数**: 7个  
**新增示例**: 2个  
**文档更新**: 3份

🎉 **审计底稿引擎功能持续增强中！**
