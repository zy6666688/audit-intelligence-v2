/**
 * ThreeDocMatchNode 测试
 */

import { ThreeDocMatchNode } from '../audit/ThreeDocMatchNode';
import { NodeTestFramework } from './test-framework';
import type { Records, RiskSet } from '../../../types/AuditDataTypes';

export async function testThreeDocMatchNode() {
  const node = new ThreeDocMatchNode();
  
  return NodeTestFramework.runTestSuite('ThreeDocMatchNode', [
    {
      name: 'should match three documents successfully',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const orders = createMockOrders();
        const deliveries = createMockDeliveries();
        const invoices = createMockInvoices();
        
        const result = await node.execute(
          { orders, deliveries, invoices },
          {
            amountTolerance: 0.01,
            dateToleranceDays: 7,
            fuzzyItemMatch: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        NodeTestFramework.assertOutputHasField(result, 'matches');
        NodeTestFramework.assertOutputHasField(result, 'mismatches');
        NodeTestFramework.assertOutputHasField(result, 'risks');
        NodeTestFramework.assertOutputHasField(result, 'evidence');
        
        // 应该有一些匹配
        const matches = result.outputs.matches as Records;
        if (matches.rowCount === 0) {
          throw new Error('Expected some matches');
        }
      }
    },
    
    {
      name: 'should detect amount mismatches',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const orders = {
          ...createMockOrders(),
          data: [{ order_id: 'ORD001', item: 'Computer', amount: 5000, date: '2025-01-01' }]
        };
        
        const deliveries = {
          ...createMockDeliveries(),
          data: [{ delivery_id: 'DEL001', order_id: 'ORD001', item: 'Computer', quantity: 1, date: '2025-01-02' }]
        };
        
        const invoices = {
          ...createMockInvoices(),
          data: [{ invoice_id: 'INV001', order_id: 'ORD001', amount: 6000, date: '2025-01-03' }]  // 金额不匹配
        };
        
        const result = await node.execute(
          { orders, deliveries, invoices },
          {
            amountTolerance: 0.01,  // 1%容差
            dateToleranceDays: 7
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        
        // 应该检测到差异
        const mismatches = result.outputs.mismatches as Records;
        if (mismatches.rowCount === 0) {
          throw new Error('Expected to detect amount mismatch');
        }
      }
    },
    
    {
      name: 'should detect date mismatches',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const orders = {
          ...createMockOrders(),
          data: [{ order_id: 'ORD001', item: 'Computer', amount: 5000, date: '2025-01-01' }]
        };
        
        const deliveries = {
          ...createMockDeliveries(),
          data: [{ delivery_id: 'DEL001', order_id: 'ORD001', item: 'Computer', quantity: 1, date: '2025-01-20' }]  // 日期超出容差
        };
        
        const invoices = {
          ...createMockInvoices(),
          data: [{ invoice_id: 'INV001', order_id: 'ORD001', amount: 5000, date: '2025-01-02' }]
        };
        
        const result = await node.execute(
          { orders, deliveries, invoices },
          {
            amountTolerance: 0.01,
            dateToleranceDays: 7  // 7天容差
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        
        // 应该检测到日期异常
        const mismatchRecords = result.outputs.mismatches as Records;
        const hasDateIssue = mismatchRecords.data.some((m: any) => 
          m.issues && m.issues.includes('Date diff')
        );
        
        if (!hasDateIssue) {
          throw new Error('Expected to detect date mismatch');
        }
      }
    },
    
    {
      name: 'should handle missing documents',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const orders = {
          ...createMockOrders(),
          data: [
            { order_id: 'ORD001', item: 'Computer', amount: 5000, date: '2025-01-01' },
            { order_id: 'ORD002', item: 'Printer', amount: 800, date: '2025-01-02' }
          ]
        };
        
        const deliveries = {
          ...createMockDeliveries(),
          data: [{ delivery_id: 'DEL001', order_id: 'ORD001', item: 'Computer', quantity: 1, date: '2025-01-02' }]
          // ORD002缺少发货单
        };
        
        const invoices = {
          ...createMockInvoices(),
          data: [{ invoice_id: 'INV001', order_id: 'ORD001', amount: 5000, date: '2025-01-03' }]
          // ORD002缺少发票
        };
        
        const result = await node.execute(
          { orders, deliveries, invoices },
          { requireAllThree: true },
          context
        );

        NodeTestFramework.assertSuccess(result);
        
        // 应该检测到缺失文档
        const mismatches = result.outputs.mismatches as Records;
        if (mismatches.rowCount === 0) {
          throw new Error('Expected to detect missing documents');
        }
        
        // 应该有高风险
        const risks = result.outputs.risks as RiskSet;
        if (risks.summary.total === 0) {
          throw new Error('Expected risks to be generated');
        }
      }
    },
    
    {
      name: 'should complete within performance target',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        // 生成100个订单
        const orders = createMockOrders(100);
        const deliveries = createMockDeliveries(95);
        const invoices = createMockInvoices(98);
        
        const result = await node.execute(
          { orders, deliveries, invoices },
          {
            amountTolerance: 0.01,
            dateToleranceDays: 7
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        NodeTestFramework.assertPerformance(result, 5000);  // 100条记录应该在5秒内完成
      }
    }
  ]);
}

// 辅助函数
function createMockOrders(count: number = 3): any {
  const data = Array.from({ length: count }, (_, i) => ({
    order_id: `ORD${String(i + 1).padStart(3, '0')}`,
    item: `Item ${i + 1}`,
    amount: (i + 1) * 1000,
    date: new Date(2025, 0, i + 1).toISOString()
  }));

  return {
    type: 'Records',
    schema: [
      { name: 'order_id', type: 'string', required: true, description: 'Order ID' },
      { name: 'item', type: 'string', required: true, description: 'Item' },
      { name: 'amount', type: 'number', required: true, description: 'Amount' },
      { name: 'date', type: 'date', required: true, description: 'Date' }
    ],
    data,
    metadata: {
      source: 'test',
      timestamp: new Date(),
      version: '1.0.0',
      traceId: 'test',
      nodeId: 'test',
      executionId: 'test'
    },
    rowCount: data.length,
    columnCount: 4
  };
}

function createMockDeliveries(count: number = 3): any {
  const data = Array.from({ length: count }, (_, i) => ({
    delivery_id: `DEL${String(i + 1).padStart(3, '0')}`,
    order_id: `ORD${String(i + 1).padStart(3, '0')}`,
    item: `Item ${i + 1}`,
    quantity: 1,
    date: new Date(2025, 0, i + 2).toISOString()
  }));

  return {
    type: 'Records',
    schema: [
      { name: 'delivery_id', type: 'string', required: true, description: 'Delivery ID' },
      { name: 'order_id', type: 'string', required: true, description: 'Order ID' },
      { name: 'item', type: 'string', required: true, description: 'Item' },
      { name: 'quantity', type: 'number', required: true, description: 'Quantity' },
      { name: 'date', type: 'date', required: true, description: 'Date' }
    ],
    data,
    metadata: {
      source: 'test',
      timestamp: new Date(),
      version: '1.0.0',
      traceId: 'test',
      nodeId: 'test',
      executionId: 'test'
    },
    rowCount: data.length,
    columnCount: 5
  };
}

function createMockInvoices(count: number = 3): any {
  const data = Array.from({ length: count }, (_, i) => ({
    invoice_id: `INV${String(i + 1).padStart(3, '0')}`,
    order_id: `ORD${String(i + 1).padStart(3, '0')}`,
    amount: (i + 1) * 1000,
    date: new Date(2025, 0, i + 3).toISOString()
  }));

  return {
    type: 'Records',
    schema: [
      { name: 'invoice_id', type: 'string', required: true, description: 'Invoice ID' },
      { name: 'order_id', type: 'string', required: true, description: 'Order ID' },
      { name: 'amount', type: 'number', required: true, description: 'Amount' },
      { name: 'date', type: 'date', required: true, description: 'Date' }
    ],
    data,
    metadata: {
      source: 'test',
      timestamp: new Date(),
      version: '1.0.0',
      traceId: 'test',
      nodeId: 'test',
      executionId: 'test'
    },
    rowCount: data.length,
    columnCount: 4
  };
}
