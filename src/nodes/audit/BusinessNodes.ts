import { BaseNode } from '@/nodes/BaseNode';
import { nodeRegistry } from '@/core/registry/NodeRegistry';

// 1. 审计启动节点
export class AuditStartNode extends BaseNode {
  constructor() {
    super('AuditStart');
  }
}
nodeRegistry.registerNode({
  type: 'AuditStart',
  title: '审计启动',
  titleEn: 'Audit Start',
  category: '审计流程',
  inputs: [
    { name: '审计通知书', nameEn: 'Audit Notice', type: 'Document' }
  ],
  outputs: [
    { name: '审计计划', nameEn: 'Audit Plan', type: 'Plan' },
    { name: '资料需求清单', nameEn: 'Data Requirements List', type: 'List' }
  ]
});

// 2. 数据采集节点
export class DataCollectionNode extends BaseNode {
  constructor() {
    super('DataCollection');
  }
}
nodeRegistry.registerNode({
  type: 'DataCollection',
  title: '数据采集',
  titleEn: 'Data Collection',
  category: '审计流程',
  inputs: [
    { name: '资料需求清单', nameEn: 'Data Requirements List', type: 'List' }
  ],
  outputs: [
    { name: '财务数据(3年)', nameEn: 'Financial Data (3 Years)', type: 'Data' },
    { name: '工程档案', nameEn: 'Engineering Archives', type: 'Document' },
    { name: '合同文件', nameEn: 'Contract Documents', type: 'Document' }
  ]
});

// 3. 风险评估节点
export class AuditRiskAssessmentNode extends BaseNode {
  constructor() {
    super('AuditRiskAssessment');
  }
}
nodeRegistry.registerNode({
  type: 'AuditRiskAssessment',
  title: '风险评估',
  titleEn: 'Risk Assessment',
  category: '审计分析',
  inputs: [
    { name: '财务数据', nameEn: 'Financial Data', type: 'Data' },
    { name: '工程档案', nameEn: 'Engineering Archives', type: 'Document' }
  ],
  outputs: [
    { name: '高风险领域清单', nameEn: 'High-Risk Areas List', type: 'List' },
    { name: '重点审计对象', nameEn: 'Key Audit Targets', type: 'Object' }
  ]
});

// 4. 合规性审查 (招投标/合同)
export class ComplianceCheckNode extends BaseNode {
  constructor() {
    super('ComplianceCheck');
  }
}
nodeRegistry.registerNode({
  type: 'ComplianceCheck',
  title: '合规性审查',
  titleEn: 'Compliance Check',
  category: '审计分析',
  inputs: [
    { name: '合同文件', nameEn: 'Contract Documents', type: 'Document' },
    { name: '重点审计对象', nameEn: 'Key Audit Targets', type: 'Object' }
  ],
  outputs: [
    { name: '违规事项记录', nameEn: 'Violation Records', type: 'Record' },
    { name: '利益输送线索', nameEn: 'Benefit Transfer Clues', type: 'Clue' }
  ]
});

// 5. 实地盘点节点
export class FieldCheckNode extends BaseNode {
  constructor() {
    super('FieldCheck');
  }
}
nodeRegistry.registerNode({
  type: 'FieldCheck',
  title: '实地盘点',
  titleEn: 'Field Check',
  category: '审计执行',
  inputs: [
    { name: '固定资产账册', nameEn: 'Fixed Assets Ledger', type: 'Data' },
    { name: '高风险领域清单', nameEn: 'High-Risk Areas List', type: 'List' }
  ],
  outputs: [
    { name: '盘点差异报告', nameEn: 'Inventory Variance Report', type: 'Report' },
    { name: '闲置资产清单', nameEn: 'Idle Assets List', type: 'List' }
  ]
});

// 6. 审计报告生成
export class ReportGenerationNode extends BaseNode {
  constructor() {
    super('ReportGeneration');
  }
}
nodeRegistry.registerNode({
  type: 'ReportGeneration',
  title: '报告生成',
  titleEn: 'Report Generation',
  category: '审计输出',
  inputs: [
    { name: '违规事项记录', nameEn: 'Violation Records', type: 'Record' },
    { name: '盘点差异报告', nameEn: 'Inventory Variance Report', type: 'Report' },
    { name: '利益输送线索', nameEn: 'Benefit Transfer Clues', type: 'Clue' }
  ],
  outputs: [
    { name: '正式审计报告', nameEn: 'Formal Audit Report', type: 'Document' },
    { name: '整改建议书', nameEn: 'Rectification Recommendations', type: 'Document' }
  ]
});

// 7. 整改跟踪
export class RectificationTrackNode extends BaseNode {
  constructor() {
    super('RectificationTrack');
  }
}
nodeRegistry.registerNode({
  type: 'RectificationTrack',
  title: '整改跟踪',
  titleEn: 'Rectification Tracking',
  category: '后续管理',
  inputs: [
    { name: '整改建议书', nameEn: 'Rectification Recommendations', type: 'Document' },
    { name: '整改反馈', nameEn: 'Rectification Feedback', type: 'Document' }
  ],
  outputs: [
    { name: '复查结论', nameEn: 'Review Conclusion', type: 'Result' },
    { name: '结项报告', nameEn: 'Project Closure Report', type: 'Document' }
  ]
});

// 8. 文本理解 AI（摘要/提取）
// 典型用法：接收违规事项记录/报告文本，输出关键句和提取信息
export class TextUnderstandingAINode extends BaseNode {
  constructor() {
    super('TextUnderstandingAI');
  }
}
nodeRegistry.registerNode({
  type: 'TextUnderstandingAI',
  title: '文本理解AI',
  titleEn: 'Text Understanding AI',
  category: '审计分析',
  inputs: [
    { name: 'text_data', nameEn: 'Text Data', nameZh: '文本数据', type: 'STRING' }, // 0
    { name: 'task_type', nameEn: 'Task Type', nameZh: '任务类型', type: 'STRING' }  // 1
  ],
  outputs: [
    { name: 'text_labels', nameEn: 'Text Labels', nameZh: '文本标签', type: 'STRING' },     // 0
    { name: 'key_sentences', nameEn: 'Key Sentences', nameZh: '关键句', type: 'STRING' }, // 1
    { name: 'extracted_info', nameEn: 'Extracted Info', nameZh: '提取信息', type: 'STRING' } // 2
  ],
  properties: [
    {
      name: 'text_data',
      label: '文本数据',
      type: 'string',
      placeholder: '粘贴/传入待分析的文本',
      description: '输入待分析的文本内容，可来自上游节点的报告/记录。'
    },
    {
      name: 'task_type',
      label: '任务类型',
      type: 'select',
      options: ['summarize', 'classify', 'extract'],
      description: 'summarize: 摘要；classify: 分类；extract: 关键信息提取。'
    },
    {
      name: 'prompt',
      label: '提示词',
      type: 'string',
      placeholder: '可选，覆盖默认提示',
      description: '自定义提示词以微调摘要/提取结果。'
    }
  ],
  description: '通用文本理解节点，可对违规记录、报告说明等文本进行摘要、分类或信息提取，输出关键句、标签或提取结果，便于后续报告生成与线索整理。'
});