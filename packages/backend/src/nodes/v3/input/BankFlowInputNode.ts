/**
 * Bank Flow Input Node - 银行流水导入节点
 * 
 * 功能：
 * - CSV/Excel银行流水导入
 * - 自动识别银行格式
 * - 交易分类
 * - 异常检测
 * 
 * 复杂度：M（中）
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, AuditDataType } from '../../../types/AuditDataTypes';
import { DataValidator } from '../utils/DataValidator';

interface BankFlowConfig {
  bankType?: 'icbc' | 'ccb' | 'abc' | 'boc' | 'cmb' | 'auto';  // 银行类型
  categorizeTransactions?: boolean;   // 交易分类
  detectAnomalies?: boolean;          // 异常检测
  consolidateAccounts?: boolean;      // 合并账户
}

export class BankFlowInputNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'input.bankflow',
      version: '1.0.0',
      category: 'input',
      
      label: {
        zh: '银行流水导入',
        en: 'Bank Flow Input'
      },
      
      description: {
        zh: '导入银行流水数据，支持多家银行格式。自动识别交易类型、检测异常模式（整数金额、高频交易等）。',
        en: 'Import bank flow data, supporting multiple bank formats. Auto-categorize transactions and detect anomalies (round amounts, high-frequency, etc.)'
      },
      
      icon: '🏦',
      color: '#2ECC71',
      
      inputs: [],
      
      outputs: [
        {
          id: 'flows',
          name: 'flows',
          type: 'Records',
          required: true,
          description: {
            zh: '标准化的银行流水',
            en: 'Standardized bank flows'
          }
        },
        {
          id: 'summary',
          name: 'summary',
          type: 'Records',
          required: true,
          description: {
            zh: '流水汇总统计',
            en: 'Flow summary statistics'
          }
        }
      ],
      
      config: [
        {
          id: 'data',
          name: { zh: '流水数据', en: 'Flow Data' },
          type: 'json',
          required: true,
          description: {
            zh: '银行流水原始数据',
            en: 'Raw bank flow data'
          }
        },
        {
          id: 'bankType',
          name: { zh: '银行类型', en: 'Bank Type' },
          type: 'select',
          required: false,
          defaultValue: 'auto',
          options: [
            { label: 'Auto (自动识别)', value: 'auto' },
            { label: '工商银行 (ICBC)', value: 'icbc' },
            { label: '建设银行 (CCB)', value: 'ccb' },
            { label: '农业银行 (ABC)', value: 'abc' },
            { label: '中国银行 (BOC)', value: 'boc' },
            { label: '招商银行 (CMB)', value: 'cmb' }
          ]
        },
        {
          id: 'categorizeTransactions',
          name: { zh: '交易分类', en: 'Categorize Transactions' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '自动分类交易类型（收入/支出/转账等）',
            en: 'Auto-categorize transaction types'
          }
        },
        {
          id: 'detectAnomalies',
          name: { zh: '检测异常', en: 'Detect Anomalies' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '检测异常交易模式',
            en: 'Detect anomalous transaction patterns'
          }
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['input', 'bank', 'flow', 'transaction', 'money-laundering'],
        documentation: 'https://docs.audit-system.com/nodes/input/bankflow',
        examples: [
          {
            title: '导入工商银行流水',
            description: '自动分类和异常检测',
            inputs: {},
            config: {
              data: [
                {
                  date: '2025-01-01',
                  from_account: '6222021234567890',
                  to_account: '6222029876543210',
                  amount: 10000,
                  type: 'transfer',
                  description: '货款'
                }
              ],
              bankType: 'icbc',
              categorizeTransactions: true,
              detectAnomalies: true
            }
          }
        ]
      },
      
      capabilities: {
        cacheable: true,
        parallel: true,
        streaming: false,
        aiPowered: false
      }
    };
  }

  async execute(
    inputs: Record<string, AuditDataType>,
    config: Record<string, any>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      const data = config.data as Array<Record<string, any>>;
      const cfg: BankFlowConfig = {
        bankType: config.bankType || 'auto',
        categorizeTransactions: config.categorizeTransactions !== false,
        detectAnomalies: config.detectAnomalies !== false
      };
      
      context.logger?.info?.(`🏦 Processing ${data.length} bank transactions`);
      
      // 1. 字段标准化
      const normalizedData = this.normalizeFields(data, cfg);
      
      // 2. 交易分类
      if (cfg.categorizeTransactions) {
        normalizedData.forEach(row => {
          row.category = this.categorizeTransaction(row);
        });
      }
      
      // 3. 异常检测
      let anomalies: string[] = [];
      if (cfg.detectAnomalies) {
        anomalies = this.detectAnomalies(normalizedData);
      }
      
      // 4. 生成汇总
      const summary = this.generateSummary(normalizedData, anomalies);
      
      // 5. 构造输出
      const flows: Records = {
        type: 'Records',
        schema: this.getFlowSchema(),
        data: normalizedData,
        metadata: this.createMetadata(context.nodeId, context.executionId, cfg.bankType || 'unknown'),
        rowCount: normalizedData.length,
        columnCount: this.getFlowSchema().length
      };
      
      const summaryRecords: Records = {
        type: 'Records',
        schema: [
          { name: 'metric', type: 'string', required: true, description: 'Metric' },
          { name: 'value', type: 'number', required: true, description: 'Value' }
        ],
        data: Object.entries(summary).map(([key, value]) => ({
          metric: key,
          value: typeof value === 'number' ? value : 0
        })),
        metadata: this.createMetadata(context.nodeId, context.executionId, 'summary'),
        rowCount: Object.keys(summary).length,
        columnCount: 2
      };
      
      const duration = Date.now() - startTime;
      
      context.logger?.info?.(`✅ Bank flows processed: ${normalizedData.length} transactions, ${anomalies.length} anomalies (${duration}ms)`);
      
      return this.wrapSuccess(
        { flows, summary: summaryRecords },
        duration,
        context
      );
      
    } catch (error: any) {
      context.logger?.error?.('❌ Bank flow import failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private normalizeFields(
    data: Array<Record<string, any>>,
    config: BankFlowConfig
  ): Array<Record<string, any>> {
    // 字段映射规则
    const fieldMap: Record<string, string[]> = {
      date: ['date', 'transaction_date', 'trans_date', 'tradedate', '交易日期', '日期'],
      from_account: ['from_account', 'payer', 'debit_account', 'from', '付款账号', '转出账号'],
      to_account: ['to_account', 'payee', 'credit_account', 'to', '收款账号', '转入账号'],
      amount: ['amount', 'money', 'value', 'sum', '金额', '交易金额'],
      balance: ['balance', 'balance_after', 'after_balance', '余额', '账户余额'],
      type: ['type', 'trans_type', 'transaction_type', '交易类型'],
      description: ['description', 'memo', 'remark', 'note', '摘要', '备注', '说明']
    };
    
    return data.map(row => {
      const normalized: Record<string, any> = {};
      
      for (const [standardField, variants] of Object.entries(fieldMap)) {
        for (const variant of variants) {
          const matchedKey = Object.keys(row).find(key => 
            key.toLowerCase() === variant.toLowerCase()
          );
          
          if (matchedKey) {
            normalized[standardField] = row[matchedKey];
            break;
          }
        }
      }
      
      // 保留未映射字段
      for (const key of Object.keys(row)) {
        if (!Object.values(fieldMap).flat().some(v => 
          v.toLowerCase() === key.toLowerCase()
        )) {
          normalized[key] = row[key];
        }
      }
      
      return normalized;
    });
  }

  private categorizeTransaction(row: Record<string, any>): string {
    const amount = parseFloat(row.amount || 0);
    const type = (row.type || '').toLowerCase();
    const description = (row.description || '').toLowerCase();
    
    // 基于类型字段
    if (type.includes('收入') || type.includes('income') || type.includes('credit')) {
      return 'income';
    }
    if (type.includes('支出') || type.includes('expense') || type.includes('debit')) {
      return 'expense';
    }
    if (type.includes('转账') || type.includes('transfer')) {
      return 'transfer';
    }
    
    // 基于描述关键词
    if (description.includes('工资') || description.includes('salary')) {
      return 'salary';
    }
    if (description.includes('货款') || description.includes('payment')) {
      return 'payment';
    }
    if (description.includes('退款') || description.includes('refund')) {
      return 'refund';
    }
    
    // 基于金额正负
    if (amount > 0) {
      return 'income';
    } else if (amount < 0) {
      return 'expense';
    }
    
    return 'unknown';
  }

  private detectAnomalies(data: Array<Record<string, any>>): string[] {
    const anomalies: string[] = [];
    
    // 1. 检测整数金额
    const roundAmounts = data.filter(row => {
      const amount = Math.abs(parseFloat(row.amount || 0));
      return amount % 1000 === 0 || amount % 100 === 0;
    }).length;
    
    if (roundAmounts / data.length > 0.5) {
      anomalies.push(`High round amount ratio: ${(roundAmounts / data.length * 100).toFixed(1)}%`);
    }
    
    // 2. 检测高频交易（同一天、同一账户）
    const dailyTransactions = new Map<string, number>();
    data.forEach(row => {
      const key = `${row.date}_${row.from_account || row.to_account}`;
      dailyTransactions.set(key, (dailyTransactions.get(key) || 0) + 1);
    });
    
    const highFreq = Array.from(dailyTransactions.values()).filter(count => count > 10).length;
    if (highFreq > 0) {
      anomalies.push(`High frequency detected: ${highFreq} account-days with >10 transactions`);
    }
    
    // 3. 检测大额交易
    const largeTransactions = data.filter(row => {
      const amount = Math.abs(parseFloat(row.amount || 0));
      return amount > 1000000;  // 大于100万
    }).length;
    
    if (largeTransactions > 0) {
      anomalies.push(`Large transactions: ${largeTransactions} transactions >1M`);
    }
    
    // 4. 检测相同金额
    const amountCounts = new Map<number, number>();
    data.forEach(row => {
      const amount = parseFloat(row.amount || 0);
      amountCounts.set(amount, (amountCounts.get(amount) || 0) + 1);
    });
    
    const duplicateAmounts = Array.from(amountCounts.values()).filter(count => count > 5).length;
    if (duplicateAmounts > 0) {
      anomalies.push(`Duplicate amounts: ${duplicateAmounts} amounts appear >5 times`);
    }
    
    return anomalies;
  }

  private generateSummary(
    data: Array<Record<string, any>>,
    anomalies: string[]
  ): Record<string, number> {
    const totalIncome = data
      .filter(r => parseFloat(r.amount || 0) > 0)
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    
    const totalExpense = data
      .filter(r => parseFloat(r.amount || 0) < 0)
      .reduce((sum, r) => sum + Math.abs(parseFloat(r.amount || 0)), 0);
    
    const netFlow = totalIncome - totalExpense;
    
    return {
      total_transactions: data.length,
      total_income: totalIncome,
      total_expense: totalExpense,
      net_flow: netFlow,
      avg_transaction: data.length > 0 ? (totalIncome + totalExpense) / data.length : 0,
      anomaly_count: anomalies.length
    };
  }

  private getFlowSchema() {
    return [
      { name: 'date', type: 'date' as const, required: true, description: 'Transaction Date' },
      { name: 'from_account', type: 'string' as const, required: false, description: 'From Account' },
      { name: 'to_account', type: 'string' as const, required: false, description: 'To Account' },
      { name: 'amount', type: 'number' as const, required: true, description: 'Amount' },
      { name: 'balance', type: 'number' as const, required: false, description: 'Balance After' },
      { name: 'type', type: 'string' as const, required: false, description: 'Transaction Type' },
      { name: 'category', type: 'string' as const, required: false, description: 'Category' },
      { name: 'description', type: 'string' as const, required: false, description: 'Description' }
    ];
  }
}
