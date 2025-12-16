# 节点使用指南

> **所有节点的详细使用说明**

---

## 📚 节点分类

### 第一层：数据采集与输入层

#### ExcelLoader - Excel文件加载
**功能**: 将 Excel 文件加载为 DataFrame

**输入参数**:
- `file_path` (STRING, 必填): Excel 文件路径
- `sheet_name` (STRING, 可选): 工作表名称，默认首个工作表
- `nrows` (INT, 可选): 仅读取前 N 行，用于大文件抽样

**输出**:
- `dataframe` (DATAFRAME): 加载的数据

**示例**:
```json
{
  "file_path": "input/invoice_demo.xlsx",
  "sheet_name": "Sheet1"
}
```

**推荐组合**: 后接 `ColumnMapperNode` 统一列名

---

#### FileUploadNode - 文件上传
**功能**: 接收用户上传的原始审计文件

**输入参数**:
- `file_path` (STRING, 必填): 文件路径
- `workflow_id` (STRING, 必填): 工作流ID

**输出**:
- `file_id` (STRING): 文件ID
- `storage_path` (STRING): 存储路径
- `file_metadata` (DICT): 文件元数据

**推荐组合**: 后接 `ExcelLoader` 或 `FileRecognitionNode`

---

### 第二层：数据清洗层

#### ColumnMapperNode - 列名映射
**功能**: 统一列名，裁剪关键信息

**输入参数**:
- `dataframe` (DATAFRAME, 必填): 待处理数据
- `mapping_json` (STRING, 必填): JSON 映射 `原列名` → `标准列名`
- `keep_other_columns` (BOOLEAN, 可选): 是否保留未映射列，默认 `false`
- `strict_mode` (BOOLEAN, 可选): 缺少映射列是否报错，默认 `true`

**输出**:
- `mapped_df` (DATAFRAME): 完成重命名与筛选的数据
- `report` (STRING): 映射统计

**示例配置**:
```json
{
  "mapping_json": "{\"发票号码\":\"invoice_no\",\"金额\":\"amount\",\"日期\":\"date\"}",
  "keep_other_columns": false,
  "strict_mode": true
}
```

**推荐组合**: 
- 前置: `ExcelLoader`
- 后置: `NullValueCleanerNode`, `ExcelColumnValidator`

---

#### NullValueCleanerNode - 空值清洗
**功能**: 缺失值标准化清洗

**输入参数**:
- `dataframe` (DATAFRAME, 必填): 待处理数据
- `target_columns` (STRING, 可选): `*` 表示所有列；`amount,tax` 仅处理指定列
- `strategy` (STRING, 必填): 
  - `drop_rows` - 删除空值行
  - `fill_zero` - 填充0
  - `fill_mean` - 填充均值
  - `fill_custom` - 自定义值
  - `ffill` - 前向填充
  - `bfill` - 后向填充
- `custom_value` (STRING, 可选): `fill_custom` 时使用

**输出**:
- `cleaned_df` (DATAFRAME): 清洗后的数据
- `report` (STRING): 处理报告

**推荐组合**:
- 前置: `ColumnMapperNode`
- 后置: `ExcelColumnValidator`, `AuditCheckNode`

---

### 第三层：指标与规则计算层

#### ExcelColumnValidator - 列值范围校验
**功能**: 数值列范围校验，输出异常行

**输入参数**:
- `dataframe` (DATAFRAME, 必填): 待校验数据
- `column_name` (STRING, 必填): 列名（如 `amount`）
- `min_value` (FLOAT, 可选): 最小值（含），默认不限
- `max_value` (FLOAT, 可选): 最大值（含），默认不限
- `include_bounds` (BOOLEAN, 可选): 是否包含边界，默认 `true`

**输出**:
- `filtered_df` (DATAFRAME): 异常行
- `report` (STRING): 异常计数和范围描述

**推荐组合**:
- 前置: `ColumnMapperNode`, `NullValueCleanerNode`
- 后置: `AuditCheckNode`, `RuleCalculationNode`

---

#### AuditCheckNode - 金额合规校验
**功能**: 金额阈值初筛，规则引擎前的轻量校验

**输入参数**:
- `amount` (FLOAT, 必填): 待校验金额
- `threshold` (FLOAT, 可选): 阈值上限，默认 `1000.0`
- `include_bounds` (BOOLEAN, 可选): `true` 表示 `<= threshold` 视为合规，默认 `false`

**输出**:
- `is_valid` (BOOLEAN): 合规结果
- `message` (STRING): 包含阈值、边界策略与实际金额的描述

**测试要点**:
- 默认规则：`amount=500<threshold` → `true`；`1500>1000` → `false`
- 边界：`amount=1000, threshold=1000, include_bounds=false` → `false`；`include_bounds=true` → `true`

**推荐组合**:
- 前置: `ColumnMapperNode`, `NullValueCleanerNode`
- 后置: `RuleCalculationNode`, `QuickPlotNode`

---

#### CommonMetricsNode - 通用指标计算
**功能**: 跨场景基础指标计算

**输入参数**:
- `dataframe` (DATAFRAME, 必填): 待计算数据

**输出**:
- `metrics` (DICT): 包含总数、均值、中位数、标准差等

**推荐组合**: 后接 `SceneMetricsNode` 或 `RuleCalculationNode`

---

#### SceneMetricsNode - 场景指标插件
**功能**: 针对不同业务场景的指标计算

**输入参数**:
- `dataframe` (DATAFRAME, 必填): 待计算数据
- `business_scene` (STRING, 必填): 
  - `travel_audit` - 差旅审计
  - `contract_audit` - 合同审计
  - `invoice_audit` - 发票审计
- `common_metrics` (DICT, 可选): 通用指标

**输出**:
- `scene_metrics` (DICT): 场景特定指标

---

#### RuleCalculationNode - 规则计算引擎
**功能**: 基于指标执行审计规则

**输入参数**:
- `dataframe` (DATAFRAME, 必填): 待计算数据
- `metrics` (DICT, 必填): 通用指标或场景指标

**输出**:
- `risk_items` (DATAFRAME): 风险项
- `risk_count` (INT): 风险数量

**规则类型**:
- 金额异常检测
- 重复记录检查
- 供应商集中度

---

### 第四层：可视化层

#### QuickPlotNode - 快速绘图
**功能**: 将 DataFrame 转为 ECharts 配置

**输入参数**:
- `dataframe` (DATAFRAME, 必填): 待绘图数据
- `chart_type` (STRING, 必填): `line` | `bar` | `pie` | `scatter` | `area`
- `x_column` (STRING, 必填): X 轴列名
- `y_column` (STRING, 必填): Y 轴列名
- `title` (STRING, 可选): 图表标题，默认 `"Chart"`
- `legend_show` (BOOLEAN, 可选): 是否显示图例，默认 `true`
- `max_points` (INT, 可选): 最大数据点数，超出自动采样，默认 `1000`

**输出**:
- `echarts_option` (STRING): ECharts 配置 JSON

**推荐组合**:
- 前置: `ColumnMapperNode`, `NullValueCleanerNode`
- 后置: `DataFrameToTableNode` 展示样例表

---

#### DataFrameToTableNode - 数据表预览
**功能**: 将 DataFrame 转为 HTML 表格

**输入参数**:
- `dataframe` (DATAFRAME, 必填): 待转换数据
- `max_rows` (INT, 可选): 最大展示行数，默认 `10`
- `include_index` (BOOLEAN, 可选): 是否展示索引，默认 `false`
- `truncate_cols` (INT, 可选): 单元格最大字符长度，默认 `120`

**输出**:
- `html_table` (STRING): 可直接渲染的 HTML 片段

**推荐组合**:
- 前置: `ColumnMapperNode`, `NullValueCleanerNode`
- 可与 `QuickPlotNode` 并行，用于表格与图形双视角校验

---

### 第五层：脚本与AI层

#### PythonScriptNode - Python脚本执行
**功能**: 受限 Python 执行环境，用于快速自定义 DataFrame 处理

**输入参数**:
- `script` (STRING, 必填): Python 代码
- `dataframe` (DATAFRAME, 可选): 通过变量 `df` 访问

**沙箱限制**:
- ✅ 允许: `pandas (pd)`, `numpy (np)`, 基础数学/字符串操作
- ❌ 禁止: 文件读写 (`open`), 网络请求, 系统命令

**输出**:
- `output` (DATAFRAME): 处理结果
- `console_log` (STRING): 标准输出与错误栈

**示例代码**:
```python
result = dataframe.copy()
result['tax'] = result['amount'] * 0.06
print(f"Processed {len(result)} rows")
return result
```

---

#### TextUnderstandingAI - 文本理解AI
**功能**: 文本分析处理

**输入参数**:
- `text_data` (STRING, 必填): 待分析文本
- `task_type` (STRING, 必填): 
  - `classify` - 风险分类
  - `summarize` - 摘要提取
  - `extract` - 信息提取

**输出**:
- `text_labels` (LIST): 文本标签
- `key_sentences` (LIST): 关键句子
- `extracted_info` (DICT): 提取的信息

---

#### AnalysisReasoningAI - 分析推理AI
**功能**: 综合风险判断

**输入参数**:
- `risk_items` (DATAFRAME, 必填): 风险项
- `metrics` (DICT, 必填): 指标
- `text_analysis` (DICT, 可选): 文本分析结果
- `image_analysis` (DICT, 可选): 图像分析结果

**输出**:
- `risk_assessment` (DICT): 风险评估
- `risk_level` (STRING): 风险等级 (HIGH/MEDIUM/LOW)
- `suggestions` (LIST): 建议列表

---

#### HumanReviewNode - 人工审核
**功能**: 支持人工介入和修正

**输入参数**:
- `risk_items` (DATAFRAME, 必填): 风险项
- `risk_assessment` (DICT, 必填): 风险评估
- `reviewer_comment` (STRING, 可选): 审核意见

**输出**:
- `reviewed_items` (DATAFRAME): 审核后的风险项
- `review_status` (STRING): 审核状态

---

### 第六层：输出层

#### ResultGenerationNode - 结果生成
**功能**: 将审计结论结构化

**输入参数**:
- `risk_items` (DATAFRAME, 必填): 风险项
- `risk_assessment` (DICT, 必填): 风险评估
- `suggestions` (LIST, 可选): 建议列表

**输出**:
- `audit_result` (DICT): 结构化审计结果

---

#### ExportReportNode - 报告导出
**功能**: 生成多种格式的报告

**输入参数**:
- `audit_result` (DICT, 必填): 审计结果
- `export_format` (STRING, 必填): `excel` | `json` | `html`

**输出**:
- `file_path` (STRING): 文件路径
- `status` (STRING): 导出状态

---

## 🔗 节点组合推荐

### 标准审计流程
```
ExcelLoader → ColumnMapperNode → NullValueCleanerNode → ExcelColumnValidator → AuditCheckNode → ExportReportNode
```

### 可视化分析流程
```
ExcelLoader → ColumnMapperNode → QuickPlotNode
                              → DataFrameToTableNode
```

### AI分析流程
```
FileUploadNode → FileRecognitionNode → TextUnderstandingAI → AnalysisReasoningAI → HumanReviewNode → ResultGenerationNode
```

---

**更多信息**: 
- [节点开发指南](./development-guide.md) - 如何开发自定义节点
- [节点方案基线](./solution-plan.md) - 节点设计规范

