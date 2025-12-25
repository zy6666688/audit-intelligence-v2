# TextUnderstandingAI 重构文档

## 🎯 核心定位转变

### 旧定位
```
TextUnderstandingAI = 文本理解AI (处理文字描述、合同条款等)
功能：分类(classify) + 总结(summarize) + 提取(extract)
```

### 新定位
```
TextUnderstandingAI = 文本事实结构化引擎 (Fact Structuring Engine)
功能：把自然语言文本拆解为可核查、可引用、可复算的结构化事实
```

## 🔑 核心功能重构

### 1. 结构化字段抽取 (Primary Duty)
- **金额 (amount)**: 合同金额、发票金额等货币数值
- **日期 (effective_date/expiry_date)**: 生效日期、到期日期等时间点
- **主体 (party_a/party_b)**: 甲方、乙方、负责人等实体
- **行为义务 (obligation)**: 应支付、应交付等义务条款
- **条件 (condition)**: if/unless/except 等条件语句

### 2. 强制原文锚定 (Evidence Anchoring)
**每个抽取字段必须回答**：
- 我从原文的哪一句、哪几个字得到的？
- 合法锚定形式：
  - 字符区间：`{"start": 10, "end": 25, "text": "合同金额：100000元"}`
  - 行号段号：`{"line": 3, "paragraph": 2}`
  - OCR坐标：`{"x": 100, "y": 200, "width": 150, "height": 30}`

### 3. 字段级置信度 (Field-level Confidence)
```
amount: 0.95 (明确匹配)
counterparty: 0.82 (基本明确)
effective_date: 0.41 (需要人工复核)
```

### 4. 抽取来源标记 (Governance Tracking)
```json
{
  "extraction_method": "hybrid",
  "model_id": "qwen-max",
  "prompt_version": "v2.1",
  "extraction_timestamp": "2024-12-25T23:02:35Z"
}
```

## 🚫 禁止行为 (红线)

### ❌ 1. 禁止生成语义总结
```python
# ❌ 错误输出
"summary": "该合同存在付款风险"
"interpretation": "条款较为严格"
"risk_description": "建议进一步核查"
```

### ❌ 2. 禁止合并推理字段
```python
# ❌ 错误输出
"combined_analysis": "甲方需在30日内付款100万，因此存在回款风险"
```

### ❌ 3. 禁止跨段/跨文档推断
- 每个字段只能来自明确文本证据
- 不得"综合全文来看"

## 🏗️ 技术架构

### 字段模板系统
```python
FIELD_TEMPLATES = {
    "contract": {
        "amount": {
            "type": "currency",
            "patterns": [r"(\d+(?:\.\d+)?)元", r"金额[为:](\d+(?:\.\d+)?)"]
        },
        "party_a": {
            "type": "entity",
            "patterns": [r"甲方[为:](\w+)", r"出卖人[为:](\w+)"]
        }
    }
}
```

### 混合抽取策略 (Hybrid Extraction)
1. **规则抽取**：基于正则表达式，置信度 0.8
2. **LLM抽取**：基于大模型理解，置信度动态
3. **冲突解决**：
   - 结果一致 → 提高置信度 (+0.1)
   - 结果不一致 → 降低置信度 (-0.2) 并标记冲突

### 置信度阈值与人工复核
```python
if confidence < threshold:
    field["needs_human_review"] = True
    field["review_reason"] = f"置信度 {confidence:.2f} 低于阈值 {threshold}"
```

## 📊 输出格式

### structured_fields
```json
{
  "amount": {
    "value": "500000.00",
    "confidence": 0.95,
    "evidence": {
      "start": 15,
      "end": 25,
      "text": "500000.00元",
      "method": "rule"
    },
    "extraction_info": {
      "method": "hybrid",
      "model": "qwen-max",
      "pattern": "(\\d+(?:\\.\\d+)?)元",
      "timestamp": "2024-12-25T23:02:35Z"
    }
  }
}
```

### extraction_metadata
```json
{
  "extraction_method": "hybrid",
  "template_type": "contract",
  "total_fields_attempted": 7,
  "fields_extracted": 3,
  "low_confidence_fields": 1,
  "text_length": 500,
  "text_hash": "a1b2c3d4e5f6789a",
  "timestamp": "2024-12-25T23:02:35Z"
}
```

## 🔗 节点协作关系

```
上游输入 → TextUnderstandingAI → 下游消费
FileRecognition     结构化事实     RuleCalculation
OCR/Image         +原文锚定     +字段级置信度   AnalysisReasoning
人工录入文本     +来源标记     +HumanReview触发 HumanReview
```

## ✅ 合规性保证

### 审计可追溯性
- ✅ 每个字段都有原文证据
- ✅ 抽取方法和版本可追踪
- ✅ 置信度量化，人工复核可触发

### 治理合规
- ✅ 无语义判断输出
- ✅ 严格的输入输出边界
- ✅ 字段级质量控制

### 性能与扩展
- ✅ 模板化配置
- ✅ 规则+AI混合策略
- ✅ 自定义字段支持

## 🧪 测试覆盖

- ✅ 合同模板字段抽取
- ✅ 自定义模板配置
- ✅ 抽取元数据完整性
- ✅ 置信度阈值逻辑
- ✅ 混合抽取冲突解决

## 🎯 验收标准

1. **功能完整性**：所有预定义模板字段可正确抽取
2. **证据完整性**：100%字段包含原文锚定信息
3. **质量可控**：置信度阈值正确触发人工复核
4. **治理合规**：无禁止行为输出，无语义判断
5. **集成就绪**：输出格式与下游节点完美兼容

---

## 📈 后续优化方向

1. **字段模板扩展**：增加更多领域模板
2. **规则引擎增强**：上下文感知的规则匹配
3. **LLM提示优化**：结构化输出质量提升
4. **批量处理能力**：支持多文档并行处理
5. **版本管理**：模板和模型版本的生命周期管理
