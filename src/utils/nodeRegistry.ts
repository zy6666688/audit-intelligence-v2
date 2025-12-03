import type { AuditPortType } from '@/types/audit';
import { t as i18nT, getLanguage as getI18nLanguage, setLanguage as setI18nLanguage } from './i18n';

/**
 * Node Registry v2.5
 * 对应文档：用户说明书第3-4章
 */

export type PortType = AuditPortType;

export interface PortDefinition {
  name: string;
  label: string;
  type: PortType;
  color?: string;
}

export interface NodeDefinition {
  type: string;
  label: string;
  labelZh?: string; // 中文标签（可选，通过getNodeLabel动态获取）
  category: 'input' | 'audit' | 'analysis' | 'output' | 'special'; // 新增 special 分类
  icon: string;
  description: string;
  descriptionZh?: string; // 中文描述
  
  // v2.5 扩展属性
  aiModel?: 'qwen-max' | 'qwen-turbo' | 'ocr-v1' | 'rule-engine';
  cache?: boolean;
  retry?: number;
  executionMode?: 'local' | 'remote' | 'both'; // 默认 local

  inputs: PortDefinition[];
  outputs: PortDefinition[];
  execute?: (inputs: Record<string, any>, data: Record<string, any>) => Promise<Record<string, any>>;
}

export const PORT_COLORS: Record<PortType, string> = {
  any: '#ffffff',
  string: '#ffd700',
  number: '#00bfff',
  boolean: '#ff69b4',
  voucher: '#32cd32',     // 绿色
  ledger: '#8a2be2',      // 紫色
  flow: '#40e0d0',        // 青色
  contract: '#deb887',    // 棕色
  image: '#9370db',
  report: '#ff4500',
  risk: '#ff0000',        // 红色高亮
  graph: '#da70d6',       // 粉紫色
  array: '#808080'
};

// --- Mock Services ---

const callQwenMock = async (prompt: string, context: any): Promise<any> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  if (prompt.includes('risk') || prompt.includes('risk_contract')) {
    return { 
      level: 'HIGH', 
      score: 85, 
      title: '发现高风险条款', 
      tags: ['对赌协议', '隐性担保'],
      evidence_chain: [{ source_id: 'CON-2023001', type: 'contract', description: '补充协议第3条' }],
      suggestions: ['建议咨询法务', '测算回购义务金额']
    };
  }
  return { summary: 'AI 分析完成，未发现重大异常。' };
};

// --- 1. 输入节点 (Input Nodes) ---

const INPUT_NODES: Record<string, NodeDefinition> = {
  'pdf_batch_import': {
    type: 'pdf_batch_import', label: 'PDF Batch Import', category: 'input', icon: '📚',
    description: 'Batch import working papers/contracts',
    inputs: [],
    outputs: [{ name: 'files', label: 'Files', type: 'array' }],
    execute: async () => ({ files: ['doc1.pdf', 'doc2.pdf'] })
  },
  'flow_ocr_import': {
    type: 'flow_ocr_import', label: 'Bank Flow OCR', category: 'input', icon: '🏦',
    description: 'OCR scan for bank statements',
    inputs: [{ name: 'image', label: 'Scan Image', type: 'image' }],
    outputs: [{ name: 'flow', label: 'Bank Flow', type: 'flow' }],
    aiModel: 'ocr-v1',
    execute: async () => ({ flow: { trans_date: '2023-11-29', amount: 50000, usage: 'Payment' } })
  },
  'erp_api_import': {
    type: 'erp_api_import', label: 'ERP API Sync', category: 'input', icon: '🧩',
    description: 'Sync from Kingdee/SAP',
    inputs: [],
    outputs: [{ name: 'ledger', label: 'Ledger', type: 'ledger' }, { name: 'voucher', label: 'Voucher', type: 'voucher' }],
    execute: async () => ({ ledger: { subject_code: '1001', closing_balance: 100000 }, voucher: { id: 'V001' } })
  },
  'voucher_input': {
    type: 'voucher_input', label: 'Voucher Input', category: 'input', icon: '📝',
    description: 'Manual voucher entry',
    inputs: [],
    outputs: [{ name: 'voucher', label: 'Voucher', type: 'voucher' }],
    execute: async (i, d) => ({ voucher: d })
  },
  'contract_import': {
    type: 'contract_import', label: 'Contract Import', category: 'input', icon: '📑',
    description: 'Import contract text',
    inputs: [],
    outputs: [{ name: 'contract', label: 'Contract', type: 'contract' }],
    execute: async () => ({ contract: { title: 'Procurement Contract', amount: 1000000 } })
  },
  'bankflow_import': {
    type: 'bankflow_import', label: 'Bank Flow Import', category: 'input', icon: '💳',
    description: 'Import excel flow',
    inputs: [],
    outputs: [{ name: 'flow', label: 'Flow', type: 'flow' }],
    execute: async () => ({ flow: { trans_no: 'TX123456' } })
  }
};

// --- 2. 审计节点 (Audit Nodes) ---

const AUDIT_NODES: Record<string, NodeDefinition> = {
  'three_doc_match': {
    type: 'three_doc_match', label: '3-Way Match', category: 'audit', icon: '📑',
    description: 'Match Order-Delivery-Invoice',
    inputs: [{ name: 'order', label: 'Order', type: 'any' }, { name: 'delivery', label: 'Delivery', type: 'any' }, { name: 'invoice', label: 'Invoice', type: 'any' }],
    outputs: [{ name: 'risk', label: 'Mismatch Risk', type: 'risk' }],
    execute: async () => ({ risk: { level: 'LOW', title: 'Matched Successfully' } })
  },
  'fund_loop_detect': {
    type: 'fund_loop_detect', label: 'Fund Loop Detect', category: 'audit', icon: '🔄',
    description: 'Detect circular fund flow',
    inputs: [{ name: 'flow', label: 'Bank Flow', type: 'flow' }],
    outputs: [{ name: 'risk', label: 'Loop Risk', type: 'risk' }, { name: 'graph', label: 'Loop Graph', type: 'graph' }],
    aiModel: 'rule-engine',
    executionMode: 'remote', // 强制远程
    execute: async () => ({ 
      risk: { level: 'HIGH', title: 'Suspected Fund Loop', tags: ['Circular Flow'] },
      graph: { nodes: [{id:'A'}, {id:'B'}, {id:'A'}], edges: [{source:'A', target:'B'}, {source:'B', target:'A'}] }
    })
  },
  'remote_filter_demo': {
    type: 'remote_filter_demo', label: 'Remote Filter (Test)', category: 'audit', icon: '🧪',
    description: 'Test node for backend execution',
    executionMode: 'remote',
    inputs: [{ name: 'data', label: 'Data', type: 'any' }],
    outputs: [{ name: 'filtered', label: 'Filtered', type: 'any' }]
  },
  'fake_supplier_detect': {
    type: 'fake_supplier_detect', label: 'Fake Supplier', category: 'audit', icon: '🏚️',
    description: 'Identify shell suppliers',
    inputs: [{ name: 'master_data', label: 'Supplier Data', type: 'any' }],
    outputs: [{ name: 'risk', label: 'Supplier Risk', type: 'risk' }],
    execute: async () => ({ risk: { level: 'MEDIUM', title: 'Newly Registered Supplier' } })
  },
  'related_party_graph': {
    type: 'related_party_graph', label: 'Related Party Graph', category: 'audit', icon: '🕸️',
    description: 'Map related party funds',
    inputs: [{ name: 'flow', label: 'Flow', type: 'flow' }, { name: 'shareholder', label: 'Shareholder', type: 'any' }],
    outputs: [{ name: 'graph', label: 'Relation Graph', type: 'graph' }],
    execute: async () => ({ graph: { nodes: 10, edges: 20 } })
  },
  'confirmation_match': {
    type: 'confirmation_match', label: 'Confirmation Match', category: 'audit', icon: '✉️',
    description: 'Match confirmation replies',
    inputs: [{ name: 'ledger', label: 'Ledger', type: 'ledger' }, { name: 'reply', label: 'Reply', type: 'any' }],
    outputs: [{ name: 'risk', label: 'Diff Risk', type: 'risk' }],
    execute: async () => ({ risk: { level: 'LOW' } })
  }
};

// --- 3. 分析节点 (Analysis Nodes) ---

const ANALYSIS_NODES: Record<string, NodeDefinition> = {
  'ai_contract_risk': {
    type: 'ai_contract_risk', label: 'AI Contract Risk', category: 'analysis', icon: '🧐',
    description: 'Extract gambling/guarantee clauses',
    aiModel: 'qwen-max',
    inputs: [{ name: 'contract', label: 'Contract', type: 'contract' }],
    outputs: [{ name: 'risk', label: 'Clause Risk', type: 'risk' }],
    execute: async (i) => ({ risk: await callQwenMock('risk_contract', i) })
  },
  'ai_graph_reasoning': {
    type: 'ai_graph_reasoning', label: 'AI Graph Reasoning', category: 'analysis', icon: '🧠',
    description: 'Reasoning on fund graph',
    inputs: [{ name: 'graph', label: 'Graph', type: 'graph' }],
    outputs: [{ name: 'risk', label: 'Hidden Risk', type: 'risk' }],
    execute: async () => ({ risk: { level: 'CRITICAL', title: 'Hidden Control Relationship Detected' } })
  },
  'ai_fraud_scorer': {
    type: 'ai_fraud_scorer', label: 'Fraud Scorer', category: 'analysis', icon: '💯',
    description: 'Score fraud probability (0-100)',
    inputs: [{ name: 'risks', label: 'Risk Set', type: 'array' }],
    outputs: [{ name: 'score', label: 'Fraud Score', type: 'number' }],
    execute: async () => ({ score: 88 })
  },
  'ai_workpaper_writer': {
    type: 'ai_workpaper_writer', label: 'Auto Workpaper', category: 'analysis', icon: '✍️',
    description: 'Generate standard workpaper',
    inputs: [{ name: 'data', label: 'Evidence', type: 'any' }],
    outputs: [{ name: 'workpaper', label: 'Workpaper', type: 'report' }],
    execute: async () => ({ workpaper: { title: 'Generated Audit WP', content: '...' } })
  }
};

// --- 4. 专项审计节点 (Special Nodes - Industry Scenarios) ---

const SPECIAL_NODES: Record<string, NodeDefinition> = {
  'real_estate_presale_fund': {
    type: 'real_estate_presale_fund', label: 'RE Presale Fund', category: 'special', icon: '🏘️',
    description: '[Real Estate] Detect misuse of presale funds',
    inputs: [{ name: 'flow', label: 'Escrow Flow', type: 'flow' }, { name: 'contract', label: 'Sales Contract', type: 'contract' }],
    outputs: [{ name: 'risk', label: 'Misuse Risk', type: 'risk' }],
    execute: async () => ({ risk: { level: 'HIGH', title: 'Fund Outflow to Non-Construction Account' } })
  },
  'fake_gmv_detect': {
    type: 'fake_gmv_detect', label: 'Fake GMV Detect', category: 'special', icon: '🛒',
    description: '[Internet] Detect brushing/fake orders',
    inputs: [{ name: 'orders', label: 'Order Data', type: 'any' }, { name: 'flow', label: 'Pay Flow', type: 'flow' }],
    outputs: [{ name: 'risk', label: 'GMV Risk', type: 'risk' }],
    execute: async () => ({ risk: { level: 'MEDIUM', title: 'High Frequency Small Amount Orders' } })
  },
  'tax_refund_loop': {
    type: 'tax_refund_loop', label: 'Tax Refund Loop', category: 'special', icon: '🚢',
    description: '[Foreign Trade] Detect export tax fraud',
    inputs: [{ name: 'customs', label: 'Customs Doc', type: 'any' }, { name: 'flow', label: 'Forex Flow', type: 'flow' }],
    outputs: [{ name: 'risk', label: 'Fraud Risk', type: 'risk' }],
    execute: async () => ({ risk: { level: 'CRITICAL', title: 'Fast Forex Settlement Loop' } })
  },
  'pharma_kickback': {
    type: 'pharma_kickback', label: 'Pharma Kickback', category: 'special', icon: '💊',
    description: '[Pharma] Detect sales kickbacks',
    inputs: [{ name: 'expense', label: 'Selling Exp', type: 'ledger' }],
    outputs: [{ name: 'risk', label: 'Compliance Risk', type: 'risk' }],
    execute: async () => ({ risk: { level: 'HIGH', title: 'Abnormal Conference Fees' } })
  }
};

// --- 5. 输出节点 (Output Nodes) ---

const OUTPUT_NODES: Record<string, NodeDefinition> = {
  'risk_heatmap': {
    type: 'risk_heatmap', label: 'Risk Heatmap', category: 'output', icon: '🌡️',
    description: 'Visualize risk distribution',
    inputs: [{ name: 'risks', label: 'Risks', type: 'array' }],
    outputs: [{ name: 'image', label: 'Heatmap', type: 'image' }],
    execute: async () => ({ image: { url: 'heatmap.png' } })
  },
  'audit_conclusion': {
    type: 'audit_conclusion', label: 'Audit Conclusion', category: 'output', icon: '✅',
    description: 'Final audit opinion',
    inputs: [{ name: 'evidence', label: 'Evidence', type: 'any' }],
    outputs: [{ name: 'report', label: 'Opinion', type: 'report' }],
    execute: async () => ({ report: { text: 'Qualified Opinion' } })
  },
  'workpaper_chain_export': {
    type: 'workpaper_chain_export', label: 'Evidence Chain', category: 'output', icon: '🔗',
    description: 'Export full evidence chain PDF',
    inputs: [{ name: 'data', label: 'Data', type: 'any' }],
    outputs: [{ name: 'file', label: 'PDF File', type: 'report' }],
    execute: async () => ({ file: { url: 'chain.pdf' } })
  }
};

export const NODE_REGISTRY: Record<string, NodeDefinition> = {
  ...INPUT_NODES,
  ...AUDIT_NODES,
  ...ANALYSIS_NODES,
  ...SPECIAL_NODES,
  ...OUTPUT_NODES
};

// 节点中英文标签映射
const NODE_LABELS_ZH: Record<string, string> = {
  'pdf_batch_import': 'PDF批量导入',
  'flow_ocr_import': '银行流水OCR',
  'erp_api_import': 'ERP接口同步',
  'voucher_input': '凭证录入',
  'contract_import': '合同导入',
  'bankflow_import': '银行流水导入',
  '3_way_match': '三单匹配',
  'fund_loop_detect': '资金回流检测',
  'fake_supplier': '虚假供应商识别',
  'related_party_graph': '关联方图谱',
  'confirmation_match': '函证匹配',
  'ai_contract_risk': 'AI合同风险',
  'anomaly_cluster': '异常聚类',
  'sample_calculator': '样本量计算',
  'summary_report': '汇总报告',
  'real_estate_presale_fund': '房地产预售资金',
  'pharma_bribery_detect': '医药行业商业贿赂',
  'gov_budget_exec': '政府预算执行',
  'bank_misappropriation': '银行挪用',
  'risk_heatmap': '风险热力图',
  'audit_opinion': '审计意见',
  'workpaper_chain_export': '证据链导出'
};

const NODE_DESC_ZH: Record<string, string> = {
  'pdf_batch_import': '批量导入底稿/合同PDF',
  'flow_ocr_import': '智能识别银行流水',
  'erp_api_import': '从金蝶/SAP同步数据',
  'voucher_input': '手工录入凭证',
  'contract_import': '导入合同文本',
  'bankflow_import': '导入银行流水Excel',
  '3_way_match': '采购三单匹配(订单/入库/发票)',
  'fund_loop_detect': '识别资金回流异常',
  'fake_supplier': '识别虚假供应商',
  'related_party_graph': '构建关联方网络',
  'confirmation_match': '函证回函匹配',
  'ai_contract_risk': 'AI提取对赌/担保条款',
  'anomaly_cluster': '聚类分析异常组',
  'sample_calculator': '计算审计样本量',
  'summary_report': '生成汇总报告',
  'real_estate_presale_fund': '[房地产]预售资金监管检测',
  'pharma_bribery_detect': '[医药]商业贿赂检测',
  'gov_budget_exec': '[政府]预算执行偏差',
  'bank_misappropriation': '[银行]贷款挪用',
  'risk_heatmap': '可视化风险分布',
  'audit_opinion': '生成审计意见',
  'workpaper_chain_export': '导出完整证据链PDF'
};

// 当前语言设置 (默认中文)
let currentLang: 'zh' | 'en' = 'zh';

export const setNodeLang = (lang: 'zh' | 'en') => {
  currentLang = lang;
  setI18nLanguage(lang); // 同步i18n语言设置
};

export const getNodeLang = (): 'zh' | 'en' => currentLang;

// 获取节点标签（支持中英文）
export const getNodeLabel = (type: string): string => {
  const node = NODE_REGISTRY[type];
  if (!node) return type;
  if (currentLang === 'zh') {
    return NODE_LABELS_ZH[type] || node.label;
  }
  return node.label;
};

// 获取节点描述（支持中英文）
export const getNodeDesc = (type: string): string => {
  const node = NODE_REGISTRY[type];
  if (!node) return '';
  if (currentLang === 'zh') {
    return NODE_DESC_ZH[type] || node.description;
  }
  return node.description;
};

export const getNodeDefinition = (type: string): NodeDefinition | null => NODE_REGISTRY[type] || null;
export const getPortColor = (type: PortType): string => PORT_COLORS[type] || PORT_COLORS['any'];
export const isValidConnection = (s: PortType, t: PortType): boolean => (s === 'any' || t === 'any') || s === t;

// 获取端口标签（支持中英文）
export const getPortLabel = (type: PortType): string => {
  return i18nT(`ports.${type}`);
};

