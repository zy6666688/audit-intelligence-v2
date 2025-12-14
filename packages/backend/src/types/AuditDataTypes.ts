/**
 * 审计数据类型系统
 * 对标 ComfyUI 的类型系统，为节点提供强类型支持
 * 
 * 设计理念:
 * 1. 每种类型都有明确的schema定义
 * 2. 类型之间可以转换和组合
 * 3. 支持元数据和血缘追踪
 * 4. 便于编译器进行类型检查
 */

// ============================================
// 基础元数据类型
// ============================================

export interface DataMetadata {
  source: string;           // 数据来源
  timestamp: Date;          // 创建时间
  version: string;          // 数据版本
  traceId: string;          // 追踪ID
  nodeId: string;           // 产生该数据的节点ID
  executionId: string;      // 执行ID
  checksum?: string;        // 数据校验和
}

export interface FieldSchema {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  constraints?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================
// 核心审计数据类型
// ============================================

/**
 * Records - 原始记录集
 * 用途: CSV/Excel/SQL导入后的标准格式
 */
export interface Records {
  type: 'Records';
  schema: FieldSchema[];
  data: Record<string, any>[];
  metadata: DataMetadata;
  rowCount: number;
  columnCount: number;
}

/**
 * Ledger - 账簿数据
 * 用途: 会计系统类结构
 */
export interface Account {
  code: string;             // 科目代码
  name: string;             // 科目名称
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  level: number;            // 科目级次
  parent?: string;          // 父科目
}

export interface LedgerEntry {
  id: string;
  date: Date;
  accountCode: string;
  debit: number;
  credit: number;
  balance: number;
  description: string;
  voucherId?: string;
  reference?: string;
}

export interface Ledger {
  type: 'Ledger';
  accounts: Account[];
  entries: LedgerEntry[];
  period: DateRange;
  currency: string;
  metadata: DataMetadata;
}

/**
 * Vouchers - 凭证集
 * 用途: 会计凭证明细
 */
export interface VoucherItem {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

export interface Voucher {
  id: string;
  voucherNo: string;        // 凭证号
  date: Date;
  type: string;             // 凭证类型
  items: VoucherItem[];
  total: number;
  preparer: string;         // 制单人
  reviewer?: string;        // 复核人
  approver?: string;        // 审批人
  attachments: string[];    // 附件
  status: 'draft' | 'approved' | 'posted';
}

export interface Vouchers {
  type: 'Vouchers';
  vouchers: Voucher[];
  attachments: Attachment[];
  metadata: DataMetadata;
}

/**
 * Invoices - 发票集
 * 用途: 发票字段标准化格式
 */
export interface Invoice {
  id: string;
  invoiceNo: string;        // 发票号码
  invoiceCode: string;      // 发票代码
  type: 'special' | 'normal' | 'electronic';
  date: Date;
  seller: {
    name: string;
    taxNo: string;
    address?: string;
    phone?: string;
    bank?: string;
  };
  buyer: {
    name: string;
    taxNo: string;
    address?: string;
    phone?: string;
    bank?: string;
  };
  items: InvoiceItem[];
  totalAmount: number;      // 不含税金额
  totalTax: number;         // 税额
  totalWithTax: number;     // 价税合计
  remarks?: string;
  imageUrl?: string;        // 发票图片
  ocrConfidence?: number;   // OCR置信度
}

export interface InvoiceItem {
  name: string;
  specification?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate: number;
  tax: number;
}

export interface Invoices {
  type: 'Invoices';
  invoices: Invoice[];
  validation: ValidationResult[];
  metadata: DataMetadata;
}

/**
 * BankFlow - 银行流水
 * 用途: 标准银行账记录
 */
export interface Transaction {
  id: string;
  date: Date;
  accountNo: string;
  counterparty: string;     // 对方户名
  counterpartyAccount?: string;
  type: 'debit' | 'credit';
  amount: number;
  balance: number;
  currency: string;
  purpose?: string;         // 用途/摘要
  reference?: string;       // 参考号
  channel?: string;         // 交易渠道
}

export interface BankAccount {
  accountNo: string;
  accountName: string;
  bank: string;
  branch?: string;
  type: 'checking' | 'savings' | 'other';
}

export interface BankFlow {
  type: 'BankFlow';
  transactions: Transaction[];
  accounts: BankAccount[];
  period: DateRange;
  metadata: DataMetadata;
}

/**
 * RiskSet - 风险点集合
 * 用途: 审计抽象产物
 */
export interface RiskItem {
  id: string;
  category: string;         // 风险类别
  description: string;      // 风险描述
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;            // 风险分数 0-100
  evidence: string[];       // 证据ID列表
  relatedData: any;         // 关联数据
  suggestedActions: string[];
  detectedBy: string;       // 检测节点
  detectedAt: Date;
}

export interface RiskSet {
  type: 'RiskSet';
  risks: RiskItem[];
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
  };
  metadata: DataMetadata;
}

/**
 * Evidence - 审计证据
 * 用途: 底稿行，如"抽样结果""异常项列表"
 */
export interface EvidenceItem {
  id: string;
  type: 'document' | 'data' | 'analysis' | 'conclusion';
  title: string;
  content: any;             // 证据内容（可以是文本、表格、图片等）
  source: string;           // 证据来源
  collectedBy: string;      // 收集节点
  collectedAt: Date;
  relatedRisks: string[];   // 关联风险
  attachments: string[];
  verified: boolean;
  verifier?: string;
}

export interface EvidenceLink {
  fromNode: string;
  toNode: string;
  dataPath: string;
  timestamp: Date;
}

export interface WorkflowSnapshot {
  graphId: string;
  version: string;
  nodes: any[];
  connections: any[];
  timestamp: Date;
}

export interface Evidence {
  type: 'Evidence';
  items: EvidenceItem[];
  traceId: string;
  workflow: WorkflowSnapshot;
  chain: EvidenceLink[];    // 证据链
  metadata: DataMetadata;
}

/**
 * DraftPage - 审计底稿页
 * 用途: 用于审计报告
 */
export interface DraftSection {
  id: string;
  title: string;
  type: 'text' | 'table' | 'chart' | 'image';
  content: any;
  evidence: string[];       // 关联证据ID
  pageNumber?: number;
  reviewed: boolean;
  reviewer?: string;
  comments?: string[];
}

export interface DraftPage {
  type: 'DraftPage';
  id: string;
  title: string;
  sections: DraftSection[];
  evidence: Evidence[];
  conclusion: string;
  preparedBy: string;
  preparedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  status: 'draft' | 'review' | 'approved';
  metadata: DataMetadata;
}

/**
 * ReportSection - 审计报告节
 * 用途: 拼装后自动生成审计报告
 */
export interface ReportSection {
  type: 'ReportSection';
  id: string;
  title: string;
  level: number;            // 标题级别
  content: string;
  pages: DraftPage[];
  subSections: ReportSection[];
  metadata: DataMetadata;
}

// ============================================
// 辅助类型
// ============================================

export interface ValidationResult {
  itemId: string;
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

// ============================================
// 类型联合
// ============================================

export type AuditDataType = 
  | Records
  | Ledger
  | Vouchers
  | Invoices
  | BankFlow
  | RiskSet
  | Evidence
  | DraftPage
  | ReportSection;

export type AuditDataTypeName = AuditDataType['type'];

// ============================================
// 类型守卫
// ============================================

export function isRecords(data: AuditDataType): data is Records {
  return data.type === 'Records';
}

export function isLedger(data: AuditDataType): data is Ledger {
  return data.type === 'Ledger';
}

export function isVouchers(data: AuditDataType): data is Vouchers {
  return data.type === 'Vouchers';
}

export function isInvoices(data: AuditDataType): data is Invoices {
  return data.type === 'Invoices';
}

export function isBankFlow(data: AuditDataType): data is BankFlow {
  return data.type === 'BankFlow';
}

export function isRiskSet(data: AuditDataType): data is RiskSet {
  return data.type === 'RiskSet';
}

export function isEvidence(data: AuditDataType): data is Evidence {
  return data.type === 'Evidence';
}

export function isDraftPage(data: AuditDataType): data is DraftPage {
  return data.type === 'DraftPage';
}

export function isReportSection(data: AuditDataType): data is ReportSection {
  return data.type === 'ReportSection';
}

// ============================================
// 类型转换器
// ============================================

export class TypeConverter {
  /**
   * Records → Ledger
   * 将原始记录转换为账簿格式
   */
  static recordsToLedger(records: Records, accountMapping: Map<string, Account>): Ledger {
    // TODO: 实现转换逻辑
    throw new Error('Not implemented');
  }

  /**
   * Records → Vouchers
   * 将原始记录转换为凭证格式
   */
  static recordsToVouchers(records: Records): Vouchers {
    // TODO: 实现转换逻辑
    throw new Error('Not implemented');
  }

  /**
   * Records → Invoices
   * 将原始记录转换为发票格式
   */
  static recordsToInvoices(records: Records): Invoices {
    // TODO: 实现转换逻辑
    throw new Error('Not implemented');
  }

  /**
   * Records → BankFlow
   * 将原始记录转换为银行流水格式
   */
  static recordsToBankFlow(records: Records): BankFlow {
    // TODO: 实现转换逻辑
    throw new Error('Not implemented');
  }
}
