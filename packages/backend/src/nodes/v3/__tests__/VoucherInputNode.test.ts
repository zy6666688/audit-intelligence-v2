/**
 * VoucherInputNode 测试
 */

import { VoucherInputNode } from '../input/VoucherInputNode';
import { NodeTestFramework } from './test-framework';
import type { Records } from '../../../types/AuditDataTypes';

export async function testVoucherInputNode() {
  const node = new VoucherInputNode();
  
  return NodeTestFramework.runTestSuite('VoucherInputNode', [
    {
      name: 'should import valid voucher data',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                voucher_no: 'V001',
                date: '2025-01-01',
                debit_account: '1001',
                credit_account: '2001',
                debit_amount: 10000,
                credit_amount: 10000,
                description: '销售收入',
                attachment_count: 1,
                approved_by: 'Manager'
              }
            ],
            source: 'csv',
            validateBalance: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        NodeTestFramework.assertOutputHasField(result, 'vouchers');
        
        const vouchers = result.outputs.vouchers as Records;
        if (vouchers.rowCount !== 1) {
          throw new Error(`Expected 1 voucher, got ${vouchers.rowCount}`);
        }
      }
    },
    
    {
      name: 'should detect unbalanced vouchers',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                voucher_no: 'V002',
                debit_amount: 10000,
                credit_amount: 9999,  // 不平衡
                description: 'Test'
              }
            ],
            validateBalance: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const validation = result.outputs.validation as Records;
        
        // 应该检测到不平衡
        const hasBalanceError = validation.data.some((v: any) => 
          v.issues && v.issues.includes('balance')
        );
        
        if (!hasBalanceError) {
          throw new Error('Expected to detect balance error');
        }
      }
    },
    
    {
      name: 'should auto-map Chinese field names',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                '凭证号': 'V003',
                '日期': '2025-01-01',
                '借方金额': 5000,
                '贷方金额': 5000,
                '摘要': '测试凭证'
              }
            ],
            autoMapFields: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const vouchers = result.outputs.vouchers as Records;
        
        // 验证字段映射
        if (vouchers.data[0].voucher_no !== 'V003') {
          throw new Error('Field mapping failed');
        }
      }
    },
    
    {
      name: 'should check attachment requirement',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                voucher_no: 'V004',
                debit_amount: 10000,
                credit_amount: 10000,
                attachment_count: 0  // 缺少附件
              }
            ],
            checkAttachments: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const validation = result.outputs.validation as Records;
        
        // 应该检测到缺少附件
        const hasAttachmentError = validation.data.some((v: any) => 
          v.issues && v.issues.includes('attachment')
        );
        
        if (!hasAttachmentError) {
          throw new Error('Expected to detect missing attachment');
        }
      }
    },
    
    {
      name: 'should handle batch import',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        // 生成100条凭证
        const data = Array.from({ length: 100 }, (_, i) => ({
          voucher_no: `V${String(i + 1).padStart(4, '0')}`,
          date: '2025-01-01',
          debit_amount: 1000 * (i + 1),
          credit_amount: 1000 * (i + 1),
          description: `Voucher ${i + 1}`
        }));
        
        const result = await node.execute(
          {},
          { data, validateBalance: true },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const vouchers = result.outputs.vouchers as Records;
        
        if (vouchers.rowCount !== 100) {
          throw new Error(`Expected 100 vouchers, got ${vouchers.rowCount}`);
        }
      }
    }
  ]);
}
