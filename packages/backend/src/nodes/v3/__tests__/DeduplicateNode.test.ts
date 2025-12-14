/**
 * DeduplicateNode 测试
 */

import { DeduplicateNode } from '../preprocess/DeduplicateNode';
import { NodeTestFramework } from './test-framework';
import type { Records } from '../../../types/AuditDataTypes';

export async function testDeduplicateNode() {
  const node = new DeduplicateNode();
  
  return NodeTestFramework.runTestSuite('DeduplicateNode', [
    {
      name: 'should deduplicate exact matches',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [{ name: 'email', type: 'string', required: true, description: 'Email' }],
          data: [
            { email: 'john@example.com' },
            { email: 'john@example.com' },  // 重复
            { email: 'jane@example.com' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 1
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            method: 'exact',
            keepStrategy: 'first'
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const unique = result.outputs.unique as Records;
        const duplicates = result.outputs.duplicates as Records;
        
        if (unique.rowCount !== 2) {
          throw new Error(`Expected 2 unique records, got ${unique.rowCount}`);
        }
        if (duplicates.rowCount !== 1) {
          throw new Error(`Expected 1 duplicate, got ${duplicates.rowCount}`);
        }
      }
    },
    
    {
      name: 'should deduplicate by specific fields',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'id', type: 'string', required: true, description: 'ID' },
            { name: 'email', type: 'string', required: true, description: 'Email' }
          ],
          data: [
            { id: '1', email: 'john@example.com' },
            { id: '2', email: 'john@example.com' },  // 邮箱重复但ID不同
            { id: '3', email: 'jane@example.com' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 2
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            method: 'exact',
            fields: ['email'],  // 只基于email去重
            keepStrategy: 'first'
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const unique = result.outputs.unique as Records;
        
        if (unique.rowCount !== 2) {
          throw new Error(`Expected 2 unique records, got ${unique.rowCount}`);
        }
      }
    },
    
    {
      name: 'should handle fuzzy deduplication',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [{ name: 'name', type: 'string', required: true, description: 'Name' }],
          data: [
            { name: 'John Smith' },
            { name: 'John  Smith' },  // 多余空格
            { name: 'john smith' },   // 大小写不同
            { name: 'Jane Doe' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 4,
          columnCount: 1
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            method: 'fuzzy',
            fuzzyThreshold: 0.9,
            caseSensitive: false,
            ignoreWhitespace: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const unique = result.outputs.unique as Records;
        
        // 前三条应该被识别为重复
        if (unique.rowCount !== 2) {
          throw new Error(`Expected 2 unique records after fuzzy matching, got ${unique.rowCount}`);
        }
      }
    },
    
    {
      name: 'should use hash deduplication',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'field1', type: 'string', required: true, description: 'Field 1' },
            { name: 'field2', type: 'string', required: true, description: 'Field 2' }
          ],
          data: [
            { field1: 'a', field2: 'b' },
            { field1: 'a', field2: 'b' },  // 完全相同
            { field1: 'c', field2: 'd' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 2
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            method: 'hash',
            keepStrategy: 'first'
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const unique = result.outputs.unique as Records;
        
        if (unique.rowCount !== 2) {
          throw new Error(`Expected 2 unique records, got ${unique.rowCount}`);
        }
      }
    },
    
    {
      name: 'should apply different keep strategies',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'id', type: 'string', required: true, description: 'ID' },
            { name: 'value', type: 'number', required: true, description: 'Value' }
          ],
          data: [
            { id: 'A', value: 1 },
            { id: 'A', value: 2 },  // 重复ID但值不同
            { id: 'B', value: 3 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 2
        };
        
        // 测试保留最后一个
        const resultLast = await node.execute(
          { records: inputRecords },
          {
            method: 'exact',
            fields: ['id'],
            keepStrategy: 'last'
          },
          context
        );

        NodeTestFramework.assertSuccess(resultLast);
        const uniqueLast = resultLast.outputs.unique as Records;
        
        // 对于ID=A，应该保留value=2的记录
        const recordA = uniqueLast.data.find((r: any) => r.id === 'A');
        if (!recordA || recordA.value !== 2) {
          throw new Error('Last strategy failed: should keep value=2');
        }
      }
    },
    
    {
      name: 'should generate deduplication report',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [{ name: 'data', type: 'string', required: true, description: 'Data' }],
          data: [
            { data: 'A' },
            { data: 'A' },
            { data: 'B' },
            { data: 'B' },
            { data: 'C' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 5,
          columnCount: 1
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            method: 'exact',
            keepStrategy: 'first'
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const report = result.outputs.report as Records;
        
        // 验证报告包含关键指标
        const metrics = report.data.map((r: any) => r.metric);
        if (!metrics.includes('original_count')) {
          throw new Error('Report missing original_count');
        }
        if (!metrics.includes('unique_count')) {
          throw new Error('Report missing unique_count');
        }
        if (!metrics.includes('duplicate_count')) {
          throw new Error('Report missing duplicate_count');
        }
      }
    }
  ]);
}
