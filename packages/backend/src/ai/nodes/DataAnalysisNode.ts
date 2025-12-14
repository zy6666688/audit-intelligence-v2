/**
 * DataAnalysisNode - 数据分析节点
 * Week 3 Day 2
 */

import type { NodeDefinition } from '@audit/shared';
import { createSimpleAINode } from '../BaseAINode';
import type { AIAdapter } from '../AIAdapter';

/**
 * 创建数据洞察节点
 */
export function createDataInsightNode(adapter: AIAdapter): NodeDefinition {
  return createSimpleAINode(
    'ai.data.insight',
    '数据洞察',
    '分析数据并提供洞察',
    adapter,
    `请分析以下数据并提供洞察：

数据：
{{data}}

分析维度：{{dimensions}}

请提供：
1. 数据概况（统计特征）
2. 关键发现（3-5条）
3. 异常点识别
4. 趋势分析
5. 建议

以结构化方式呈现。`,
    {
      data: { type: 'string', required: true, description: 'JSON或CSV格式数据' },
      dimensions: { type: 'string', default: '全面分析', description: '分析维度' }
    },
    {
      result: { type: 'string', description: '分析结果' },
      usage: { type: 'object', description: 'Token使用情况' }
    }
  );
}

/**
 * 创建异常检测节点
 */
export function createAnomalyDetectionNode(adapter: AIAdapter): NodeDefinition {
  return createSimpleAINode(
    'ai.data.anomaly',
    '异常检测',
    '识别数据中的异常值和异常模式',
    adapter,
    `请检测以下数据中的异常：

数据：
{{data}}

检测标准：{{criteria}}

请识别：
1. 数值异常（超出正常范围）
2. 模式异常（不符合正常分布）
3. 异常严重程度
4. 可能原因分析

以JSON格式返回：
{
  "anomalies": [
    {
      "index": 位置,
      "value": 值,
      "type": "类型",
      "severity": "high/medium/low",
      "reason": "原因"
    }
  ],
  "summary": "总体评估"
}`,
    {
      data: { type: 'string', required: true, description: '数据' },
      criteria: { type: 'string', default: '标准统计方法', description: '检测标准' }
    },
    {
      result: { type: 'string', description: 'JSON格式的异常检测结果' },
      usage: { type: 'object', description: 'Token使用情况' }
    }
  );
}

/**
 * 创建趋势预测节点
 */
export function createTrendPredictionNode(adapter: AIAdapter): NodeDefinition {
  return createSimpleAINode(
    'ai.data.trend',
    '趋势预测',
    '基于历史数据预测未来趋势',
    adapter,
    `基于以下历史数据，预测未来{{periods}}期的趋势：

历史数据：
{{data}}

请提供：
1. 趋势判断（上升/下降/平稳）
2. 关键转折点
3. 影响因素
4. 预测值及置信区间
5. 风险提示

以结构化方式呈现。`,
    {
      data: { type: 'string', required: true, description: '时间序列数据' },
      periods: { type: 'number', default: 3, description: '预测期数' }
    },
    {
      result: { type: 'string', description: '趋势预测结果' },
      usage: { type: 'object', description: 'Token使用情况' }
    }
  );
}
