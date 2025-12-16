import { BaseNode } from '@/nodes/BaseNode';
import { nodeRegistry } from '@/core/registry/NodeRegistry';

// ExcelLoader 节点
export class ExcelLoaderNode extends BaseNode {
  constructor() {
    super('ExcelLoader');
  }
}
nodeRegistry.registerNode({
  type: 'ExcelLoader',
  title: 'Excel加载器',
  titleEn: 'Excel Loader',
  category: '数据源',
  // 严格按照后端INPUT_TYPES定义：required在前，optional在后
  inputs: [
    { name: 'file_path', nameEn: 'File Path', nameZh: '文件路径', type: 'STRING' },  // Slot 0 (required)
    { name: 'storage_path', nameEn: 'Storage Path', nameZh: '存储路径', type: 'STRING' }  // Slot 1 (optional)
  ],
  outputs: [
    { name: 'dataframe', nameEn: 'DataFrame', nameZh: '数据框', type: 'DATAFRAME' }  // Slot 0
  ],
  properties: [
    { 
      name: 'file_path', 
      label: '文件路径', 
      type: 'string', 
      placeholder: '例如: input/invoice_demo.xlsx',
      description: 'Excel文件的相对路径，支持.xlsx和.xls格式'
    },
    { 
      name: 'sheet_name', 
      label: '工作表名称', 
      type: 'string', 
      placeholder: 'Sheet1 (可选)',
      description: '要加载的工作表名称，留空则加载第一个工作表'
    },
    { 
      name: 'nrows', 
      label: '读取行数', 
      type: 'number', 
      placeholder: '5000 (可选)',
      description: '仅读取前N行，用于大文件抽样测试'
    },
    { 
      name: 'storage_path', 
      label: '存储路径', 
      type: 'string', 
      placeholder: '(可选，来自FileUploadNode)',
      description: '从FileUploadNode接收的文件存储路径'
    }
  ],
  description: '从文件系统加载Excel文件并转换为DataFrame。支持自动查找input目录。可以从FileUploadNode接收storage_path。'
});

// ColumnMapperNode 节点
export class ColumnMapperNode extends BaseNode {
  constructor() {
    super('ColumnMapperNode');
  }
}
nodeRegistry.registerNode({
  type: 'ColumnMapperNode',
  title: '列名映射',
  titleEn: 'Column Mapper',
  category: '数据清洗',
  // 严格按照后端INPUT_TYPES_LEGACY定义：required在前，optional在后
  inputs: [
    { name: 'dataframe', nameEn: 'DataFrame', nameZh: '数据框', type: 'DATAFRAME' },  // Slot 0 (required)
    { name: 'mapping_json', nameEn: 'Mapping JSON', nameZh: '列名映射', type: 'STRING' },  // Slot 1 (required)
    { name: 'keep_other_columns', nameEn: 'Keep Other Columns', nameZh: '保留其他列', type: 'BOOLEAN' },  // Slot 2 (optional)
    { name: 'strict_mode', nameEn: 'Strict Mode', nameZh: '严格模式', type: 'BOOLEAN' }  // Slot 3 (optional)
  ],
  outputs: [
    { name: 'cleaned_df', nameEn: 'Cleaned DataFrame', nameZh: '清洗后数据', type: 'DATAFRAME' },  // Slot 0
    { name: 'report', nameEn: 'Report', nameZh: '报告', type: 'STRING' }  // Slot 1
  ],
  properties: [
    { 
      name: 'mapping_json', 
      label: '列名映射 (JSON)', 
      type: 'code', 
      placeholder: '{"原列名": "新列名"}',
      description: 'JSON格式的列名映射，例如: {"发票号码":"invoice_no","金额":"amount"}'
    },
    { 
      name: 'keep_other_columns', 
      label: '保留其他列', 
      type: 'boolean',
      description: '是否保留未映射的列，false表示只保留映射的列'
    },
    { 
      name: 'strict_mode', 
      label: '严格模式', 
      type: 'boolean',
      description: '如果为true，缺少映射列会报错；如果为false，会忽略缺失的列'
    },
    { 
      name: 'drop_duplicates', 
      label: '删除重复行', 
      type: 'boolean',
      description: '是否在映射后删除重复的行'
    }
  ],
  description: '将原始列名映射为标准列名，统一数据格式。支持列筛选和严格模式检查。'
});

// NullValueCleanerNode 节点
export class NullValueCleanerNode extends BaseNode {
  constructor() {
    super('NullValueCleanerNode');
  }
}
nodeRegistry.registerNode({
  type: 'NullValueCleanerNode',
  title: '空值清洗',
  titleEn: 'Null Value Cleaner',
  category: '数据清洗',
  // 严格按照后端INPUT_TYPES_LEGACY定义：required在前，optional在后
  inputs: [
    { name: 'dataframe', nameEn: 'DataFrame', nameZh: '数据框', type: 'DATAFRAME' },  // Slot 0 (required)
    { name: 'strategy', nameEn: 'Strategy', nameZh: '策略', type: 'STRING' },  // Slot 1 (required)
    { name: 'target_columns', nameEn: 'Target Columns', nameZh: '目标列', type: 'STRING' },  // Slot 2 (optional)
    { name: 'custom_value', nameEn: 'Custom Value', nameZh: '自定义值', type: 'FLOAT' }  // Slot 3 (optional)
  ],
  outputs: [
    { name: 'cleaned_df', nameEn: 'Cleaned DataFrame', nameZh: '清洗后数据', type: 'DATAFRAME' },  // Slot 0
    { name: 'report', nameEn: 'Report', nameZh: '报告', type: 'STRING' }  // Slot 1
  ],
  properties: [
    { 
      name: 'target_columns', 
      label: '目标列', 
      type: 'string', 
      placeholder: 'amount,date 或 * 表示全部',
      description: '要处理的列名，逗号分隔，或使用*表示所有列'
    },
    { 
      name: 'strategy', 
      label: '清洗策略', 
      type: 'select',
      options: ['drop_rows', 'fill_zero', 'fill_mean', 'fill_custom', 'forward_fill', 'backward_fill'],
      description: 'drop_rows: 删除空值行; fill_zero: 填充0; fill_mean: 填充均值; fill_custom: 自定义值; forward_fill: 前向填充; backward_fill: 后向填充'
    },
    { 
      name: 'report_limit', 
      label: '报告行数限制', 
      type: 'number', 
      placeholder: '20',
      description: '清洗报告中显示的最大行数'
    }
  ],
  description: '清洗数据中的空值，支持多种清洗策略。会生成清洗报告记录操作影响。'
});

// ExcelColumnValidator 节点
export class ExcelColumnValidatorNode extends BaseNode {
  constructor() {
    super('ExcelColumnValidator');
  }
}
nodeRegistry.registerNode({
  type: 'ExcelColumnValidator',
  title: '列范围校验',
  titleEn: 'Column Range Validator',
  category: '数据校验',
  // 严格按照后端INPUT_TYPES_LEGACY定义：required在前
  inputs: [
    { name: 'dataframe', nameEn: 'DataFrame', nameZh: '数据框', type: 'DATAFRAME' },  // Slot 0 (required)
    { name: 'column_name', nameEn: 'Column Name', nameZh: '列名', type: 'STRING' },  // Slot 1 (required)
    { name: 'min_value', nameEn: 'Min Value', nameZh: '最小值', type: 'FLOAT' },  // Slot 2 (required)
    { name: 'max_value', nameEn: 'Max Value', nameZh: '最大值', type: 'FLOAT' }  // Slot 3 (required)
  ],
  outputs: [
    { name: 'outliers', nameEn: 'Outliers', nameZh: '异常行', type: 'DATAFRAME' },  // Slot 0
    { name: 'report', nameEn: 'Report', nameZh: '报告', type: 'STRING' }  // Slot 1
  ],
  properties: [
    { 
      name: 'column_name', 
      label: '列名', 
      type: 'string', 
      placeholder: 'amount',
      description: '要校验的列名'
    },
    { 
      name: 'min_value', 
      label: '最小值', 
      type: 'number', 
      placeholder: '0',
      description: '允许的最小值'
    },
    { 
      name: 'max_value', 
      label: '最大值', 
      type: 'number', 
      placeholder: '20000',
      description: '允许的最大值'
    },
    { 
      name: 'include_bounds', 
      label: '包含边界', 
      type: 'boolean',
      description: '是否包含最小值和最大值边界'
    },
    { 
      name: 'report_limit', 
      label: '报告行数限制', 
      type: 'number', 
      placeholder: '20',
      description: '校验报告中显示的最大异常行数'
    }
  ],
  description: '校验指定列的数值范围，过滤超出范围的数据。输出异常数据DataFrame和校验报告。'
});

// AuditCheckNode 节点
export class AuditCheckNode extends BaseNode {
  constructor() {
    super('AuditCheckNode');
  }
}
nodeRegistry.registerNode({
  type: 'AuditCheckNode',
  title: '规则判定',
  category: '审计分析',
  // 严格按照后端INPUT_TYPES_LEGACY定义
  inputs: [
    { name: 'amount', type: 'FLOAT' },  // Slot 0 (required)
    { name: 'threshold', type: 'FLOAT' }  // Slot 1 (required)
  ],
  outputs: [
    { name: 'is_valid', type: 'BOOLEAN' },  // Slot 0
    { name: 'message', type: 'STRING' }  // Slot 1
  ],
  properties: [
    { 
      name: 'amount', 
      label: '金额', 
      type: 'number', 
      placeholder: '10000.0',
      description: '要检查的金额值（可以从params或输入连接获取）'
    },
    { 
      name: 'threshold', 
      label: '阈值', 
      type: 'number', 
      placeholder: '10000.0',
      description: '金额阈值，超过此值将被标记为异常'
    }
  ],
  description: '简单的审计规则检查，判断金额是否超过阈值。返回检查结果和消息。注意：amount输入需要FLOAT类型，不能直接从DATAFRAME连接。'
});

// DataFrameToTableNode 节点
export class DataFrameToTableNode extends BaseNode {
  constructor() {
    super('DataFrameToTableNode');
  }
}
nodeRegistry.registerNode({
  type: 'DataFrameToTableNode',
  title: '数据预览',
  titleEn: 'Data Preview',
  category: '数据输出',
  // 严格按照后端INPUT_TYPES定义：required在前，optional在后
  inputs: [
    { name: 'dataframe', nameEn: 'DataFrame', nameZh: '数据框', type: 'DATAFRAME' },  // Slot 0 (required)
    { name: 'max_rows', nameEn: 'Max Rows', nameZh: '最大行数', type: 'INT' },  // Slot 1 (optional)
    { name: 'include_index', nameEn: 'Include Index', nameZh: '包含索引', type: 'BOOLEAN' }  // Slot 2 (optional)
  ],
  outputs: [
    { name: 'html_table', nameEn: 'HTML Table', nameZh: 'HTML表', type: 'STRING' }  // Slot 0
  ],
  properties: [
    { 
      name: 'max_rows', 
      label: '最大行数', 
      type: 'number', 
      placeholder: '20',
      description: '预览表格显示的最大行数'
    },
    { 
      name: 'include_index', 
      label: '包含索引', 
      type: 'boolean',
      description: '是否在表格中显示行索引'
    },
    { 
      name: 'truncate_cols', 
      label: '列宽限制', 
      type: 'number', 
      placeholder: '120',
      description: '每列显示的最大字符数，超出部分会被截断（前端显示用）'
    }
  ],
  description: '将DataFrame转换为HTML表格格式用于预览。输出HTML字符串。'
});

// QuickPlotNode 节点
export class QuickPlotNode extends BaseNode {
  constructor() {
    super('QuickPlotNode');
  }
}
nodeRegistry.registerNode({
  type: 'QuickPlotNode',
  title: '快速图表',
  titleEn: 'Quick Plot',
  category: '数据可视化',
  // 严格按照后端INPUT_TYPES定义：required在前，optional在后
  inputs: [
    { name: 'dataframe', nameEn: 'DataFrame', nameZh: '数据框', type: 'DATAFRAME' },  // Slot 0 (required)
    { name: 'chart_type', nameEn: 'Chart Type', nameZh: '图表类型', type: 'STRING' },  // Slot 1 (required)
    { name: 'x_column', nameEn: 'X Column', nameZh: 'X轴列', type: 'STRING' },  // Slot 2 (required)
    { name: 'y_column', nameEn: 'Y Column', nameZh: 'Y轴列', type: 'STRING' },  // Slot 3 (required)
    { name: 'title', nameEn: 'Title', nameZh: '标题', type: 'STRING' },  // Slot 4 (optional)
    { name: 'legend_show', nameEn: 'Show Legend', nameZh: '显示图例', type: 'BOOLEAN' }  // Slot 5 (optional)
  ],
  outputs: [
    { name: 'echarts_option', nameEn: 'ECharts Option', nameZh: '图表配置', type: 'STRING' }  // Slot 0
  ],
  properties: [
    { 
      name: 'chart_type', 
      label: '图表类型', 
      type: 'select',
      options: ['line', 'bar', 'pie', 'scatter', 'area'],
      description: 'line: 折线图; bar: 柱状图; pie: 饼图; scatter: 散点图; area: 面积图'
    },
    { 
      name: 'x_column', 
      label: 'X轴列名', 
      type: 'string', 
      placeholder: 'invoice_no',
      description: '用于X轴的列名（类别或独立变量）'
    },
    { 
      name: 'y_column', 
      label: 'Y轴列名', 
      type: 'string', 
      placeholder: 'amount',
      description: '用于Y轴的列名（数值或依赖变量）'
    },
    { 
      name: 'title', 
      label: '图表标题', 
      type: 'string', 
      placeholder: '异常金额分布',
      description: '图表的标题文本'
    },
    { 
      name: 'legend_show', 
      label: '显示图例', 
      type: 'boolean',
      description: '是否在图表中显示图例'
    },
    { 
      name: 'max_points', 
      label: '最大数据点', 
      type: 'number', 
      placeholder: '500',
      description: '如果数据点超过此数量，会自动采样以提高性能'
    },
    { 
      name: 'sort_by_x', 
      label: '按X轴排序', 
      type: 'boolean',
      description: '是否按X轴值对数据进行排序'
    }
  ],
  description: '从DataFrame生成交互式图表。输出ECharts配置JSON，支持多种图表类型。'
});
