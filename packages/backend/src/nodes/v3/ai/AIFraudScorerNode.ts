/**
 * AI Fraud Scorer Node - AI驱动的舞弊评分节点
 * 
 * 核心功能：基于规则引擎 + LLM的多维舞弊评分
 * 
 * 审计价值：
 * - 自动化舞弊风险评估
 * - 结合规则和AI的混合判断
 * - 生成可解释的风险报告
 * 
 * 复杂度：H（高）- AI集成、多数据源融合
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, RiskSet, Evidence, AuditDataType } from '../../../types/AuditDataTypes';

interface FraudScorerConfig {
  sensitivity: 'low' | 'medium' | 'high';
  enableAI: boolean;
  aiModel?: string;
  ruleWeights?: Record<string, number>;
  threshold?: number;
}

interface FraudScore {
  overall: number;              // 总体风险分数 0-100
  dimensions: {
    financial: number;          // 财务异常
    behavioral: number;         // 行为异常
    document: number;          // 单据异常
    relationship: number;      // 关系异常
  };
  aiReasoning?: string;         // AI推理过程
  ruleMatches: Array<{
    rule: string;
    weight: number;
    triggered: boolean;
  }>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class AIFraudScorerNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'ai.fraud_scorer',
      version: '1.0.0',
      category: 'analysis',
      
      label: {
        zh: 'AI舞弊评分',
        en: 'AI Fraud Scorer'
      },
      
      description: {
        zh: '基于规则引擎和大语言模型的智能舞弊评分系统。分析凭证、流水、合同等多维数据，生成综合风险评分和AI推理报告。',
        en: 'Intelligent fraud scoring system based on rule engine and LLM. Analyzes vouchers, flows, contracts, and generates comprehensive risk scores with AI reasoning.'
      },
      
      icon: '🤖',
      color: '#9B59B6',
      
      inputs: [
        {
          id: 'vouchers',
          name: 'vouchers',
          type: 'Records',
          required: false,
          description: {
            zh: '凭证数据',
            en: 'Voucher records'
          }
        },
        {
          id: 'flows',
          name: 'flows',
          type: 'Records',
          required: false,
          description: {
            zh: '银行流水',
            en: 'Bank flows'
          }
        },
        {
          id: 'contracts',
          name: 'contracts',
          type: 'Records',
          required: false,
          description: {
            zh: '合同数据',
            en: 'Contract data'
          }
        },
        {
          id: 'existingRisks',
          name: 'existingRisks',
          type: 'RiskSet',
          required: false,
          description: {
            zh: '已识别的风险（来自其他节点）',
            en: 'Existing risks (from other nodes)'
          }
        }
      ],
      
      outputs: [
        {
          id: 'risk',
          name: 'risk',
          type: 'RiskSet',
          required: true,
          description: {
            zh: '舞弊风险评分',
            en: 'Fraud risk assessment'
          }
        },
        {
          id: 'scores',
          name: 'scores',
          type: 'Records',
          required: true,
          description: {
            zh: '详细评分表',
            en: 'Detailed scores'
          }
        },
        {
          id: 'evidence',
          name: 'evidence',
          type: 'Evidence',
          required: true,
          description: {
            zh: 'AI分析证据',
            en: 'AI analysis evidence'
          }
        }
      ],
      
      config: [
        {
          id: 'sensitivity',
          name: { zh: '敏感度', en: 'Sensitivity' },
          type: 'select',
          required: false,
          defaultValue: 'medium',
          options: [
            { label: '低', value: 'low' },
            { label: '中', value: 'medium' },
            { label: '高', value: 'high' }
          ],
          description: {
            zh: '风险检测敏感度',
            en: 'Risk detection sensitivity'
          }
        },
        {
          id: 'enableAI',
          name: { zh: '启用AI分析', en: 'Enable AI' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '是否使用LLM进行深度分析',
            en: 'Whether to use LLM for deep analysis'
          }
        },
        {
          id: 'aiModel',
          name: { zh: 'AI模型', en: 'AI Model' },
          type: 'select',
          required: false,
          options: [
            { label: 'OpenAI GPT-4', value: 'gpt-4' },
            { label: 'OpenAI GPT-3.5', value: 'gpt-3.5-turbo' },
            { label: 'Qwen Max', value: 'qwen-max' },
            { label: 'Local Model', value: 'local' }
          ],
          description: {
            zh: '使用的AI模型',
            en: 'AI model to use'
          }
        },
        {
          id: 'threshold',
          name: { zh: '风险阈值', en: 'Risk Threshold' },
          type: 'number',
          required: false,
          defaultValue: 70,
          description: {
            zh: '触发高风险告警的分数阈值（0-100）',
            en: 'Score threshold for high risk alert (0-100)'
          },
          validation: {
            min: 0,
            max: 100
          }
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['ai', 'fraud-detection', 'scoring', 'llm', 'risk-assessment'],
        documentation: 'https://docs.audit-system.com/nodes/ai/fraud-scorer',
        examples: [
          {
            title: 'AI舞弊评分',
            description: '结合凭证、流水和AI推理进行舞弊评分',
            inputs: {
              vouchers: { type: 'Records', rowCount: 100 },
              flows: { type: 'Records', rowCount: 500 }
            },
            config: {
              sensitivity: 'high',
              enableAI: true,
              aiModel: 'gpt-4'
            }
          }
        ]
      },
      
      capabilities: {
        cacheable: true,
        parallel: true,
        streaming: false,
        aiPowered: true          // 标记为AI驱动
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
      const vouchers = inputs.vouchers as Records | undefined;
      const flows = inputs.flows as Records | undefined;
      const contracts = inputs.contracts as Records | undefined;
      const existingRisks = inputs.existingRisks as RiskSet | undefined;
      
      const cfg: FraudScorerConfig = {
        sensitivity: config.sensitivity || 'medium',
        enableAI: config.enableAI !== false,
        aiModel: config.aiModel || 'gpt-3.5-turbo',
        threshold: config.threshold || 70
      };
      
      context.logger?.info?.(`🤖 Starting AI fraud scoring (AI: ${cfg.enableAI}, Model: ${cfg.aiModel})`);
      
      // 1. 规则引擎评分（快速）
      const ruleScore = await this.ruleBasedScoring(
        vouchers,
        flows,
        contracts,
        existingRisks,
        cfg,
        context
      );
      
      context.logger?.info?.(`📊 Rule-based score: ${ruleScore.overall.toFixed(1)}`);
      
      // 2. AI增强评分（如果启用）
      let finalScore = ruleScore;
      if (cfg.enableAI && context.ai) {
        try {
          const aiScore = await this.aiEnhancedScoring(
            ruleScore,
            vouchers,
            flows,
            contracts,
            cfg,
            context
          );
          finalScore = this.mergeScores(ruleScore, aiScore);
          context.logger?.info?.(`🧠 AI-enhanced score: ${finalScore.overall.toFixed(1)}`);
        } catch (error: any) {
          context.logger?.warn?.(`⚠️ AI scoring failed, fallback to rules: ${error.message}`);
          // Fallback to rule-based score
        }
      }
      
      // 3. 生成风险集
      const risks = this.generateRisks(finalScore, cfg);
      
      // 4. 生成证据
      const evidence = this.generateEvidence(finalScore, context);
      
      // 5. 构造详细评分表
      const scoresRecords: Records = {
        type: 'Records',
        schema: [
          { name: 'dimension', type: 'string', required: true, description: 'Dimension' },
          { name: 'score', type: 'number', required: true, description: 'Score' },
          { name: 'weight', type: 'number', required: true, description: 'Weight' }
        ],
        data: [
          { dimension: 'Financial Anomaly', score: finalScore.dimensions.financial, weight: 0.3 },
          { dimension: 'Behavioral Anomaly', score: finalScore.dimensions.behavioral, weight: 0.25 },
          { dimension: 'Document Anomaly', score: finalScore.dimensions.document, weight: 0.25 },
          { dimension: 'Relationship Anomaly', score: finalScore.dimensions.relationship, weight: 0.2 },
          { dimension: 'Overall', score: finalScore.overall, weight: 1.0 }
        ],
        metadata: this.createMetadata(context.nodeId, context.executionId, 'fraud_scores'),
        rowCount: 5,
        columnCount: 3
      };
      
      const duration = Date.now() - startTime;
      
      context.logger?.info?.(`✅ AI fraud scoring completed: ${finalScore.overall.toFixed(1)}/100 (${finalScore.riskLevel}) (${duration}ms)`);
      
      return this.wrapSuccess(
        {
          risk: risks,
          scores: scoresRecords,
          evidence
        },
        duration,
        context
      );
      
    } catch (error: any) {
      context.logger?.error?.('❌ AI fraud scoring failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private async ruleBasedScoring(
    vouchers: Records | undefined,
    flows: Records | undefined,
    contracts: Records | undefined,
    existingRisks: RiskSet | undefined,
    config: FraudScorerConfig,
    context: NodeExecutionContext
  ): Promise<FraudScore> {
    const scores = {
      financial: 0,
      behavioral: 0,
      document: 0,
      relationship: 0
    };
    
    const ruleMatches: Array<{ rule: string; weight: number; triggered: boolean }> = [];
    
    // 财务异常规则
    if (flows && flows.rowCount > 0) {
      // 规则1: 整数金额异常（大量整百、整千）
      const roundAmounts = flows.data.filter(f => {
        const amount = parseFloat(f.amount || 0);
        return amount % 1000 === 0 || amount % 100 === 0;
      }).length;
      
      const roundRatio = roundAmounts / flows.rowCount;
      if (roundRatio > 0.5) {
        scores.financial += 30;
        ruleMatches.push({ rule: 'High round amount ratio', weight: 30, triggered: true });
      } else if (roundRatio > 0.3) {
        scores.financial += 15;
        ruleMatches.push({ rule: 'Medium round amount ratio', weight: 15, triggered: true });
      }
      
      // 规则2: 高频小额交易
      const smallAmounts = flows.data.filter(f => parseFloat(f.amount || 0) < 5000).length;
      if (smallAmounts / flows.rowCount > 0.7) {
        scores.financial += 20;
        ruleMatches.push({ rule: 'High frequency small transactions', weight: 20, triggered: true });
      }
    }
    
    // 单据异常规则
    if (vouchers && vouchers.rowCount > 0) {
      // 规则3: 缺少附件
      const noAttachment = vouchers.data.filter(v => !v.attachments || v.attachments.length === 0).length;
      const noAttachmentRatio = noAttachment / vouchers.rowCount;
      if (noAttachmentRatio > 0.3) {
        scores.document += 25;
        ruleMatches.push({ rule: 'High missing attachment ratio', weight: 25, triggered: true });
      }
      
      // 规则4: 审批缺失
      const noApproval = vouchers.data.filter(v => !v.approved_by).length;
      if (noApproval / vouchers.rowCount > 0.1) {
        scores.document += 30;
        ruleMatches.push({ rule: 'Missing approvals', weight: 30, triggered: true });
      }
    }
    
    // 行为异常规则
    if (existingRisks && existingRisks.risks.length > 0) {
      const criticalCount = existingRisks.risks.filter(r => r.severity === 'critical').length;
      const highCount = existingRisks.risks.filter(r => r.severity === 'high').length;
      
      scores.behavioral = Math.min(100, criticalCount * 40 + highCount * 20);
      ruleMatches.push({ rule: 'Existing risk signals', weight: scores.behavioral, triggered: true });
    }
    
    // 关系异常规则
    if (contracts && contracts.rowCount > 0) {
      // 简单示例：检查关联方
      const relatedParty = contracts.data.filter(c => 
        c.party_type === 'related' || c.relationship === 'related'
      ).length;
      
      if (relatedParty / contracts.rowCount > 0.2) {
        scores.relationship += 35;
        ruleMatches.push({ rule: 'High related party ratio', weight: 35, triggered: true });
      }
    }
    
    // 计算总分（加权平均）
    const overall = 
      scores.financial * 0.3 +
      scores.behavioral * 0.25 +
      scores.document * 0.25 +
      scores.relationship * 0.2;
    
    // 根据敏感度调整
    const sensitivityMultiplier = config.sensitivity === 'high' ? 1.2 : config.sensitivity === 'low' ? 0.8 : 1.0;
    const adjustedOverall = Math.min(100, overall * sensitivityMultiplier);
    
    return {
      overall: adjustedOverall,
      dimensions: scores,
      ruleMatches,
      riskLevel: this.scoreToLevel(adjustedOverall)
    };
  }

  private async aiEnhancedScoring(
    ruleScore: FraudScore,
    vouchers: Records | undefined,
    flows: Records | undefined,
    contracts: Records | undefined,
    config: FraudScorerConfig,
    context: NodeExecutionContext
  ): Promise<FraudScore> {
    if (!context.ai) {
      return ruleScore;
    }
    
    // 准备AI提示（脱敏后的数据摘要）
    const prompt = this.buildAIPrompt(ruleScore, vouchers, flows, contracts);
    
    // 调用AI
    try {
      const response = await context.ai.chat([
        { role: 'system', content: 'You are an expert fraud auditor. Analyze the data and provide risk assessment.' },
        { role: 'user', content: prompt }
      ]);
      
      // 解析AI响应
      const aiScore = this.parseAIResponse(response);
      
      return {
        ...ruleScore,
        aiReasoning: response
      };
      
    } catch (error: any) {
      context.logger?.warn?.(`AI call failed: ${error.message}`);
      return ruleScore;
    }
  }

  private buildAIPrompt(
    ruleScore: FraudScore,
    vouchers: Records | undefined,
    flows: Records | undefined,
    contracts: Records | undefined
  ): string {
    const parts: string[] = [
      'Analyze the following audit data for fraud risk:',
      '',
      `Rule-based score: ${ruleScore.overall.toFixed(1)}/100`,
      `Dimensions:`,
      `- Financial: ${ruleScore.dimensions.financial}`,
      `- Behavioral: ${ruleScore.dimensions.behavioral}`,
      `- Document: ${ruleScore.dimensions.document}`,
      `- Relationship: ${ruleScore.dimensions.relationship}`,
      ''
    ];
    
    if (vouchers) {
      parts.push(`Vouchers: ${vouchers.rowCount} records`);
    }
    if (flows) {
      parts.push(`Bank flows: ${flows.rowCount} transactions`);
    }
    if (contracts) {
      parts.push(`Contracts: ${contracts.rowCount} contracts`);
    }
    
    parts.push('');
    parts.push('Provide a brief risk assessment (2-3 sentences) focusing on:');
    parts.push('1. Key risk indicators');
    parts.push('2. Potential fraud patterns');
    parts.push('3. Recommended actions');
    
    return parts.join('\n');
  }

  private parseAIResponse(response: string): Partial<FraudScore> {
    // 简化版：实际应该用更复杂的解析
    return {
      aiReasoning: response
    };
  }

  private mergeScores(ruleScore: FraudScore, aiScore: Partial<FraudScore>): FraudScore {
    // AI只增强推理，不修改分数（保持可解释性）
    return {
      ...ruleScore,
      aiReasoning: aiScore.aiReasoning
    };
  }

  private scoreToLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private generateRisks(score: FraudScore, config: FraudScorerConfig): RiskSet {
    const risks = [{
      id: `fraud_risk_${Date.now()}`,
      category: 'fraud',
      description: `Fraud risk assessment: Overall score ${score.overall.toFixed(1)}/100. ${score.aiReasoning || 'Rule-based analysis.'}`,
      severity: score.riskLevel,
      score: score.overall,
      evidence: [],
      relatedData: {
        dimensions: score.dimensions,
        rules: score.ruleMatches.filter(r => r.triggered)
      },
      suggestedActions: [
        'Review high-risk transactions',
        'Verify document authenticity',
        'Investigate related parties'
      ],
      detectedBy: 'ai_fraud_scorer',
      detectedAt: new Date()
    }];
    
    return {
      type: 'RiskSet',
      risks,
      summary: {
        total: 1,
        bySeverity: {
          [score.riskLevel]: 1
        },
        byCategory: {
          fraud: 1
        }
      },
      metadata: this.createMetadata('', '', 'fraud_assessment')
    };
  }

  private generateEvidence(score: FraudScore, context: NodeExecutionContext): Evidence {
    const evidenceItem: any = {
      id: `evidence_${context.executionId}`,
      type: 'analysis' as const,
      title: 'AI Fraud Scoring Evidence',
      content: {
        overallScore: score.overall,
        riskLevel: score.riskLevel,
        dimensions: score.dimensions,
        ruleMatches: score.ruleMatches.filter(r => r.triggered).map(r => r.rule),
        aiReasoning: score.aiReasoning || 'N/A'
      },
      source: 'ai_fraud_scorer',
      collectedBy: 'ai_fraud_scorer',
      collectedAt: new Date(),
      relatedRisks: [`fraud_risk_${Date.now()}`],
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
      metadata: this.createMetadata(context.nodeId, context.executionId, 'fraud_scoring_evidence')
    };
  }
}
