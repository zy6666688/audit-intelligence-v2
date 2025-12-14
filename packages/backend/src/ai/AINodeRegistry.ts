/**
 * AINodeRegistry - AI节点注册器
 * Week 3 Day 2
 */

import type { AIAdapter } from './AIAdapter';
import { NodeRegistryV2 } from '../services/NodeRegistryV2';
import { createSentimentAnalysisNode, createKeywordExtractionNode, createTextSummaryNode } from './nodes/TextAnalysisNode';
import { createDataInsightNode, createAnomalyDetectionNode, createTrendPredictionNode } from './nodes/DataAnalysisNode';
import { createAuditCheckNode, createRiskAssessmentNode, createAuditReportNode } from './nodes/AuditNode';

/**
 * 注册所有AI节点
 */
export function registerAINodes(registry: NodeRegistryV2, adapter: AIAdapter): void {
  // 文本分析节点
  registry.register(createSentimentAnalysisNode(adapter));
  registry.register(createKeywordExtractionNode(adapter));
  registry.register(createTextSummaryNode(adapter));

  // 数据分析节点
  registry.register(createDataInsightNode(adapter));
  registry.register(createAnomalyDetectionNode(adapter));
  registry.register(createTrendPredictionNode(adapter));

  // 审计节点
  registry.register(createAuditCheckNode(adapter));
  registry.register(createRiskAssessmentNode(adapter));
  registry.register(createAuditReportNode(adapter));

  console.log('✅ 已注册 9 个AI节点');
}

/**
 * 获取AI节点列表
 */
export function getAINodeTypes(): string[] {
  return [
    'ai.text.sentiment',
    'ai.text.keywords',
    'ai.text.summary',
    'ai.data.insight',
    'ai.data.anomaly',
    'ai.data.trend',
    'ai.audit.check',
    'ai.audit.risk',
    'ai.audit.report'
  ];
}
