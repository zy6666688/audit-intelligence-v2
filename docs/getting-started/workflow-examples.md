# 工作流示例

> **完整的工作流配置和运行指南**

---

## 📋 发票审计工作流

### 工作流概览

这是一个完整的端到端发票审计工作流，展示了所有五层节点的协同工作。

```
ExcelLoader → ColumnMapperNode → NullValueCleanerNode → ExcelColumnValidator
                                                              ↓
                                                      [AuditCheckNode]
                                                              ↓
                                    [DataFrameToTableNode] [QuickPlotNode]
```

### 节点配置

#### 1. ExcelLoader - 加载数据
```json
{
  "type": "ExcelLoader",
  "params": {
    "file_path": "input/invoice_demo.xlsx",
    "sheet_name": "Sheet1"
  }
}
```

#### 2. ColumnMapperNode - 列名映射
```json
{
  "type": "ColumnMapperNode",
  "params": {
    "mapping_json": "{\"发票号码\":\"invoice_no\",\"金额\":\"amount\",\"日期\":\"date\"}",
    "keep_other_columns": false
  }
}
```

#### 3. NullValueCleanerNode - 空值清洗
```json
{
  "type": "NullValueCleanerNode",
  "params": {
    "target_columns": "amount,date",
    "strategy": "drop_rows"
  }
}
```

#### 4. ExcelColumnValidator - 范围校验
```json
{
  "type": "ExcelColumnValidator",
  "params": {
    "column_name": "amount",
    "min_value": 0,
    "max_value": 20000,
    "include_bounds": true
  }
}
```

#### 5. AuditCheckNode - 规则判定
```json
{
  "type": "AuditCheckNode",
  "params": {
    "amount": 10000.0,
    "threshold": 10000.0
  }
}
```

#### 6. DataFrameToTableNode - 数据预览
```json
{
  "type": "DataFrameToTableNode",
  "params": {
    "max_rows": 20
  }
}
```

#### 7. QuickPlotNode - 可视化
```json
{
  "type": "QuickPlotNode",
  "params": {
    "chart_type": "bar",
    "x_column": "invoice_no",
    "y_column": "amount",
    "title": "异常金额分布"
  }
}
```

---

## 🚀 运行步骤

### 1. 准备数据文件

确保文件存在：
```
backend/input/invoice_demo.xlsx
```

文件应包含列：
- `发票号码`
- `金额`
- `日期`

### 2. 导入工作流

1. 打开前端界面
2. 点击"导入"按钮
3. 选择 `backend/workflows/audit_mock_workflow.json`

### 3. 执行工作流

1. 点击"运行审计"按钮
2. 观察节点执行状态
3. 查看数据预览和图表

### 4. 查看结果

- **数据预览**: 点击节点上的 👁️ 图标
- **图表**: 自动在画布上显示
- **报告**: 位于 `backend/output/reports/`

---

## 📊 预期输出

### 风险发现示例
```
🚨 发现的风险项：
1. 金额异常：INV-2024-003 金额150000元超过阈值
2. 重复记录：INV-2024-001 出现2次
3. 供应商集中：供应商A占比60%
```

### 审计报告结构
```
audit_report_20241212_193000.xlsx
├── 摘要 (Summary)
│   ├── 总项目数: 5
│   ├── 高风险: 2
│   └── 风险等级: HIGH
├── 审计发现 (Findings)
│   └── 详细风险清单
└── 审计建议 (Recommendations)
    └── 改进建议列表
```

---

## 🎯 场景化工作流模板

### 差旅审计流程
```
ExcelLoader → SceneMetricsNode(travel_audit) → RuleCalculationNode → HumanReviewNode → ExportReportNode
```

### 合同审计流程
```
FileUploadNode → FileRecognitionNode → TextUnderstandingAI → AnalysisReasoningAI → ResultGenerationNode
```

### 票据验真流程
```
FileUploadNode → FileRecognitionNode → ImageRecognitionAI → RuleCalculationNode → ExportReportNode
```

---

## 💡 最佳实践

1. ✅ **数据验证优先** - 始终先验证数据质量
2. ✅ **渐进式分析** - 从简单规则到复杂AI
3. ✅ **人机结合** - 关键决策保留人工审核
4. ✅ **证据留痕** - 全程记录审计轨迹
5. ✅ **报告标准化** - 使用统一的报告模板

---

**更多示例**: 查看 [节点使用指南](../nodes/user-guide.md)

