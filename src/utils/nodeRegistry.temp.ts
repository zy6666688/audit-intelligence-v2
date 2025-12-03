
export type PortType = 'any' | 'string' | 'number' | 'boolean' | 'voucher' | 'image' | 'report' | 'ledger' | 'flow' | 'contract' | 'invoice' | 'extract' | 'risk' | 'graph';

export interface PortDefinition {
  name: string;
  label: string;
  type: PortType;
  color?: string;
}

export interface NodeDefinition {
  type: string;
  label: string;
  category: 'audit' | 'analysis' | 'output' | 'input';
  icon: string;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  execute?: (inputs: Record<string, any>, data: Record<string, any>) => Promise<Record<string, any>>;
}

export const PORT_COLORS: Record<PortType, string> = {
  any: '#ffffff',
  string: '#ffd700',
  number: '#00bfff',
  boolean: '#ff69b4',
  voucher: '#32cd32',
  image: '#9370db',
  report: '#ff4500',
  ledger: '#8a2be2',
  flow: '#40e0d0',
  contract: '#deb887',
  invoice: '#ff6347',
  extract: '#d3d3d3',
  risk: '#ff0000',
  graph: '#da70d6'
};

const callQwenMock = async (prompt: string, context: any): Promise<any> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  if (prompt.includes('风险')) {
    return { risk_level: 'HIGH', risk_tags: ['资金空转', '跨期确认'], explanation: '检测到异常资金流动。' };
  }
  return { summary: 'AI分析完成。' };
};

const callOCRMock = async (file: any): Promise<any> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { text: "OCR Result", amount: 10000 };
};

const INPUT_NODES: Record<string, NodeDefinition> = {
  'pdf_import': { type: 'pdf_import', label: 'PDF导入', category: 'input', icon: '📄', description: '导入PDF', inputs: [], outputs: [{ name: 'extract', label: '数据', type: 'extract' }], execute: async () => ({ extract: { text: 'pdf' } }) },
  'voucher_ai_import': { type: 'voucher_ai_import', label: '智能凭证识别', category: 'input', icon: '🎫', description: '识别凭证', inputs: [{ name: 'image', label: '图片', type: 'image' }], outputs: [{ name: 'voucher', label: '凭证', type: 'voucher' }], execute: async (i) => ({ voucher: await callQwenMock('凭证', i) }) },
  'ledger_import': { type: 'ledger_import', label: '总账导入', category: 'input', icon: '📚', description: '导入总账', inputs: [], outputs: [{ name: 'ledger', label: '账簿', type: 'ledger' }], execute: async () => ({ ledger: { entries: 1000 } }) },
  'bankflow_import': { type: 'bankflow_import', label: '银行流水导入', category: 'input', icon: '💳', description: '导入流水', inputs: [], outputs: [{ name: 'flow', label: '流水', type: 'flow' }], execute: async () => ({ flow: { tx: 500 } }) },
  'contract_import': { type: 'contract_import', label: '合同导入', category: 'input', icon: '📑', description: '导入合同', inputs: [], outputs: [{ name: 'contract', label: '合同', type: 'contract' }], execute: async () => ({ contract: { title: '合同' } }) },
  'voucher_input': { type: 'voucher_input', label: '凭证录入', category: 'input', icon: '📝', description: '录入凭证', inputs: [], outputs: [{ name: 'data', label: '凭证', type: 'voucher' }], execute: async (i, d) => ({ data: d }) }
};

const AUDIT_NODES: Record<string, NodeDefinition> = {
  'voucher_check': { type: 'voucher_check', label: '凭证检查', category: 'audit', icon: '🔍', description: '检查凭证', inputs: [{ name: 'voucher', label: '凭证', type: 'voucher' }], outputs: [{ name: 'risk', label: '风险', type: 'risk' }], execute: async () => ({ risk: { level: 'LOW' } }) },
  'amount_filter': { type: 'amount_filter', label: '金额筛选', category: 'audit', icon: '⚖️', description: '筛选金额', inputs: [{ name: 'voucher', label: '凭证', type: 'voucher' }, { name: 'min', label: '最小', type: 'number' }], outputs: [{ name: 'filtered', label: '结果', type: 'voucher' }], execute: async (i) => ({ filtered: i.voucher }) },
  'ledger_match': { type: 'ledger_match', label: '账证一致性', category: 'audit', icon: '🔗', description: '核对账证', inputs: [{ name: 'ledger', label: '总账', type: 'ledger' }, { name: 'voucher', label: '凭证', type: 'voucher' }], outputs: [{ name: 'risk', label: '风险', type: 'risk' }], execute: async () => ({ risk: { level: 'MEDIUM' } }) },
  'ledger_ratio_test': { type: 'ledger_ratio_test', label: '比率分析', category: 'audit', icon: '📊', description: '财务比率', inputs: [{ name: 'ledger', label: '总账', type: 'ledger' }], outputs: [{ name: 'ratios', label: '比率', type: 'extract' }, { name: 'risk', label: '异常', type: 'risk' }], execute: async () => ({ ratios: { ratio: 1.5 }, risk: { level: 'LOW' } }) },
  'cutoff_test': { type: 'cutoff_test', label: '跨期测试', category: 'audit', icon: '✂️', description: '跨期检查', inputs: [{ name: 'voucher', label: '凭证', type: 'voucher' }], outputs: [{ name: 'risk', label: '风险', type: 'risk' }], execute: async () => ({ risk: { level: 'HIGH' } }) },
  'bankflow_trace': { type: 'bankflow_trace', label: '资金链追踪', category: 'audit', icon: '🕸️', description: '资金追踪', inputs: [{ name: 'flow', label: '流水', type: 'flow' }], outputs: [{ name: 'graph', label: '图谱', type: 'graph' }, { name: 'risk', label: '风险', type: 'risk' }], execute: async () => ({ graph: {}, risk: { level: 'HIGH' } }) },
  'inventory_test': { type: 'inventory_test', label: '存货测试', category: 'audit', icon: '📦', description: '存货异常', inputs: [{ name: 'data', label: '数据', type: 'extract' }], outputs: [{ name: 'risk', label: '风险', type: 'risk' }], execute: async () => ({ risk: { level: 'MEDIUM' } }) },
  'contract_ai_review': { type: 'contract_ai_review', label: '合同审查', category: 'audit', icon: '🧐', description: 'AI审查', inputs: [{ name: 'contract', label: '合同', type: 'contract' }], outputs: [{ name: 'risk', label: '风险', type: 'risk' }], execute: async (i) => ({ risk: await callQwenMock('合同风险', i) }) }
};

const ANALYSIS_NODES: Record<string, NodeDefinition> = {
  'ai_risk_assess': { type: 'ai_risk_assess', label: 'AI评估', category: 'analysis', icon: '🤖', description: '综合评估', inputs: [{ name: 'data', label: '数据', type: 'any' }], outputs: [{ name: 'risk_level', label: '等级', type: 'string' }, { name: 'report', label: '报告', type: 'report' }], execute: async (i) => ({ risk_level: 'HIGH', report: {} }) },
  'ai_fraud_scan': { type: 'ai_fraud_scan', label: '舞弊扫描', category: 'analysis', icon: '🚨', description: '舞弊特征', inputs: [{ name: 'ledger', label: '财务', type: 'ledger' }, { name: 'flow', label: '流水', type: 'flow' }], outputs: [{ name: 'risk', label: '风险', type: 'risk' }], execute: async () => ({ risk: { level: 'CRITICAL' } }) },
  'ai_workpaper_writer': { type: 'ai_workpaper_writer', label: '底稿生成', category: 'analysis', icon: '✍️', description: '写底稿', inputs: [{ name: 'risk', label: '风险', type: 'risk' }], outputs: [{ name: 'workpaper', label: '底稿', type: 'report' }], execute: async () => ({ workpaper: {} }) },
  'ai_summary': { type: 'ai_summary', label: '智能总结', category: 'analysis', icon: '💡', description: '总结摘要', inputs: [{ name: 'data', label: '数据', type: 'any' }], outputs: [{ name: 'summary', label: '摘要', type: 'string' }], execute: async () => ({ summary: 'Summary' }) }
};

const OUTPUT_NODES: Record<string, NodeDefinition> = {
  'report_gen': { type: 'report_gen', label: '报告生成', category: 'output', icon: '📤', description: '生成报告', inputs: [{ name: 'content', label: '内容', type: 'any' }], outputs: [{ name: 'file', label: '文件', type: 'report' }], execute: async () => ({ file: {} }) },
  'graph_export': { type: 'graph_export', label: '图谱导出', category: 'output', icon: '🕸️', description: '导出图片', inputs: [{ name: 'graph', label: '图谱', type: 'graph' }], outputs: [{ name: 'image', label: '图片', type: 'image' }], execute: async () => ({ image: {} }) },
  'risk_dashboard': { type: 'risk_dashboard', label: '风险面板', category: 'output', icon: '💹', description: '风险大屏', inputs: [{ name: 'risks', label: '风险', type: 'risk' }], outputs: [{ name: 'json', label: '配置', type: 'any' }], execute: async () => ({ json: {} }) }
};

export const NODE_REGISTRY: Record<string, NodeDefinition> = {
  ...INPUT_NODES,
  ...AUDIT_NODES,
  ...ANALYSIS_NODES,
  ...OUTPUT_NODES
};

export const getNodeDefinition = (type: string): NodeDefinition | null => NODE_REGISTRY[type] || null;
export const getPortColor = (type: PortType): string => PORT_COLORS[type] || PORT_COLORS['any'];
export const isValidConnection = (s: PortType, t: PortType): boolean => (s === 'any' || t === 'any') || s === t;
