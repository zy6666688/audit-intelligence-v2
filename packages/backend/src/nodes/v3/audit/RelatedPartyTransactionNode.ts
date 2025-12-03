/**
 * Related Party Transaction Node - 关联方交易检测节点
 * 
 * 核心功能：识别关联方交易并检测异常模式
 * 
 * 审计价值：
 * - 发现隐藏的关联方关系
 * - 识别利益输送行为
 * - 评估关联交易公允性
 * - 检测循环交易
 * 
 * 算法：图算法 + 统计分析 + 模式识别
 * 复杂度：H（高）- 多维度分析、图算法
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, RiskSet, RiskItem, AuditDataType } from '../../../types/AuditDataTypes';

interface RelatedPartyTransactionConfig {
  relatedPartySource: 'input' | 'auto_detect' | 'both';
  priceDeviationThreshold: number;      // 价格偏离阈值（%）
  frequencyThreshold: number;           // 高频交易阈值（次/月）
  amountThreshold: number;              // 大额交易阈值
  priceWeight: number;                  // 价格权重
  frequencyWeight: number;              // 频次权重
  amountWeight: number;                 // 金额权重
  detectCircular: boolean;              // 检测循环交易
  detectPrice: boolean;                 // 检测价格异常
  detectTiming: boolean;                // 检测时点异常
  minRiskScore: number;                 // 最小风险分数
}

interface RelatedParty {
  id: string;
  name: string;
  type: 'shareholder' | 'director' | 'executive' | 'subsidiary' | 'associate' | 'other';
  relationship: string;
  confidence: number;
}

interface Transaction {
  id: string;
  date: Date;
  counterparty: string;
  amount: number;
  item?: string;
  price?: number;
  quantity?: number;
  description?: string;
}

interface TransactionAnomaly {
  type: 'price' | 'frequency' | 'amount' | 'timing' | 'circular';
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: any;
}

export class RelatedPartyTransactionNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'audit.related_party_transaction',
      version: '1.0.0',
      category: 'audit',
      
      label: {
        zh: '关联方交易检测',
        en: 'Related Party Transaction Detection'
      },
      
      description: {
        zh: '识别和分析关联方交易，检测潜在的利益输送和不公允交易。支持自动识别关联方、多维度异常检测和循环交易发现。',
        en: 'Identify and analyze related party transactions, detect potential tunneling and unfair dealings. Support auto-detection, multi-dimensional anomaly detection and circular transaction discovery.'
      },
      
      icon: '🔗',
      color: '#9B59B6',
      
      inputs: [
        {
          id: 'transactions',
          name: 'transactions',
          type: 'Records',
          required: true,
          description: {
            zh: '交易记录（需包含：交易对手、金额、日期等）',
            en: 'Transaction records (must include: counterparty, amount, date, etc.)'
          }
        },
        {
          id: 'related_parties',
          name: 'related_parties',
          type: 'Records',
          required: false,
          description: {
            zh: '已知关联方名单（可选）',
            en: 'Known related parties list (optional)'
          }
        },
        {
          id: 'market_prices',
          name: 'market_prices',
          type: 'Records',
          required: false,
          description: {
            zh: '市场公允价格参考（可选）',
            en: 'Market fair prices reference (optional)'
          }
        }
      ],
      
      outputs: [
        {
          id: 'risks',
          name: 'risks',
          type: 'RiskSet',
          required: true,
          description: {
            zh: '关联方交易风险集合',
            en: 'Related party transaction risks'
          }
        }
      ],
      
      config: [
        {
          id: 'relatedPartySource',
          name: { zh: '关联方识别方式', en: 'Related Party Source' },
          type: 'select',
          required: false,
          defaultValue: 'both',
          options: [
            { label: 'Input Only', value: 'input' },
            { label: 'Auto Detect', value: 'auto_detect' },
            { label: 'Both', value: 'both' }
          ],
          description: {
            zh: '关联方识别方式：仅使用输入/自动检测/两者结合',
            en: 'How to identify related parties: input only, auto-detect, or both'
          }
        },
        {
          id: 'priceDeviationThreshold',
          name: { zh: '价格偏离阈值(%)', en: 'Price Deviation Threshold (%)' },
          type: 'number',
          required: false,
          defaultValue: 20,
          description: {
            zh: '价格偏离市场价的阈值百分比',
            en: 'Threshold percentage for price deviation from market price'
          },
          validation: { min: 0, max: 100 }
        },
        {
          id: 'frequencyThreshold',
          name: { zh: '高频交易阈值(次/月)', en: 'Frequency Threshold (times/month)' },
          type: 'number',
          required: false,
          defaultValue: 10,
          description: {
            zh: '判定为高频交易的月均次数阈值',
            en: 'Monthly frequency threshold for high-frequency trading'
          },
          validation: { min: 1 }
        },
        {
          id: 'amountThreshold',
          name: { zh: '大额交易阈值', en: 'Large Amount Threshold' },
          type: 'number',
          required: false,
          defaultValue: 1000000,
          description: {
            zh: '判定为大额交易的金额阈值',
            en: 'Amount threshold for large transactions'
          },
          validation: { min: 0 }
        },
        {
          id: 'detectCircular',
          name: { zh: '检测循环交易', en: 'Detect Circular Transactions' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '是否检测循环交易模式',
            en: 'Whether to detect circular transaction patterns'
          }
        },
        {
          id: 'detectPrice',
          name: { zh: '检测价格异常', en: 'Detect Price Anomaly' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '是否检测价格异常',
            en: 'Whether to detect price anomalies'
          }
        },
        {
          id: 'minRiskScore',
          name: { zh: '最小风险分数', en: 'Minimum Risk Score' },
          type: 'number',
          required: false,
          defaultValue: 50,
          description: {
            zh: '输出的最小风险分数阈值',
            en: 'Minimum risk score threshold for output'
          },
          validation: { min: 0, max: 100 }
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['audit', 'related-party', 'risk-detection', 'compliance'],
        documentation: 'https://docs.audit-system.com/nodes/audit/related-party-transaction',
        examples: [
          {
            title: '关联方交易检测',
            description: '检测并分析关联方交易异常',
            inputs: {
              transactions: { type: 'Records', rowCount: 1000 }
            },
            config: {
              priceDeviationThreshold: 20,
              frequencyThreshold: 10,
              detectCircular: true
            }
          }
        ]
      },
      
      capabilities: {
        cacheable: true,
        parallel: false,
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
      const transactions = inputs.transactions as Records;
      const relatedPartiesInput = inputs.related_parties as Records | undefined;
      const marketPrices = inputs.market_prices as Records | undefined;
      
      const cfg: RelatedPartyTransactionConfig = {
        relatedPartySource: config.relatedPartySource ?? 'both',
        priceDeviationThreshold: config.priceDeviationThreshold ?? 20,
        frequencyThreshold: config.frequencyThreshold ?? 10,
        amountThreshold: config.amountThreshold ?? 1000000,
        priceWeight: config.priceWeight ?? 0.4,
        frequencyWeight: config.frequencyWeight ?? 0.3,
        amountWeight: config.amountWeight ?? 0.3,
        detectCircular: config.detectCircular !== false,
        detectPrice: config.detectPrice !== false,
        detectTiming: config.detectTiming !== false,
        minRiskScore: config.minRiskScore ?? 50
      };
      
      context.logger?.info?.(`🔗 Starting related party transaction detection: ${transactions.rowCount} transactions`);
      
      // 1. 识别关联方
      const relatedParties = this.identifyRelatedParties(
        transactions,
        relatedPartiesInput,
        cfg,
        context
      );
      
      context.logger?.info?.(`📋 Identified ${relatedParties.length} related parties`);
      
      // 2. 提取关联方交易
      const relatedTransactions = this.extractRelatedTransactions(
        transactions.data,
        relatedParties
      );
      
      context.logger?.info?.(`💼 Found ${relatedTransactions.length} related party transactions`);
      
      // 3. 检测交易异常
      const risks: RiskItem[] = [];
      
      for (const transaction of relatedTransactions) {
        const anomalies = this.detectAnomalies(
          transaction,
          relatedTransactions,
          marketPrices,
          cfg
        );
        
        if (anomalies.length > 0) {
          const riskScore = this.calculateRiskScore(anomalies, cfg);
          
          if (riskScore >= cfg.minRiskScore) {
            risks.push({
              id: `RPT-${transaction.id}`,
              category: 'related_party_transaction',
              description: this.generateRiskDescription(transaction, anomalies),
              severity: this.getSeverity(riskScore),
              score: riskScore,
              evidence: [JSON.stringify(transaction)],
              relatedData: {
                transaction,
                anomalies,
                related_party: relatedParties.find(rp => rp.name === transaction.counterparty)
              },
              suggestedActions: this.generateActions(anomalies),
              detectedBy: 'related_party_transaction_v1.0.0',
              detectedAt: new Date()
            });
          }
        }
      }
      
      // 4. 检测循环交易（如果启用）
      if (cfg.detectCircular) {
        const circularRisks = this.detectCircularTransactions(
          relatedTransactions,
          relatedParties,
          cfg,
          context
        );
        risks.push(...circularRisks);
      }
      
      // 5. 生成汇总
      const summary = {
        total: risks.length,
        bySeverity: this.groupBySeverity(risks),
        byCategory: {
          price_anomaly: risks.filter(r => 
            (r.relatedData as any).anomalies?.some((a: TransactionAnomaly) => a.type === 'price')
          ).length,
          frequency_anomaly: risks.filter(r =>
            (r.relatedData as any).anomalies?.some((a: TransactionAnomaly) => a.type === 'frequency')
          ).length,
          amount_anomaly: risks.filter(r =>
            (r.relatedData as any).anomalies?.some((a: TransactionAnomaly) => a.type === 'amount')
          ).length,
          circular_transaction: risks.filter(r =>
            (r.relatedData as any).anomalies?.some((a: TransactionAnomaly) => a.type === 'circular')
          ).length
        }
      };
      
      const riskSet: RiskSet = {
        type: 'RiskSet',
        risks,
        summary,
        metadata: this.createMetadata(context.nodeId, context.executionId, 'related_party_risks')
      };
      
      const duration = Date.now() - startTime;
      context.logger?.info?.(`✅ Related party transaction detection completed: ${risks.length} risks found (${duration}ms)`);
      
      return this.wrapSuccess({ risks: riskSet }, duration, context);
      
    } catch (error: any) {
      context.logger?.error?.('❌ Related party transaction detection failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }
  
  // ============================================
  // 私有方法
  // ============================================
  
  /**
   * 识别关联方
   */
  private identifyRelatedParties(
    transactions: Records,
    relatedPartiesInput: Records | undefined,
    config: RelatedPartyTransactionConfig,
    context: NodeExecutionContext
  ): RelatedParty[] {
    const relatedParties: RelatedParty[] = [];
    
    // 从输入中获取关联方
    if (relatedPartiesInput && (config.relatedPartySource === 'input' || config.relatedPartySource === 'both')) {
      for (const party of relatedPartiesInput.data) {
        relatedParties.push({
          id: party.id || `RP-${relatedParties.length + 1}`,
          name: party.name || party.counterparty || '',
          type: party.type || 'other',
          relationship: party.relationship || 'unknown',
          confidence: 1.0
        });
      }
    }
    
    // 自动检测关联方（基于交易模式）
    if (config.relatedPartySource === 'auto_detect' || config.relatedPartySource === 'both') {
      const autoDetected = this.autoDetectRelatedParties(transactions, context);
      relatedParties.push(...autoDetected);
    }
    
    // 去重
    const uniqueParties = new Map<string, RelatedParty>();
    for (const party of relatedParties) {
      const existing = uniqueParties.get(party.name);
      if (!existing || party.confidence > existing.confidence) {
        uniqueParties.set(party.name, party);
      }
    }
    
    return Array.from(uniqueParties.values());
  }
  
  /**
   * 自动检测关联方（基于交易特征）
   */
  private autoDetectRelatedParties(
    transactions: Records,
    context: NodeExecutionContext
  ): RelatedParty[] {
    const detected: RelatedParty[] = [];
    const counterpartyStats = new Map<string, { count: number; totalAmount: number; dates: Date[] }>();
    
    // 统计交易对手频次和金额
    for (const transaction of transactions.data) {
      const counterparty = transaction.counterparty || transaction.customer || transaction.supplier;
      if (!counterparty) continue;
      
      const stats = counterpartyStats.get(counterparty) || { count: 0, totalAmount: 0, dates: [] };
      stats.count++;
      stats.totalAmount += transaction.amount || 0;
      if (transaction.date) {
        stats.dates.push(new Date(transaction.date));
      }
      counterpartyStats.set(counterparty, stats);
    }
    
    // 识别高频交易对手作为潜在关联方
    for (const [name, stats] of counterpartyStats) {
      let confidence = 0;
      
      // 高频交易
      if (stats.count >= 10) confidence += 0.3;
      
      // 大额交易
      if (stats.totalAmount >= 10000000) confidence += 0.3;
      
      // 交易规律性
      if (this.hasRegularPattern(stats.dates)) confidence += 0.2;
      
      // 交易金额整数特征
      const roundAmountCount = transactions.data
        .filter(t => (t.counterparty || t.customer || t.supplier) === name)
        .filter(t => (t.amount || 0) % 10000 === 0).length;
      const roundRatio = roundAmountCount / stats.count;
      if (roundRatio > 0.5) confidence += 0.2;
      
      if (confidence >= 0.5) {
        detected.push({
          id: `AUTO-${detected.length + 1}`,
          name,
          type: 'other',
          relationship: 'suspected',
          confidence
        });
      }
    }
    
    return detected;
  }
  
  /**
   * 检查是否有规律性交易模式
   */
  private hasRegularPattern(dates: Date[]): boolean {
    if (dates.length < 3) return false;
    
    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const intervals: number[] = [];
    
    for (let i = 1; i < sortedDates.length; i++) {
      const interval = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
      intervals.push(interval);
    }
    
    // 计算间隔的标准差
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // 如果标准差小于平均值的30%，认为有规律性
    return stdDev / avgInterval < 0.3;
  }
  
  /**
   * 提取关联方交易
   */
  private extractRelatedTransactions(
    data: Array<Record<string, any>>,
    relatedParties: RelatedParty[]
  ): Transaction[] {
    const relatedPartyNames = new Set(relatedParties.map(rp => rp.name));
    
    return data
      .filter(t => {
        const counterparty = t.counterparty || t.customer || t.supplier;
        return counterparty && relatedPartyNames.has(counterparty);
      })
      .map((t, index) => ({
        id: t.id || `T${index + 1}`,
        date: new Date(t.date || Date.now()),
        counterparty: t.counterparty || t.customer || t.supplier,
        amount: t.amount || 0,
        item: t.item || t.product,
        price: t.price,
        quantity: t.quantity,
        description: t.description || t.summary
      }));
  }
  
  /**
   * 检测交易异常
   */
  private detectAnomalies(
    transaction: Transaction,
    allRelatedTransactions: Transaction[],
    marketPrices: Records | undefined,
    config: RelatedPartyTransactionConfig
  ): TransactionAnomaly[] {
    const anomalies: TransactionAnomaly[] = [];
    
    // 价格异常检测
    if (config.detectPrice && marketPrices) {
      const priceAnomaly = this.detectPriceAnomaly(transaction, marketPrices, config);
      if (priceAnomaly) anomalies.push(priceAnomaly);
    }
    
    // 频次异常检测
    const frequencyAnomaly = this.detectFrequencyAnomaly(transaction, allRelatedTransactions, config);
    if (frequencyAnomaly) anomalies.push(frequencyAnomaly);
    
    // 金额异常检测
    const amountAnomaly = this.detectAmountAnomaly(transaction, config);
    if (amountAnomaly) anomalies.push(amountAnomaly);
    
    // 时点异常检测
    if (config.detectTiming) {
      const timingAnomaly = this.detectTimingAnomaly(transaction);
      if (timingAnomaly) anomalies.push(timingAnomaly);
    }
    
    return anomalies;
  }
  
  /**
   * 检测价格异常
   */
  private detectPriceAnomaly(
    transaction: Transaction,
    marketPrices: Records,
    config: RelatedPartyTransactionConfig
  ): TransactionAnomaly | null {
    if (!transaction.item) return null;
    
    const marketPrice = marketPrices.data.find(p => 
      p.item === transaction.item || p.product === transaction.item
    );
    if (!marketPrice) return null;
    
    const transactionPrice = transaction.price || (transaction.amount / (transaction.quantity || 1));
    const deviation = Math.abs((transactionPrice - marketPrice.price) / marketPrice.price) * 100;
    
    if (deviation > config.priceDeviationThreshold) {
      return {
        type: 'price',
        severity: deviation > 50 ? 'high' : deviation > 30 ? 'medium' : 'low',
        description: `交易价格偏离市场价格${deviation.toFixed(1)}%`,
        evidence: {
          transaction_price: transactionPrice,
          market_price: marketPrice.price,
          deviation: `${deviation.toFixed(1)}%`
        }
      };
    }
    
    return null;
  }
  
  /**
   * 检测频次异常
   */
  private detectFrequencyAnomaly(
    transaction: Transaction,
    allRelatedTransactions: Transaction[],
    config: RelatedPartyTransactionConfig
  ): TransactionAnomaly | null {
    const counterparty = transaction.counterparty;
    const transactionsWithSameParty = allRelatedTransactions.filter(
      t => t.counterparty === counterparty
    );
    
    // 计算月度频次
    const monthlyFrequency = transactionsWithSameParty.length / 12; // 假设数据覆盖12个月
    
    if (monthlyFrequency > config.frequencyThreshold) {
      return {
        type: 'frequency',
        severity: monthlyFrequency > config.frequencyThreshold * 2 ? 'high' : 'medium',
        description: `与${counterparty}的交易频次异常高：${monthlyFrequency.toFixed(1)}次/月`,
        evidence: {
          monthly_frequency: monthlyFrequency,
          total_transactions: transactionsWithSameParty.length,
          threshold: config.frequencyThreshold
        }
      };
    }
    
    return null;
  }
  
  /**
   * 检测金额异常
   */
  private detectAmountAnomaly(
    transaction: Transaction,
    config: RelatedPartyTransactionConfig
  ): TransactionAnomaly | null {
    const amount = transaction.amount;
    
    if (amount >= config.amountThreshold) {
      return {
        type: 'amount',
        severity: amount >= config.amountThreshold * 10 ? 'high' : 
                  amount >= config.amountThreshold * 5 ? 'medium' : 'low',
        description: `大额关联交易：${amount.toLocaleString()}元`,
        evidence: {
          amount,
          threshold: config.amountThreshold,
          ratio: (amount / config.amountThreshold).toFixed(2)
        }
      };
    }
    
    return null;
  }
  
  /**
   * 检测时点异常（期末突击交易）
   */
  private detectTimingAnomaly(transaction: Transaction): TransactionAnomaly | null {
    const date = transaction.date;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // 检测期末突击交易（12月最后5天）
    const isYearEnd = month === 12 && day >= 27;
    
    // 检测季末交易（每季度最后3天）
    const isQuarterEnd = [3, 6, 9, 12].includes(month) && day >= 29;
    
    if (isYearEnd || isQuarterEnd) {
      return {
        type: 'timing',
        severity: isYearEnd ? 'high' : 'medium',
        description: isYearEnd ? '年末突击交易' : '季末突击交易',
        evidence: {
          date: date.toISOString().split('T')[0],
          is_year_end: isYearEnd,
          is_quarter_end: isQuarterEnd
        }
      };
    }
    
    return null;
  }
  
  /**
   * 检测循环交易
   */
  private detectCircularTransactions(
    transactions: Transaction[],
    relatedParties: RelatedParty[],
    config: RelatedPartyTransactionConfig,
    context: NodeExecutionContext
  ): RiskItem[] {
    const risks: RiskItem[] = [];
    
    // 构建交易图
    const graph = new Map<string, Set<string>>();
    for (const transaction of transactions) {
      const from = 'company'; // 假设公司为起点
      const to = transaction.counterparty;
      
      if (!graph.has(from)) graph.set(from, new Set());
      graph.get(from)!.add(to);
    }
    
    // 简单的循环检测：检查是否有A→B和B→A的模式
    const checked = new Set<string>();
    for (const transaction of transactions) {
      const party = transaction.counterparty;
      if (checked.has(party)) continue;
      
      const outgoing = transactions.filter(t => t.counterparty === party);
      const incoming = transactions.filter(t => (t as any).from === party);
      
      if (outgoing.length > 0 && incoming.length > 0) {
        const totalOutgoing = outgoing.reduce((sum, t) => sum + t.amount, 0);
        const totalIncoming = incoming.reduce((sum, t) => sum + t.amount, 0);
        const ratio = Math.min(totalOutgoing, totalIncoming) / Math.max(totalOutgoing, totalIncoming);
        
        if (ratio > 0.8) {
          risks.push({
            id: `CIRCULAR-${risks.length + 1}`,
            category: 'circular_transaction',
            description: `检测到与${party}的双向交易，疑似循环交易`,
            severity: 'high',
            score: 85,
            evidence: [],
            relatedData: {
              party,
              outgoing_amount: totalOutgoing,
              incoming_amount: totalIncoming,
              ratio,
              anomalies: [{
                type: 'circular',
                severity: 'high',
                description: '双向资金流动',
                evidence: { outgoing_amount: totalOutgoing, incoming_amount: totalIncoming }
              }]
            },
            suggestedActions: [
              '核查循环交易的商业实质',
              '检查是否存在虚构交易',
              '评估是否为利益输送'
            ],
            detectedBy: 'related_party_transaction_v1.0.0',
            detectedAt: new Date()
          });
          
          checked.add(party);
        }
      }
    }
    
    return risks;
  }
  
  /**
   * 计算风险分数
   */
  private calculateRiskScore(
    anomalies: TransactionAnomaly[],
    config: RelatedPartyTransactionConfig
  ): number {
    let score = 0;
    
    for (const anomaly of anomalies) {
      let baseScore = 0;
      
      switch (anomaly.severity) {
        case 'high': baseScore = 80; break;
        case 'medium': baseScore = 60; break;
        case 'low': baseScore = 40; break;
      }
      
      switch (anomaly.type) {
        case 'price':
          score += baseScore * config.priceWeight;
          break;
        case 'frequency':
          score += baseScore * config.frequencyWeight;
          break;
        case 'amount':
          score += baseScore * config.amountWeight;
          break;
        default:
          score += baseScore * 0.2;
      }
    }
    
    return Math.min(100, score);
  }
  
  /**
   * 生成风险描述
   */
  private generateRiskDescription(transaction: Transaction, anomalies: TransactionAnomaly[]): string {
    const counterparty = transaction.counterparty;
    const descriptions = anomalies.map(a => a.description);
    return `关联方${counterparty}的交易存在异常：${descriptions.join('；')}`;
  }
  
  /**
   * 获取严重程度
   */
  private getSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }
  
  /**
   * 生成建议行动
   */
  private generateActions(anomalies: TransactionAnomaly[]): string[] {
    const actions = new Set<string>();
    
    for (const anomaly of anomalies) {
      switch (anomaly.type) {
        case 'price':
          actions.add('核实交易价格的公允性');
          actions.add('获取第三方价格证明');
          break;
        case 'frequency':
          actions.add('检查交易的商业合理性');
          actions.add('评估交易频繁性的必要性');
          break;
        case 'amount':
          actions.add('执行大额交易专项审计');
          actions.add('获取董事会/股东会决议');
          break;
        case 'timing':
          actions.add('核查期末交易的商业实质');
          actions.add('检查是否存在调节利润的动机');
          break;
        case 'circular':
          actions.add('追查循环交易的完整链路');
          actions.add('评估是否存在虚构交易');
          break;
      }
    }
    
    return Array.from(actions);
  }
  
  /**
   * 按严重程度分组
   */
  private groupBySeverity(risks: RiskItem[]): Record<string, number> {
    return {
      critical: risks.filter(r => r.severity === 'critical').length,
      high: risks.filter(r => r.severity === 'high').length,
      medium: risks.filter(r => r.severity === 'medium').length,
      low: risks.filter(r => r.severity === 'low').length
    };
  }
}
