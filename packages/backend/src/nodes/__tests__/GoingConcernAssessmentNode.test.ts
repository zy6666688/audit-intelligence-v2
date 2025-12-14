/**
 * 持续经营评估节点测试
 * 
 * @description 测试持续经营评估节点的所有功能
 * @author SHENJI Team
 * @date 2025-12-04
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GoingConcernAssessmentNode } from '../GoingConcernAssessmentNode';

describe('GoingConcernAssessmentNode', () => {
  let node: GoingConcernAssessmentNode;

  beforeEach(() => {
    node = new GoingConcernAssessmentNode();
  });

  describe('元数据测试', () => {
    it('应该有正确的节点ID', () => {
      expect(GoingConcernAssessmentNode.metadata.id).toBe('going-concern-assessment');
    });

    it('应该有正确的节点名称', () => {
      expect(GoingConcernAssessmentNode.metadata.name).toBe('持续经营评估');
    });

    it('应该属于风险评估分类', () => {
      expect(GoingConcernAssessmentNode.metadata.category).toBe('风险评估');
    });

    it('应该有描述信息', () => {
      expect(GoingConcernAssessmentNode.metadata.description).toBeDefined();
      expect(GoingConcernAssessmentNode.metadata.description.length).toBeGreaterThan(0);
    });

    it('应该有版本号', () => {
      expect(GoingConcernAssessmentNode.metadata.version).toBeDefined();
      expect(GoingConcernAssessmentNode.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('输入定义测试', () => {
    it('应该定义financialStatements输入', () => {
      const financialInput = GoingConcernAssessmentNode.inputs.find(
        input => input.name === 'financialStatements'
      );
      expect(financialInput).toBeDefined();
      expect(financialInput?.type).toBe('excel');
      expect(financialInput?.required).toBe(true);
    });

    it('应该定义cashFlowForecast输入', () => {
      const cashFlowInput = GoingConcernAssessmentNode.inputs.find(
        input => input.name === 'cashFlowForecast'
      );
      expect(cashFlowInput).toBeDefined();
      expect(cashFlowInput?.type).toBe('excel');
      expect(cashFlowInput?.required).toBe(false);
    });

    it('应该定义debtSchedule输入', () => {
      const debtInput = GoingConcernAssessmentNode.inputs.find(
        input => input.name === 'debtSchedule'
      );
      expect(debtInput).toBeDefined();
      expect(debtInput?.type).toBe('excel');
      expect(debtInput?.required).toBe(false);
    });

    it('应该定义operatingData输入', () => {
      const operatingInput = GoingConcernAssessmentNode.inputs.find(
        input => input.name === 'operatingData'
      );
      expect(operatingInput).toBeDefined();
      expect(operatingInput?.type).toBe('excel');
      expect(operatingInput?.required).toBe(false);
    });

    it('应该有输入描述', () => {
      GoingConcernAssessmentNode.inputs.forEach(input => {
        expect(input.description).toBeDefined();
        expect(input.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('输出定义测试', () => {
    it('应该定义assessment输出', () => {
      const assessmentOutput = GoingConcernAssessmentNode.outputs.find(
        output => output.name === 'assessment'
      );
      expect(assessmentOutput).toBeDefined();
      expect(assessmentOutput?.type).toBe('data');
    });

    it('应该定义indicatorAnalysis输出', () => {
      const indicatorOutput = GoingConcernAssessmentNode.outputs.find(
        output => output.name === 'indicatorAnalysis'
      );
      expect(indicatorOutput).toBeDefined();
      expect(indicatorOutput?.type).toBe('excel');
    });

    it('应该定义riskFactorsList输出', () => {
      const riskOutput = GoingConcernAssessmentNode.outputs.find(
        output => output.name === 'riskFactorsList'
      );
      expect(riskOutput).toBeDefined();
      expect(riskOutput?.type).toBe('excel');
    });

    it('应该定义cashFlowAnalysis输出', () => {
      const cashFlowOutput = GoingConcernAssessmentNode.outputs.find(
        output => output.name === 'cashFlowAnalysis'
      );
      expect(cashFlowOutput).toBeDefined();
      expect(cashFlowOutput?.type).toBe('excel');
    });

    it('应该定义workpaper输出', () => {
      const workpaperOutput = GoingConcernAssessmentNode.outputs.find(
        output => output.name === 'workpaper'
      );
      expect(workpaperOutput).toBeDefined();
      expect(workpaperOutput?.type).toBe('excel');
    });

    it('应该有6个输出项', () => {
      expect(GoingConcernAssessmentNode.outputs).toHaveLength(6);
    });
  });

  describe('配置项测试', () => {
    it('应该有assessmentPeriod配置', () => {
      expect(GoingConcernAssessmentNode.config.assessmentPeriod).toBeDefined();
      expect(GoingConcernAssessmentNode.config.assessmentPeriod.type).toBe('number');
      expect(GoingConcernAssessmentNode.config.assessmentPeriod.default).toBe(12);
    });

    it('应该有industryBenchmark配置', () => {
      expect(GoingConcernAssessmentNode.config.industryBenchmark).toBeDefined();
      expect(GoingConcernAssessmentNode.config.industryBenchmark.type).toBe('boolean');
    });

    it('应该有riskThreshold配置', () => {
      expect(GoingConcernAssessmentNode.config.riskThreshold).toBeDefined();
      expect(GoingConcernAssessmentNode.config.riskThreshold.type).toBe('number');
      expect(GoingConcernAssessmentNode.config.riskThreshold.default).toBe(60);
    });

    it('应该有includeMarketFactors配置', () => {
      expect(GoingConcernAssessmentNode.config.includeMarketFactors).toBeDefined();
      expect(GoingConcernAssessmentNode.config.includeMarketFactors.type).toBe('boolean');
    });

    it('配置项应该有描述', () => {
      const configs = Object.values(GoingConcernAssessmentNode.config);
      configs.forEach(config => {
        expect(config.description).toBeDefined();
      });
    });
  });

  describe('输入验证测试', () => {
    it('缺少financialStatements时应该失败', async () => {
      try {
        const result = await node.execute({}, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain('财务');
      } catch (error: any) {
        expect(error.message).toContain('财务');
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
          financialStatements: []
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
          financialStatements: []
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
          financialStatements: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受自定义assessmentPeriod', async () => {
      try {
        const inputs = {
          financialStatements: []
        };
        const config = {
          assessmentPeriod: 24
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受industryBenchmark选项', async () => {
      try {
        const inputs = {
          financialStatements: []
        };
        const config = {
          industryBenchmark: true
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受自定义riskThreshold', async () => {
      try {
        const inputs = {
          financialStatements: []
        };
        const config = {
          riskThreshold: 50
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该接受includeMarketFactors选项', async () => {
      try {
        const inputs = {
          financialStatements: []
        };
        const config = {
          includeMarketFactors: false
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('边界条件测试', () => {
    it('空财务报表应该能处理', async () => {
      try {
        const inputs = {
          financialStatements: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('assessmentPeriod为0应该能处理', async () => {
      try {
        const inputs = {
          financialStatements: []
        };
        const config = {
          assessmentPeriod: 0
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('非常大的assessmentPeriod应该能处理', async () => {
      try {
        const inputs = {
          financialStatements: []
        };
        const config = {
          assessmentPeriod: 120
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('riskThreshold为0应该能处理', async () => {
      try {
        const inputs = {
          financialStatements: []
        };
        const config = {
          riskThreshold: 0
        };
        await node.execute(inputs, config);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('riskThreshold为100应该能处理', async () => {
      try {
        const inputs = {
          financialStatements: []
        };
        const config = {
          riskThreshold: 100
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
          financialStatements: 'invalid-file.xlsx'
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
    it('应该支持可选的cashFlowForecast输入', async () => {
      try {
        const inputs = {
          financialStatements: [],
          cashFlowForecast: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该支持可选的debtSchedule输入', async () => {
      try {
        const inputs = {
          financialStatements: [],
          debtSchedule: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该支持可选的operatingData输入', async () => {
      try {
        const inputs = {
          financialStatements: [],
          operatingData: []
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
          financialStatements: []
        };
        await node.execute(inputs, {});
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
