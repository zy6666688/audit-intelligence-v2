# ExportReportNode v2 重构文档

## 概述

`ExportReportNode` 已重构为 v2 版本，从简单的报告导出节点升级为"**审计报告导出的最后防线**"，实现完整的artifact管理、治理检查和UI链接控制。

## 核心定位转变

### 定位：审计输出的最后防线
- **核心职责**：执行最终的AI治理检查、生成带完整元数据的导出产物、管理访问控制
- **治理边界**：禁止experimental_logic_used标记的内容用于外部用途
- **安全特性**：实现signed URL、访问控制、审计追踪

### 区别于其他节点
- **vs RuleCalculationNode**：不计算规则，只验证规则结果的合规性
- **vs HumanReviewNode**：不创建复核任务，只在阻断时触发
- **vs AnalysisReasoningAI**：不进行分析，只进行最终的治理检查

## API接口设计

### 输入参数
```python
{
    "audit_result_ref": {
        "workflow_id": "string",           # 必需
        "run_id": "string",                # 必需
        "audit_result_id": "uuid",         # 必需
        "storage_path": "string"           # 可选，用于直接路径
    },
    "export_options": {
        "format": "pdf|xlsx|json|html",    # 默认json
        "template_id": "string",           # 可选
        "include_attachments": true,       # 可选
        "for_external_use": false          # 默认false
    },
    "requester": {
        "user_id": "string",               # 默认system
        "role": "string",                  # 可选
        "request_time": "ISO8601"          # 默认当前时间
    },
    "ui_flags": {
        "force_watermark": false,          # 可选
        "additional_notes": "string"       # 可选
    }
}
```

### 输出格式
```python
{
    "status": "SUCCESS|SUCCESS_WITH_WARNINGS|BLOCKED",
    "artifact_id": "artifact-xxxxxxxxxxxx",           # 成功时返回
    "file_path": "/storage/exports/...json",         # 成功时返回
    "ui_link": "/ui/exports/wf/run/artifact",        # 成功时返回
    "metadata_path": "/storage/exports/.../metadata.json", # 成功时返回
    "auditlog_ref": "/api/auditlogs/12345",          # 成功时返回
    "warnings": ["EXPERIMENTAL_LOGIC_USED"],         # 警告时返回
    "error_type": "AI_GOVERNANCE_BLOCK",             # 阻断时返回
    "user_message": "AI governance check failed...", # 阻断时返回
    "internal_detail": {...}                         # 阻断时返回
}
```

## 核心功能详解

### 1. 治理检查流程

#### AI治理验证
- 调用 `ai_gov.check(audit_result)` 进行AI输出治理检查
- 检查硬性违规：`violations.hard > 0` 或 `status == "FAILED_HARD"`
- 检查警告级违规：`violations.warnings > 0` 或 `status == "WARN"`

#### 签名状态验证
- 外部使用：要求 `signature_status == "approved"`
- 内部使用：允许 `signature_status == "approved"`（暂定）

#### 实验性逻辑检查
- `experimental_logic_used == true` + `for_external_use == true` → 阻断
- `experimental_logic_used == true` + `for_external_use == false` → 允许但水印

### 2. Artifact管理系统

#### 存储路径约定
```
/storage/exports/{env}/{workflow_id}/{run_id}/{audit_result_id}/{artifact_id}/
├── audit_report_{audit_result_id}.json    # 导出产物
└── metadata.json                          # 元数据文件
```

- `env`: prod|staging|dev（从环境变量获取）
- `artifact_id`: 唯一标识符 `artifact-{sha256后16位}`

#### 元数据结构
```json
{
  "artifact_id": "artifact-20251226001a2b3c",
  "audit_result_id": "uuid-1234",
  "workflow_id": "invoice_audit",
  "run_id": "run-20251226-01",
  "file_name": "audit_report_uuid-1234.json",
  "format": "json",
  "ui_link": "/ui/exports/invoice_audit/run-20251226-01/artifact-20251226001a2b3c",
  "storage_path": "/storage/exports/dev/invoice_audit/run-20251226-01/uuid-1234/artifact-20251226001a2b3c/audit_report_uuid-1234.json",
  "generated_by": "ExportReportNode v2.0",
  "generated_at": "2025-12-26T13:12:00Z",
  "provenance": {
    "audit_result_snapshot_ref": "/storage/audit/invoice_audit/run-20251226-01/uuid-1234.json",
    "analysis_snapshot_refs": ["/storage/analysis/analysis1.json"],
    "ci_scan_report_ref": "/storage/scans/scan1.json"
  },
  "governance": {
    "experimental_logic_used": false,
    "ai_gov_status": "CLEAN",
    "ai_gov_summary": "Clean"
  },
  "access_control": {
    "visibility": "internal",
    "signed_url_ttl_seconds": 3600
  },
  "file_hash": "sha256:abcd1234...",
  "auditlog_ref": "/api/auditlogs/12345"
}
```

### 3. 水印和警告策略

#### 水印应用条件
- AI治理警告：`ai_gov_status` 为 "WARNINGS_ONLY"
- 实验性逻辑：`experimental_logic_used == true`
- 强制水印：`ui_flags.force_watermark == true`

#### 水印内容
```json
{
  "applied": true,
  "notice": "DRAFT – AI-ASSISTED CONTENT – NOT A FINAL AUDIT OPINION",
  "warnings": ["EXPERIMENTAL_LOGIC_USED", "AI_GOVERNANCE_WARNINGS"],
  "experimental_logic_used": true
}
```

### 4. 访问控制和UI链接

#### UI链接生成
- 格式：`/ui/exports/{workflow_id}/{run_id}/{artifact_id}`
- 用途：前端展示和管理导出产物

#### Signed URL策略（预留接口）
- TTL：默认3600秒，最大86400秒
- 权限：基于用户角色和artifact可见性
- 审计：生成和使用都记录审计日志

## 使用场景示例

### 场景1：正常内部导出
```python
audit_result_ref = {
    "workflow_id": "invoice_audit",
    "run_id": "run-20251226-01",
    "audit_result_id": "uuid-1234"
}

export_options = {"format": "json", "for_external_use": False}

result = node.export_audit_report(audit_result_ref, export_options)
# result["status"] == "SUCCESS"
# result["ui_link"] == "/ui/exports/invoice_audit/run-20251226-01/artifact-xxxx"
```

### 场景2：外部导出被阻断
```python
audit_result_ref = {...}
export_options = {"for_external_use": True}  # 外部使用

# audit_result.governance_flags.experimental_logic_used == true

result = node.export_audit_report(audit_result_ref, export_options)
# result["status"] == "BLOCKED"
# result["error_type"] == "AI_GOVERNANCE_BLOCK"
# result["internal_detail"]["review_task_id"] 存在
```

### 场景3：带警告的成功导出
```python
# audit_result 有AI治理警告但不阻断
result = node.export_audit_report(audit_result_ref, export_options)
# result["status"] == "SUCCESS_WITH_WARNINGS"
# result["warnings"] == ["AI_GOVERNANCE_WARNINGS"]

# 导出文件中包含水印
with open(result["file_path"]) as f:
    data = json.load(f)
    assert data["watermark"]["applied"] == True
```

## 错误码和处理策略

| 错误码 | 触发条件 | 处理策略 |
|--------|----------|----------|
| `AI_GOVERNANCE_BLOCK` | AI治理硬性违规 | 创建review_task，阻断导出 |
| `MISSING_SIGNATURE` | 外部使用但签名未批准 | 阻断导出 |
| `EXPERIMENTAL_LOGIC_EXTERNAL` | 实验性逻辑用于外部 | 阻断导出 |
| `INVALID_INPUT` | audit_result_ref无效 | 返回错误，不创建任务 |
| `SCHEMA_MISMATCH` | 无法加载审计结果快照 | 返回错误 |
| `INTERNAL_ERROR` | 意外错误 | 记录日志，返回错误 |

## 与其他节点的集成

### 上游节点
- **ResultGenerationNode**：提供audit_result快照
- **AnalysisReasoningAI**：提供分析结果和governance_flags
- **HumanReviewNode**：提供signature_status

### 下游节点/系统
- **UI系统**：消费ui_link展示导出产物
- **审计日志系统**：记录所有导出操作
- **人工复核系统**：接收review_task处理阻断项目

### 数据流示例
```
ResultGenerationNode → audit_result (with governance_flags)
ExportReportNode → governance_check + artifact_generation
UI System → ui_link访问 + signed_url下载
AuditLog → 记录export_report_success/block事件
```

## 测试覆盖要求

### 单元测试
- ✅ 治理检查逻辑：硬阻断、警告水印、签名验证
- ✅ Artifact生成：ID唯一性、存储路径、元数据完整性
- ✅ 错误处理：各种错误码的正确返回
- ✅ 输入验证：audit_result_ref的完整性检查

### 集成测试
- ✅ 与ResultGenerationNode的数据流
- ✅ 与ai_gov模块的集成
- ✅ 文件系统操作的正确性
- ✅ 审计日志记录的完整性

### 治理测试
- ✅ 实验性逻辑的阻断行为
- ✅ 外部使用权限控制
- ✅ 水印应用的条件判断
- ✅ 人工复核任务的正确创建

## 设计原则

**"ExportReportNode是审计系统的最后一道防线。它不创造价值，但它保护价值。它不生成审计结论，但它确保只有合规的结论才能离开系统。"**

这个定位确保了：
- **合规性**：严格的治理检查和阻断机制
- **可追溯性**：完整的provenance和审计日志
- **用户友好性**：清晰的错误信息和UI链接
- **扩展性**：支持多种导出格式和访问控制策略
