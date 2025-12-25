# ImageRecognitionAI 重构文档

## 概述

`ImageRecognitionAI` 节点已从"图像票据检查AI"重构为"**图像票据事实结构化引擎**"，专门负责从OCR文本中抽取结构化票据字段，并提供原文锚定。

## 核心职责定位

### ✅ 必须承担的责任
1. **票据文本 → 结构化字段抽取**
   - 从OCR识别的票据文本中抽取关键字段（金额、日期、主体、号码等）
   - 支持发票、收据、合同等多种票据类型

2. **强制原文锚定（Evidence Anchoring）**
   - 每个抽取字段必须提供原文证据：字符区间、匹配文本、抽取方法
   - 保证可追溯性、可复核性

3. **字段级置信度评估**
   - 为每个字段分配置信度分数
   - 低于阈值的字段自动标记为需要人工复核

4. **抽取来源标记（治理必需）**
   - 记录抽取方法（rule/llm/hybrid）、模板版本、时间戳
   - 支持AI治理和模型回溯

### ❌ 绝对禁止的行为
1. **禁止真伪判断** - 交给RuleCalculationNode
2. **禁止重复检查** - 交给RuleCalculationNode
3. **禁止风险评估** - 交给RuleCalculationNode/AnalysisReasoningNode
4. **禁止跨文档推理** - 只处理单张票据
5. **禁止生成结论** - 只抽取事实，不做判断

## API接口设计

### 输入参数
- `ocr_text` (String): OCR识别的票据文本
- `template_type` (String): 模板类型 (invoice/receipt/contract/custom)
- `custom_fields` (String, Optional): 自定义字段模板（JSON格式）
- `extraction_method` (String, Optional): 抽取方法 (hybrid/llm/rule)
- `confidence_threshold` (Float, Optional): 置信度阈值
- `model/provider/api_key/base_url`: LLM配置（可选）

### 输出格式
- `structured_fields` (Dict): 结构化字段字典
- `extraction_metadata` (List): 抽取元数据

### 结构化字段格式
```json
{
  "invoice_number": {
    "value": "00123456",
    "confidence": 0.85,
    "evidence": {
      "start": 45,
      "end": 53,
      "text": "00123456",
      "method": "rule"
    },
    "extraction_info": {
      "method": "rule",
      "pattern": "发票号[码:]*([A-Za-z0-9\\-]+)",
      "timestamp": "2024-01-15T10:30:00"
    },
    "needs_human_review": false
  }
}
```

## 内置模板支持

### 发票模板 (invoice)
- `invoice_number`: 发票号码
- `amount`: 发票金额
- `tax_amount`: 税额
- `invoice_date`: 开票日期
- `seller_name`: 销方名称
- `buyer_name`: 购方名称
- `seller_tax_id`: 销方税号

### 收据模板 (receipt)
- `receipt_number`: 收据号码
- `amount`: 收据金额
- `receipt_date`: 收据日期
- `payee`: 收款人
- `payer`: 付款人

### 合同模板 (contract)
- `contract_number`: 合同编号
- `amount`: 合同金额
- `effective_date`: 合同生效日期
- `party_a`: 甲方
- `party_b`: 乙方

## 与其他节点的协作关系

### 上游节点
- `FileRecognitionNode`: 提供OCR文本
- `ImageRecognitionAI`: 提供原始票据图像（坐标映射）

### 下游节点
- `RuleCalculationNode`: 使用抽取的结构化字段进行规则计算
- `AnalysisReasoningNode`: 使用字段事实进行推理分析
- `HumanReviewNode`: 处理低置信度字段的人工复核

### 协作原则
- **只传递事实，不传递判断**
- **证据链可完全追溯**
- **低置信度字段自动触发人工复核**

## 治理与合规要求

### 证据完整性
- 每个字段必须有原文锚定
- 锚定信息包含字符位置和匹配文本
- 支持OCR坐标映射（未来扩展）

### 置信度管理
- 规则抽取：默认置信度0.8
- LLM抽取：基于模型输出
- 低于阈值自动标记人工复核

### 版本控制
- 抽取方法版本化
- 模板版本追踪
- 模型版本记录

## 典型应用场景

### 发票处理流程
1. `FileRecognitionNode` → OCR文本
2. `ImageRecognitionAI` → 抽取发票字段
3. `RuleCalculationNode` → 验证发票规则
4. `AnalysisReasoningNode` → 生成分析解释
5. `HumanReviewNode` → 人工审核（如果需要）

### 异常处理
- **低置信度字段**: 自动标记 `needs_human_review`
- **缺失关键字段**: 在元数据中记录缺失情况
- **模板不匹配**: 返回空字段但不报错

## 优化方向

### 短期优化 (P0-P1)
1. **字段模板扩展**: 支持更多票据类型和自定义模板
2. **规则+AI一致性校验**: LLM抽取结果与规则抽取对比
3. **字段级人工复核触发**: 基于置信度和字段重要性
4. **模板版本冻结**: 支持版本化模板管理

### 中期优化 (P2-P3)
1. **多模板并行处理**: 支持同一文本匹配多个模板
2. **OCR坐标集成**: 支持图像坐标到文本位置的映射
3. **上下文感知抽取**: 考虑字段间的关联关系
4. **领域自适应**: 根据历史数据优化抽取规则

### 长期优化 (P4+)
1. **端到端视觉抽取**: 直接从图像抽取，跳过OCR
2. **跨语言支持**: 支持多语言票据处理
3. **实时学习**: 根据人工校正持续优化模型

## 测试覆盖要求

### 单元测试
- ✅ 模板字段抽取准确性
- ✅ 证据锚定完整性
- ✅ 置信度阈值应用
- ✅ 自定义模板处理
- ✅ 错误输入处理

### 集成测试
- ✅ 与RuleCalculationNode的数据流
- ✅ 与HumanReviewNode的低置信度处理
- ✅ 证据链追溯完整性
- ✅ 性能测试（大文本处理）

### 治理测试
- ✅ 禁止行为边界检查
- ✅ AI治理标签正确注入
- ✅ 审计日志记录完整性

## 设计原则

**"ImageRecognitionAI 不判断票据的好坏，它只负责把票据的'说什么'变成机器能理解的'事实'。判断'好不好'是RuleCalculationNode和HumanReviewNode的责任。"**

这个定位确保了：
- **职能清晰**: 结构化 ≠ 判断
- **治理可控**: 事实抽取的可追溯性
- **扩展性强**: 新票据类型只需添加模板
