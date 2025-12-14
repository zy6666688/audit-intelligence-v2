/**
 * NormalizeDataNode 测试
 */

import { NormalizeDataNode } from '../preprocess/NormalizeDataNode';
import { NodeTestFramework } from './test-framework';
import type { Records } from '../../../types/AuditDataTypes';

export async function testNormalizeDataNode() {
  const node = new NormalizeDataNode();
  
  return NodeTestFramework.runTestSuite('NormalizeDataNode', [
    {
      name: 'should normalize date formats',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'date', type: 'string', required: true, description: 'Date' }
          ],
          data: [
            { date: '2025/01/01' },
            { date: '01-01-2025' },
            { date: '2025年1月1日' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 1
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            dateFormat: 'YYYY-MM-DD',
            trimStrings: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const normalized = result.outputs.normalized as Records;
        
        // 所有日期应该统一为YYYY-MM-DD格式
        for (const row of normalized.data) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
            throw new Error(`Invalid date format: ${row.date}`);
          }
        }
      }
    },
    
    {
      name: 'should convert amount units',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'amount', type: 'string', required: true, description: 'Amount' }
          ],
          data: [
            { amount: '10万元' },
            { amount: '1亿元' },
            { amount: '5000元' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 1
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            amountUnit: 'yuan'  // 转换为元
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const normalized = result.outputs.normalized as Records;
        
        // 验证转换结果
        if (normalized.data[0].amount !== 100000) {
          throw new Error(`Expected 100000, got ${normalized.data[0].amount}`);
        }
        if (normalized.data[1].amount !== 100000000) {
          throw new Error(`Expected 100000000, got ${normalized.data[1].amount}`);
        }
      }
    },
    
    {
      name: 'should trim strings',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'name', type: 'string', required: true, description: 'Name' }
          ],
          data: [
            { name: '  John  ' },
            { name: 'Jane\t' },
            { name: '\nBob' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 1
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            trimStrings: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const normalized = result.outputs.normalized as Records;
        
        // 所有字符串应该去除空格
        for (const row of normalized.data) {
          if (row.name !== row.name.trim()) {
            throw new Error(`String not trimmed: "${row.name}"`);
          }
        }
      }
    },
    
    {
      name: 'should remove empty rows',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'data', type: 'string', required: true, description: 'Data' }
          ],
          data: [
            { data: 'valid' },
            { data: '' },        // 空值
            { data: '  ' },      // 只有空格
            { data: 'valid2' },
            { data: null }       // null
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 5,
          columnCount: 1
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            removeEmptyRows: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const normalized = result.outputs.normalized as Records;
        const report = result.outputs.report as Records;
        
        // 应该只剩2行有效数据
        if (normalized.rowCount !== 2) {
          throw new Error(`Expected 2 rows, got ${normalized.rowCount}`);
        }
        
        // 验证报告
        const emptyRowsRemoved = report.data.find((r: any) => r.metric === 'emptyRowsRemoved');
        if (!emptyRowsRemoved || emptyRowsRemoved.value !== 3) {
          throw new Error('Report should show 3 empty rows removed');
        }
      }
    },
    
    {
      name: 'should fill null values',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'name', type: 'string', required: true, description: 'Name' },
            { name: 'amount', type: 'number', required: true, description: 'Amount' }
          ],
          data: [
            { name: 'John', amount: null },
            { name: null, amount: 1000 }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 2,
          columnCount: 2
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            fillNullValues: true,
            removeEmptyRows: false
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const normalized = result.outputs.normalized as Records;
        
        // null值应该被填充
        for (const row of normalized.data) {
          if (row.amount === null || row.amount === undefined) {
            throw new Error('Amount should be filled');
          }
          if (row.name === null || row.name === undefined) {
            throw new Error('Name should be filled');
          }
        }
      }
    },
    
    {
      name: 'should generate normalization report',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'date', type: 'string', required: true, description: 'Date' },
            { name: 'amount', type: 'string', required: true, description: 'Amount' },
            { name: 'name', type: 'string', required: true, description: 'Name' }
          ],
          data: [
            { date: '2025/01/01', amount: '10000元', name: '  John  ' },
            { date: '', amount: '', name: '' }  // 空行
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 2,
          columnCount: 3
        };
        
        const result = await node.execute(
          { records: inputRecords },
          {
            dateFormat: 'YYYY-MM-DD',
            amountUnit: 'yuan',
            trimStrings: true,
            removeEmptyRows: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const report = result.outputs.report as Records;
        
        // 验证报告包含所有指标
        const metrics = report.data.map((r: any) => r.metric);
        const requiredMetrics = [
          'originalRows',
          'emptyRowsRemoved',
          'nullValuesFilled',
          'datesFormatted',
          'amountsConverted',
          'stringsNormalized'
        ];
        
        for (const metric of requiredMetrics) {
          if (!metrics.includes(metric)) {
            throw new Error(`Missing metric: ${metric}`);
          }
        }
      }
    }
  ]);
}
