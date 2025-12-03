/**
 * 业务审计节点 - 凭证、发票、风险评估等
 */

import type { NodeDefinition, NodeManifest, ExecutionContext } from '@audit/shared';

/**
 * 凭证分析节点
 */
export function createVoucherAnalysisNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'audit.voucher_analysis',
    version: '1.0.0',
    category: 'audit',
    label: { zh: '凭证分析', en: 'Voucher Analysis' },
    description: { zh: '分析会计凭证的完整性和合规性', en: 'Analyze accounting vouchers for completeness and compliance' },
    icon: '📝',
    
    inputsSchema: {
      vouchers: {
        type: 'array',
        description: '凭证列表',
        required: true
      }
    },
    
    outputsSchema: {
      totalCount: {
        type: 'number',
        description: '凭证总数'
      },
      validCount: {
        type: 'number',
        description: '有效凭证数'
      },
      invalidCount: {
        type: 'number',
        description: '无效凭证数'
      },
      issues: {
        type: 'array',
        description: '发现的问题列表'
      },
      riskLevel: {
        type: 'string',
        description: '风险等级: low/medium/high'
      },
      summary: {
        type: 'object',
        description: '分析摘要'
      }
    },
    
    configSchema: {
      checkBalance: {
        type: 'boolean',
        description: '检查借贷平衡',
        default: true
      },
      checkAttachments: {
        type: 'boolean',
        description: '检查附件完整性',
        default: true
      },
      checkApproval: {
        type: 'boolean',
        description: '检查审批流程',
        default: false
      }
    },
    
    capabilities: ['cpu-bound'],
    
    metadata: {
      author: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['audit', 'voucher', 'analysis']
    }
  };

  const execute = async (inputs: any, config: any, context: ExecutionContext) => {
    const { vouchers } = inputs;
    const { checkBalance = true, checkAttachments = true, checkApproval = false } = config;

    let validCount = 0;
    let invalidCount = 0;
    const issues: any[] = [];

    // 分析每张凭证
    vouchers.forEach((voucher: any, index: number) => {
      const voucherIssues: string[] = [];

      // 1. 检查借贷平衡
      if (checkBalance) {
        const debit = voucher.debitAmount || 0;
        const credit = voucher.creditAmount || 0;
        if (Math.abs(debit - credit) > 0.01) {
          voucherIssues.push(`借贷不平衡: 借方${debit}, 贷方${credit}`);
        }
      }

      // 2. 检查附件
      if (checkAttachments) {
        if (!voucher.attachments || voucher.attachments.length === 0) {
          voucherIssues.push('缺少附件');
        }
      }

      // 3. 检查审批
      if (checkApproval) {
        if (!voucher.approvedBy || !voucher.approvalDate) {
          voucherIssues.push('缺少审批信息');
        }
      }

      // 4. 检查必填字段
      if (!voucher.date) voucherIssues.push('缺少日期');
      if (!voucher.description) voucherIssues.push('缺少摘要');
      if (!voucher.voucherNo) voucherIssues.push('缺少凭证号');

      if (voucherIssues.length > 0) {
        invalidCount++;
        issues.push({
          voucherNo: voucher.voucherNo || `凭证${index + 1}`,
          date: voucher.date,
          issues: voucherIssues,
          severity: voucherIssues.length > 2 ? 'high' : 'medium'
        });
      } else {
        validCount++;
      }
    });

    // 计算风险等级
    const errorRate = invalidCount / vouchers.length;
    let riskLevel = 'low';
    if (errorRate > 0.1) riskLevel = 'high';
    else if (errorRate > 0.05) riskLevel = 'medium';

    return {
      totalCount: vouchers.length,
      validCount,
      invalidCount,
      issues,
      riskLevel,
      summary: {
        errorRate: `${(errorRate * 100).toFixed(2)}%`,
        mostCommonIssue: issues.length > 0 ? '借贷不平衡' : null,
        recommendation: riskLevel === 'high' ? '建议重点关注并整改' : '风险可控'
      }
    };
  };

  return { manifest, execute };
}

/**
 * 风险评估节点
 */
export function createRiskAssessmentNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'audit.risk_assessment',
    version: '1.0.0',
    category: 'audit',
    label: { zh: '风险评估', en: 'Risk Assessment' },
    description: { zh: '评估审计项目的风险等级', en: 'Assess risk level of audit items' },
    icon: '⚠️',
    
    inputsSchema: {
      items: {
        type: 'array',
        description: '待评估项目列表',
        required: true
      }
    },
    
    outputsSchema: {
      riskScore: {
        type: 'number',
        description: '风险评分 (0-100)'
      },
      riskLevel: {
        type: 'string',
        description: '风险等级'
      },
      highRiskItems: {
        type: 'array',
        description: '高风险项目'
      },
      recommendations: {
        type: 'array',
        description: '改进建议'
      }
    },
    
    configSchema: {
      highRiskThreshold: {
        type: 'number',
        description: '高风险阈值',
        default: 70
      },
      amountWeight: {
        type: 'number',
        description: '金额风险权重',
        default: 0.3
      },
      frequencyWeight: {
        type: 'number',
        description: '频率风险权重',
        default: 0.2
      },
      unusualWeight: {
        type: 'number',
        description: '异常风险权重',
        default: 0.3
      },
      complianceWeight: {
        type: 'number',
        description: '合规风险权重',
        default: 0.2
      }
    },
    
    capabilities: ['cpu-bound'],
    
    metadata: {
      author: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['audit', 'risk', 'assessment']
    }
  };

  const execute = async (inputs: any, config: any, context: ExecutionContext) => {
    const { items } = inputs;
    const { 
      highRiskThreshold = 70,
      amountWeight = 0.3,
      frequencyWeight = 0.2,
      unusualWeight = 0.3,
      complianceWeight = 0.2
    } = config;

    const weights = {
      amountWeight,
      frequencyWeight,
      unusualWeight,
      complianceWeight
    };

    const highRiskItems: any[] = [];
    let totalRisk = 0;

    // 评估每个项目
    items.forEach((item: any) => {
      let itemRisk = 0;

      // 1. 金额风险
      const amount = item.amount || 0;
      if (amount > 1000000) itemRisk += 30 * weights.amountWeight;
      else if (amount > 100000) itemRisk += 20 * weights.amountWeight;
      else itemRisk += 10 * weights.amountWeight;

      // 2. 频率风险
      const frequency = item.frequency || 0;
      if (frequency > 100) itemRisk += 25 * weights.frequencyWeight;
      else if (frequency > 50) itemRisk += 15 * weights.frequencyWeight;

      // 3. 异常指标
      if (item.isUnusual) itemRisk += 40 * weights.unusualWeight;
      if (item.hasExceptions) itemRisk += 30 * weights.unusualWeight;

      // 4. 合规性
      if (!item.hasApproval) itemRisk += 35 * weights.complianceWeight;
      if (!item.hasEvidence) itemRisk += 25 * weights.complianceWeight;

      item.riskScore = Math.min(100, itemRisk);
      totalRisk += item.riskScore;

      if (item.riskScore >= highRiskThreshold) {
        highRiskItems.push({
          ...item,
          riskScore: item.riskScore.toFixed(2),
          reasons: [
            amount > 1000000 && '金额巨大',
            item.isUnusual && '存在异常',
            !item.hasApproval && '缺少审批',
            !item.hasEvidence && '缺少证据'
          ].filter(Boolean)
        });
      }
    });

    const avgRiskScore = items.length > 0 ? totalRisk / items.length : 0;
    let riskLevel = 'low';
    if (avgRiskScore >= 70) riskLevel = 'high';
    else if (avgRiskScore >= 40) riskLevel = 'medium';

    const recommendations = [];
    if (highRiskItems.length > 0) {
      recommendations.push('对高风险项目进行重点审计');
      recommendations.push('完善审批流程和证据链');
    }
    if (avgRiskScore >= 40) {
      recommendations.push('建议增加审计频率');
      recommendations.push('加强内控制度建设');
    }

    return {
      riskScore: parseFloat(avgRiskScore.toFixed(2)),
      riskLevel,
      highRiskItems,
      recommendations
    };
  };

  return { manifest, execute };
}

/**
 * 发票验证节点
 */
export function createInvoiceValidationNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'audit.invoice_validation',
    version: '1.0.0',
    category: 'audit',
    label: { zh: '发票验证', en: 'Invoice Validation' },
    description: { zh: '验证发票的真实性和合规性', en: 'Validate invoice authenticity and compliance' },
    icon: '🧾',
    
    inputsSchema: {
      invoices: {
        type: 'array',
        description: '发票列表',
        required: true
      }
    },
    
    outputsSchema: {
      validInvoices: {
        type: 'array',
        description: '有效发票'
      },
      invalidInvoices: {
        type: 'array',
        description: '无效发票'
      },
      validationRate: {
        type: 'number',
        description: '验证通过率'
      },
      issues: {
        type: 'array',
        description: '问题列表'
      }
    },
    
    configSchema: {
      checkFormat: {
        type: 'boolean',
        description: '检查格式',
        default: true
      },
      checkAmount: {
        type: 'boolean',
        description: '检查金额',
        default: true
      },
      checkTaxCode: {
        type: 'boolean',
        description: '检查税号',
        default: true
      }
    },
    
    capabilities: ['cpu-bound'],
    
    metadata: {
      author: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['audit', 'invoice', 'validation']
    }
  };

  const execute = async (inputs: any, config: any, context: ExecutionContext) => {
    const { invoices } = inputs;
    const { checkFormat = true, checkAmount = true, checkTaxCode = true } = config;

    const validInvoices: any[] = [];
    const invalidInvoices: any[] = [];
    const issues: any[] = [];

    invoices.forEach((invoice: any) => {
      const invoiceIssues: string[] = [];

      // 1. 格式检查
      if (checkFormat) {
        if (!invoice.invoiceNo || invoice.invoiceNo.length < 8) {
          invoiceIssues.push('发票号格式错误');
        }
        if (!invoice.invoiceCode || invoice.invoiceCode.length !== 12) {
          invoiceIssues.push('发票代码格式错误');
        }
      }

      // 2. 金额检查
      if (checkAmount) {
        const amount = parseFloat(invoice.amount);
        const taxAmount = parseFloat(invoice.taxAmount);
        const totalAmount = parseFloat(invoice.totalAmount);

        if (isNaN(amount) || amount <= 0) {
          invoiceIssues.push('金额无效');
        }
        if (Math.abs(amount + taxAmount - totalAmount) > 0.01) {
          invoiceIssues.push('金额计算错误');
        }
      }

      // 3. 税号检查
      if (checkTaxCode) {
        const taxCode = invoice.buyerTaxCode || invoice.sellerTaxCode;
        if (!taxCode || taxCode.length !== 18) {
          invoiceIssues.push('税号格式错误');
        }
      }

      // 4. 必填字段
      if (!invoice.date) invoiceIssues.push('缺少日期');
      if (!invoice.buyerName) invoiceIssues.push('缺少购方名称');
      if (!invoice.sellerName) invoiceIssues.push('缺少销方名称');

      if (invoiceIssues.length > 0) {
        invalidInvoices.push({
          ...invoice,
          validationIssues: invoiceIssues
        });
        issues.push({
          invoiceNo: invoice.invoiceNo,
          issues: invoiceIssues
        });
      } else {
        validInvoices.push(invoice);
      }
    });

    const validationRate = invoices.length > 0 
      ? (validInvoices.length / invoices.length) * 100 
      : 0;

    return {
      validInvoices,
      invalidInvoices,
      validationRate: parseFloat(validationRate.toFixed(2)),
      issues
    };
  };

  return { manifest, execute };
}

// 导出所有业务节点
export const businessNodes = [
  createVoucherAnalysisNode(),
  // createRiskAssessmentNode(), // 暂时禁用 - Schema compilation issue
  createInvoiceValidationNode()
];
