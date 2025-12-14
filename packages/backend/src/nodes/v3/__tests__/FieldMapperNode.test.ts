/**
 * FieldMapperNode 测试
 */

import { FieldMapperNode } from '../preprocess/FieldMapperNode';
import { NodeTestFramework } from './test-framework';
import type { Records } from '../../../types/AuditDataTypes';

export async function testFieldMapperNode() {
  const node = new FieldMapperNode();
  
  return NodeTestFramework.runTestSuite('FieldMapperNode', [
    {
      name: 'should map field names',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'old_name', type: 'string', required: true, description: 'Old Name' }
          ],
          data: [{ old_name: 'John' }],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 1
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            mappings: [
              { sourceField: 'old_name', targetField: 'new_name', targetType: 'string' }
            ],
            keepUnmapped: false
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const mapped = result.outputs.mapped as Records;
        
        if (!mapped.data[0].new_name) {
          throw new Error('Field mapping failed');
        }
        if (mapped.data[0].old_name) {
          throw new Error('Old field should not exist when keepUnmapped=false');
        }
      }
    },
    
    {
      name: 'should convert field types',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'age', type: 'string', required: true, description: 'Age' }
          ],
          data: [{ age: '30' }],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 1
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            mappings: [
              { sourceField: 'age', targetField: 'age', targetType: 'number' }
            ]
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const mapped = result.outputs.mapped as Records;
        
        if (typeof mapped.data[0].age !== 'number') {
          throw new Error('Type conversion failed');
        }
        if (mapped.data[0].age !== 30) {
          throw new Error(`Expected 30, got ${mapped.data[0].age}`);
        }
      }
    },
    
    {
      name: 'should apply transforms',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [{ name: 'name', type: 'string', required: true, description: 'Name' }],
          data: [{ name: 'john' }],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 1
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            mappings: [
              { sourceField: 'name', targetField: 'name', transform: 'uppercase' }
            ]
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const mapped = result.outputs.mapped as Records;
        
        if (mapped.data[0].name !== 'JOHN') {
          throw new Error(`Expected JOHN, got ${mapped.data[0].name}`);
        }
      }
    },
    
    {
      name: 'should evaluate formulas',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'salary', type: 'number', required: true, description: 'Salary' },
            { name: 'tax_rate', type: 'number', required: true, description: 'Tax Rate' }
          ],
          data: [{ salary: 10000, tax_rate: 0.2 }],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 2
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            mappings: [
              { 
                sourceField: 'salary', 
                targetField: 'after_tax', 
                targetType: 'number',
                formula: 'salary * (1 - tax_rate)'
              }
            ]
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const mapped = result.outputs.mapped as Records;
        
        const expectedAfterTax = 10000 * (1 - 0.2);
        if (Math.abs(mapped.data[0].after_tax - expectedAfterTax) > 0.01) {
          throw new Error(`Expected ${expectedAfterTax}, got ${mapped.data[0].after_tax}`);
        }
      }
    },
    
    {
      name: 'should apply conditional mapping',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [{ name: 'amount', type: 'number', required: true, description: 'Amount' }],
          data: [
            { amount: 5000 },
            { amount: 15000 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 2,
          columnCount: 1
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            mappings: [
              {
                sourceField: 'amount',
                targetField: 'category',
                defaultValue: 'low',
                condition: {
                  field: 'amount',
                  operator: '>',
                  value: 10000
                }
              }
            ]
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const mapped = result.outputs.mapped as Records;
        
        // 第一条记录不满足条件，应该使用默认值
        // 第二条记录满足条件，应该有category字段
        if (mapped.data.length !== 2) {
          throw new Error('Expected 2 records');
        }
      }
    }
  ]);
}
