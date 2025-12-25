# AnalysisReasoningAI v2 重构文档

## 概述

`AnalysisReasoningAI` 已重构为 v2 版本，从简单的"分析推理AI"升级为"**支持用户API Key的审计分析节点**"，专门负责对规则计算产生的risk_items与指标metrics进行综合分析。

## 核心定位转变

### 定位：审计分析助手
- **核心职责**：对结构化审计数据进行综合分析，生成风险评估和建议
- **治理边界**：只接受上游处理后的数据，禁止访问原始DataFrame
- **安全特性**：支持用户自带API Key，但不持久化，触发实验性标记

### 区别于其他节点
- **vs AnalysisReasoningNode**：已被删除，功能合并到此节点
- **vs RuleCalculationNode**：不计算规则，只分析已触发的规则结果
- **vs HumanReviewNode**：提供分析建议，不做决策记录

## API接口设计

### 输入参数
```python
{
    "risk_items": List[Dict]          # 规则触发结果列表 (必需)
    "metrics": Dict                   # 通用指标 & 场景指标 (必需)
    "human_review_states": Dict       # 人工复核状态 (可选)
    "user_api_key": str               # 用户自带API Key (可选)
    "model_provider": str             # 外部模型提供商 (可选)
    "model_name": str                 # 外部模型名称 (可选)
    "base_url": str                   # 外部API基础URL (可选)
}
```

### 输出格式
```python
(
    risk_assessment: Dict,      # 结构化风险评估结果
    risk_level: str,            # 综合风险等级 (LOW/MEDIUM/HIGH/CRITICAL)
    suggestions: List[str],     # AI给出的改善或复核建议
    snapshot_metadata: Dict     # 节点生成快照信息
)
```

## 核心功能详解

### 1. 风险评估算法

#### 内部规则引擎 (默认)
基于规则触发数量、风险等级分布、指标异常程度进行综合评分：

- **规则权重**：每个规则触发 +8 分，高风险额外 +20 分，中风险额外 +10 分
- **指标异常**：高风险占比 >10% (+25 分)，异常率 >5% (+15 分)
- **人工复核**：被否决项目 (+30 分/项)，积压待复核 >10 (+10 分)

#### 风险等级映射
- **CRITICAL** (≥80分)：立即启动紧急审计程序
- **HIGH** (≥50分)：安排优先人工复核
- **MEDIUM** (≥25分)：进行抽样复核
- **LOW** (<25分)：常规审计程序

### 2. 用户API Key支持

#### 安全设计原则
- **不持久化**：API Key仅内存使用，执行结束后即销毁
- **审计追踪**：所有调用结果写入快照，记录`user_model_key_used=true`
- **实验性标记**：触发`experimental_logic_used=true`，影响下游处理

#### 支持的外部模型
```python
# 示例配置
{
    "user_api_key": "sk-...",
    "model_provider": "openai",      # openai/anthropic/其他
    "model_name": "gpt-4",           # 具体模型名称
    "base_url": "https://api.openai.com"  # 可选，自定义endpoint
}
```

#### 回退机制
- 外部API调用失败 → 自动回退到内部规则引擎
- 保证审计流程的连续性，不会因外部服务中断而阻塞

### 3. 快照元数据

每次执行生成完整的审计快照：

```python
{
    "node_type": "AnalysisReasoningAI",
    "node_version": "2.0.0",
    "execution_hash": "sha256_hash",           # 执行唯一标识
    "generated_at": "2024-01-15T10:30:00Z",
    "model_info": {
        "model_name": "external-gpt-4",        # 或 "internal-rules-engine"
        "provider": "user_provided",           # 或 "internal"
        "capabilities": ["risk_assessment", "suggestion_generation"]
    },
    "governance_flags": {
        "user_model_key_used": true,           # 是否使用外部API
        "experimental_logic_used": true,      # 是否为实验性逻辑
        "input_boundary_enforced": true,      # 输入边界检查通过
        "snapshot_persisted": true           # 快照已持久化
    },
    "provenance": {
        "input_risk_items_count": 5,          # 输入规则数量
        "input_metrics_keys": ["total_transactions", "high_risk_count"],
        "external_api_used": true             # 是否调用外部API
    }
}
```

## 使用场景示例

### 场景1：标准内部分析
```python
# 输入
risk_items = [
    {"rule_id": "R001", "description": "金额异常", "risk_level": "HIGH"},
    {"rule_id": "R002", "description": "频率异常", "risk_level": "MEDIUM"}
]
metrics = {"total_transactions": 100, "high_risk_count": 5}

# 执行
risk_assessment, risk_level, suggestions, metadata = node.analyze_audit_risk(
    risk_items=risk_items,
    metrics=metrics
)

# 输出
# risk_level = "HIGH"
# metadata["governance_flags"]["user_model_key_used"] = False
```

### 场景2：用户外部API分析
```python
# 输入
risk_items = [...]  # 同上
user_config = {
    "user_api_key": "sk-user-provided-key",
    "model_provider": "openai",
    "model_name": "gpt-4-turbo"
}

# 执行
result = node.analyze_audit_risk(
    risk_items=risk_items,
    metrics=metrics,
    **user_config
)

# 输出
# result[3]["governance_flags"]["user_model_key_used"] = True
# result[3]["governance_flags"]["experimental_logic_used"] = True
```

### 场景3：人工复核结合分析
```python
# 输入包含人工复核状态
human_review_states = {
    "pending_count": 12,
    "rejected_count": 2,
    "approved_count": 8
}

# 执行时会考虑人工复核历史
result = node.analyze_audit_risk(
    risk_items=risk_items,
    metrics=metrics,
    human_review_states=human_review_states
)
```

## 治理与合规要求

### 输入边界检查
- 强制验证`risk_items`为列表格式
- 强制验证`metrics`为字典格式
- 禁止包含`dataframe`、`raw_data`等原始数据关键词

### 审计追踪
- 每次执行生成唯一`execution_hash`
- 记录完整的输入摘要和处理模式
- 支持审计日志追溯

### 外部API治理
- API Key调用前后进行审计日志记录
- 所有外部API结果标记为实验性
- 失败时自动降级到内部规则

## 与其他节点的集成

### 上游节点
- **RuleCalculationNode**：提供`risk_items`规则触发结果
- **CommonMetricsNode/SceneMetricsNode**：提供`metrics`指标数据
- **HumanReviewNode**：提供`human_review_states`复核状态

### 下游节点
- **ResultGenerationNode**：消费`risk_assessment`构建审计结果
- **ExportReportNode**：根据`risk_level`决定是否阻断导出
- **AuditLog**：记录分析执行和快照生成

### 数据流示例
```
RuleCalculationNode → risk_items
CommonMetricsNode → metrics
AnalysisReasoningAI → risk_assessment + risk_level + suggestions + metadata
ResultGenerationNode → 消费分析结果生成AuditResult
ExportReportNode → 检查experimental_logic_used决定导出策略
```

## 测试覆盖

### 单元测试
- ✅ 内部规则风险评估算法
- ✅ 外部API调用与回退机制
- ✅ 输入验证和治理边界
- ✅ 快照元数据结构完整性
- ✅ 不同风险等级的建议生成

### 集成测试
- ✅ 与RuleCalculationNode的数据流
- ✅ 与ResultGenerationNode的分析结果消费
- ✅ 外部API治理标记传播
- ✅ 审计日志记录完整性

### 治理测试
- ✅ 禁止输入模式的边界检查
- ✅ 实验性标记的正确设置
- ✅ API Key不持久化的安全验证

## 优化方向

### 短期优化 (P0-P1)
1. **外部API支持扩展**：支持更多模型提供商 (Claude, Gemini等)
2. **分析模板系统**：根据行业和场景定制分析模板
3. **批量分析优化**：支持一次分析多个审计对象的批量处理

### 中期优化 (P2-P3)
1. **多模型比较**：同时调用多个外部模型进行比较分析
2. **分析结果缓存**：对相似输入进行智能缓存避免重复计算
3. **实时分析更新**：支持增量分析，随着新数据到来更新风险评估

### 长期优化 (P4+)
1. **机器学习增强**：基于历史审计数据训练专用风险模型
2. **跨审计周期分析**：考虑历史趋势和周期性模式
3. **预测性分析**：基于当前数据预测未来风险趋势

## 设计原则

**"AnalysisReasoningAI v2 是审计师的智能助手，不是决策者。它提供分析洞察，帮助审计师做出更好的判断，但最终决策权始终掌握在人类手中。"**

这个定位确保了：
- **专业性**：专注审计分析，不涉及通用AI任务
- **可控性**：严格的治理边界和审计追踪
- **灵活性**：支持内部规则和外部API的双模式
- **可靠性**：外部API失败时的自动降级保证
