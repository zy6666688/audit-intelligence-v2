/**
 * Voucher Input Node - 凭证导入节点
 * 
 * 功能：
 * - 导入会计凭证数据
 * - 支持CSV/Excel/ERP API
 * - 自动字段映射
 * - 凭证规则验证（借贷平衡等）
 * 
 * 复杂度：M（中）
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, AuditDataType } from '../../../types/AuditDataTypes';
import { DataValidator } from '../utils/DataValidator';

interface VoucherConfig {
  source?: 'csv' | 'excel' | 'erp' | 'manual';
  validateBalance?: boolean;      // 验证借贷平衡
  requireAttachments?: boolean;   // 要求附件
  requireApproval?: boolean;      // 要求审批
  autoMapFields?: boolean;        // 自动字段映射
}

export class VoucherInputNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'input.voucher',
      version: '1.0.0',
      category: 'input',
      
      label: {
        zh: '凭证导入',
        en: 'Voucher Input'
      },
      
      description: {
        zh: '导入会计凭证数据，支持CSV/Excel/ERP系统。自动验证借贷平衡、附件完整性和审批流程。',
        en: 'Import accounting vouchers from CSV/Excel/ERP systems. Auto-validate debit-credit balance, attachments, and approval workflow.'
      },
      
      icon: '📝',
      color: '#3498DB',
      
      inputs: [],
      
      outputs: [
        {
          id: 'vouchers',
          name: 'vouchers',
          type: 'Records',
          required: true,
          description: {
            zh: '标准化的凭证记录',
            en: 'Standardized voucher records'
          }
        },
        {
          id: 'validation',
          name: 'validation',
          type: 'Records',
          required: true,
          description: {
            zh: '验证结果',
            en: 'Validation results'
          }
        }
      ],
      
      config: [
        {
          id: 'data',
          name: { zh: '凭证数据', en: 'Voucher Data' },
          type: 'json',
          required: true,
          description: {
            zh: '原始凭证数据',
            en: 'Raw voucher data'
          }
        },
        {
          id: 'source',
          name: { zh: '数据来源', en: 'Data Source' },
          type: 'select',
          required: false,
          defaultValue: 'csv',
          options: [
            { label: 'CSV', value: 'csv' },
            { label: 'Excel', value: 'excel' },
            { label: 'ERP API', value: 'erp' },
            { label: 'Manual', value: 'manual' }
          ]
        },
        {
          id: 'validateBalance',
          name: { zh: '验证借贷平衡', en: 'Validate Balance' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '检查每张凭证的借贷是否平衡',
            en: 'Check if debit equals credit for each voucher'
          }
        },
        {
          id: 'requireAttachments',
          name: { zh: '要求附件', en: 'Require Attachments' },
          type: 'boolean',
          required: false,
          defaultValue: false,
          description: {
            zh: '是否要求每张凭证必须有附件',
            en: 'Whether attachments are required for each voucher'
          }
        },
        {
          id: 'requireApproval',
          name: { zh: '要求审批', en: 'Require Approval' },
          type: 'boolean',
          required: false,
          defaultValue: false,
          description: {
            zh: '是否要求凭证必须经过审批',
            en: 'Whether approval is required for each voucher'
          }
        },
        {
          id: 'autoMapFields',
          name: { zh: '自动字段映射', en: 'Auto Map Fields' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '自动识别和映射字段名称',
            en: 'Auto-detect and map field names'
          }
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['input', 'voucher', 'accounting', 'validation'],
        documentation: 'https://docs.audit-system.com/nodes/input/voucher',
        examples: [
          {
            title: '导入ERP凭证',
            description: '从ERP系统导入凭证并验证',
            inputs: {},
            config: {
              data: [
                {
                  voucher_no: 'V2025001',
                  date: '2025-01-01',
                  debit_account: '1001',
                  debit_amount: 10000,
                  credit_account: '2001',
                  credit_amount: 10000,
                  description: '采购设备',
                  approved_by: '张三'
                }
              ],
              validateBalance: true,
              requireApproval: true
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
      const cfg: VoucherConfig = {
        source: config.source || 'csv',
        validateBalance: config.validateBalance !== false,
        requireAttachments: config.requireAttachments === true,
        requireApproval: config.requireApproval === true,
        autoMapFields: config.autoMapFields !== false
      };
      
      context.logger?.info?.(`📝 Importing ${data.length} vouchers from ${cfg.source}`);
      
      // 1. 字段映射
      const mappedData = cfg.autoMapFields 
        ? this.autoMapFields(data)
        : data;
      
      // 2. 验证凭证
      const validationResults = this.validateVouchers(mappedData, cfg, context);
      
      // 3. 创建输出
      const vouchers: Records = {
        type: 'Records',
        schema: this.getVoucherSchema(),
        data: mappedData,
        metadata: this.createMetadata(context.nodeId, context.executionId, cfg.source || 'csv'),
        rowCount: mappedData.length,
        columnCount: this.getVoucherSchema().length
      };
      
      const validation: Records = {
        type: 'Records',
        schema: [
          { name: 'voucher_no', type: 'string', required: true, description: 'Voucher No' },
          { name: 'status', type: 'string', required: true, description: 'Status' },
          { name: 'issues', type: 'string', required: false, description: 'Issues' }
        ],
        data: validationResults,
        metadata: this.createMetadata(context.nodeId, context.executionId, 'validation'),
        rowCount: validationResults.length,
        columnCount: 3
      };
      
      const duration = Date.now() - startTime;
      
      const validCount = validationResults.filter(v => v.status === 'valid').length;
      const invalidCount = validationResults.length - validCount;
      
      context.logger?.info?.(`✅ Vouchers imported: ${validCount} valid, ${invalidCount} invalid (${duration}ms)`);
      
      return this.wrapSuccess(
        { vouchers, validation },
        duration,
        context
      );
      
    } catch (error: any) {
      context.logger?.error?.('❌ Voucher import failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private autoMapFields(data: Array<Record<string, any>>): Array<Record<string, any>> {
    // 字段映射规则
    const fieldMap: Record<string, string[]> = {
      voucher_no: ['voucher_no', 'voucherno', 'no', 'number', '凭证号'],
      date: ['date', 'voucher_date', 'voucherdate', '日期'],
      debit_account: ['debit_account', 'debitaccount', 'debit', '借方科目'],
      debit_amount: ['debit_amount', 'debitamount', 'debit_amt', '借方金额'],
      credit_account: ['credit_account', 'creditaccount', 'credit', '贷方科目'],
      credit_amount: ['credit_amount', 'creditamount', 'credit_amt', '贷方金额'],
      description: ['description', 'memo', 'remark', '摘要', '说明'],
      approved_by: ['approved_by', 'approver', 'approved', '审批人'],
      attachment_count: ['attachment_count', 'attachments', 'att_count', '附件数']
    };
    
    return data.map(row => {
      const mapped: Record<string, any> = {};
      
      for (const [standardField, variants] of Object.entries(fieldMap)) {
        // 查找匹配的字段
        for (const variant of variants) {
          const lowerVariant = variant.toLowerCase();
          const matchedKey = Object.keys(row).find(key => 
            key.toLowerCase() === lowerVariant
          );
          
          if (matchedKey) {
            mapped[standardField] = row[matchedKey];
            break;
          }
        }
      }
      
      // 保留未映射的字段
      for (const key of Object.keys(row)) {
        if (!Object.values(fieldMap).flat().some(v => 
          v.toLowerCase() === key.toLowerCase()
        )) {
          mapped[key] = row[key];
        }
      }
      
      return mapped;
    });
  }

  private validateVouchers(
    data: Array<Record<string, any>>,
    config: VoucherConfig,
    context: NodeExecutionContext
  ): Array<Record<string, any>> {
    return data.map(voucher => {
      const issues: string[] = [];
      
      // 1. 检查必需字段
      if (!voucher.voucher_no) {
        issues.push('Missing voucher number');
      }
      
      // 2. 检查借贷平衡
      if (config.validateBalance) {
        const debit = parseFloat(voucher.debit_amount || 0);
        const credit = parseFloat(voucher.credit_amount || 0);
        
        if (Math.abs(debit - credit) > 0.01) {
          issues.push(`Unbalanced: Debit ${debit} != Credit ${credit}`);
        }
      }
      
      // 3. 检查附件
      if (config.requireAttachments) {
        const attachmentCount = parseInt(voucher.attachment_count || 0);
        if (attachmentCount === 0) {
          issues.push('No attachments');
        }
      }
      
      // 4. 检查审批
      if (config.requireApproval) {
        if (!voucher.approved_by) {
          issues.push('Not approved');
        }
      }
      
      return {
        voucher_no: voucher.voucher_no || 'UNKNOWN',
        status: issues.length === 0 ? 'valid' : 'invalid',
        issues: issues.join('; ')
      };
    });
  }

  private getVoucherSchema() {
    return [
      { name: 'voucher_no', type: 'string' as const, required: true, description: 'Voucher Number' },
      { name: 'date', type: 'date' as const, required: true, description: 'Date' },
      { name: 'debit_account', type: 'string' as const, required: true, description: 'Debit Account' },
      { name: 'debit_amount', type: 'number' as const, required: true, description: 'Debit Amount' },
      { name: 'credit_account', type: 'string' as const, required: true, description: 'Credit Account' },
      { name: 'credit_amount', type: 'number' as const, required: true, description: 'Credit Amount' },
      { name: 'description', type: 'string' as const, required: false, description: 'Description' },
      { name: 'approved_by', type: 'string' as const, required: false, description: 'Approved By' },
      { name: 'attachment_count', type: 'number' as const, required: false, description: 'Attachment Count' }
    ];
  }
}
