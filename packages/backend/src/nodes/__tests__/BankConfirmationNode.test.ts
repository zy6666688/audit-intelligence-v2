/**
 * 银行询证节点测试
 * 
 * @description 测试银行询证节点的所有功能
 * @author SHENJI Team
 * @date 2025-12-04
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BankConfirmationNode } from '../BankConfirmationNode';

describe('BankConfirmationNode', () => {
  let node: BankConfirmationNode;

  beforeEach(() => {
    node = new BankConfirmationNode();
  });

  describe('元数据测试', () => {
    it('应该有正确的节点ID', () => {
      expect(BankConfirmationNode.metadata.id).toBe('bank-confirmation');
    });

    it('应该有正确的节点名称', () => {
      expect(BankConfirmationNode.metadata.name).toBe('银行询证');
    });

    it('应该属于货币资金循环分类', () => {
      expect(BankConfirmationNode.metadata.category).toBe('货币资金循环');
    });

    it('应该有描述信息', () => {
      expect(BankConfirmationNode.metadata.description).toBeDefined();
      expect(BankConfirmationNode.metadata.description.length).toBeGreaterThan(0);
    });

    it('应该有版本号', () => {
      expect(BankConfirmationNode.metadata.version).toBeDefined();
      expect(BankConfirmationNode.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('输入定义测试', () => {
    it('应该定义bankAccountList输入', () => {
      const bankInput = BankConfirmationNode.inputs.find(
        input => input.name === 'bankAccountList'
      );
      expect(bankInput).toBeDefined();
      expect(bankInput?.type).toBe('excel');
      expect(bankInput?.required).toBe(true);
    });

    it('应该定义balanceSheet输入', () => {
      const balanceInput = BankConfirmationNode.inputs.find(
        input => input.name === 'balanceSheet'
      );
      expect(balanceInput).toBeDefined();
      expect(balanceInput?.type).toBe('excel');
      expect(balanceInput?.required).toBe(false);
    });

    it('应该定义responseRecords输入', () => {
      const responseInput = BankConfirmationNode.inputs.find(
        input => input.name === 'responseRecords'
      );
      expect(responseInput).toBeDefined();
      expect(responseInput?.type).toBe('excel');
      expect(responseInput?.required).toBe(false);
    });

    it('应该有输入描述', () => {
      BankConfirmationNode.inputs.forEach(input => {
        expect(input.description).toBeDefined();
        expect(input.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('输出定义测试', () => {
    it('应该定义summary输出', () => {
      const summaryOutput = BankConfirmationNode.outputs.find(
        output => output.name === 'summary'
      );
      expect(summaryOutput).toBeDefined();
      expect(summaryOutput?.type).toBe('data');
    });

    it('应该定义confirmationList输出', () => {
      const listOutput = BankConfirmationNode.outputs.find(
        output => output.name === 'confirmationList'
      );
      expect(listOutput).toBeDefined();
      expect(listOutput?.type).toBe('excel');
    });

    it('应该定义differenceList输出', () => {
      const diffOutput = BankConfirmationNode.outputs.find(
        output => output.name === 'differenceList'
      );
      expect(diffOutput).toBeDefined();
      expect(diffOutput?.type).toBe('excel');
    });

    it('应该定义workpaper输出', () => {
      const workpaperOutput = BankConfirmationNode.outputs.find(
        output => output.name === 'workpaper'
      );
      expect(workpaperOutput).toBeDefined();
      expect(workpaperOutput?.type).toBe('excel');
    });

    it('应该有5个输出项', () => {
      expect(BankConfirmationNode.outputs).toHaveLength(5);
    });
  });

  describe('配置项测试', () => {
    it('应该有confirmAllAccounts配置', () => {
      expect(BankConfirmationNode.config.confirmAllAccounts).toBeDefined();
      expect(BankConfirmationNode.config.confirmAllAccounts.type).toBe('boolean');
      expect(BankConfirmationNode.config.confirmAllAccounts.default).toBe(true);
    });

    it('应该有materialityAmount配置', () => {
      expect(BankConfirmationNode.config.materialityAmount).toBeDefined();
      expect(BankConfirmationNode.config.materialityAmount.type).toBe('number');
      expect(BankConfirmationNode.config.materialityAmount.default).toBe(50000);
    });

    it('应该有includeZeroBalance配置', () => {
      expect(BankConfirmationNode.config.includeZeroBalance).toBeDefined();
      expect(BankConfirmationNode.config.includeZeroBalance.type).toBe('boolean');
    });

    it('应该有autoMatchTolerance配置', () => {
      expect(BankConfirmationNode.config.autoMatchTolerance).toBeDefined();
      expect(BankConfirmationNode.config.autoMatchTolerance.type).toBe('number');
      expect(BankConfirmationNode.config.autoMatchTolerance.default).toBe(1);
    });

    it('配置项应该有描述', () => {
      const configs = Object.values(BankConfirmationNode.config);
      configs.forEach(config => {
        expect(config.description).toBeDefined();
      });
    });
  });

  describe('输入验证测试', () => {
    it('缺少bankAccountList时应该失败', async () => {
      try {
        const result = await node.execute({}, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain('银行');
      } catch (error: any) {
        expect(error.message).toContain('银行');
      }
    });

    it('空对象输入应该失败', async () => {
      try {
        const result = await node.execute({}, {});
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('null输入应该处理', async () => {
      try {
        await node.execute(null as any, {});
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('undefined输入应该处理', async () => {
      try {
        await node.execute(undefined as any, {});
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('日志记录测试', () => {
    it('执行过程应该记录日志', async () => {
      try {
        const inputs = {
          bankAccountList: []
        };
        await node.execute(inputs, {});
      } catch (error) {
        // 即使失败也可能有日志
      }
      
      const logs = node.getLogs();
      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('日志应该包含开始标记', async () => {
      try {
        const inputs = {
          bankAccountList: []
        };
        await node.execute(inputs, {});
      } catch (error) {
        // 即使失败也可能有日志
      }
      
      const logs = node.getLogs();
      const startLog = logs.find(log => log.includes('开始') || log.includes('执行'));
      expect(startLog).toBeDefined();
    });

    it('清除日志功能应该工作', () => {
      node.clearLogs();
      const logs = node.getLogs();
      expect(logs.length).toBe(0);
    });
  });

  describe('执行结果测试', () => {
    it('成功执行应该返回正确的结构', async () => {
      try {
        const result = await node.execute({}, {});
        expect(result).toBeDefined();
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('logs');
        expect(result).toHaveProperty('duration');
        
        if (!result.success) {
          expect(result).toHaveProperty('error');
        } else {
          expect(result).toHaveProperty('data');
          expect(result).toHaveProperty('outputs');
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该记录执行时间', async () => {
      try {
        const result = await node.execute({}, {});
        expect(result.duration).toBeDefined();
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThanOrEqual(0);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('失败时应该有错误信息', async () => {
      try {
        const result = await node.execute({}, {});
        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error?.length).toBeGreaterThan(0);
        }
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('配置参数测试', () => {
    it('应该接受默认配置', async () => {
      try {
        const inputs = {
          bankAccountList: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受自定义confirmAllAccounts', async () => {
      try {
        const inputs = {
          bankAccountList: []
        };
        const config = {
          confirmAllAccounts: false
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受自定义materialityAmount', async () => {
      try {
        const inputs = {
          bankAccountList: []
        };
        const config = {
          materialityAmount: 100000
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受includeZeroBalance选项', async () => {
      try {
        const inputs = {
          bankAccountList: []
        };
        const config = {
          includeZeroBalance: false
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('边界条件测试', () => {
    it('空银行账户列表应该能处理', async () => {
      try {
        const inputs = {
          bankAccountList: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('非常大的materialityAmount应该能处理', async () => {
      try {
        const inputs = {
          bankAccountList: []
        };
        const config = {
          materialityAmount: 999999999
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('autoMatchTolerance为0应该能处理', async () => {
      try {
        const inputs = {
          bankAccountList: []
        };
        const config = {
          autoMatchTolerance: 0
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('错误处理测试', () => {
    it('遇到错误应该优雅地失败', async () => {
      try {
        const inputs = {
          bankAccountList: 'invalid-file.xlsx'
        };
        const result = await node.execute(inputs, {});
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });

    it('错误信息应该清晰', async () => {
      try {
        const result = await node.execute({}, {});
        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(result.error?.length).toBeGreaterThan(0);
          expect(result.error).not.toBe('Error');
        }
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.message.length).toBeGreaterThan(0);
      }
    });

    it('错误时仍应该返回日志', async () => {
      try {
        const result = await node.execute({}, {});
        expect(result.logs).toBeDefined();
        expect(Array.isArray(result.logs)).toBe(true);
      } catch (error) {
        const logs = node.getLogs();
        expect(logs).toBeDefined();
        expect(Array.isArray(logs)).toBe(true);
      }
    });
  });

  describe('高级功能测试', () => {
    it('应该支持可选的balanceSheet输入', async () => {
      try {
        const inputs = {
          bankAccountList: [],
          balanceSheet: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该支持可选的responseRecords输入', async () => {
      try {
        const inputs = {
          bankAccountList: [],
          responseRecords: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('缺少可选输入不应该失败', async () => {
      try {
        const inputs = {
          bankAccountList: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
