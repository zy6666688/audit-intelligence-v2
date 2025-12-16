# 📊 审计工作流库

## 可运行的工作流示例

### 1. 发票审计工作流 (`invoice_audit_workflow.json`)

完整的端到端发票审计流程，包含14个节点，覆盖全部5层架构。

**工作流结构图：**
```
┌─────────────────────────────────────────────────────────────────┐
│                      发票审计工作流 v1.0                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [数据采集层]                                                     │
│     ExcelLoader ──────────┐                                     │
│                          ↓                                      │
│  [数据清洗层]                                                     │
│     ColumnMapper ──→ NullCleaner ──┐                           │
│                                    ↓                           │
│  [指标计算层]                                                     │
│     ┌──────────────────────────────┼──────────────┐            │
│     ↓                              ↓              ↓            │
│  CommonMetrics    SceneMetrics    ColumnValidator              │
│     ↓                ↓                   ↓                     │
│  [规则引擎层]         ↓                   ↓                     │
│     └──────→ RuleCalculation ←───────────┘                     │
│                    ↓                                           │
│  [AI分析层]                                                      │
│     TextAI ──→ ReasoningAI ←─────┘                             │
│                    ↓                                           │
│  [人工审核层]                                                     │
│              HumanReview                                       │
│                    ↓                                           │
│  [输出层]                                                        │
│     Visualization  ResultGeneration → ExportReport              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**关键特性：**
- ✅ 重复发票检测
- ✅ 金额异常识别  
- ✅ 供应商集中度分析
- ✅ AI风险评分
- ✅ 人工审核确认
- ✅ 自动报告生成

**使用方法：**
```bash
# 导入工作流
1. 在前端界面点击"导入工作流"
2. 选择本文件：invoice_audit_workflow.json
3. 点击"运行审计"

# 或通过API调用
curl -X POST http://localhost:8000/api/workflow/run \
  -H "Content-Type: application/json" \
  -d @invoice_audit_workflow.json
```

---

### 2. 快速数据分析流程 (开发中)

简化版工作流，用于快速数据质量检查。

**包含节点：**
- ExcelLoader → CommonMetrics → QuickPlot → ExportReport

---

### 3. 票据OCR验真流程 (开发中)

专门用于票据图像的识别和验证。

**包含节点：**
- FileUpload → FileRecognition → ImageAI → RuleCalculation → ExportReport

---

## 工作流规范

### 文件格式
所有工作流采用JSON格式，包含以下结构：

```json
{
  "workflow_id": "unique_identifier",
  "name": "工作流名称",
  "description": "详细描述",
  "nodes": [
    {
      "id": "n1",
      "type": "NodeType",
      "params": {},
      "position": {"x": 100, "y": 100}
    }
  ],
  "edges": [
    {
      "from": "n1",
      "to": "n2",
      "from_slot": 0,
      "to_slot": 0
    }
  ]
}
```

### 命名规范
- 工作流ID：`{domain}_{function}_v{version}`
- 节点ID：`n{number}` 或 `{function}_{number}`
- 文件名：`{workflow_id}.json`

### 版本管理
- v1.x - 稳定版本，生产可用
- v0.x - 测试版本，开发中
- _dev - 开发版本，不稳定

## 自定义工作流

### 创建新工作流
```python
from backend.workflow_builder import WorkflowBuilder

wb = WorkflowBuilder("my_custom_workflow")
wb.add_node("ExcelLoader", params={"file_path": "data.xlsx"})
wb.add_node("CommonMetrics")
wb.connect("n1", "n2")
wb.export("my_workflow.json")
```

### 验证工作流
```bash
python -m backend.workflow_validator my_workflow.json
```

## 常见问题

**Q: 如何调试工作流？**
A: 使用前端的单步执行功能，或查看backend/logs/workflow_*.log

**Q: 如何优化性能？**
A: 启用节点缓存，设置合理的chunk_size参数

**Q: 如何处理失败？**
A: 配置failure_policy为RETRY或SKIP，设置max_retries参数
