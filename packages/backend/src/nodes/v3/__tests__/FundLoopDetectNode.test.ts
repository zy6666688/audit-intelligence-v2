/**
 * FundLoopDetectNode 测试
 * 测试资金循环检测功能
 */

import { FundLoopDetectNode } from '../audit/FundLoopDetectNode';
import { NodeTestFramework } from './test-framework';
import type { Records, RiskSet, RiskItem } from '../../../types/AuditDataTypes';

export async function testFundLoopDetectNode() {
  const node = new FundLoopDetectNode();
  
  return NodeTestFramework.runTestSuite('FundLoopDetectNode', [
    {
      name: 'should detect simple circular fund flow',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        // 简单循环: A -> B -> C -> A
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'transaction_id', type: 'string', required: true, description: 'Transaction ID' },
            { name: 'from_account', type: 'string', required: true, description: 'From Account' },
            { name: 'to_account', type: 'string', required: true, description: 'To Account' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' },
            { name: 'date', type: 'string', required: true, description: 'Date' }
          ],
          data: [
            { transaction_id: 'T001', from_account: 'A', to_account: 'B', amount: 10000, date: '2024-01-01' },
            { transaction_id: 'T002', from_account: 'B', to_account: 'C', amount: 9500, date: '2024-01-02' },
            { transaction_id: 'T003', from_account: 'C', to_account: 'A', amount: 9000, date: '2024-01-03' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 5
        };
        
        const config = {
          min_loop_length: 2,
          max_loop_length: 10,
          min_total_amount: 1000,
          time_window_days: 30
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        
        if (risks.risks.length === 0) {
          throw new Error('Should detect at least one fund loop');
        }
        
        // 验证检测到循环
        const hasLoopRisk = risks.risks.some((r: RiskItem) => 
          r.category === 'fund_loop' && r.severity === 'high'
        );
        
        if (!hasLoopRisk) {
          throw new Error('Should detect fund loop risk');
        }
      }
    },
    
    {
      name: 'should detect minimum circular fund flow',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        // 最小循环: A -> B -> A
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'from_account', type: 'string', required: true, description: 'From' },
            { name: 'to_account', type: 'string', required: true, description: 'To' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' }
          ],
          data: [
            { from_account: 'A', to_account: 'B', amount: 5000 },
            { from_account: 'B', to_account: 'A', amount: 4800 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 2,
          columnCount: 3
        };
        
        const config = {
          min_loop_length: 2,
          max_loop_length: 10,
          min_total_amount: 1000
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        
        if (risks.risks.length === 0) {
          throw new Error('Should detect minimum loop (2 nodes)');
        }
      }
    },
    
    {
      name: 'should detect multi-level circular flow',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        // 多层循环: A -> B -> C -> D -> E -> A
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'from_account', type: 'string', required: true, description: 'From' },
            { name: 'to_account', type: 'string', required: true, description: 'To' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' }
          ],
          data: [
            { from_account: 'A', to_account: 'B', amount: 100000 },
            { from_account: 'B', to_account: 'C', amount: 95000 },
            { from_account: 'C', to_account: 'D', amount: 90000 },
            { from_account: 'D', to_account: 'E', amount: 85000 },
            { from_account: 'E', to_account: 'A', amount: 80000 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 5,
          columnCount: 3
        };
        
        const config = {
          min_loop_length: 2,
          max_loop_length: 10,
          min_total_amount: 10000
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        
        if (risks.risks.length === 0) {
          throw new Error('Should detect multi-level loop (5 nodes)');
        }
        
        // 验证循环路径长度
        const loopRisk = risks.risks.find((r: RiskItem) => r.category === 'fund_loop');
        if (loopRisk && loopRisk.relatedData) {
          const path = loopRisk.relatedData.loop_path;
          if (path && path.length !== 5) {
            throw new Error(`Expected loop length 5, got ${path.length}`);
          }
        }
      }
    },
    
    {
      name: 'should filter by minimum amount threshold',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        // 小额循环，应该被过滤
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'from_account', type: 'string', required: true, description: 'From' },
            { name: 'to_account', type: 'string', required: true, description: 'To' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' }
          ],
          data: [
            { from_account: 'A', to_account: 'B', amount: 100 },
            { from_account: 'B', to_account: 'A', amount: 95 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 2,
          columnCount: 3
        };
        
        const config = {
          min_loop_length: 2,
          max_loop_length: 10,
          min_total_amount: 10000  // 阈值远大于循环金额
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        
        // 应该被过滤，没有风险
        if (risks.risks.length > 0) {
          throw new Error('Small amount loop should be filtered');
        }
      }
    },
    
    {
      name: 'should not detect non-circular flow',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        // 非循环流: A -> B -> C (没有回到A)
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'from_account', type: 'string', required: true, description: 'From' },
            { name: 'to_account', type: 'string', required: true, description: 'To' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' }
          ],
          data: [
            { from_account: 'A', to_account: 'B', amount: 10000 },
            { from_account: 'B', to_account: 'C', amount: 9500 },
            { from_account: 'C', to_account: 'D', amount: 9000 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 3
        };
        
        const config = {
          min_loop_length: 2,
          max_loop_length: 10,
          min_total_amount: 1000
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        
        // 非循环流，不应该检测到风险
        const hasLoopRisk = risks.risks.some((r: RiskItem) => r.category === 'fund_loop');
        if (hasLoopRisk) {
          throw new Error('Should not detect loop in non-circular flow');
        }
      }
    },
    
    {
      name: 'should track loop path correctly',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'transaction_id', type: 'string', required: true, description: 'ID' },
            { name: 'from_account', type: 'string', required: true, description: 'From' },
            { name: 'to_account', type: 'string', required: true, description: 'To' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' }
          ],
          data: [
            { transaction_id: 'T001', from_account: 'A', to_account: 'B', amount: 10000 },
            { transaction_id: 'T002', from_account: 'B', to_account: 'C', amount: 9500 },
            { transaction_id: 'T003', from_account: 'C', to_account: 'A', amount: 9000 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 4
        };
        
        const config = {
          min_loop_length: 2,
          max_loop_length: 10,
          min_total_amount: 1000
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        const loopRisk = risks.risks.find((r: RiskItem) => r.category === 'fund_loop');
        
        if (!loopRisk) {
          throw new Error('Should detect fund loop');
        }
        
        // 验证路径信息
        if (!loopRisk.relatedData || !loopRisk.relatedData.loop_path) {
          throw new Error('Loop risk should include path information');
        }
        
        // 验证路径包含正确的账户
        const path = loopRisk.relatedData.loop_path as string[];
        if (!path.includes('A') || !path.includes('B') || !path.includes('C')) {
          throw new Error('Loop path should include all accounts in the cycle');
        }
      }
    },
    
    {
      name: 'should calculate total loop amount',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'from_account', type: 'string', required: true, description: 'From' },
            { name: 'to_account', type: 'string', required: true, description: 'To' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' }
          ],
          data: [
            { from_account: 'A', to_account: 'B', amount: 10000 },
            { from_account: 'B', to_account: 'C', amount: 8000 },
            { from_account: 'C', to_account: 'A', amount: 6000 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 3
        };
        
        const config = {
          min_loop_length: 2,
          max_loop_length: 10,
          min_total_amount: 1000
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        const loopRisk = risks.risks.find((r: RiskItem) => r.category === 'fund_loop');
        
        if (!loopRisk || !loopRisk.relatedData) {
          throw new Error('Should detect loop with amount info');
        }
        
        // 验证总金额计算
        const totalAmount = loopRisk.relatedData.total_amount as number;
        if (totalAmount !== 24000) {  // 10000 + 8000 + 6000
          throw new Error(`Expected total amount 24000, got ${totalAmount}`);
        }
      }
    },
    
    {
      name: 'should generate summary report',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'from_account', type: 'string', required: true, description: 'From' },
            { name: 'to_account', type: 'string', required: true, description: 'To' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' }
          ],
          data: [
            { from_account: 'A', to_account: 'B', amount: 10000 },
            { from_account: 'B', to_account: 'A', amount: 9500 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 2,
          columnCount: 3
        };
        
        const config = {
          min_loop_length: 2,
          max_loop_length: 10,
          min_total_amount: 1000
        };
        
        const result = await node.execute({ records: inputRecords }, config, context);
        
        if (!result.success) {
          throw new Error('Execution failed');
        }
        
        const risks = result.outputs.risks as RiskSet;
        
        // 验证元数据包含汇总信息
        if (!risks.metadata || !risks.summary) {
          throw new Error('Should include summary in metadata');
        }
        
        const summary = risks.summary as any;
        if (!summary.total_loops || !summary.total_accounts || !summary.total_amount) {
          throw new Error('Summary should include loops, accounts, and amount statistics');
        }
      }
    }
  ]);
}

// 如果直接运行此文件
if (require.main === module) {
  testFundLoopDetectNode().then(() => {
    console.log('✅ FundLoopDetectNode tests completed');
  }).catch(err => {
    console.error('❌ Tests failed:', err);
    process.exit(1);
  });
}
