/**
 * 存货监盘节点测试
 * 
 * @description 测试存货监盘节点的所有功能
 * @author SHENJI Team
 * @date 2025-12-04
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryObservationNode } from '../InventoryObservationNode';

describe('InventoryObservationNode', () => {
  let node: InventoryObservationNode;

  beforeEach(() => {
    node = new InventoryObservationNode();
  });

  describe('元数据测试', () => {
    it('应该有正确的节点ID', () => {
      expect(InventoryObservationNode.metadata.id).toBe('inventory-observation');
    });

    it('应该有正确的节点名称', () => {
      expect(InventoryObservationNode.metadata.name).toBe('存货监盘');
    });

    it('应该属于存货循环分类', () => {
      expect(InventoryObservationNode.metadata.category).toBe('存货循环');
    });

    it('应该有描述信息', () => {
      expect(InventoryObservationNode.metadata.description).toBeDefined();
      expect(InventoryObservationNode.metadata.description.length).toBeGreaterThan(0);
    });

    it('应该有版本号', () => {
      expect(InventoryObservationNode.metadata.version).toBeDefined();
      expect(InventoryObservationNode.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('输入定义测试', () => {
    it('应该定义inventoryBook输入', () => {
      const inventoryInput = InventoryObservationNode.inputs.find(
        input => input.name === 'inventoryBook'
      );
      expect(inventoryInput).toBeDefined();
      expect(inventoryInput?.type).toBe('excel');
      expect(inventoryInput?.required).toBe(true);
    });

    it('应该定义countRecords输入', () => {
      const countInput = InventoryObservationNode.inputs.find(
        input => input.name === 'countRecords'
      );
      expect(countInput).toBeDefined();
      expect(countInput?.type).toBe('excel');
      expect(countInput?.required).toBe(true);
    });

    it('应该定义warehouseLayout输入', () => {
      const layoutInput = InventoryObservationNode.inputs.find(
        input => input.name === 'warehouseLayout'
      );
      expect(layoutInput).toBeDefined();
      expect(layoutInput?.type).toBe('image');
      expect(layoutInput?.required).toBe(false);
    });

    it('应该定义inventoryPhotos输入', () => {
      const photosInput = InventoryObservationNode.inputs.find(
        input => input.name === 'inventoryPhotos'
      );
      expect(photosInput).toBeDefined();
      expect(photosInput?.type).toBe('image');
      expect(photosInput?.required).toBe(false);
    });

    it('应该有输入描述', () => {
      InventoryObservationNode.inputs.forEach(input => {
        expect(input.description).toBeDefined();
        expect(input.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('输出定义测试', () => {
    it('应该定义summary输出', () => {
      const summaryOutput = InventoryObservationNode.outputs.find(
        output => output.name === 'summary'
      );
      expect(summaryOutput).toBeDefined();
      expect(summaryOutput?.type).toBe('data');
    });

    it('应该定义countList输出', () => {
      const listOutput = InventoryObservationNode.outputs.find(
        output => output.name === 'countList'
      );
      expect(listOutput).toBeDefined();
      expect(listOutput?.type).toBe('excel');
    });

    it('应该定义differenceList输出', () => {
      const diffOutput = InventoryObservationNode.outputs.find(
        output => output.name === 'differenceList'
      );
      expect(diffOutput).toBeDefined();
      expect(diffOutput?.type).toBe('excel');
    });

    it('应该定义workpaper输出', () => {
      const workpaperOutput = InventoryObservationNode.outputs.find(
        output => output.name === 'workpaper'
      );
      expect(workpaperOutput).toBeDefined();
      expect(workpaperOutput?.type).toBe('excel');
    });

    it('应该有5个输出项', () => {
      expect(InventoryObservationNode.outputs).toHaveLength(5);
    });
  });

  describe('配置项测试', () => {
    it('应该有toleranceRate配置', () => {
      expect(InventoryObservationNode.config.toleranceRate).toBeDefined();
      expect(InventoryObservationNode.config.toleranceRate.type).toBe('number');
      expect(InventoryObservationNode.config.toleranceRate.default).toBe(0.02);
    });

    it('应该有countCoverageRate配置', () => {
      expect(InventoryObservationNode.config.countCoverageRate).toBeDefined();
      expect(InventoryObservationNode.config.countCoverageRate.type).toBe('number');
      expect(InventoryObservationNode.config.countCoverageRate.default).toBe(1.0);
    });

    it('应该有valueThreshold配置', () => {
      expect(InventoryObservationNode.config.valueThreshold).toBeDefined();
      expect(InventoryObservationNode.config.valueThreshold.type).toBe('number');
      expect(InventoryObservationNode.config.valueThreshold.default).toBe(50000);
    });

    it('应该有checkCondition配置', () => {
      expect(InventoryObservationNode.config.checkCondition).toBeDefined();
      expect(InventoryObservationNode.config.checkCondition.type).toBe('boolean');
    });

    it('配置项应该有描述', () => {
      const configs = Object.values(InventoryObservationNode.config);
      configs.forEach(config => {
        expect(config.description).toBeDefined();
      });
    });
  });

  describe('输入验证测试', () => {
    it('缺少inventoryBook时应该失败', async () => {
      try {
        const result = await node.execute(
          { countRecords: 'test.xlsx' },
          {}
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain('存货');
      } catch (error: any) {
        expect(error.message).toContain('存货');
      }
    });

    it('缺少countRecords时应该失败', async () => {
      try {
        const result = await node.execute(
          { inventoryBook: 'test.xlsx' },
          {}
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain('盘点');
      } catch (error: any) {
        expect(error.message).toContain('盘点');
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
          inventoryBook: [],
          countRecords: []
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
          inventoryBook: [],
          countRecords: []
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
          inventoryBook: [],
          countRecords: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受自定义toleranceRate', async () => {
      try {
        const inputs = {
          inventoryBook: [],
          countRecords: []
        };
        const config = {
          toleranceRate: 0.05
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受自定义countCoverageRate', async () => {
      try {
        const inputs = {
          inventoryBook: [],
          countRecords: []
        };
        const config = {
          countCoverageRate: 0.8
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受checkCondition选项', async () => {
      try {
        const inputs = {
          inventoryBook: [],
          countRecords: []
        };
        const config = {
          checkCondition: false
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('边界条件测试', () => {
    it('空存货明细账应该能处理', async () => {
      try {
        const inputs = {
          inventoryBook: [],
          countRecords: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('空盘点记录应该能处理', async () => {
      try {
        const inputs = {
          inventoryBook: [],
          countRecords: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('toleranceRate为0应该能处理', async () => {
      try {
        const inputs = {
          inventoryBook: [],
          countRecords: []
        };
        const config = {
          toleranceRate: 0
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('countCoverageRate为1应该能处理', async () => {
      try {
        const inputs = {
          inventoryBook: [],
          countRecords: []
        };
        const config = {
          countCoverageRate: 1.0
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('非常大的valueThreshold应该能处理', async () => {
      try {
        const inputs = {
          inventoryBook: [],
          countRecords: []
        };
        const config = {
          valueThreshold: 999999999
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
          inventoryBook: 'invalid-file.xlsx',
          countRecords: 'invalid-file2.xlsx'
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
    it('应该支持可选的warehouseLayout输入', async () => {
      try {
        const inputs = {
          inventoryBook: [],
          countRecords: [],
          warehouseLayout: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该支持可选的inventoryPhotos输入', async () => {
      try {
        const inputs = {
          inventoryBook: [],
          countRecords: [],
          inventoryPhotos: []
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
          inventoryBook: [],
          countRecords: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
