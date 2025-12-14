/**
 * AIFraudScorerNode 测试
 * 测试AI舞弊评分功能
 */

import { AIFraudScorerNode } from '../ai/AIFraudScorerNode';
import { NodeTestFramework } from './test-framework';
import type { Records, RiskSet, RiskItem } from '../../../types/AuditDataTypes';

export async function testAIFraudScorerNode() {
  const node = new AIFraudScorerNode();
  
  return NodeTestFramework.runTestSuite('AIFraudScorerNode', [
    {
      name: 'should score records with AI analysis',
      fn: async () => {
        const context = NodeTestFramework.createTestContext({
          ai: {
            analyze: async (data: any) => {
              return {
                fraudScore: 0.75,
                confidence: 0.9,
                reasons: ['Unusual transaction pattern', 'High amount']
              };
            },
            chat: async () => '',
            ocr: async () => '',
            embedding: async () => []
          } as any
        });
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'transaction_id', type: 'string', required: true, description: 'ID' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' },
            { name: 'description', type: 'string', required: true, description: 'Description' }
          ],
          data: [
            { transaction_id: 'T001', amount: 100000, description: 'Suspicious transfer' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 3
        };
        
        const config = {
          score_threshold: 0.5,
          confidence_threshold: 0.7,
          batch_size: 10
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        
        if (risks.risks.length === 0) {
          throw new Error('Should generate fraud risk for high score');
        }
        
        const fraudRisk = risks.risks[0];
        if (fraudRisk.category !== 'ai_fraud') {
          throw new Error('Risk category should be ai_fraud');
        }
        
        if (!fraudRisk.relatedData || !fraudRisk.relatedData.fraud_score) {
          throw new Error('Should include fraud score in relatedData');
        }
      }
    },
    
    {
      name: 'should filter by score threshold',
      fn: async () => {
        const context = NodeTestFramework.createTestContext({
          ai: {
            analyze: async () => ({
              fraudScore: 0.3,  // 低分数
              confidence: 0.9,
              reasons: []
            }),
            chat: async () => '',
            ocr: async () => '',
            embedding: async () => []
          } as any
        });
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'transaction_id', type: 'string', required: true, description: 'ID' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' }
          ],
          data: [
            { transaction_id: 'T001', amount: 5000 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 2
        };
        
        const config = {
          score_threshold: 0.5,  // 阈值高于分数
          confidence_threshold: 0.7,
          batch_size: 10
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        
        // 低分数应该被过滤
        if (risks.risks.length > 0) {
          throw new Error('Low score should be filtered by threshold');
        }
      }
    },
    
    {
      name: 'should filter by confidence threshold',
      fn: async () => {
        const context = NodeTestFramework.createTestContext({
          ai: {
            analyze: async () => ({
              fraudScore: 0.8,
              confidence: 0.5,  // 低置信度
              reasons: ['Uncertain pattern']
            }),
            chat: async () => '',
            ocr: async () => '',
            embedding: async () => []
          } as any
        });
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'transaction_id', type: 'string', required: true, description: 'ID' }
          ],
          data: [
            { transaction_id: 'T001' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 1
        };
        
        const config = {
          score_threshold: 0.5,
          confidence_threshold: 0.7,  // 阈值高于置信度
          batch_size: 10
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        
        // 低置信度应该被过滤
        if (risks.risks.length > 0) {
          throw new Error('Low confidence should be filtered');
        }
      }
    },
    
    {
      name: 'should process batch records',
      fn: async () => {
        let analyzeCallCount = 0;
        
        const context = NodeTestFramework.createTestContext({
          ai: {
            analyze: async () => {
              analyzeCallCount++;
              return {
                fraudScore: 0.6,
                confidence: 0.8,
                reasons: ['Test']
              };
            },
            chat: async () => '',
            ocr: async () => '',
            embedding: async () => []
          } as any
        });
        
        // 创建15条记录，batch_size=5，应该分3批处理
        const data = Array.from({ length: 15 }, (_, i) => ({
          transaction_id: `T${String(i + 1).padStart(3, '0')}`,
          amount: 1000
        }));
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'transaction_id', type: 'string', required: true, description: 'ID' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' }
          ],
          data,
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 15,
          columnCount: 2
        };
        
        const config = {
          score_threshold: 0.5,
          confidence_threshold: 0.7,
          batch_size: 5
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        // 验证批处理调用次数
        if (analyzeCallCount < 3) {
          throw new Error(`Expected at least 3 batch calls, got ${analyzeCallCount}`);
        }
        
        const risks = result.outputs.risks as RiskSet;
        
        // 应该生成风险（分数0.6 > 阈值0.5）
        if (risks.risks.length === 0) {
          throw new Error('Should generate risks for qualifying records');
        }
      }
    },
    
    {
      name: 'should include AI reasons in risk details',
      fn: async () => {
        const testReasons = [
          'Unusual transaction time',
          'High amount compared to history',
          'Suspicious counterparty'
        ];
        
        const context = NodeTestFramework.createTestContext({
          ai: {
            analyze: async () => ({
              fraudScore: 0.85,
              confidence: 0.92,
              reasons: testReasons
            }),
            chat: async () => '',
            ocr: async () => '',
            embedding: async () => []
          } as any
        });
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'transaction_id', type: 'string', required: true, description: 'ID' }
          ],
          data: [
            { transaction_id: 'T001' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 1
        };
        
        const config = {
          score_threshold: 0.5,
          confidence_threshold: 0.7,
          batch_size: 10
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        const fraudRisk = risks.risks[0];
        
        // 验证原因包含在relatedData中
        if (!fraudRisk.relatedData || !fraudRisk.relatedData.ai_reasons) {
          throw new Error('Should include AI reasons in relatedData');
        }
        
        const reasons = fraudRisk.relatedData.ai_reasons as string[];
        if (reasons.length !== testReasons.length) {
          throw new Error('Should include all AI reasons');
        }
      }
    },
    
    {
      name: 'should generate summary statistics',
      fn: async () => {
        const context = NodeTestFramework.createTestContext({
          ai: {
            analyze: async () => ({
              fraudScore: Math.random() * 0.5 + 0.5,  // 0.5-1.0
              confidence: 0.9,
              reasons: ['Test']
            }),
            chat: async () => '',
            ocr: async () => '',
            embedding: async () => []
          } as any
        });
        
        const data = Array.from({ length: 10 }, (_, i) => ({
          transaction_id: `T${String(i + 1).padStart(3, '0')}`
        }));
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'transaction_id', type: 'string', required: true, description: 'ID' }
          ],
          data,
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 10,
          columnCount: 1
        };
        
        const config = {
          score_threshold: 0.5,
          confidence_threshold: 0.7,
          batch_size: 5
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        
        // 验证元数据包含统计信息
        if (!risks.metadata || !risks.summary) {
          throw new Error('Should include summary statistics');
        }
        
        const summary = risks.summary as any;
        if (typeof summary.total_analyzed !== 'number' || 
            typeof summary.high_risk_count !== 'number') {
          throw new Error('Summary should include analysis statistics');
        }
      }
    }
  ]);
}

// 如果直接运行此文件
if (require.main === module) {
  testAIFraudScorerNode().then(() => {
    console.log('✅ AIFraudScorerNode tests completed');
  }).catch(err => {
    console.error('❌ Tests failed:', err);
    process.exit(1);
  });
}
