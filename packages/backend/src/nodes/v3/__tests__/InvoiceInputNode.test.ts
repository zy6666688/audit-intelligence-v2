/**
 * InvoiceInputNode 测试
 */

import { InvoiceInputNode } from '../input/InvoiceInputNode';
import { NodeTestFramework } from './test-framework';
import type { Records } from '../../../types/AuditDataTypes';

export async function testInvoiceInputNode() {
  const node = new InvoiceInputNode();
  
  return NodeTestFramework.runTestSuite('InvoiceInputNode', [
    {
      name: 'should import valid invoice data',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                invoice_no: '12345678',
                invoice_code: '1100192130',
                date: '2025-01-01',
                seller: '某某公司',
                buyer: '采购方公司',
                amount: 10000,
                tax_rate: 0.13,
                tax: 1300,
                total: 11300
              }
            ],
            validateFormat: true,
            verifyTax: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        NodeTestFramework.assertOutputHasField(result, 'invoices');
        NodeTestFramework.assertOutputHasField(result, 'validation');
        
        const invoices = result.outputs.invoices as Records;
        if (invoices.rowCount !== 1) {
          throw new Error(`Expected 1 invoice, got ${invoices.rowCount}`);
        }
      }
    },
    
    {
      name: 'should validate invoice format',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                invoice_no: '123',  // 错误格式（应该是8位）
                invoice_code: '110019',  // 错误格式
                amount: 10000
              }
            ],
            validateFormat: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const validation = result.outputs.validation as Records;
        
        // 应该检测到格式错误
        const invalidCount = validation.data.filter((v: any) => v.status === 'invalid').length;
        if (invalidCount === 0) {
          throw new Error('Failed to detect format errors');
        }
      }
    },
    
    {
      name: 'should verify tax calculation',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                invoice_no: '12345678',
                amount: 10000,
                tax_rate: 0.13,
                tax: 1500,  // 错误：应该是1300
                total: 11500
              }
            ],
            verifyTax: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const validation = result.outputs.validation as Records;
        
        // 应该检测到税额计算错误
        const hasTaxError = validation.data.some((v: any) => 
          v.issues && v.issues.includes('Tax calculation error')
        );
        
        if (!hasTaxError) {
          throw new Error('Failed to detect tax calculation error');
        }
      }
    },
    
    {
      name: 'should detect duplicate invoices',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              { invoice_no: '12345678', amount: 10000 },
              { invoice_no: '12345678', amount: 10000 },  // 重复
              { invoice_no: '87654321', amount: 5000 }
            ],
            detectDuplicates: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const validation = result.outputs.validation as Records;
        
        // 应该检测到重复发票
        const duplicateCount = validation.data.filter((v: any) => 
          v.issues && v.issues.includes('Duplicate')
        ).length;
        
        if (duplicateCount === 0) {
          throw new Error('Failed to detect duplicate invoice');
        }
      }
    },
    
    {
      name: 'should handle batch import',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        // 生成50条发票
        const data = Array.from({ length: 50 }, (_, i) => ({
          invoice_no: String(12345678 + i),
          date: '2025-01-01',
          amount: 1000 * (i + 1),
          tax_rate: 0.13,
          tax: 130 * (i + 1),
          total: 1130 * (i + 1)
        }));
        
        const result = await node.execute(
          {},
          { data, verifyTax: true },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const invoices = result.outputs.invoices as Records;
        
        if (invoices.rowCount !== 50) {
          throw new Error(`Expected 50 invoices, got ${invoices.rowCount}`);
        }
      }
    }
  ]);
}
