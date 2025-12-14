/**
 * Three-Doc Match Node - 三单匹配节点
 * 
 * 核心功能：订单-发货单-发票 三单匹配
 * 
 * 审计价值：
 * - 识别采购舞弊（虚开发票、虚假采购）
 * - 检测金额差异、时间异常
 * - 自动生成差异报告和证据
 * 
 * 复杂度：H（高）- 涉及模糊匹配、图索引、证据链
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, Evidence, RiskSet, AuditDataType } from '../../../types/AuditDataTypes';

interface ThreeDocMatchConfig {
  amountTolerance?: number;        // 金额容差（0.01 = 1%）
  dateToleranceDays?: number;      // 日期容差（天）
  fuzzyItemMatch?: boolean;        // 是否启用模糊商品匹配
  requireAllThree?: boolean;       // 是否要求三单齐全
  minMatchScore?: number;          // 最小匹配分数（0-1）
}

interface MatchResult {
  orderId: string;
  deliveryId?: string;
  invoiceId?: string;
  matchType: 'full' | 'partial' | 'missing';
  matchScore: number;
  amountDiff?: number;
  dateDiff?: number;
  issues: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class ThreeDocMatchNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'audit.three_doc_match',
      version: '1.0.0',
      category: 'audit',
      
      label: {
        zh: '三单匹配',
        en: 'Three-Doc Match'
      },
      
      description: {
        zh: '订单-发货单-发票三单匹配，识别虚开发票、虚假采购等舞弊行为。支持金额容差、日期容差和模糊商品匹配。',
        en: 'Match orders, deliveries, and invoices to detect fake invoices and fraudulent purchases. Supports amount tolerance, date tolerance, and fuzzy item matching.'
      },
      
      icon: '📋',
      color: '#FF6B6B',
      
      inputs: [
        {
          id: 'orders',
          name: 'orders',
          type: 'Records',
          required: true,
          description: {
            zh: '订单记录（需包含：订单号、商品名、金额、日期）',
            en: 'Order records (must include: order_id, item, amount, date)'
          }
        },
        {
          id: 'deliveries',
          name: 'deliveries',
          type: 'Records',
          required: true,
          description: {
            zh: '发货单记录（需包含：发货单号、订单号、商品名、数量、日期）',
            en: 'Delivery records (must include: delivery_id, order_id, item, quantity, date)'
          }
        },
        {
          id: 'invoices',
          name: 'invoices',
          type: 'Records',
          required: true,
          description: {
            zh: '发票记录（需包含：发票号、订单号、金额、日期）',
            en: 'Invoice records (must include: invoice_id, order_id, amount, date)'
          }
        }
      ],
      
      outputs: [
        {
          id: 'matches',
          name: 'matches',
          type: 'Records',
          required: true,
          description: {
            zh: '匹配成功的三单记录',
            en: 'Successfully matched records'
          }
        },
        {
          id: 'mismatches',
          name: 'mismatches',
          type: 'Records',
          required: true,
          description: {
            zh: '匹配失败或异常的记录',
            en: 'Mismatched or anomalous records'
          }
        },
        {
          id: 'risks',
          name: 'risks',
          type: 'RiskSet',
          required: true,
          description: {
            zh: '识别的风险点集合',
            en: 'Identified risk set'
          }
        },
        {
          id: 'evidence',
          name: 'evidence',
          type: 'Evidence',
          required: true,
          description: {
            zh: '审计证据',
            en: 'Audit evidence'
          }
        }
      ],
      
      config: [
        {
          id: 'amountTolerance',
          name: { zh: '金额容差', en: 'Amount Tolerance' },
          type: 'number',
          required: false,
          defaultValue: 0.01,
          description: {
            zh: '允许的金额差异比例（0.01 = 1%）',
            en: 'Allowed amount difference ratio (0.01 = 1%)'
          },
          validation: {
            min: 0,
            max: 0.5
          }
        },
        {
          id: 'dateToleranceDays',
          name: { zh: '日期容差（天）', en: 'Date Tolerance (Days)' },
          type: 'number',
          required: false,
          defaultValue: 7,
          description: {
            zh: '允许的日期差异天数',
            en: 'Allowed date difference in days'
          },
          validation: {
            min: 0,
            max: 90
          }
        },
        {
          id: 'fuzzyItemMatch',
          name: { zh: '模糊商品匹配', en: 'Fuzzy Item Match' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '启用商品名称模糊匹配（容忍拼写差异）',
            en: 'Enable fuzzy matching for item names (tolerates spelling differences)'
          }
        },
        {
          id: 'requireAllThree',
          name: { zh: '要求三单齐全', en: 'Require All Three' },
          type: 'boolean',
          required: false,
          defaultValue: false,
          description: {
            zh: '是否要求订单、发货单、发票必须全部存在',
            en: 'Whether to require all three documents'
          }
        },
        {
          id: 'minMatchScore',
          name: { zh: '最小匹配分数', en: 'Min Match Score' },
          type: 'number',
          required: false,
          defaultValue: 0.8,
          description: {
            zh: '最小匹配分数阈值（0-1）',
            en: 'Minimum match score threshold (0-1)'
          },
          validation: {
            min: 0,
            max: 1
          }
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['audit', 'fraud-detection', 'three-doc', 'matching'],
        documentation: 'https://docs.audit-system.com/nodes/audit/three-doc-match',
        examples: [
          {
            title: '标准三单匹配',
            description: '匹配订单、发货单和发票，识别差异',
            inputs: {
              orders: { type: 'Records', rowCount: 100 },
              deliveries: { type: 'Records', rowCount: 95 },
              invoices: { type: 'Records', rowCount: 98 }
            },
            config: {
              amountTolerance: 0.01,
              dateToleranceDays: 7,
              fuzzyItemMatch: true
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
      // 1. 提取输入
      const orders = inputs.orders as Records;
      const deliveries = inputs.deliveries as Records;
      const invoices = inputs.invoices as Records;
      
      // 2. 获取配置
      const cfg: ThreeDocMatchConfig = {
        amountTolerance: config.amountTolerance ?? 0.01,
        dateToleranceDays: config.dateToleranceDays ?? 7,
        fuzzyItemMatch: config.fuzzyItemMatch ?? true,
        requireAllThree: config.requireAllThree ?? false,
        minMatchScore: config.minMatchScore ?? 0.8
      };
      
      context.logger?.info?.(`🔍 Starting three-doc match: ${orders.rowCount} orders, ${deliveries.rowCount} deliveries, ${invoices.rowCount} invoices`);
      
      // 3. 构建索引
      const orderIndex = this.buildIndex(orders.data, 'order_id');
      const deliveryIndex = this.buildMultiIndex(deliveries.data, 'order_id');
      const invoiceIndex = this.buildMultiIndex(invoices.data, 'order_id');
      
      // 4. 执行匹配
      const matchResults: MatchResult[] = [];
      
      for (const order of orders.data) {
        const orderId = this.getFieldValue(order, 'order_id');
        if (!orderId) continue;
        
        const result = this.matchSingleOrder(
          order,
          deliveryIndex.get(orderId) || [],
          invoiceIndex.get(orderId) || [],
          cfg
        );
        
        matchResults.push(result);
      }
      
      // 5. 分类结果
      const minScore = cfg.minMatchScore ?? 0.8;
      const matches = matchResults.filter(r => 
        r.matchType === 'full' && r.matchScore >= minScore
      );
      
      const mismatches = matchResults.filter(r => 
        r.matchType !== 'full' || r.matchScore < minScore
      );
      
      // 6. 生成风险集
      const risks = this.generateRisks(mismatches, cfg);
      
      // 7. 生成证据
      const evidence = this.generateEvidence(
        matchResults,
        orders,
        deliveries,
        invoices,
        context
      );
      
      // 8. 构造输出
      const matchRecords: Records = {
        type: 'Records',
        schema: [
          { name: 'order_id', type: 'string', required: true, description: 'Order ID' },
          { name: 'delivery_id', type: 'string', required: false, description: 'Delivery ID' },
          { name: 'invoice_id', type: 'string', required: false, description: 'Invoice ID' },
          { name: 'match_score', type: 'number', required: true, description: 'Match Score' },
          { name: 'match_type', type: 'string', required: true, description: 'Match Type' }
        ],
        data: matches.map(m => ({
          order_id: m.orderId,
          delivery_id: m.deliveryId,
          invoice_id: m.invoiceId,
          match_score: m.matchScore,
          match_type: m.matchType
        })),
        metadata: this.createMetadata(context.nodeId, context.executionId, 'three_doc_match'),
        rowCount: matches.length,
        columnCount: 5
      };
      
      const mismatchRecords: Records = {
        type: 'Records',
        schema: [
          { name: 'order_id', type: 'string', required: true, description: 'Order ID' },
          { name: 'match_type', type: 'string', required: true, description: 'Match Type' },
          { name: 'match_score', type: 'number', required: true, description: 'Match Score' },
          { name: 'risk_level', type: 'string', required: true, description: 'Risk Level' },
          { name: 'issues', type: 'string', required: true, description: 'Issues' },
          { name: 'amount_diff', type: 'number', required: false, description: 'Amount Diff' },
          { name: 'date_diff', type: 'number', required: false, description: 'Date Diff (days)' }
        ],
        data: mismatches.map(m => ({
          order_id: m.orderId,
          match_type: m.matchType,
          match_score: m.matchScore,
          risk_level: m.riskLevel,
          issues: m.issues.join('; '),
          amount_diff: m.amountDiff,
          date_diff: m.dateDiff
        })),
        metadata: this.createMetadata(context.nodeId, context.executionId, 'three_doc_match_mismatches'),
        rowCount: mismatches.length,
        columnCount: 7
      };
      
      const duration = Date.now() - startTime;
      
      context.logger?.info?.(`✅ Three-doc match completed: ${matches.length} matches, ${mismatches.length} mismatches, ${risks.risks.length} risks (${duration}ms)`);
      
      return this.wrapSuccess(
        {
          matches: matchRecords,
          mismatches: mismatchRecords,
          risks,
          evidence
        },
        duration,
        context
      );
      
    } catch (error: any) {
      context.logger?.error?.('❌ Three-doc match failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private buildIndex(data: Array<Record<string, any>>, key: string): Map<string, any> {
    const index = new Map();
    for (const item of data) {
      const keyValue = this.getFieldValue(item, key);
      if (keyValue) {
        index.set(keyValue, item);
      }
    }
    return index;
  }

  private buildMultiIndex(data: Array<Record<string, any>>, key: string): Map<string, any[]> {
    const index = new Map<string, any[]>();
    for (const item of data) {
      const keyValue = this.getFieldValue(item, key);
      if (keyValue) {
        if (!index.has(keyValue)) {
          index.set(keyValue, []);
        }
        index.get(keyValue)!.push(item);
      }
    }
    return index;
  }

  private getFieldValue(record: Record<string, any>, fieldName: string): any {
    // 尝试多种字段名变体
    const variants = [
      fieldName,
      fieldName.toLowerCase(),
      fieldName.toUpperCase(),
      fieldName.replace(/_/g, '')
    ];
    
    for (const variant of variants) {
      if (record[variant] !== undefined) {
        return record[variant];
      }
    }
    
    return undefined;
  }

  private matchSingleOrder(
    order: Record<string, any>,
    deliveries: Array<Record<string, any>>,
    invoices: Array<Record<string, any>>,
    config: ThreeDocMatchConfig
  ): MatchResult {
    const orderId = this.getFieldValue(order, 'order_id');
    const orderAmount = parseFloat(this.getFieldValue(order, 'amount') || '0');
    const orderDate = new Date(this.getFieldValue(order, 'date') || Date.now());
    const orderItem = this.getFieldValue(order, 'item') || '';
    
    let matchScore = 0;
    let matchType: 'full' | 'partial' | 'missing' = 'missing';
    let deliveryId: string | undefined;
    let invoiceId: string | undefined;
    let amountDiff: number | undefined;
    let dateDiff: number | undefined;
    const issues: string[] = [];
    
    // 匹配发货单
    const delivery = this.findBestDelivery(order, deliveries, config);
    if (delivery) {
      deliveryId = this.getFieldValue(delivery, 'delivery_id');
      matchScore += 0.4;
      
      // 检查商品匹配
      const deliveryItem = this.getFieldValue(delivery, 'item') || '';
      if (config.fuzzyItemMatch) {
        const similarity = this.fuzzyMatch(orderItem, deliveryItem);
        if (similarity < 0.7) {
          issues.push(`Item mismatch: ${orderItem} vs ${deliveryItem}`);
        }
      }
      
      // 检查日期
      const deliveryDate = new Date(this.getFieldValue(delivery, 'date') || Date.now());
      const daysDiff = Math.abs((deliveryDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > config.dateToleranceDays!) {
        issues.push(`Date diff: ${daysDiff.toFixed(0)} days`);
        dateDiff = daysDiff;
      }
    } else {
      issues.push('No matching delivery');
    }
    
    // 匹配发票
    const invoice = this.findBestInvoice(order, invoices, config);
    if (invoice) {
      invoiceId = this.getFieldValue(invoice, 'invoice_id');
      matchScore += 0.6;
      
      // 检查金额
      const invoiceAmount = parseFloat(this.getFieldValue(invoice, 'amount') || '0');
      const amountDiffRatio = Math.abs(invoiceAmount - orderAmount) / orderAmount;
      if (amountDiffRatio > config.amountTolerance!) {
        issues.push(`Amount diff: ${(amountDiffRatio * 100).toFixed(2)}%`);
        amountDiff = invoiceAmount - orderAmount;
      }
      
      // 检查日期
      const invoiceDate = new Date(this.getFieldValue(invoice, 'date') || Date.now());
      const daysDiff = Math.abs((invoiceDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > config.dateToleranceDays!) {
        issues.push(`Invoice date diff: ${daysDiff.toFixed(0)} days`);
        dateDiff = Math.max(dateDiff || 0, daysDiff);
      }
    } else {
      issues.push('No matching invoice');
    }
    
    // 确定匹配类型
    if (deliveryId && invoiceId) {
      matchType = 'full';
    } else if (deliveryId || invoiceId) {
      matchType = 'partial';
    }
    
    // 计算风险等级
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (matchType === 'missing') {
      riskLevel = 'critical';
    } else if (issues.length >= 3) {
      riskLevel = 'high';
    } else if (issues.length >= 2) {
      riskLevel = 'medium';
    } else if (issues.length >= 1) {
      riskLevel = 'low';
    }
    
    return {
      orderId,
      deliveryId,
      invoiceId,
      matchType,
      matchScore,
      amountDiff,
      dateDiff,
      issues,
      riskLevel
    };
  }

  private findBestDelivery(
    order: Record<string, any>,
    deliveries: Array<Record<string, any>>,
    config: ThreeDocMatchConfig
  ): Record<string, any> | undefined {
    if (deliveries.length === 0) return undefined;
    if (deliveries.length === 1) return deliveries[0];
    
    // 简单返回第一个（实际应该按相似度排序）
    return deliveries[0];
  }

  private findBestInvoice(
    order: Record<string, any>,
    invoices: Array<Record<string, any>>,
    config: ThreeDocMatchConfig
  ): Record<string, any> | undefined {
    if (invoices.length === 0) return undefined;
    if (invoices.length === 1) return invoices[0];
    
    // 简单返回第一个（实际应该按金额、日期相似度排序）
    return invoices[0];
  }

  private fuzzyMatch(str1: string, str2: string): number {
    // 简化的模糊匹配（实际应使用 Levenshtein 距离或 ngram）
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    // 计算公共字符比例
    const common = new Set([...s1].filter(c => s2.includes(c)));
    return common.size / Math.max(s1.length, s2.length);
  }

  private generateRisks(mismatches: MatchResult[], config: ThreeDocMatchConfig): RiskSet {
    const risks = mismatches.map(m => ({
      id: `risk_${m.orderId}`,
      category: m.matchType === 'missing' ? 'missing_documents' : 'document_mismatch',
      description: `Order ${m.orderId}: ${m.issues.join(', ')}`,
      severity: m.riskLevel,
      score: (1 - m.matchScore) * 100,
      evidence: [],
      relatedData: { orderId: m.orderId, deliveryId: m.deliveryId, invoiceId: m.invoiceId },
      suggestedActions: ['Review documents', 'Verify amounts and dates'],
      detectedBy: 'three_doc_match',
      detectedAt: new Date()
    }));
    
    return {
      type: 'RiskSet',
      risks,
      summary: {
        total: risks.length,
        bySeverity: {
          critical: risks.filter(r => r.severity === 'critical').length,
          high: risks.filter(r => r.severity === 'high').length,
          medium: risks.filter(r => r.severity === 'medium').length,
          low: risks.filter(r => r.severity === 'low').length
        },
        byCategory: {
          missing_documents: risks.filter(r => r.category === 'missing_documents').length,
          document_mismatch: risks.filter(r => r.category === 'document_mismatch').length
        }
      },
      metadata: this.createMetadata('', '', 'three_doc_match')
    };
  }

  private generateEvidence(
    matchResults: MatchResult[],
    orders: Records,
    deliveries: Records,
    invoices: Records,
    context: NodeExecutionContext
  ): Evidence {
    const evidenceItem: any = {
      id: `evidence_${context.executionId}`,
      type: 'analysis' as const,
      title: 'Three-Doc Match Evidence',
      content: {
        totalOrders: orders.rowCount,
        totalDeliveries: deliveries.rowCount,
        totalInvoices: invoices.rowCount,
        fullMatches: matchResults.filter(r => r.matchType === 'full').length,
        partialMatches: matchResults.filter(r => r.matchType === 'partial').length,
        missing: matchResults.filter(r => r.matchType === 'missing').length,
        highRisks: matchResults.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length
      },
      source: 'three_doc_match',
      collectedBy: 'three_doc_match',
      collectedAt: new Date(),
      relatedRisks: matchResults
        .filter(r => r.riskLevel !== 'low')
        .map(r => `risk_${r.orderId}`),
      attachments: [],
      verified: false
    };
    
    return {
      type: 'Evidence',
      items: [evidenceItem],
      traceId: context.executionId,
      workflow: {
        graphId: context.graphId,
        version: '1.0.0',
        nodes: [],
        connections: [],
        timestamp: new Date()
      },
      chain: [],
      metadata: this.createMetadata(context.nodeId, context.executionId, 'three_doc_match_evidence')
    };
  }
}
