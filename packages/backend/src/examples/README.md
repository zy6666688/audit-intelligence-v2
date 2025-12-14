# 审计底稿引擎 - 使用示例

本目录包含审计底稿引擎的完整使用示例，帮助您快速上手。

## 📁 文件说明

- `auditWorkflowExample.ts` - 完整的审计工作流示例

## 🚀 运行示例

### 方式1: 直接运行

```bash
cd packages/backend
npm run build
node dist/examples/auditWorkflowExample.js
```

### 方式2: 使用 ts-node

```bash
cd packages/backend
npx ts-node src/examples/auditWorkflowExample.ts
```

## 📊 示例1: 数据对比审计

对比两个数据源，找出差异并统计金额。

### 工作流步骤

1. **CSV读取节点1** - 读取账面数据
2. **CSV读取节点2** - 读取实际数据  
3. **数据对比节点** - 对比两组数据
4. **金额计算节点** - 统计差异金额

### 核心代码

```typescript
// 1. 注册节点
const registry = new NodeRegistryV2();
allNodes.forEach(nodeDef => registry.register(nodeDef));

// 2. 构建工作流图
const nodes = [
  { id: 'csv1', type: 'data.csv_reader', ... },
  { id: 'csv2', type: 'data.csv_reader', ... },
  { id: 'compare', type: 'audit.data_compare', ... },
  { id: 'calc', type: 'audit.amount_calculate', ... }
];

// 3. 执行工作流
const engine = new ExecutionEngineV2(registry);
const result = await engine.executeGraph(graph, {});
```

### 预期输出

```json
{
  "matches": [...],
  "onlyInSource1": [...],
  "onlyInSource2": [...],
  "differences": [...],
  "summary": {
    "totalAmount": 15000,
    "differenceCount": 5
  }
}
```

## 📊 示例2: 数据过滤和聚合

过滤大额交易并按部门聚合统计。

### 工作流步骤

1. **CSV读取节点** - 读取交易数据
2. **数据过滤节点** - 过滤金额>1000
3. **数据聚合节点** - 按部门统计
4. **审计抽样节点** - Top-N抽样

### 核心代码

```typescript
const nodes = [
  { id: 'reader', type: 'data.csv_reader', ... },
  { id: 'filter', type: 'data.filter', config: {
    field: 'amount',
    operator: 'greaterThan',
    value: 1000
  }},
  { id: 'aggregate', type: 'data.aggregate', config: {
    groupBy: ['department'],
    aggregations: {
      totalAmount: { function: 'sum', sourceField: 'amount' }
    }
  }},
  { id: 'sampling', type: 'audit.sampling', config: {
    method: 'top',
    sampleSize: 5
  }}
];
```

### 预期输出

```json
{
  "samples": [
    { "department": "销售部", "totalAmount": 50000, "count": 25 },
    { "department": "采购部", "totalAmount": 45000, "count": 20 },
    ...
  ],
  "samplingRate": 0.15
}
```

## 🎯 可用节点类型

### 数据输入节点

- `data.csv_reader` - CSV文件读取

### 数据转换节点

- `data.filter` - 数据过滤
- `data.map` - 数据映射
- `data.aggregate` - 数据聚合

### 审计节点

- `audit.data_compare` - 数据对比
- `audit.amount_calculate` - 金额计算
- `audit.sampling` - 审计抽样

### AI节点 (需要OpenAI API)

- `ai.text_analysis` - 文本分析
- `ai.sentiment_analysis` - 情感分析
- `ai.audit_check` - 智能审计检查

## 💡 最佳实践

### 1. 节点配置

```typescript
// ✅ 好的配置
config: {
  field: 'amount',
  operator: 'greaterThan',
  value: 1000,
  precision: 2
}

// ❌ 避免硬编码
config: {
  value: 1000  // 应该从参数传入
}
```

### 2. 错误处理

```typescript
try {
  const result = await engine.executeGraph(graph, {});
  console.log('成功:', result);
} catch (error) {
  console.error('执行失败:', error.message);
  // 检查具体失败的节点
  if (error.nodeId) {
    console.error('失败节点:', error.nodeId);
  }
}
```

### 3. 性能优化

```typescript
// 使用缓存
const engine = new ExecutionEngineV2(registry, {
  cacheEnabled: true,
  maxConcurrency: 10
});

// 避免大数据量全量加载
config: {
  streaming: true,  // 启用流式处理
  batchSize: 1000   // 分批处理
}
```

## 📖 进阶用法

### 自定义节点

```typescript
function createCustomAuditNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'custom.my_audit',
    version: '1.0.0',
    category: 'audit',
    label: { zh: '自定义审计', en: 'Custom Audit' },
    // ... 其他配置
  };

  const execute = async (inputs, config, context) => {
    // 实现自定义逻辑
    return { result: 'success' };
  };

  return { manifest, execute };
}

// 注册自定义节点
registry.register(createCustomAuditNode());
```

### 条件执行

```typescript
// 根据条件动态构建工作流
const nodes = [
  csvReader,
  filter,
  // 根据配置决定是否添加AI节点
  ...(config.useAI ? [aiAnalysisNode] : []),
  outputNode
];
```

## 🐛 常见问题

### Q1: 节点执行超时

**A**: 增加超时时间配置

```typescript
const engine = new ExecutionEngineV2(registry, {
  timeout: 60000  // 60秒
});
```

### Q2: 内存溢出

**A**: 启用流式处理或分批处理

```typescript
config: {
  streaming: true,
  batchSize: 1000
}
```

### Q3: 找不到节点类型

**A**: 确保节点已注册

```typescript
// 检查已注册的节点类型
console.log('已注册节点:', registry.getAllTypes());
```

## 📞 获取帮助

- 📚 查看 `docs/` 目录的详细文档
- 🐛 遇到问题请查看 `CURRENT_STATUS.md`
- 💡 更多示例请查看测试文件

---

*示例持续更新中...* 🚀
