/**
 * ContractInputNode 测试
 */

import { ContractInputNode } from '../input/ContractInputNode';
import { NodeTestFramework } from './test-framework';
import type { Records } from '../../../types/AuditDataTypes';

export async function testContractInputNode() {
  const node = new ContractInputNode();
  
  return NodeTestFramework.runTestSuite('ContractInputNode', [
    {
      name: 'should import contract from PDF',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                file_path: '/test/contract.pdf',
                contract_no: 'C001'
              }
            ],
            source: 'pdf',
            extractText: true,
            recognizeElements: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        NodeTestFramework.assertOutputHasField(result, 'contracts');
      }
    },
    
    {
      name: 'should extract contract elements with regex',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const sampleText = `
          甲方：某某公司
          乙方：采购方公司
          合同金额：人民币100万元
          签订日期：2025年1月1日
          付款方式：合同签订后30日内支付50%
        `;
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                contract_no: 'C002',
                text_content: sampleText
              }
            ],
            source: 'text',
            recognizeElements: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const contracts = result.outputs.contracts as Records;
        
        // 验证提取到的要素
        const contract = contracts.data[0];
        if (!contract.party_a || !contract.party_b) {
          throw new Error('Failed to extract parties');
        }
      }
    },
    
    {
      name: 'should detect risk clauses',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const riskText = `
          本合同如有违约，违约方需支付合同金额的20%作为违约金。
          如发生争议，双方应通过仲裁解决。
        `;
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                contract_no: 'C003',
                text_content: riskText
              }
            ],
            detectRisks: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const contracts = result.outputs.contracts as Records;
        
        // 应该检测到风险条款
        const contract = contracts.data[0];
        if (!contract.risk_clauses || contract.risk_clauses.length === 0) {
          throw new Error('Failed to detect risk clauses');
        }
      }
    },
    
    {
      name: 'should handle batch contract import',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const data = Array.from({ length: 20 }, (_, i) => ({
          contract_no: `C${String(i + 1).padStart(4, '0')}`,
          file_path: `/test/contract_${i + 1}.pdf`
        }));
        
        const result = await node.execute(
          {},
          { data, source: 'pdf' },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const contracts = result.outputs.contracts as Records;
        
        if (contracts.rowCount !== 20) {
          throw new Error(`Expected 20 contracts, got ${contracts.rowCount}`);
        }
      }
    },
    
    {
      name: 'should extract payment terms',
      fn: async () => {
        const context = NodeTestFramework.createTestContext();
        
        const paymentText = `
          付款条款：
          1. 合同签订后7日内支付30%
          2. 货物交付后支付60%
          3. 验收合格后支付尾款10%
        `;
        
        const result = await node.execute(
          {},
          {
            data: [
              {
                contract_no: 'C004',
                text_content: paymentText
              }
            ],
            recognizeElements: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const contracts = result.outputs.contracts as Records;
        
        // 验证提取到付款条款
        const contract = contracts.data[0];
        if (!contract.payment_terms) {
          throw new Error('Failed to extract payment terms');
        }
      }
    }
  ]);
}
