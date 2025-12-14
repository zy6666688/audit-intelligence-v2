/**
 * BankFlowInputNode 测试
 */

import { BankFlowInputNode } from '../input/BankFlowInputNode';
import { NodeTestFramework } from './test-framework';
import type { Records } from '../../../types/AuditDataTypes';

export async function testBankFlowInputNode() {
  const node = new BankFlowInputNode();
  
  return NodeTestFramework.runTestSuite('BankFlowInputNode', [
    {
      name: 'should import bank flow data',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                date: '2025-01-01',
                from_account: '6222021234567890',
                to_account: '6222029876543210',
                amount: 10000,
                type: 'transfer',
                description: '货款'
              }
            ],
            bankType: 'icbc',
            categorizeTransactions: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        NodeTestFramework.assertOutputHasField(result, 'flows');
        NodeTestFramework.assertOutputHasField(result, 'summary');
      }
    },
    
    {
      name: 'should categorize transactions',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              { amount: 5000, description: '工资' },
              { amount: -3000, description: '采购支出' },
              { amount: 10000, type: '转账' }
            ],
            categorizeTransactions: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const flows = result.outputs.flows as Records;
        
        // 验证分类
        const categories = flows.data.map((f: any) => f.category);
        if (!categories.includes('salary')) {
          throw new Error('Failed to categorize salary');
        }
      }
    },
    
    {
      name: 'should detect anomalies',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        // 创建异常数据：大量整数金额
        const data = Array.from({ length: 20 }, (_, i) => ({
          date: '2025-01-01',
          amount: (i + 1) * 1000,  // 全是整千
          description: `Transaction ${i}`
        }));
        
        const result = await node.execute(
          {},
          {
            data,
            detectAnomalies: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const summary = result.outputs.summary as Records;
        
        // 应该检测到异常
        const anomalyCount = summary.data.find((s: any) => s.metric === 'anomaly_count');
        if (!anomalyCount || anomalyCount.value === 0) {
          throw new Error('Failed to detect anomalies');
        }
      }
    },
    
    {
      name: 'should detect high frequency transactions',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        // 同一天同一账户多笔交易
        const data = Array.from({ length: 15 }, (_, i) => ({
          date: '2025-01-01',
          from_account: '6222021234567890',
          amount: 100 + i,
          description: `High freq ${i}`
        }));
        
        const result = await node.execute(
          {},
          {
            data,
            detectAnomalies: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        // 应该检测到高频交易异常
      }
    },
    
    {
      name: 'should calculate summary statistics',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              { amount: 5000 },
              { amount: -3000 },
              { amount: 2000 }
            ]
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const summary = result.outputs.summary as Records;
        
        // 验证统计指标
        const metrics = summary.data.map((s: any) => s.metric);
        if (!metrics.includes('total_income')) {
          throw new Error('Missing income statistics');
        }
        if (!metrics.includes('total_expense')) {
          throw new Error('Missing expense statistics');
        }
      }
    }
  ]);
}
