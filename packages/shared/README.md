# @audit/shared

审计数智析 - 共享类型定义包

## 📦 包含内容

### 核心类型
- `NodeManifest` - 节点清单（元数据定义）
- `NodeDefinition` - 节点定义（清单 + 执行函数）
- `ExecutionContext` - 执行上下文
- `NodeGraph` - 节点图
- `EdgeBinding` - 节点连接

### 辅助类型
- `NodeCategory` - 节点分类
- `Capability` - 节点能力
- `PortType` - 端口类型
- `NodeStatus` - 节点状态

## 🚀 使用

```typescript
import { NodeManifest, NodeDefinition, ExecutionContext } from '@audit/shared';

// 定义节点
const myNodeManifest: NodeManifest = {
  type: 'my_node',
  version: '1.0.0',
  category: 'transformation',
  label: { zh: '我的节点', en: 'My Node' },
  // ...
};

const myNodeDefinition: NodeDefinition = {
  manifest: myNodeManifest,
  execute: async (inputs, config, context) => {
    // 执行逻辑
    return { result: 'success' };
  }
};
```

## 📚 文档

参见: [技术方案 - 节点模型规范化](../../docs/refactoring/02_Node_Manifest.md)

## 🔄 版本

- **v0.1.0** (Week 1 Day 1): 初始版本，核心类型定义
