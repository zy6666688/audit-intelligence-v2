/**
 * TextAnalysisNode - 文本分析节点
 * Week 3 Day 2
 */

import type { NodeDefinition } from '@audit/shared';
import { createSimpleAINode } from '../BaseAINode';
import type { AIAdapter } from '../AIAdapter';

/**
 * 创建文本情感分析节点
 */
export function createSentimentAnalysisNode(adapter: AIAdapter): NodeDefinition {
  return createSimpleAINode(
    'ai.text.sentiment',
    '情感分析',
    '分析文本的情感倾向（正面/负面/中性）',
    adapter,
    `请分析以下文本的情感倾向：

文本：{{text}}

请给出：
1. 情感分类（正面/负面/中性）
2. 置信度（0-1）
3. 关键情感词
4. 简要分析

请以JSON格式返回：
{
  "sentiment": "正面/负面/中性",
  "confidence": 0.85,
  "keywords": ["关键词1", "关键词2"],
  "analysis": "简要分析"
}`,
    {
      text: { type: 'string', required: true, description: '待分析文本' }
    },
    {
      result: { type: 'string', description: 'JSON格式的分析结果' },
      usage: { type: 'object', description: 'Token使用情况' }
    }
  );
}

/**
 * 创建关键词提取节点
 */
export function createKeywordExtractionNode(adapter: AIAdapter): NodeDefinition {
  return createSimpleAINode(
    'ai.text.keywords',
    '关键词提取',
    '从文本中提取关键词和短语',
    adapter,
    `请从以下文本中提取{{count}}个最重要的关键词：

文本：{{text}}

要求：
- 按重要性排序
- 提供每个关键词的权重（0-1）
- 给出简短说明

以JSON格式返回：
{
  "keywords": [
    {"word": "关键词", "weight": 0.9, "reason": "说明"}
  ]
}`,
    {
      text: { type: 'string', required: true, description: '源文本' },
      count: { type: 'number', default: 5, description: '提取数量' }
    },
    {
      result: { type: 'string', description: 'JSON格式的关键词列表' },
      usage: { type: 'object', description: 'Token使用情况' }
    }
  );
}

/**
 * 创建文本摘要节点
 */
export function createTextSummaryNode(adapter: AIAdapter): NodeDefinition {
  return createSimpleAINode(
    'ai.text.summary',
    '文本摘要',
    '生成文本的简洁摘要',
    adapter,
    `请为以下内容生成摘要，不超过{{maxLength}}字：

{{text}}

要求：
- 保留核心信息
- 语言简洁
- 条理清晰`,
    {
      text: { type: 'string', required: true, description: '源文本' },
      maxLength: { type: 'number', default: 200, description: '最大长度' }
    },
    {
      result: { type: 'string', description: '摘要文本' },
      usage: { type: 'object', description: 'Token使用情况' }
    }
  );
}
