import { BaseNode } from '@/nodes/BaseNode';
import { nodeRegistry } from '@/core/registry/NodeRegistry';

/**
 * 审计数据导入节点
 * 模拟从 Excel 或数据库导入审计底稿数据
 */
export class AuditDataImportNode extends BaseNode {
  constructor() {
    super('AuditDataImport');
  }
}

// 注册节点定义
nodeRegistry.registerNode({
  type: 'AuditDataImport',
  title: '审计数据导入',
  titleEn: 'Audit Data Import',
  category: '数据源',
  inputs: [], // 数据源节点通常没有输入，只有参数
  outputs: [
    { name: '财务数据', nameEn: 'Financial Data', type: 'DataFrame' },
    { name: '凭证列表', nameEn: 'Voucher List', type: 'List<Voucher>' }
  ]
});

/**
 * 风险评估节点
 * 模拟对导入的数据进行风险分析
 */
export class RiskAssessmentNode extends BaseNode {
  constructor() {
    super('RiskAssessment');
  }
}

// 注册节点定义
nodeRegistry.registerNode({
  type: 'RiskAssessment',
  title: '风险评估模型',
  titleEn: 'Risk Assessment Model',
  category: '分析',
  inputs: [
    { name: '财务数据', nameEn: 'Financial Data', type: 'DataFrame' }
  ],
  outputs: [
    { name: '高风险凭证', nameEn: 'High-Risk Vouchers', type: 'List<Voucher>' },
    { name: '评估报告', nameEn: 'Assessment Report', type: 'String' }
  ]
});

/**
 * 审计底稿生成节点
 */
export class ReportGenNode extends BaseNode {
  constructor() {
    super('ReportGen');
  }
}

// 注册节点定义
nodeRegistry.registerNode({
  type: 'ReportGen',
  title: '底稿生成',
  titleEn: 'Report Generation',
  category: '输出',
  inputs: [
    { name: '评估报告', nameEn: 'Assessment Report', type: 'String' },
    { name: '高风险凭证', nameEn: 'High-Risk Vouchers', type: 'List<Voucher>' }
  ],
  outputs: [
    { name: '最终底稿.docx', nameEn: 'Final Report.docx', type: 'File' }
  ]
});
