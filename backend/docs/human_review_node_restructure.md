# HumanReviewNode 重构文档

## 🎯 核心定位转变

### 旧定位
```
HumanReviewNode = 人工审核节点 (Generic Review Node)
功能：处理风险项审核、生成审核状态、创建任务
```

### 新定位
```
HumanReviewNode = 审计决策登记器 (Audit Decision Registrar)
功能：把人的明确决策记录成可追溯、可复核、可签字的系统事实
唯一能把AI和规则产生的结果合法转化为审计决定
```

---

## 🔑 核心功能重构

### 1. **双向API钩子设计** (Core Innovation)

#### 入站钩子：create_review_task
**触发来源**：被阻断/标记/升级的审计结果
- ExportReportNode（治理阻断）
- AnalysisReasoningNode（低置信解释）
- RuleCalculationNode（高风险规则）

```python
# API调用示例
result = node.execute({
    "action": "create_task",
    "audit_result_id": "audit_123",
    "trigger_source": "ai_gov",  # ai_gov | rule | analysis | export
    "trigger_reason": "AI governance violation detected",
    "affected_rule_ids": ["rule_1", "rule_2"],
    "analysis_refs": ["analysis_456"]
})
```

**返回值**：
```json
{
  "status": "created",
  "task_id": "hr_e8789397019f",
  "review_task_id": "hr_e8789397019f",
  "audit_log_id": null,
  "task_payload": {
    "task_id": "hr_e8789397019f",
    "audit_result_id": "audit_123",
    "trigger_source": "ai_gov",
    "status": "pending_review",
    "affected_rule_ids": ["rule_1", "rule_2"],
    "analysis_refs": ["analysis_456"],
    "created_at": "2024-12-25T23:22:07.344640",
    "created_by": "system"
  }
}
```

#### 出站钩子：commit_review_decision
**人工决策输入**，强制要求：
- reviewer_id, reviewer_name, reviewer_role, reviewer_license
- decision_type: approve | reject | request_changes | override
- decision_comment（必填，不可空）
- override_reason（override时必填）

```python
result = node.execute({
    "action": "commit_decision",
    "task_id": "hr_e8789397019f",
    "reviewer_id": "reviewer_001",
    "reviewer_name": "张三",
    "reviewer_role": "senior_auditor",
    "reviewer_license": "CPA001",
    "decision_type": "approve",
    "decision_comment": "经过审核，确认符合审计要求"
})
```

### 2. **严格状态机** (State Machine Enforcement)

```
PENDING_REVIEW (待审核)
   ↓ approve
APPROVED (已批准) → 允许导出
   ↓ reject
REJECTED (已拒绝) → 永久阻断
   ↓ request_changes
CHANGES_REQUIRED (需要修改) → 要求重新处理
```

**关键约束**：
- 任何状态跳跃都是非法的
- 只有人工决策能改变状态
- 状态变更必须有完整审计记录

### 3. **强制审计记录** (Mandatory Audit Logging)

#### AuditLog 记录
每次操作都写入 AuditLog：
```json
{
  "action_type": "human_review_approve",
  "target_type": "audit_result",
  "target_id": "audit_123",
  "parameters": {
    "task_id": "hr_e8789397019f",
    "reviewer_id": "reviewer_001",
    "decision_type": "approve",
    "decision_comment": "经过审核，确认符合审计要求"
  }
}
```

#### RuleAction 记录
```json
{
  "user_id": "reviewer_001",
  "action": "human_review_task_created",
  "rule_id": null,
  "reason": "Human review task created: AI governance violation detected",
  "metadata": {
    "task_id": "hr_e8789397019f",
    "trigger_source": "ai_gov",
    "audit_result_id": "audit_123"
  }
}
```

### 4. **签名和状态管理** (Signature Management)

#### AuditResult 签名结构更新
```json
{
  "audit_result_id": "audit_123",
  "signature_status": "approved",  // draft → approved/rejected
  "signatures": {
    "approved_by": {
      "id": "reviewer_001",
      "name": "张三",
      "role": "senior_auditor",
      "license": "CPA001",
      "decision_time": "2024-12-25T23:30:00Z",
      "decision_type": "approve",
      "comment": "经过审核，确认符合审计要求"
    }
  },
  "metadata": {
    "human_review_refs": [{
      "task_id": "hr_e8789397019f",
      "decision": "approve",
      "reviewer": "reviewer_001",
      "timestamp": "2024-12-25T23:30:00Z"
    }]
  }
}
```

---

## 🚫 禁止行为 (红线)

### ❌ 绝对不能做的事

| 禁止项 | 原因 | 替代方案 |
|--------|------|----------|
| 自行计算风险 | 与RuleCalculation冲突 | 读取RuleCalculation结果 |
| 自动生成结论 | 人工节点不能"自动" | 只能记录人工决策 |
| 修改原始证据 | 破坏证据链 | 只能添加决策标记 |
| 覆盖AI/规则结果 | 破坏治理边界 | 只能确认/否决/要求修改 |
| 自动跳过复核 | 合规事故 | 必须有人工决策 |

**设计原则**：HumanReviewNode 不负责"判断对不对"，只负责记录"是谁、在何时、基于什么，作出了决定"。

---

## 🔗 节点协作关系

### 1. **与ExportReportNode的联动**
```
ExportReportNode (被动裁决者)
├── 读取 HumanReview 状态
├── approved → 允许导出
├── rejected → 永久阻断
└── ❌ 不接触用户，不发起任务
```

### 2. **与ResultGenerationNode的联动**
```
ResultGenerationNode (初版生成者)
├── 生成 draft AuditResult
├── 读取 HumanReview 签名状态
└── 只有 approved 才写入最终版本

HumanReviewNode (签名更新者)
├── 更新 signatures / status
└── 不可反向修改 ResultGeneration 结果
```

### 3. **与AnalysisReasoningNode的联动**
```
AnalysisReasoningNode (解释提供者)
├── 生成分析解释
└── analysis_refs 挂在 review_task 上

HumanReviewNode (决策记录者)
├── 读取 analysis_refs 作为决策依据
└── 记录人工对分析结果的确认/否决
```

---

## 🏗️ 技术架构

### API设计模式
```python
def process_review_action(self, action: str, **kwargs):
    if action == "create_task":
        return self._create_review_task(**kwargs)
    elif action == "commit_decision":
        return self._commit_review_decision(**kwargs)
```

### 任务持久化
- 存储路径：`{STORAGE_PATH}/tasks/human_review/{task_id}.json`
- 完成任务：`{STORAGE_PATH}/tasks/human_review/completed/{task_id}.json`
- 原子写入保证数据完整性

### AuditResult快照管理
- 审核决策触发新版本创建
- 格式：`{audit_result_id}_reviewed_{timestamp}.json`
- 保持历史版本完整性

---

## ✅ 合规性保证

### 审计可追溯性
- ✅ 每个决策都有完整记录（谁、何时、何决定、何原因）
- ✅ 所有操作写入AuditLog和RuleAction
- ✅ 决策与原始证据完全分离但可关联

### 治理合规
- ✅ 状态机防止无效状态转换
- ✅ 强制决策评论和审核人身份验证
- ✅ Override需要特殊理由和权限

### 性能与扩展
- ✅ 任务ID采用高熵随机生成
- ✅ 支持批量任务处理
- ✅ 异步审计日志写入

---

## 🧪 测试覆盖

- ✅ 创建审核任务API
- ✅ 决策提交和验证
- ✅ 状态机约束
- ✅ 错误处理（任务不存在、权限不足等）
- ✅ 向后兼容方法

---

## 🎯 验收标准

1. **API完整性**：create_task 和 commit_decision API 完全可用
2. **状态一致性**：所有状态转换都经过验证，无非法跳跃
3. **审计完整性**：每个决策都有完整审计记录
4. **集成就绪**：与ExportReportNode、ResultGenerationNode完美协作
5. **合规达标**：满足审计要求的可追溯性和责任界定

---

## 📈 后续优化方向

1. **多审核人支持**：主审/复核分离流程
2. **SLA管理**：审核超时提醒和升级机制
3. **批量审核**：相似任务的批量处理能力
4. **审核模板**：不同类型任务的标准化审核流程
5. **高级权限**：基于角色的审核权限控制

---

## 💡 设计哲学

**HumanReviewNode 的价值不在于"做出更好的决定"，而在于"让每个决定都变得可审计、可复核、可负责"。**

**没有 HumanReviewNode 的记录，就不存在"合法的审计结论"。**

**它是整个系统从"自动化分析"到"审计责任"的关键转换点。** 🎯
