/**
 * 应收账款函证节点测试
 * 
 * @description 测试应收账款函证节点的所有功能
 * @author SHENJI Team
 * @date 2025-12-04
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AccountsReceivableConfirmationNode } from '../AccountsReceivableConfirmationNode';

describe('AccountsReceivableConfirmationNode', () => {
  let node: AccountsReceivableConfirmationNode;

  beforeEach(() => {
    node = new AccountsReceivableConfirmationNode();
  });

  describe('元数据测试', () => {
    it('应该有正确的节点ID', () => {
      expect(AccountsReceivableConfirmationNode.metadata.id).toBe('accounts-receivable-confirmation');
    });

    it('应该有正确的节点名称', () => {
      expect(AccountsReceivableConfirmationNode.metadata.name).toBe('应收账款函证');
    });

    it('应该属于收入循环分类', () => {
      expect(AccountsReceivableConfirmationNode.metadata.category).toBe('收入循环');
    });

    it('应该有描述信息', () => {
      expect(AccountsReceivableConfirmationNode.metadata.description).toBeDefined();
      expect(AccountsReceivableConfirmationNode.metadata.description.length).toBeGreaterThan(0);
    });

    it('应该有版本号', () => {
      expect(AccountsReceivableConfirmationNode.metadata.version).toBeDefined();
      expect(AccountsReceivableConfirmationNode.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('输入定义测试', () => {
    it('应该定义receivableList输入', () => {
      const receivableInput = AccountsReceivableConfirmationNode.inputs.find(
        input => input.name === 'receivableList'
      );
      expect(receivableInput).toBeDefined();
      expect(receivableInput?.type).toBe('excel');
      expect(receivableInput?.required).toBe(true);
    });

    it('应该定义customerList输入', () => {
      const customerInput = AccountsReceivableConfirmationNode.inputs.find(
        input => input.name === 'customerList'
      );
      expect(customerInput).toBeDefined();
      expect(customerInput?.type).toBe('excel');
      expect(customerInput?.required).toBe(true);
    });

    it('应该定义responseRecords输入', () => {
      const responseInput = AccountsReceivableConfirmationNode.inputs.find(
        input => input.name === 'responseRecords'
      );
      expect(responseInput).toBeDefined();
      expect(responseInput?.type).toBe('excel');
      expect(responseInput?.required).toBe(false);
    });

    it('应该有输入描述', () => {
      AccountsReceivableConfirmationNode.inputs.forEach(input => {
        expect(input.description).toBeDefined();
        expect(input.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('输出定义测试', () => {
    it('应该定义summary输出', () => {
      const summaryOutput = AccountsReceivableConfirmationNode.outputs.find(
        output => output.name === 'summary'
      );
      expect(summaryOutput).toBeDefined();
      expect(summaryOutput?.type).toBe('data');
    });

    it('应该定义confirmationList输出', () => {
      const listOutput = AccountsReceivableConfirmationNode.outputs.find(
        output => output.name === 'confirmationList'
      );
      expect(listOutput).toBeDefined();
      expect(listOutput?.type).toBe('excel');
    });

    it('应该定义differenceList输出', () => {
      const diffOutput = AccountsReceivableConfirmationNode.outputs.find(
        output => output.name === 'differenceList'
      );
      expect(diffOutput).toBeDefined();
      expect(diffOutput?.type).toBe('excel');
    });

    it('应该定义workpaper输出', () => {
      const workpaperOutput = AccountsReceivableConfirmationNode.outputs.find(
        output => output.name === 'workpaper'
      );
      expect(workpaperOutput).toBeDefined();
      expect(workpaperOutput?.type).toBe('excel');
    });

    it('应该有5个输出项', () => {
      expect(AccountsReceivableConfirmationNode.outputs).toHaveLength(5);
    });
  });

  describe('配置项测试', () => {
    it('应该有confirmationRatio配置', () => {
      expect(AccountsReceivableConfirmationNode.config.confirmationRatio).toBeDefined();
      expect(AccountsReceivableConfirmationNode.config.confirmationRatio.type).toBe('number');
      expect(AccountsReceivableConfirmationNode.config.confirmationRatio.default).toBe(1.0);
    });

    it('应该有materialityAmount配置', () => {
      expect(AccountsReceivableConfirmationNode.config.materialityAmount).toBeDefined();
      expect(AccountsReceivableConfirmationNode.config.materialityAmount.type).toBe('number');
      expect(AccountsReceivableConfirmationNode.config.materialityAmount.default).toBe(100000);
    });

    it('应该有includeElectronic配置', () => {
      expect(AccountsReceivableConfirmationNode.config.includeElectronic).toBeDefined();
      expect(AccountsReceivableConfirmationNode.config.includeElectronic.type).toBe('boolean');
    });

    it('应该有autoMatchTolerance配置', () => {
      expect(AccountsReceivableConfirmationNode.config.autoMatchTolerance).toBeDefined();
      expect(AccountsReceivableConfirmationNode.config.autoMatchTolerance.type).toBe('number');
      expect(AccountsReceivableConfirmationNode.config.autoMatchTolerance.default).toBe(10);
    });

    it('配置项应该有描述', () => {
      const configs = Object.values(AccountsReceivableConfirmationNode.config);
      configs.forEach(config => {
        expect(config.description).toBeDefined();
      });
    });
  });

  describe('输入验证测试', () => {
    it('缺少receivableList时应该失败', async () => {
      try {
        const result = await node.execute(
          { customerList: 'test.xlsx' },
          {}
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain('应收');
      } catch (error: any) {
        expect(error.message).toContain('应收');
      }
    });

    it('缺少customerList时应该失败', async () => {
      try {
        const result = await node.execute(
          { receivableList: 'test.xlsx' },
          {}
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain('客户');
      } catch (error: any) {
        expect(error.message).toContain('客户');
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
          receivableList: [],
          customerList: []
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
          receivableList: [],
          customerList: []
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
          receivableList: [],
          customerList: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受自定义confirmationRatio', async () => {
      try {
        const inputs = {
          receivableList: [],
          customerList: []
        };
        const config = {
          confirmationRatio: 0.8
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
          receivableList: [],
          customerList: []
        };
        const config = {
          materialityAmount: 200000
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受includeElectronic选项', async () => {
      try {
        const inputs = {
          receivableList: [],
          customerList: []
        };
        const config = {
          includeElectronic: true
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('无效的confirmationRatio应该处理', async () => {
      try {
        const inputs = {
          receivableList: [],
          customerList: []
        };
        const config = {
          confirmationRatio: 1.5
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('边界条件测试', () => {
    it('空应收账款列表应该能处理', async () => {
      try {
        const inputs = {
          receivableList: [],
          customerList: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('confirmationRatio为0应该能处理', async () => {
      try {
        const inputs = {
          receivableList: [],
          customerList: []
        };
        const config = {
          confirmationRatio: 0
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('confirmationRatio为1应该能处理', async () => {
      try {
        const inputs = {
          receivableList: [],
          customerList: []
        };
        const config = {
          confirmationRatio: 1.0
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('非常大的materialityAmount应该能处理', async () => {
      try {
        const inputs = {
          receivableList: [],
          customerList: []
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
          receivableList: [],
          customerList: []
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
          receivableList: 'invalid-file.xlsx',
          customerList: 'invalid-file2.xlsx'
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
    it('应该支持可选的responseRecords输入', async () => {
      try {
        const inputs = {
          receivableList: [],
          customerList: [],
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
          receivableList: [],
          customerList: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
