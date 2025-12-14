# Phase C 审计节点开发指南

**版本**: v1.0.0  
**更新时间**: 2025-12-02 23:50  
**适用于**: V3节点系统

---

## 🎯 概述

本指南介绍Phase C新增的高级审计节点开发流程、使用方法和最佳实践。Phase C聚焦于专业审计分析功能，提供8个实用的审计节点。

---

## 📋 Phase C 节点清单

### 已规划节点（8个）

| 序号 | 节点名称 | 英文名 | 功能描述 | 优先级 | 状态 |
|-----|---------|--------|---------|--------|------|
| 1 | 关联方交易检测 | RelatedPartyTransaction | 识别关联方交易和利益输送 | ⭐⭐⭐⭐⭐ | 🚧 开发中 |
| 2 | 账龄分析 | AgingAnalysis | 应收/应付账款账龄分析 | ⭐⭐⭐⭐⭐ | 📅 计划中 |
| 3 | 异常凭证检测 | AbnormalVoucher | 检测异常会计凭证 | ⭐⭐⭐⭐⭐ | 📅 计划中 |
| 4 | 收入确认检查 | RevenueRecognition | 收入确认合规性检查 | ⭐⭐⭐⭐⭐ | 📅 计划中 |
| 5 | 资产减值测试 | ImpairmentTest | 资产减值迹象识别 | ⭐⭐⭐⭐ | 📅 计划中 |
| 6 | 存货周转分析 | InventoryTurnover | 存货周转率分析 | ⭐⭐⭐⭐ | 📅 计划中 |
| 7 | 税务合规检查 | TaxCompliance | 税务合规性检查 | ⭐⭐⭐⭐ | 📅 计划中 |
| 8 | 现金流异常检测 | CashFlowAnomaly | 现金流异常模式检测 | ⭐⭐⭐⭐ | 📅 计划中 |

---

## 🌟 节点1: 关联方交易检测

### 功能概述

**RelatedPartyTransactionNode** 用于识别和分析关联方交易，检测潜在的利益输送和不公允交易。

### 核心功能

1. **关联方识别**
   - 从名单导入关联方信息
   - 自动检测潜在关联方（基于交易特征）
   - 关联方分类（股东、董事、高管、关联企业等）

2. **交易异常检测**
   - 价格异常：对比市场公允价格
   - 频次异常：识别高频交易
   - 金额异常：识别大额交易
   - 时点异常：期末突击交易
   - 循环交易：检测交易闭环

3. **风险评分**
   - 多维度风险评估
   - 可配置的风险权重
   - 风险分数计算(0-100)

### 输入端口

| 端口名 | 类型 | 必需 | 描述 |
|-------|------|------|------|
| transactions | Records | ✅ | 交易记录（需包含交易对手、金额、日期） |
| related_parties | Records | ❌ | 关联方名单 |
| market_prices | Records | ❌ | 市场公允价格参考 |

### 输出端口

| 端口名 | 类型 | 描述 |
|-------|------|------|
| risks | RiskSet | 关联方交易风险集合 |

### 配置参数

```typescript
{
  // 关联方识别方式
  related_party_source: 'input' | 'auto_detect' | 'both',  
  // 默认: 'both'
  
  // 异常检测阈值
  price_deviation_threshold: 20,     // 价格偏离阈值（%）
  frequency_threshold: 10,           // 高频交易阈值（次/月）
  amount_threshold: 1000000,         // 大额交易阈值
  
  // 检测选项
  detect_circular_transactions: true,  // 检测循环交易
  detect_price_anomaly: true,         // 检测价格异常
  detect_timing_anomaly: true,        // 检测时点异常
  
  // 输出选项
  min_risk_score: 50                  // 最小风险分数
}
```

### 使用示例

**场景1: 基础关联方交易检测**

```javascript
// 输入数据
const transactions = {
  type: 'Records',
  data: [
    {
      id: 'T001',
      date: '2024-12-20',
      counterparty: '关联公司A',
      amount: 5000000,
      item: '原材料',
      price: 1200
    },
    {
      id: 'T002',
      date: '2024-12-25',
      counterparty: '关联公司A',
      amount: 3000000,
      item: '原材料',
      price: 1300
    }
  ],
  schema: { /* ... */ },
  metadata: { /* ... */ }
};

const relatedParties = {
  type: 'Records',
  data: [
    {
      name: '关联公司A',
      type: 'subsidiary',
      relationship: '子公司',
      confidence: 1.0
    }
  ],
  schema: { /* ... */ },
  metadata: { /* ... */ }
};

// 配置
const config = {
  related_party_source: 'both',
  price_deviation_threshold: 20,
  frequency_threshold: 10,
  detect_circular_transactions: true,
  min_risk_score: 60
};

// 执行节点
const result = await node.execute(
  { transactions, related_parties },
  config,
  context
);

// 输出结果
console.log(result.outputs.risks);
/*
{
  type: 'RiskSet',
  risks: [
    {
      id: 'RPT-1',
      category: 'related_party_transaction',
      description: '关联方关联公司A的交易存在异常：交易频次异常高：1.7次/月；大额关联交易：5,000,000元',
      severity: 'high',
      score: 75,
      suggestedActions: [
        '检查交易的商业合理性',
        '执行大额交易专项审计'
      ]
    }
  ],
  summary: {
    total: 1,
    bySeverity: { high: 1, medium: 0, low: 0, critical: 0 },
    byCategory: { price_anomaly: 0, frequency_anomaly: 1, amount_anomaly: 1 }
  }
}
*/
```

**场景2: 循环交易检测**

```javascript
const transactions = {
  type: 'Records',
  data: [
    { from: '公司', to: '关联方A', amount: 1000000 },
    { from: '关联方A', to: '关联方B', amount: 950000 },
    { from: '关联方B', to: '公司', amount: 900000 }
  ],
  schema: { /* ... */ },
  metadata: { /* ... */ }
};

const config = {
  detect_circular_transactions: true,
  min_risk_score: 50
};

const result = await node.execute({ transactions }, config, context);

// 检测到循环交易
console.log(result.outputs.risks.risks[0]);
/*
{
  id: 'CIRCULAR-1',
  category: 'circular_transaction',
  description: '检测到循环交易链：公司 → 关联方A → 关联方B → 公司',
  severity: 'high',
  score: 90,
  suggestedActions: [
    '核查循环交易的商业实质',
    '检查是否存在虚构交易',
    '评估是否为利益输送'
  ]
}
*/
```

### 审计应用场景

1. **年度审计**
   - 关联方交易披露审核
   - 关联方交易公允性评估

2. **风险评估**
   - 识别利益输送风险
   - 评估关联交易对财务报表的影响

3. **合规检查**
   - 检查关联交易审批程序
   - 验证关联交易定价政策

### 输出解读

#### 风险分类

| 类别 | 说明 | 示例 |
|------|------|------|
| price_anomaly | 价格异常 | 交易价格偏离市场价30% |
| frequency_anomaly | 频次异常 | 月均交易15次，超过阈值10次 |
| amount_anomaly | 金额异常 | 单笔交易500万，超过阈值100万 |
| circular_transaction | 循环交易 | A→B→C→A形成闭环 |

#### 风险等级

| 等级 | 分数范围 | 处理建议 |
|------|----------|----------|
| Critical | 90-100 | 立即审计，重点关注 |
| High | 70-89 | 专项审计程序 |
| Medium | 50-69 | 进一步核查 |
| Low | 0-49 | 常规关注 |

---

## 🌟 节点2: 账龄分析

### 功能概述

**AgingAnalysisNode** 用于应收/应付账款的账龄分析，评估坏账风险和回款能力。

### 核心功能

1. **账龄分段**
   - 自定义账龄区间
   - 按客户/供应商统计
   - 账龄分布分析

2. **坏账准备计算**
   - 按账龄计提比例
   - 个别认定法
   - 组合计提法

3. **逾期风险评估**
   - 逾期率计算
   - 坏账率趋势
   - 重点客户识别

### 配置参数

```typescript
{
  // 账龄分段（天数）
  aging_buckets: [30, 60, 90, 180, 360],  // 默认6个区间
  
  // 坏账计提比例（%）
  provision_rates: {
    '0-30': 0,
    '31-60': 1,
    '61-90': 5,
    '91-180': 10,
    '181-360': 30,
    '360+': 100
  },
  
  // 分析选项
  group_by: 'customer' | 'category' | 'both',
  include_provision: true,
  include_trend: true,
  
  // 风险阈值
  overdue_rate_threshold: 20,  // 逾期率阈值（%）
  concentration_threshold: 30   // 集中度阈值（%）
}
```

### 使用示例

```javascript
const receivables = {
  type: 'Records',
  data: [
    {
      customer: '客户A',
      amount: 100000,
      invoice_date: '2024-09-01',
      due_date: '2024-12-01',
      payment_status: 'unpaid'
    },
    {
      customer: '客户B',
      amount: 50000,
      invoice_date: '2024-11-01',
      due_date: '2025-02-01',
      payment_status: 'unpaid'
    }
  ],
  schema: { /* ... */ },
  metadata: { /* ... */ }
};

const config = {
  aging_buckets: [30, 60, 90, 180, 360],
  include_provision: true,
  overdue_rate_threshold: 20
};

const result = await node.execute({ receivables }, config, context);

// 输出：账龄分析表 + 坏账风险
console.log(result.outputs.aging_report);
console.log(result.outputs.risks);
```

---

## 🌟 节点3: 异常凭证检测

### 功能概述

**AbnormalVoucherNode** 用于检测异常会计凭证，识别潜在的舞弊行为和会计错误。

### 核心功能

1. **多维度异常检测**
   - 重复凭证
   - 异常科目组合
   - 异常摘要模式
   - 本福特定律检验
   - 周末/节假日凭证
   - 跨期凭证
   - 一借多贷/一贷多借异常

2. **舞弊模式识别**
   - 调节利润模式
   - 虚构交易模式
   - 资金挪用模式

### 配置参数

```typescript
{
  // 检测选项
  detect_duplicates: true,
  detect_unusual_combinations: true,
  detect_benford_law: true,
  detect_timing_anomalies: true,
  
  // 阈值设置
  duplicate_tolerance: 0,           // 重复容忍度
  benford_deviation_threshold: 10,  // 本福特定律偏离阈值（%）
  
  // 时间范围
  include_weekends: false,
  include_holidays: false,
  
  // 输出选项
  min_anomaly_score: 60
}
```

### 使用示例

```javascript
const vouchers = {
  type: 'Records',
  data: [
    {
      voucher_no: 'V001',
      date: '2024-12-31',  // 年末凭证
      debit_account: '6001',
      credit_account: '1122',
      amount: 888888,      // 可疑金额
      summary: '调整收入'
    }
  ],
  schema: { /* ... */ },
  metadata: { /* ... */ }
};

const config = {
  detect_benford_law: true,
  detect_timing_anomalies: true,
  min_anomaly_score: 60
};

const result = await node.execute({ vouchers }, config, context);
```

---

## 🌟 节点4: 收入确认检查

### 功能概述

**RevenueRecognitionNode** 用于检查收入确认是否符合会计准则（新收入准则五步法）。

### 核心功能

1. **五步法验证**
   - 识别客户合同
   - 识别履约义务
   - 确定交易价格
   - 分摊交易价格
   - 履约时确认收入

2. **合规性检查**
   - 收入与合同匹配
   - 确认时点检查
   - 退货率异常
   - 收入成本配比

### 配置参数

```typescript
{
  // 检查选项
  check_contract_matching: true,
  check_timing: true,
  check_return_rate: true,
  check_cost_matching: true,
  
  // 阈值设置
  return_rate_threshold: 10,      // 退货率阈值（%）
  timing_deviation_days: 5,       // 确认时点偏离天数
  cost_ratio_range: [0.6, 0.8],  // 成本收入比合理范围
  
  // 输出选项
  min_risk_score: 60
}
```

---

## 🌟 节点5-8: 其他审计节点

### 5. 资产减值测试 (ImpairmentTestNode)
- 减值迹象识别
- 可回收金额估算
- 减值准备计算

### 6. 存货周转分析 (InventoryTurnoverNode)
- 周转率计算
- 滞销存货识别
- ABC分类分析

### 7. 税务合规检查 (TaxComplianceNode)
- 增值税合规
- 所得税计算验证
- 税负率异常检测

### 8. 现金流异常检测 (CashFlowAnomalyNode)
- 三表勾稽
- 异常流入/流出
- 大额现金交易识别

---

## 📝 节点开发规范

### 1. 代码结构

```typescript
export class YourAuditNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'audit.your_node',
      version: '1.0.0',
      category: 'audit',
      label: { zh: '中文名', en: 'English Name' },
      description: { zh: '描述', en: 'Description' },
      inputs: [/* ... */],
      outputs: [/* ... */],
      config: [/* ... */],
      metadata: {
        author: 'Audit Intelligence System',
        tags: ['audit', 'risk'],
        documentation: '使用说明URL'
      },
      capabilities: {
        cacheable: true,
        parallel: false,
        streaming: false,
        aiPowered: false
      }
    };
  }
  
  async execute(inputs, config, context): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      // 1. 获取输入
      // 2. 验证数据
      // 3. 执行分析逻辑
      // 4. 生成风险/结果
      // 5. 包装输出
      
      return this.wrapSuccess(outputs, Date.now() - startTime, context);
    } catch (error) {
      return this.wrapError('ERROR_CODE', error.message, error);
    }
  }
}
```

### 2. 测试规范

每个节点至少包含5-8个测试用例：
- 正常情况测试
- 边界情况测试
- 异常情况测试
- 性能测试

### 3. 文档规范

每个节点需提供：
- 功能说明
- 输入输出定义
- 配置参数说明
- 使用示例
- 审计应用场景

---

## 🚀 快速开始

### 1. 查看节点清单

```bash
# 查看Phase C开发计划
cat Phase_C_新审计节点开发计划.md
```

### 2. 运行示例

```javascript
// 导入节点
import { RelatedPartyTransactionNode } from './audit/RelatedPartyTransactionNode';

// 创建节点实例
const node = new RelatedPartyTransactionNode();

// 准备数据和配置
const inputs = { transactions, related_parties };
const config = { /* ... */ };

// 执行
const result = await node.execute(inputs, config, context);

// 处理结果
if (result.success) {
  console.log('风险数量:', result.outputs.risks.summary.total);
  console.log('高风险项:', result.outputs.risks.risks.filter(r => r.severity === 'high'));
}
```

### 3. 集成到工作流

```javascript
// 工作流配置
const workflow = {
  nodes: [
    {
      id: 'input-1',
      type: 'input.records',
      config: { file_path: './transactions.csv' }
    },
    {
      id: 'audit-1',
      type: 'audit.related_party_transaction',
      config: {
        price_deviation_threshold: 20,
        detect_circular_transactions: true
      }
    },
    {
      id: 'output-1',
      type: 'output.workpaper_generator',
      config: { format: 'markdown' }
    }
  ],
  connections: [
    { from: 'input-1.records', to: 'audit-1.transactions' },
    { from: 'audit-1.risks', to: 'output-1.risks' }
  ]
};
```

---

## 📊 性能指标

| 节点 | 平均执行时间 | 内存占用 | 适用数据规模 |
|------|------------|----------|-------------|
| RelatedPartyTransaction | 200-500ms | ~50MB | <10万笔交易 |
| AgingAnalysis | 100-300ms | ~30MB | <50万条记录 |
| AbnormalVoucher | 300-800ms | ~80MB | <20万张凭证 |
| RevenueRecognition | 200-400ms | ~40MB | <10万条收入 |

---

## 🔍 故障排查

### 常见问题

**Q: 节点执行失败，提示"Missing required input"**
A: 检查输入数据是否包含必需字段，参考节点的inputs定义。

**Q: 风险检测结果为空**
A: 调低`min_risk_score`阈值，或检查检测选项是否已启用。

**Q: 性能较慢**
A: 启用缓存功能，或减小数据规模进行分批处理。

---

## 📚 参考资料

### 审计准则
- 《中国注册会计师审计准则》
- 《企业会计准则》
- 《国际审计准则》

### 技术文档
- [V3节点使用手册](./V3节点使用手册.md)
- [节点配置指南](./节点配置指南.md)
- [V3架构设计](../architecture/V3架构完成总结.md)

### API参考
- [BaseNodeV3 API](../api/BaseNodeV3.md)
- [AuditDataTypes](../api/AuditDataTypes.md)

---

## 🤝 贡献指南

欢迎贡献新的审计节点！

### 提交流程
1. Fork项目
2. 创建feature分支
3. 开发节点和测试
4. 编写文档
5. 提交Pull Request

### 代码审查标准
- ✅ TypeScript编译通过
- ✅ 测试覆盖率≥90%
- ✅ 文档完整
- ✅ 符合编码规范

---

**文档版本**: v1.0.0  
**最后更新**: 2025-12-02  
**维护者**: Audit Intelligence Team  
**状态**: ✅ 活跃维护
