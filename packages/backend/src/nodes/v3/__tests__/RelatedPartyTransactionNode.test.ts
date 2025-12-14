/**
 * RelatedPartyTransactionNode 测试
 * 测试关联方交易检测功能
 */

import { RelatedPartyTransactionNode } from '../audit/RelatedPartyTransactionNode';
import { NodeTestFramework } from './test-framework';
import type { Records, RiskSet } from '../../../types/AuditDataTypes';

export async function testRelatedPartyTransactionNode() {
  const node = new RelatedPartyTransactionNode();
  
  return NodeTestFramework.runTestSuite('RelatedPartyTransactionNode', [
    
    // Test 1: 基础功能测试
    {
      name: 'should detect basic related party transactions',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const transactions: Records = {
          type: 'Records',
          schema: [
            { name: 'id', type: 'string', required: true, description: 'ID' },
            { name: 'date', type: 'string', required: true, description: 'Date' },
            { name: 'counterparty', type: 'string', required: true, description: 'Counterparty' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' }
          ],
          data: [
            { id: 'T001', date: '2024-01-15', counterparty: '关联公司A', amount: 500000 },
            { id: 'T002', date: '2024-02-20', counterparty: '关联公司A', amount: 800000 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 2,
          columnCount: 4
        };

        const relatedParties: Records = {
          type: 'Records',
          schema: [
            { name: 'name', type: 'string', required: true, description: 'Name' }
          ],
          data: [
            { name: '关联公司A', type: 'subsidiary' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 1
        };

        const result = await node.execute(
          { transactions, related_parties: relatedParties },
          { relatedPartySource: 'input', minRiskScore: 0 },
          context
        );

        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        if (risks.type !== 'RiskSet') {
          throw new Error('Should return RiskSet');
        }
      }
    },
    
    // Test 2: 大额交易检测
    {
      name: 'should detect large amount transactions',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const transactions: Records = {
          type: 'Records',
          schema: [
            { name: 'id', type: 'string', required: true, description: 'ID' },
            { name: 'counterparty', type: 'string', required: true, description: 'Counterparty' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' },
            { name: 'date', type: 'string', required: true, description: 'Date' }
          ],
          data: [
            { id: 'T001', counterparty: '关联方A', amount: 5000000, date: '2024-01-01' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 4
        };

        const relatedParties: Records = {
          type: 'Records',
          schema: [
            { name: 'name', type: 'string', required: true, description: 'Name' }
          ],
          data: [
            { name: '关联方A', type: 'associate' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 1
        };

        const result = await node.execute(
          { transactions, related_parties: relatedParties },
          { amountThreshold: 1000000, minRiskScore: 0 },
          context
        );

        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        if (risks.risks.length === 0) {
          throw new Error('Should detect large amount risk');
        }
      }
    },
    
    // Test 3: 空数据处理
    {
      name: 'should handle empty transactions',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const transactions: Records = {
          type: 'Records',
          schema: [
            { name: 'id', type: 'string', required: true, description: 'ID' }
          ],
          data: [],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 0,
          columnCount: 1
        };

        const result = await node.execute(
          { transactions },
          {},
          context
        );

        if (!result.success) {
          throw new Error('Should handle empty data gracefully');
        }
        
        const risks = result.outputs.risks as RiskSet;
        if (risks.risks.length !== 0) {
          throw new Error('Should return empty risks for empty data');
        }
      }
    }
    
  ]);
}
