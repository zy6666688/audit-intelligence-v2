/**
 * 审计数智析 - 核心数据结构定义 (Schema v2.5)
 * 对应文档：用户说明书第10章
 */

// 1. 基础凭证数据
export interface VoucherSchema {
  id: string;
  date: string;
  voucher_no: string; // 凭证号
  summary: string;    // 摘要
  entries: {
    subject_code: string; // 科目编码
    subject_name: string;
    debit: number;        // 借方
    credit: number;       // 贷方
  }[];
  attachment_ids: string[]; // 附件ID
}

// 2. 总账/明细账数据
export interface LedgerSchema {
  subject_code: string;
  subject_name: string;
  period: string;
  opening_balance: number;
  debit_amount: number;
  credit_amount: number;
  closing_balance: number;
}

// 3. 银行流水数据
export interface BankFlowSchema {
  trans_date: string;
  trans_no: string;
  counterparty_name: string; // 对方户名
  counterparty_account: string;
  amount: number;
  direction: 'in' | 'out';
  usage: string; // 用途/摘要
  balance: number;
}

// 4. 合同数据
export interface ContractSchema {
  id: string;
  title: string;
  party_a: string; // 甲方
  party_b: string; // 乙方
  amount: number;
  sign_date: string;
  risk_clauses: {
    type: string; // 如：对赌、回购
    content: string;
    risk_level: 'high' | 'medium' | 'low';
  }[];
}

// 5. 图谱数据 (用于资金链/关联方)
export interface GraphSchema {
  nodes: {
    id: string;
    label: string;
    type: 'company' | 'person' | 'account';
    risk_score?: number;
  }[];
  edges: {
    source: string;
    target: string;
    label: string; // 如：转账、控股
    value?: number; // 金额
  }[];
}

// 6. 风险评估对象
export interface RiskSchema {
  rule_id: string;
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  score: number; // 0-100
  title: string;
  description: string;
  tags: string[]; // 如：资金空转、关联交易
  evidence_chain: {
    source_id: string; // 溯源ID (凭证号/流水号)
    type: 'voucher' | 'flow' | 'contract';
    description: string;
  }[];
  suggestions: string[]; // 审计建议
}

// 7. 底稿结构
export interface WorkpaperSchema {
  project_info: {
    name: string;
    period: string;
  };
  procedures: {
    id: string;
    name: string;
    status: 'done' | 'pending';
    executor: string;
  }[];
  findings: RiskSchema[]; // 发现的风险点
  conclusion: {
    type: 'unqualified' | 'qualified' | 'adverse'; // 审计意见类型
    summary_text: string;
  };
}

// 扩展端口类型定义，与 NodeRegistry 配合使用
export type AuditPortType = 
  | 'any' 
  | 'string' | 'number' | 'boolean' 
  | 'voucher' | 'ledger' | 'flow' | 'contract' // 核心业务数据
  | 'graph' | 'risk' | 'report' | 'image' // 分析结果
  | 'array'; // 数组容器
