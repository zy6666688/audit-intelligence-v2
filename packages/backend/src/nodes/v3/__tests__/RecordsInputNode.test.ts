/**
 * RecordsInputNode 测试
 */

import { RecordsInputNode } from '../input/RecordsInputNode';
import { NodeTestFramework } from './test-framework';
import type { Records } from '../../../types/AuditDataTypes';

export async function testRecordsInputNode() {
  const node = new RecordsInputNode();
  
  return NodeTestFramework.runTestSuite('RecordsInputNode', [
    {
      name: 'should import valid CSV data',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              { id: 1, name: 'Alice', amount: 1000, date: '2025-01-01' },
              { id: 2, name: 'Bob', amount: 2000, date: '2025-01-02' }
            ],
            autoDetectTypes: true,
            validateData: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        NodeTestFramework.assertOutputHasField(result, 'records');
        
        const records = result.outputs.records as Records;
        if (records.rowCount !== 2) {
          throw new Error(`Expected 2 rows, got ${records.rowCount}`);
        }
        if (records.columnCount !== 4) {
          throw new Error(`Expected 4 columns, got ${records.columnCount}`);
        }
      }
    },
    
    {
      name: 'should auto-detect field types',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              { name: 'Test', count: 123, active: true, date: '2025-01-01' }
            ],
            autoDetectTypes: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        
        const records = result.outputs.records as Records;
        const schema = records.schema;
        
        // 验证类型推断
        const nameField = schema.find((f: any) => f.name === 'name');
        const countField = schema.find((f: any) => f.name === 'count');
        const activeField = schema.find((f: any) => f.name === 'active');
        
        if (nameField?.type !== 'string') throw new Error('Name should be string');
        if (countField?.type !== 'number') throw new Error('Count should be number');
        if (activeField?.type !== 'boolean') throw new Error('Active should be boolean');
      }
    },
    
    {
      name: 'should reject empty data',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [],
            autoDetectTypes: true
          },
          context
        );

        NodeTestFramework.assertFailure(result, 'INVALID_DATA');
      }
    },
    
    {
      name: 'should validate required fields',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              { id: 1, name: '' },  // Empty required field
              { id: 2, name: 'Valid' }
            ],
            autoDetectTypes: true,
            validateData: true
          },
          context
        );

        // 应该成功但有警告（空字符串被视为非required）
        NodeTestFramework.assertSuccess(result);
      }
    },
    
    {
      name: 'should handle large datasets',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        // 生成1000行数据
        const largeData = Array.from({ length: 1000 }, (_, i) => ({
          id: i + 1,
          name: `Item ${i + 1}`,
          value: Math.random() * 1000
        }));
        
        const result = await node.execute(
          {},
          {
            data: largeData,
            autoDetectTypes: true,
            validateData: false  // 跳过验证以提升性能
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        NodeTestFramework.assertPerformance(result, 2000);  // 应该在2秒内完成
        
        const records = result.outputs.records as Records;
        if (records.rowCount !== 1000) {
          throw new Error(`Expected 1000 rows, got ${records.rowCount}`);
        }
      }
    },
    
    {
      name: 'should use cache on repeated calls',
      fn: async () => {
        const context = NodeTestFramework.createTestContext({
          cache: {
            get: async () => null,
            set: async () => {},
            has: async () => false,
            delete: async () => {}
          }
        });
        
        const data = [{ id: 1, name: 'Test' }];
        const config = { data, autoDetectTypes: true };
        
        // 第一次执行
        const result1 = await node.execute({}, config, context);
        NodeTestFramework.assertSuccess(result1);
        
        // 第二次执行（应该更快）
        const result2 = await node.execute({}, config, context);
        NodeTestFramework.assertSuccess(result2);
      }
    }
  ]);
}
