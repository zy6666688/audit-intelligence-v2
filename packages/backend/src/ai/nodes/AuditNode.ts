/**
 * AuditNode - 审计专用AI节点
 * Week 3 Day 2
 */

import type { NodeDefinition } from '@audit/shared';
import { createSimpleAINode } from '../BaseAINode';
import type { AIAdapter } from '../AIAdapter';

/**
 * 创建审计检查节点
 */
export function createAuditCheckNode(adapter: AIAdapter): NodeDefinition {
  return createSimpleAINode(
    'ai.audit.check',
    '审计检查',
    '基于审计准则进行合规性检查',
    adapter,
    `作为专业审计师，请检查以下内容：

审计项目：{{project}}
检查项：{{checkItem}}
相关数据：
{{data}}

适用准则：{{standards}}

请按审计准则评估：
1. 合规性判断（合规/不合规/部分合规）
2. 发现的问题（列举）
3. 风险等级（高/中/低）
4. 影响分析
5. 整改建议

以结构化格式输出。`,
    {
      project: { type: 'string', required: true, description: '项目名称' },
      checkItem: { type: 'string', required: true, description: '检查项' },
      data: { type: 'string', required: true, description: '相关数据' },
      standards: { type: 'string', default: '中国审计准则', description: '适用准则' }
    },
    {
      result: { type: 'string', description: '审计检查结果' },
      usage: { type: 'object', description: 'Token使用情况' }
    }
  );
}

/**
 * 创建风险评估节点
 */
export function createRiskAssessmentNode(adapter: AIAdapter): NodeDefinition {
  return createSimpleAINode(
    'ai.audit.risk',
    '风险评估',
    '评估审计风险并提供应对策略',
    adapter,
    `请评估以下审计场景的风险：

场景：{{scenario}}
背景信息：{{context}}
已知风险因素：{{riskFactors}}

请分析：
1. 主要风险点识别（至少3个）
2. 每个风险的：
   - 风险类型（固有风险/控制风险/检查风险）
   - 风险等级（高/中/低）
   - 可能影响
   - 发生概率
3. 综合风险评级
4. 应对策略建议

以JSON格式返回：
{
  "risks": [
    {
      "name": "风险名称",
      "type": "类型",
      "level": "等级",
      "impact": "影响",
      "probability": "概率",
      "mitigation": "应对措施"
    }
  ],
  "overallRisk": "high/medium/low",
  "recommendations": ["建议1", "建议2"]
}`,
    {
      scenario: { type: 'string', required: true, description: '审计场景' },
      context: { type: 'string', required: true, description: '背景信息' },
      riskFactors: { type: 'string', default: '无', description: '已知风险因素' }
    },
    {
      result: { type: 'string', description: 'JSON格式的风险评估' },
      usage: { type: 'object', description: 'Token使用情况' }
    }
  );
}

/**
 * 创建审计报告生成节点
 */
export function createAuditReportNode(adapter: AIAdapter): NodeDefinition {
  return createSimpleAINode(
    'ai.audit.report',
    '审计报告生成',
    '生成专业的审计报告',
    adapter,
    `请基于以下信息生成审计报告：

项目名称：{{projectName}}
审计期间：{{period}}
审计发现：
{{findings}}

要求：
1. 使用专业审计语言
2. 结构完整（标题、概述、详细发现、结论、建议）
3. 逻辑清晰
4. 突出重点

生成完整的审计报告。`,
    {
      projectName: { type: 'string', required: true, description: '项目名称' },
      period: { type: 'string', required: true, description: '审计期间' },
      findings: { type: 'string', required: true, description: '审计发现' }
    },
    {
      result: { type: 'string', description: '审计报告全文' },
      usage: { type: 'object', description: 'Token使用情况' }
    }
  );
}
