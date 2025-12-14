/**
 * WorkpaperGeneratorNode 测试
 * 测试审计底稿生成功能
 */

import { WorkpaperGeneratorNode } from '../output/WorkpaperGeneratorNode';
import { NodeTestFramework } from './test-framework';
import type { RiskSet, Evidence, DraftPage } from '../../../types/AuditDataTypes';

export async function testWorkpaperGeneratorNode() {
  const node = new WorkpaperGeneratorNode();
  
  return NodeTestFramework.runTestSuite('WorkpaperGeneratorNode', [
    {
      name: 'should generate basic workpaper',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRisks: RiskSet = {
          type: 'RiskSet',
          risks: [
            {
              id: 'R001',
              category: 'fraud',
              description: 'Suspicious transaction detected',
              severity: 'high',
              score: 85,
              evidence: ['E001'],
              relatedData: { transaction_id: 'T001' },
              suggestedActions: ['Further investigation'],
              detectedBy: 'AIFraudScorerNode',
              detectedAt: new Date()
            }
          ],
          summary: {
            total: 1,
            bySeverity: { high: 1 },
            byCategory: { fraud: 1 }
          },
          metadata: NodeTestFramework.createTestMetadata()
        };
        
        const config = {
          template: 'standard',
          format: 'markdown',
          include_summary: true
        };
        
        const result = await node.execute({ risks: inputRisks }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const draft = result.outputs.draft as DraftPage;
        
        if (!draft || draft.type !== 'DraftPage') {
          throw new Error('Should generate DraftPage output');
        }
      }
    },
    
    {
      name: 'should include risk summary',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRisks: RiskSet = {
          type: 'RiskSet',
          risks: [
            {
              id: 'R001',
              category: 'fraud',
              description: 'Risk 1',
              severity: 'high',
              score: 90,
              evidence: [],
              relatedData: {},
              suggestedActions: [],
              detectedBy: 'TestNode',
              detectedAt: new Date()
            },
            {
              id: 'R002',
              category: 'compliance',
              description: 'Risk 2',
              severity: 'medium',
              score: 60,
              evidence: [],
              relatedData: {},
              suggestedActions: [],
              detectedBy: 'TestNode',
              detectedAt: new Date()
            }
          ],
          summary: {
            total: 2,
            bySeverity: { high: 1, medium: 1 },
            byCategory: { fraud: 1, compliance: 1 }
          },
          metadata: NodeTestFramework.createTestMetadata()
        };
        
        const config = {
          template: 'standard',
          format: 'markdown',
          include_summary: true
        };
        
        const result = await node.execute({ risks: inputRisks }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const draft = result.outputs.draft as DraftPage;
        
        // 验证包含摘要信息
        if (!draft.sections || draft.sections.length === 0) {
          throw new Error('Should include sections');
        }
        
        const hasSummarySection = draft.sections.some((s: any) => 
          s.title && s.title.includes('Summary')
        );
        
        if (!hasSummarySection) {
          throw new Error('Should include summary section');
        }
      }
    },
    
    {
      name: 'should format as markdown',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRisks: RiskSet = {
          type: 'RiskSet',
          risks: [
            {
              id: 'R001',
              category: 'test',
              description: 'Test risk',
              severity: 'low',
              score: 30,
              evidence: [],
              relatedData: {},
              suggestedActions: ['Action 1'],
              detectedBy: 'TestNode',
              detectedAt: new Date()
            }
          ],
          summary: {
            total: 1,
            bySeverity: { low: 1 },
            byCategory: { test: 1 }
          },
          metadata: NodeTestFramework.createTestMetadata()
        };
        
        const config = {
          template: 'standard',
          format: 'markdown',
          include_summary: true
        };
        
        const result = await node.execute({ risks: inputRisks }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const draft = result.outputs.draft as DraftPage;
        
        // 验证markdown格式
        const hasMarkdownContent = draft.sections?.some((s: any) =>
          s.content && typeof s.content === 'string' && 
          (s.content.includes('#') || s.content.includes('##'))
        );
        
        if (!hasMarkdownContent) {
          throw new Error('Should format content as markdown');
        }
      }
    },
    
    {
      name: 'should include evidence if provided',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRisks: RiskSet = {
          type: 'RiskSet',
          risks: [
            {
              id: 'R001',
              category: 'fraud',
              description: 'Risk with evidence',
              severity: 'high',
              score: 85,
              evidence: ['E001', 'E002'],
              relatedData: {},
              suggestedActions: [],
              detectedBy: 'TestNode',
              detectedAt: new Date()
            }
          ],
          summary: {
            total: 1,
            bySeverity: { high: 1 },
            byCategory: { fraud: 1 }
          },
          metadata: NodeTestFramework.createTestMetadata()
        };
        
        const inputEvidence: Evidence = {
          type: 'Evidence',
          items: [
            {
              id: 'E001',
              type: 'data',
              title: 'Transaction Data',
              content: { transaction_id: 'T001', amount: 10000 },
              source: 'BankFlowInputNode',
              collectedBy: 'TestNode',
              collectedAt: new Date(),
              relatedRisks: ['R001'],
              attachments: [],
              verified: true
            }
          ],
          traceId: 'trace-001',
          workflow: {
            graphId: 'graph-001',
            version: '1.0.0',
            nodes: [],
            connections: [],
            timestamp: new Date()
          },
          chain: [],
          metadata: NodeTestFramework.createTestMetadata()
        };
        
        const config = {
          template: 'standard',
          format: 'markdown',
          include_summary: true,
          include_evidence: true
        };
        
        const result = await node.execute(
          { risks: inputRisks, evidence: inputEvidence },
          config,
          context
        );
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const draft = result.outputs.draft as DraftPage;
        
        // 验证包含证据部分
        const hasEvidenceSection = draft.sections?.some((s: any) =>
          s.title && s.title.toLowerCase().includes('evidence')
        );
        
        if (!hasEvidenceSection) {
          throw new Error('Should include evidence section');
        }
      }
    },
    
    {
      name: 'should generate table format',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRisks: RiskSet = {
          type: 'RiskSet',
          risks: [
            {
              id: 'R001',
              category: 'compliance',
              description: 'Compliance risk',
              severity: 'medium',
              score: 60,
              evidence: [],
              relatedData: {},
              suggestedActions: [],
              detectedBy: 'TestNode',
              detectedAt: new Date()
            }
          ],
          summary: {
            total: 1,
            bySeverity: { medium: 1 },
            byCategory: { compliance: 1 }
          },
          metadata: NodeTestFramework.createTestMetadata()
        };
        
        const config = {
          template: 'table',
          format: 'markdown',
          include_summary: false
        };
        
        const result = await node.execute({ risks: inputRisks }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const draft = result.outputs.draft as DraftPage;
        
        // 验证表格格式
        const hasTableSection = draft.sections?.some((s: any) =>
          s.type === 'table' || 
          (s.content && typeof s.content === 'string' && s.content.includes('|'))
        );
        
        if (!hasTableSection) {
          throw new Error('Should include table format content');
        }
      }
    },
    
    {
      name: 'should handle empty risks',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRisks: RiskSet = {
          type: 'RiskSet',
          risks: [],
          summary: {
            total: 0,
            bySeverity: {},
            byCategory: {}
          },
          metadata: NodeTestFramework.createTestMetadata()
        };
        
        const config = {
          template: 'standard',
          format: 'markdown',
          include_summary: true
        };
        
        const result = await node.execute({ risks: inputRisks }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const draft = result.outputs.draft as DraftPage;
        
        // 应该仍然生成底稿，只是内容为空或提示无风险
        if (!draft || draft.type !== 'DraftPage') {
          throw new Error('Should still generate DraftPage for empty risks');
        }
      }
    }
  ]);
}

// 如果直接运行此文件
if (require.main === module) {
  testWorkpaperGeneratorNode().then(() => {
    console.log('✅ WorkpaperGeneratorNode tests completed');
  }).catch(err => {
    console.error('❌ Tests failed:', err);
    process.exit(1);
  });
}
