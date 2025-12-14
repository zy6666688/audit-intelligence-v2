# 节点 V3 系统

**版本**: 3.0.0  
**设计理念**: ComfyUI + Blender + 审计专业逻辑

---

## 🎯 核心特性

### 1. 强类型系统
- 9种审计专用数据类型
- Records, Ledger, Vouchers, Invoices, BankFlow...
- 编译时类型检查

### 2. 纯函数节点
- 相同输入产生相同输出
- 无副作用
- 可缓存、可重放

### 3. 智能编译器
- 类型检查
- 依赖分析
- 并行优化
- 证据链生成

### 4. 多语言支持
- 所有标签和描述都有中英文
- 国际化友好

---

## 📁 目录结构

```
v3/
├── BaseNode.ts              # 节点基类
├── NodeRegistryV3.ts        # 节点注册中心
├── README.md                # 本文档
└── input/                   # 输入节点
    └── RecordsInputNode.ts  # 示例节点
```

---

## 🚀 快速开始

### 创建新节点

```typescript
import { BaseNodeV3, NodeManifest } from '../BaseNode';
import type { Records } from '../../../types/AuditDataTypes';

export class MyNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'category.my_node',
      version: '3.0.0',
      category: 'audit',
      
      label: {
        zh: '我的节点',
        en: 'My Node'
      },
      
      description: {
        zh: '这是一个示例节点',
        en: 'This is an example node'
      },
      
      inputs: [{
        id: 'records',
        name: 'records',
        type: 'Records',
        required: true,
        description: { zh: '输入记录', en: 'Input records' }
      }],
      
      outputs: [{
        id: 'result',
        name: 'result',
        type: 'Records',
        required: true,
        description: { zh: '输出结果', en: 'Output result' }
      }],
      
      config: [],
      
      metadata: {
        author: 'Your Name',
        tags: ['audit', 'example']
      },
      
      capabilities: {
        cacheable: true,
        parallel: true,
        streaming: false,
        aiPowered: false
      }
    };
  }

  async execute(inputs, config, context) {
    const records = inputs.records as Records;
    
    // 处理逻辑
    const result: Records = {
      ...records,
      // 修改...
    };
    
    return this.wrapSuccess({ result }, 0, context);
  }
}
```

### 注册节点

```typescript
import { nodeRegistryV3 } from './NodeRegistryV3';
import { MyNode } from './MyNode';

nodeRegistryV3.register(new MyNode());
```

---

## 📋 节点开发指南

### 1. 清单（Manifest）

每个节点必须定义完整的清单：

- **type**: 唯一标识符，格式 `category.name`
- **version**: 语义化版本号
- **category**: 节点分类
- **label**: 中英文标签
- **description**: 中英文描述
- **inputs**: 输入端口定义
- **outputs**: 输出端口定义
- **config**: 配置字段定义
- **metadata**: 元数据（作者、标签、文档等）
- **capabilities**: 能力标记

### 2. 执行函数

`execute()` 方法必须：

- 接收 `inputs`, `config`, `context`
- 返回 `Promise<NodeExecutionResult>`
- 是纯函数（无副作用）
- 处理所有异常

### 3. 类型安全

使用审计类型系统：

```typescript
import type { 
  Records, 
  Ledger, 
  RiskSet 
} from '../../../types/AuditDataTypes';
```

### 4. 缓存支持

使用内置缓存方法：

```typescript
// 尝试从缓存获取
const cacheKey = this.getCacheKey(inputs, config);
const cached = await this.tryGetFromCache(context, cacheKey);
if (cached) return cached;

// 执行逻辑...

// 保存到缓存
await this.saveToCache(context, cacheKey, result, ttl);
```

### 5. 日志记录

使用context.logger：

```typescript
context.logger?.info?.('Processing data...');
context.logger?.warn?.('Warning message');
context.logger?.error?.('Error occurred', error);
```

---

## 🎨 最佳实践

### DO ✅
- 使用强类型
- 编写纯函数
- 验证输入和配置
- 提供详细的错误信息
- 添加示例和文档
- 支持多语言

### DON'T ❌
- 修改输入数据
- 使用全局状态
- 忽略错误
- 省略类型定义
- 硬编码配置

---

## 📊 示例节点

### RecordsInputNode

基础输入节点，展示：
- 如何定义清单
- 如何处理配置
- 如何推断类型
- 如何验证数据
- 如何使用缓存

查看完整代码: `input/RecordsInputNode.ts`

---

## 🔗 相关文档

- [审计类型系统](../../../types/AuditDataTypes.ts)
- [节点编译器](../../../compiler/AuditNodeCompiler.ts)
- [架构重构计划](../../../../../架构重构计划.md)

---

## 🐛 常见问题

### Q: 节点类型怎么命名？
A: 使用 `category.name` 格式，如 `input.csv_reader`, `audit.risk_assess`

### Q: 如何支持多个输入类型？
A: 在端口定义中使用数组：`type: ['Records', 'Ledger']`

### Q: 缓存TTL如何设置？
A: 根据数据性质，输入节点1小时，分析节点10分钟，实时节点不缓存

### Q: 如何处理大数据？
A: 设置 `capabilities.streaming = true` 并实现流式处理

---

**最后更新**: 2025-12-02
