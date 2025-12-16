# 审计数智析 v2 - 节点库总体说明书

> **⚠️ 重要提示**: 节点文档已整合到新位置！  
> **新位置**: [节点使用指南](../../../docs/nodes/user-guide.md)

---

## 📚 文档已整合

所有节点文档已整合到新的文档结构中：

- **[节点使用指南](../../../docs/nodes/user-guide.md)** - 所有节点的详细使用说明（整合了12个单独节点文档）
- **[节点开发指南](../../../docs/nodes/development-guide.md)** - 如何开发自定义节点
- **[节点方案基线](../../../docs/nodes/solution-plan.md)** - 节点设计规范（对标 ComfyUI）

---

## 概述
审计智能平台提供了完整的五层节点体系，支持从数据采集到报告生成的全流程审计工作流。

## 常用方案与最佳实践
- 常用节点方案基线（对标 ComfyUI）：详见 [节点方案基线](../../../docs/nodes/solution-plan.md)，统一输入输出、错误处理、性能与安全要求。
- 新增节点时，请先对照方案基线完善文档与验收项，再在后端注册并补充前端说明。

## 节点分类体系

### 第一层：数据采集与输入层
#### 文件处理节点
- `FileUploadNode` - 文件上传与存储
  - 输入：文件路径、工作流ID
  - 输出：文件ID、存储路径、元数据
  
- `FileRecognitionNode` - 文件识别（OCR/结构化）
  - 输入：文件ID、识别策略
  - 输出：结构化数据、识别文本
  
- `ExcelLoader` - Excel文件加载
  - 输入：文件路径
  - 输出：DataFrame数据

### 第二层：指标与规则计算层
#### 指标计算节点
- `CommonMetricsNode` - 通用指标计算
  - 计算：总数、均值、中位数、标准差等
  
- `SceneMetricsNode` - 场景指标插件
  - 场景：差旅审计、合同审计、发票审计
  
- `RuleCalculationNode` - 规则计算引擎
  - 规则：金额异常、重复记录、集中度过高

#### 基础审计节点
- `AuditCheckNode` - 金额合规校验
- `ExcelColumnValidator` - 列值范围验证

### 第三层：AI分析层
#### 智能分析节点
- `TextUnderstandingAI` - 文本理解AI
  - 功能：分类、摘要、信息提取
  
- `ImageRecognitionAI` - 票据识别AI
  - 功能：重复检查、真伪鉴定、异常检测
  
- `AnalysisReasoningAI` - 分析推理AI
  - 功能：综合风险判断、审计建议生成

### 第四层：审计协同层
#### 人机协同节点
- `HumanReviewNode` - 人工审核
  - 功能：风险确认、意见补充、结论修正

### 第五层：输出与归档层
#### 可视化节点
- `QuickPlotNode` - 快速绘图
  - 图表：折线图、柱状图、饼图、散点图
  
- `DataFrameToTableNode` - 数据表预览

#### 报告生成节点
- `ResultGenerationNode` - 结果生成
  - 输出：结构化审计结果
  
- `ExportReportNode` - 报告导出
  - 格式：Excel、JSON、HTML

### 数据清洗层
#### 数据预处理节点
- `ColumnMapperNode` - 列名映射与筛选
- `NullValueCleanerNode` - 空值清洗

### 脚本节点
#### 自定义处理
- `PythonScriptNode` - Python脚本执行
  - 沙箱环境，安全限制

## 核心特性

1. **工作流编排**: 所有节点通过workflow_instance_id串联
2. **幂等性保证**: 相同输入总是产生相同输出
3. **证据追踪**: 全程记录审计证据链
4. **成本估算**: 预估执行时间和资源消耗
5. **失败策略**: 支持重试、跳过、补偿等策略

## 🚀 快速开始

### 运行示例工作流
```bash
# 1. 生成示例数据和工作流
cd backend
python example_workflow.py

# 2. 启动后端服务
python -m uvicorn app.main:app --reload

# 3. 启动前端服务（新终端）
cd ..
npm run dev

# 4. 导入工作流文件
# 选择: backend/workflows/invoice_audit_workflow.json
```

### 查看完整示例
📖 [**发票审计工作流完整示例**](./WORKFLOW_EXAMPLE.md) - 包含详细配置和运行指南

## 使用指南
- **查看文档**: 按住 `Ctrl` + `左键点击` 节点，可查看该节点的详细说明书
- **数据预览**: 点击节点上的 👁️ 图标，可在底部面板查看输出数据
- **导入工作流**: 点击工具栏的"导入"按钮，选择JSON格式的工作流文件
- **运行审计**: 点击"运行"按钮执行整个工作流
