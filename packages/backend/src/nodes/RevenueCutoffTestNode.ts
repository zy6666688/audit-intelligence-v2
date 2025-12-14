/**
 * 收入截止性测试节点
 * 
 * @description 测试收入确认截止的正确性，识别跨期收入
 * 检查资产负债表日前后的收入记录，确保收入计入正确的会计期间
 * 
 * @author SHENJI Team
 * @date 2025-12-04
 * @version 1.0.0
 * @since Week 2: 核心节点开发 - 收入循环
 * 
 * @example
 * ```typescript
 * const node = new RevenueCutoffTestNode();
 * const result = await node.execute({
 *   salesRecords: '/path/to/sales.xlsx',
 *   shippingRecords: '/path/to/shipping.xlsx'
 * }, {
 *   cutoffDate: '2024-12-31',
 *   testDays: 15
 * });
 * ```
 */

import { BaseNode, NodeExecutionResult } from './BaseNode';
import { BusinessError, ErrorCode } from '../constants/ErrorCode';

/**
 * 销售记录接口
 */
interface SalesRecord {
  /** 销售单号 */
  salesNo: string;
  /** 客户名称 */
  customerName: string;
  /** 销售日期 */
  salesDate: string;
  /** 销售金额 */
  amount: number;
  /** 发货日期 */
  shippingDate?: string;
  /** 发货单号 */
  shippingNo?: string;
  /** 收款日期 */
  paymentDate?: string;
  /** 产品名称 */
  productName?: string;
}

/**
 * 截止性测试记录接口
 */
interface CutoffTestRecord extends SalesRecord {
  /** 截止日期 */
  cutoffDate: string;
  /** 记录期间（截止日前/后） */
  period: '截止日前' | '截止日后';
  /** 是否跨期 */
  isCutoffError: boolean;
  /** 跨期类型 */
  errorType?: '提前确认' | '延后确认';
  /** 正确期间 */
  correctPeriod?: string;
  /** 跨期原因 */
  reason?: string;
  /** 建议调整金额 */
  adjustmentAmount?: number;
}

/**
 * 截止性测试汇总接口
 */
interface CutoffTestSummary {
  /** 截止日期 */
  cutoffDate: string;
  /** 测试期间 */
  testPeriod: string;
  /** 截止日前记录数 */
  beforeCount: number;
  /** 截止日前金额 */
  beforeAmount: number;
  /** 截止日后记录数 */
  afterCount: number;
  /** 截止日后金额 */
  afterAmount: number;
  /** 跨期记录数 */
  cutoffErrorCount: number;
  /** 跨期金额 */
  cutoffErrorAmount: number;
  /** 提前确认记录数 */
  earlyRecognitionCount: number;
  /** 提前确认金额 */
  earlyRecognitionAmount: number;
  /** 延后确认记录数 */
  lateRecognitionCount: number;
  /** 延后确认金额 */
  lateRecognitionAmount: number;
  /** 截止准确率 */
  accuracyRate: number;
}

/**
 * 收入截止性测试节点
 * 
 * @description 执行收入截止性测试程序的审计节点
 * 包括截止日前后收入测试、跨期识别、调整建议等完整流程
 * 
 * @extends {BaseNode}
 */
export class RevenueCutoffTestNode extends BaseNode {
  /**
   * 节点元数据
   */
  static metadata = {
    id: 'revenue-cutoff-test',
    name: '收入截止性测试',
    category: '收入循环',
    description: '测试收入确认截止的正确性，识别和分析跨期收入问题',
    icon: 'calendar-check',
    version: '1.0.0',
  };

  /**
   * 输入定义
   */
  static inputs = [
    {
      name: 'salesRecords',
      label: '销售记录',
      type: 'excel' as const,
      required: true,
      description: '截止日前后的销售记录（包含：销售单号、客户、日期、金额、发货信息等）',
    },
    {
      name: 'shippingRecords',
      label: '发货记录',
      type: 'excel' as const,
      required: false,
      description: '发货单据记录（可选，用于核对销售与发货的时间匹配）',
    },
    {
      name: 'invoiceRecords',
      label: '开票记录',
      type: 'excel' as const,
      required: false,
      description: '发票开具记录（可选，用于核对收入确认依据）',
    },
  ];

  /**
   * 输出定义
   */
  static outputs = [
    {
      name: 'summary',
      label: '测试结果汇总',
      type: 'data' as const,
      description: '截止性测试的汇总数据（跨期数量、金额、准确率等关键指标）',
    },
    {
      name: 'testList',
      label: '测试明细表',
      type: 'excel' as const,
      description: '详细的截止性测试记录（包含每笔收入的测试结果）',
    },
    {
      name: 'cutoffErrorList',
      label: '跨期收入清单',
      type: 'excel' as const,
      description: '识别出的跨期收入明细及调整建议',
    },
    {
      name: 'adjustmentEntries',
      label: '调整分录',
      type: 'excel' as const,
      description: '建议的会计调整分录',
    },
    {
      name: 'workpaper',
      label: '审计底稿',
      type: 'excel' as const,
      description: '收入截止性测试审计工作底稿',
    },
  ];

  /**
   * 配置项定义
   */
  static config = {
    cutoffDate: {
      label: '截止日期',
      type: 'string' as const,
      default: '2024-12-31',
      description: '资产负债表日/审计截止日期（格式：YYYY-MM-DD）',
    },
    testDays: {
      label: '测试天数',
      type: 'number' as const,
      default: 15,
      description: '截止日前后各测试的天数（如15天表示测试前后各15天）',
    },
    materialityAmount: {
      label: '重要性金额',
      type: 'number' as const,
      default: 10000,
      description: '重要性金额阈值（元），超过此金额的跨期收入需要重点关注',
    },
    revenueRecognitionBasis: {
      label: '收入确认依据',
      type: 'select' as const,
      default: '发货日期',
      options: ['发货日期', '开票日期', '验收日期', '合同约定日期'],
      description: '判断收入应确认日期的依据',
    },
    allowedDays: {
      label: '允许偏差天数',
      type: 'number' as const,
      default: 3,
      description: '允许的日期偏差天数（如3天表示前后3天内视为正常）',
    },
  };

  /**
   * 执行节点逻辑
   * 
   * @description 执行收入截止性测试的完整流程
   * 
   * @param {Record<string, any>} inputs - 输入数据
   * @param {Record<string, any>} config - 配置参数
   * @returns {Promise<NodeExecutionResult>} 节点执行结果
   * 
   * @throws {BusinessError} 当输入数据不完整或执行失败时
   */
  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    this.clearLogs();

    try {
      this.log('========== 开始执行收入截止性测试节点 ==========');

      // 1. 验证输入
      await this.validateInputs(inputs);
      this.log('✓ 输入验证通过');

      // 2. 解析配置
      const cutoffDate = config.cutoffDate || '2024-12-31';
      const testDays = config.testDays || 15;
      const revenueRecognitionBasis = config.revenueRecognitionBasis || '发货日期';
      const allowedDays = config.allowedDays || 3;
      
      this.log(`截止日期：${cutoffDate}`);
      this.log(`测试期间：截止日前后各${testDays}天`);
      this.log(`收入确认依据：${revenueRecognitionBasis}`);

      // 3. 解析销售记录
      this.log('开始解析销售记录...');
      const salesRecords = await this.parseExcel(inputs.salesRecords);
      this.log(`✓ 成功解析销售记录：${salesRecords.length}笔`);

      // 4. 解析发货记录（如果有）
      let shippingRecords: any[] = [];
      if (inputs.shippingRecords) {
        shippingRecords = await this.parseExcel(inputs.shippingRecords);
        this.log(`✓ 成功解析发货记录：${shippingRecords.length}笔`);
      }

      // 5. 数据清洗
      this.log('开始数据清洗...');
      const cleanedSales = this.cleanSalesRecords(salesRecords);
      this.log('✓ 数据清洗完成');

      // 6. 筛选测试期间的记录
      this.log('筛选测试期间的记录...');
      const testRecords = this.filterTestPeriod(cleanedSales, cutoffDate, testDays);
      this.log(`✓ 筛选出测试记录：${testRecords.length}笔`);

      // 7. 执行截止性测试
      this.log('执行截止性测试...');
      const testResults = this.performCutoffTest(
        testRecords,
        cutoffDate,
        revenueRecognitionBasis,
        allowedDays
      );
      this.log('✓ 截止性测试完成');

      // 8. 计算汇总数据
      this.log('计算测试结果汇总...');
      const summary = this.calculateSummary(testResults, cutoffDate, testDays);
      this.log('✓ 汇总数据计算完成');

      // 9. 识别跨期收入
      this.log('识别跨期收入...');
      const cutoffErrors = testResults.filter(r => r.isCutoffError);
      this.log(`✓ 识别出${cutoffErrors.length}笔跨期收入`);

      // 10. 生成调整分录
      this.log('生成调整分录建议...');
      const adjustmentEntries = this.generateAdjustmentEntries(cutoffErrors, cutoffDate);
      this.log(`✓ 生成${adjustmentEntries.length}条调整分录`);

      // 11. 导出测试明细表
      this.log('导出测试明细表...');
      const testListPath = await this.exportTestList(testResults);
      this.log(`✓ 测试明细表已导出：${testListPath}`);

      // 12. 导出跨期收入清单
      let cutoffErrorListPath = '';
      if (cutoffErrors.length > 0) {
        this.log('导出跨期收入清单...');
        cutoffErrorListPath = await this.exportCutoffErrorList(cutoffErrors);
        this.log(`✓ 跨期收入清单已导出：${cutoffErrorListPath}`);
      }

      // 13. 导出调整分录
      let adjustmentEntriesPath = '';
      if (adjustmentEntries.length > 0) {
        this.log('导出调整分录...');
        adjustmentEntriesPath = await this.exportAdjustmentEntries(adjustmentEntries);
        this.log(`✓ 调整分录已导出：${adjustmentEntriesPath}`);
      }

      // 14. 生成审计底稿
      this.log('生成审计底稿...');
      const workpaperPath = await this.generateCutoffTestWorkpaper(
        summary,
        testResults,
        cutoffErrors,
        adjustmentEntries
      );
      this.log(`✓ 审计底稿已生成：${workpaperPath}`);

      // 15. 完成执行
      const duration = Date.now() - startTime;
      this.log(`========== 收入截止性测试节点执行完成，耗时：${duration}ms ==========`);

      return {
        success: true,
        data: {
          summary,
          testResults,
          cutoffErrors,
          adjustmentEntries,
        },
        outputs: {
          summary,
          testList: testListPath,
          cutoffErrorList: cutoffErrorListPath || null,
          adjustmentEntries: adjustmentEntriesPath || null,
          workpaper: workpaperPath,
        },
        logs: this.getLogs(),
        duration,
      };
    } catch (error: any) {
      this.log(`❌ 执行失败：${error.message}`);
      return {
        success: false,
        error: error.message,
        logs: this.getLogs(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 清洗销售记录数据
   * 
   * @description 规范化数据格式，过滤无效记录
   * 
   * @private
   * @param {any[]} sales - 原始销售数据
   * @returns {SalesRecord[]} 清洗后的数据
   */
  private cleanSalesRecords(sales: any[]): SalesRecord[] {
    return sales
      .filter(s => s.销售单号 && s.销售日期)
      .map(s => ({
        salesNo: String(s.销售单号).trim(),
        customerName: String(s.客户名称 || '').trim(),
        salesDate: this.normalizeDate(s.销售日期),
        amount: Number(s.销售金额 || s.金额 || 0),
        shippingDate: s.发货日期 ? this.normalizeDate(s.发货日期) : undefined,
        shippingNo: s.发货单号 ? String(s.发货单号).trim() : undefined,
        paymentDate: s.收款日期 ? this.normalizeDate(s.收款日期) : undefined,
        productName: s.产品名称 ? String(s.产品名称).trim() : undefined,
      }));
  }

  /**
   * 规范化日期格式
   * 
   * @description 将各种日期格式统一为YYYY-MM-DD
   * 
   * @private
   * @param {any} date - 日期值
   * @returns {string} 规范化后的日期字符串
   */
  private normalizeDate(date: any): string {
    if (!date) return '';
    
    // 如果已经是标准格式
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    // 尝试解析为Date对象
    const dateObj = new Date(date);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }

    return String(date);
  }

  /**
   * 筛选测试期间的记录
   * 
   * @description 筛选出截止日前后指定天数内的记录
   * 
   * @private
   * @param {SalesRecord[]} records - 所有销售记录
   * @param {string} cutoffDate - 截止日期
   * @param {number} testDays - 测试天数
   * @returns {SalesRecord[]} 测试期间的记录
   */
  private filterTestPeriod(
    records: SalesRecord[],
    cutoffDate: string,
    testDays: number
  ): SalesRecord[] {
    const cutoff = new Date(cutoffDate);
    const startDate = new Date(cutoff);
    startDate.setDate(startDate.getDate() - testDays);
    const endDate = new Date(cutoff);
    endDate.setDate(endDate.getDate() + testDays);

    return records.filter(r => {
      const salesDate = new Date(r.salesDate);
      return salesDate >= startDate && salesDate <= endDate;
    });
  }

  /**
   * 执行截止性测试
   * 
   * @description 检查每笔收入是否在正确的期间确认
   * 
   * @private
   * @param {SalesRecord[]} records - 测试记录
   * @param {string} cutoffDate - 截止日期
   * @param {string} basis - 收入确认依据
   * @param {number} allowedDays - 允许偏差天数
   * @returns {CutoffTestRecord[]} 测试结果
   */
  private performCutoffTest(
    records: SalesRecord[],
    cutoffDate: string,
    basis: string,
    allowedDays: number
  ): CutoffTestRecord[] {
    const cutoff = new Date(cutoffDate);

    return records.map(record => {
      const salesDate = new Date(record.salesDate);
      const period = salesDate <= cutoff ? '截止日前' : '截止日后';

      // 获取收入应确认的日期
      const recognitionDate = this.getRecognitionDate(record, basis);
      if (!recognitionDate) {
        // 无法确定应确认日期，视为需要进一步核实
        return {
          ...record,
          cutoffDate,
          period,
          isCutoffError: true,
          errorType: undefined,
          reason: `缺少${basis}信息，无法判断收入确认时点`,
        };
      }

      const recognition = new Date(recognitionDate);
      
      // 计算日期差异（天数）
      const daysDiff = Math.floor((salesDate.getTime() - recognition.getTime()) / (1000 * 60 * 60 * 24));
      
      // 判断是否在允许偏差范围内
      const isWithinAllowance = Math.abs(daysDiff) <= allowedDays;

      if (isWithinAllowance) {
        // 在允许范围内，视为正确
        return {
          ...record,
          cutoffDate,
          period,
          isCutoffError: false,
        };
      }

      // 判断跨期类型
      let errorType: '提前确认' | '延后确认';
      let correctPeriod: string;
      let reason: string;

      if (daysDiff > 0) {
        // 销售日期晚于应确认日期 = 延后确认
        errorType = '延后确认';
        correctPeriod = recognition <= cutoff ? '应在截止日前确认' : '应在截止日后确认';
        reason = `${basis}为${recognitionDate}，但收入确认延后${daysDiff}天`;
      } else {
        // 销售日期早于应确认日期 = 提前确认
        errorType = '提前确认';
        correctPeriod = recognition <= cutoff ? '应在截止日前确认' : '应在截止日后确认';
        reason = `${basis}为${recognitionDate}，但收入确认提前${Math.abs(daysDiff)}天`;
      }

      return {
        ...record,
        cutoffDate,
        period,
        isCutoffError: true,
        errorType,
        correctPeriod,
        reason,
        adjustmentAmount: this.shouldCrossCutoff(salesDate, recognition, cutoff) ? record.amount : 0,
      };
    });
  }

  /**
   * 获取收入应确认的日期
   * 
   * @description 根据指定依据确定收入应确认的日期
   * 
   * @private
   * @param {SalesRecord} record - 销售记录
   * @param {string} basis - 确认依据
   * @returns {string | undefined} 应确认日期
   */
  private getRecognitionDate(record: SalesRecord, basis: string): string | undefined {
    switch (basis) {
      case '发货日期':
        return record.shippingDate;
      case '开票日期':
        // 这里简化处理，实际应从开票记录获取
        return record.salesDate;
      case '验收日期':
        // 这里简化处理，实际应从验收记录获取
        return record.paymentDate;
      case '合同约定日期':
        // 这里简化处理，实际应从合同中获取
        return record.salesDate;
      default:
        return record.shippingDate || record.salesDate;
    }
  }

  /**
   * 判断是否跨越截止日
   * 
   * @description 判断收入确认日期和应确认日期是否跨越截止日
   * 
   * @private
   * @param {Date} salesDate - 销售确认日期
   * @param {Date} recognitionDate - 应确认日期
   * @param {Date} cutoffDate - 截止日期
   * @returns {boolean} 是否跨期
   */
  private shouldCrossCutoff(salesDate: Date, recognitionDate: Date, cutoffDate: Date): boolean {
    const salesBeforeCutoff = salesDate <= cutoffDate;
    const recognitionBeforeCutoff = recognitionDate <= cutoffDate;
    return salesBeforeCutoff !== recognitionBeforeCutoff;
  }

  /**
   * 计算测试结果汇总
   * 
   * @description 统计截止性测试的关键指标
   * 
   * @private
   * @param {CutoffTestRecord[]} records - 测试记录
   * @param {string} cutoffDate - 截止日期
   * @param {number} testDays - 测试天数
   * @returns {CutoffTestSummary} 汇总数据
   */
  private calculateSummary(
    records: CutoffTestRecord[],
    cutoffDate: string,
    testDays: number
  ): CutoffTestSummary {
    const cutoff = new Date(cutoffDate);
    const startDate = new Date(cutoff);
    startDate.setDate(startDate.getDate() - testDays);
    const endDate = new Date(cutoff);
    endDate.setDate(endDate.getDate() + testDays);

    const beforeRecords = records.filter(r => new Date(r.salesDate) <= cutoff);
    const afterRecords = records.filter(r => new Date(r.salesDate) > cutoff);
    const errorRecords = records.filter(r => r.isCutoffError);
    const earlyRecords = errorRecords.filter(r => r.errorType === '提前确认');
    const lateRecords = errorRecords.filter(r => r.errorType === '延后确认');

    const beforeCount = beforeRecords.length;
    const beforeAmount = beforeRecords.reduce((sum, r) => sum + r.amount, 0);
    const afterCount = afterRecords.length;
    const afterAmount = afterRecords.reduce((sum, r) => sum + r.amount, 0);
    const cutoffErrorCount = errorRecords.length;
    const cutoffErrorAmount = errorRecords.reduce((sum, r) => sum + (r.adjustmentAmount || 0), 0);

    return {
      cutoffDate,
      testPeriod: `${startDate.toISOString().split('T')[0]} 至 ${endDate.toISOString().split('T')[0]}`,
      beforeCount,
      beforeAmount,
      afterCount,
      afterAmount,
      cutoffErrorCount,
      cutoffErrorAmount,
      earlyRecognitionCount: earlyRecords.length,
      earlyRecognitionAmount: earlyRecords.reduce((sum, r) => sum + (r.adjustmentAmount || 0), 0),
      lateRecognitionCount: lateRecords.length,
      lateRecognitionAmount: lateRecords.reduce((sum, r) => sum + (r.adjustmentAmount || 0), 0),
      accuracyRate: records.length > 0 ? (records.length - cutoffErrorCount) / records.length : 1,
    };
  }

  /**
   * 生成调整分录
   * 
   * @description 为跨期收入生成会计调整分录
   * 
   * @private
   * @param {CutoffTestRecord[]} errors - 跨期记录
   * @param {string} cutoffDate - 截止日期
   * @returns {any[]} 调整分录
   */
  private generateAdjustmentEntries(errors: CutoffTestRecord[], cutoffDate: string): any[] {
    return errors
      .filter(e => e.adjustmentAmount && e.adjustmentAmount > 0)
      .map(e => {
        if (e.errorType === '提前确认') {
          // 提前确认收入，应冲减本期收入
          return {
            销售单号: e.salesNo,
            客户名称: e.customerName,
            调整类型: '冲减提前确认的收入',
            借方科目: '主营业务收入',
            借方金额: e.adjustmentAmount,
            贷方科目: '预收账款/应收账款',
            贷方金额: e.adjustmentAmount,
            调整原因: e.reason,
            调整金额: e.adjustmentAmount,
          };
        } else {
          // 延后确认收入，应补确认本期收入
          return {
            销售单号: e.salesNo,
            客户名称: e.customerName,
            调整类型: '补确认延后的收入',
            借方科目: '应收账款/预收账款',
            借方金额: e.adjustmentAmount,
            贷方科目: '主营业务收入',
            贷方金额: e.adjustmentAmount,
            调整原因: e.reason,
            调整金额: e.adjustmentAmount,
          };
        }
      });
  }

  /**
   * 导出测试明细表
   * 
   * @description 将测试记录导出为Excel文件
   * 
   * @private
   * @param {CutoffTestRecord[]} records - 测试记录
   * @returns {Promise<string>} 文件路径
   */
  private async exportTestList(records: CutoffTestRecord[]): Promise<string> {
    const headers = [
      '销售单号',
      '客户名称',
      '销售日期',
      '销售金额',
      '发货日期',
      '记录期间',
      '是否跨期',
      '跨期类型',
      '跨期原因',
      '建议调整金额',
    ];

    const data = records.map(r => ({
      销售单号: r.salesNo,
      客户名称: r.customerName,
      销售日期: r.salesDate,
      销售金额: r.amount,
      发货日期: r.shippingDate || '',
      记录期间: r.period,
      是否跨期: r.isCutoffError ? '是' : '否',
      跨期类型: r.errorType || '',
      跨期原因: r.reason || '',
      建议调整金额: r.adjustmentAmount || 0,
    }));

    return await this.exportExcel(
      data,
      headers,
      `收入截止性测试明细_${Date.now()}.xlsx`
    );
  }

  /**
   * 导出跨期收入清单
   * 
   * @description 导出识别出的跨期收入明细
   * 
   * @private
   * @param {CutoffTestRecord[]} errors - 跨期记录
   * @returns {Promise<string>} 文件路径
   */
  private async exportCutoffErrorList(errors: CutoffTestRecord[]): Promise<string> {
    const headers = [
      '销售单号',
      '客户名称',
      '销售日期',
      '发货日期',
      '销售金额',
      '跨期类型',
      '跨期原因',
      '正确期间',
      '建议调整金额',
      '重要性',
    ];

    const data = errors.map(r => ({
      销售单号: r.salesNo,
      客户名称: r.customerName,
      销售日期: r.salesDate,
      发货日期: r.shippingDate || '',
      销售金额: r.amount,
      跨期类型: r.errorType || '',
      跨期原因: r.reason || '',
      正确期间: r.correctPeriod || '',
      建议调整金额: r.adjustmentAmount || 0,
      重要性: (r.adjustmentAmount || 0) > 10000 ? '重要' : '一般',
    }));

    return await this.exportExcel(
      data,
      headers,
      `跨期收入清单_${Date.now()}.xlsx`
    );
  }

  /**
   * 导出调整分录
   * 
   * @description 导出会计调整分录
   * 
   * @private
   * @param {any[]} entries - 调整分录
   * @returns {Promise<string>} 文件路径
   */
  private async exportAdjustmentEntries(entries: any[]): Promise<string> {
    const headers = [
      '销售单号',
      '客户名称',
      '调整类型',
      '借方科目',
      '借方金额',
      '贷方科目',
      '贷方金额',
      '调整原因',
    ];

    return await this.exportExcel(
      entries,
      headers,
      `收入截止调整分录_${Date.now()}.xlsx`
    );
  }

  /**
   * 生成截止性测试审计底稿
   * 
   * @description 生成标准格式的截止性测试审计工作底稿
   * 
   * @private
   * @param {CutoffTestSummary} summary - 汇总数据
   * @param {CutoffTestRecord[]} records - 测试记录
   * @param {CutoffTestRecord[]} errors - 跨期记录
   * @param {any[]} adjustments - 调整分录
   * @returns {Promise<string>} 底稿文件路径
   */
  private async generateCutoffTestWorkpaper(
    summary: CutoffTestSummary,
    records: CutoffTestRecord[],
    errors: CutoffTestRecord[],
    adjustments: any[]
  ): Promise<string> {
    const sections: Array<{
      title: string;
      headers: string[];
      data: any[];
    }> = [
      {
        title: '一、截止性测试程序执行情况',
        headers: ['指标', '数值', '说明'],
        data: [
          {
            指标: '测试截止日期',
            数值: summary.cutoffDate,
            说明: '资产负债表日',
          },
          {
            指标: '测试期间',
            数值: summary.testPeriod,
            说明: '截止日前后测试范围',
          },
          {
            指标: '截止日前记录数',
            数值: summary.beforeCount + '笔',
            说明: '金额: ' + summary.beforeAmount.toFixed(2) + '元',
          },
          {
            指标: '截止日后记录数',
            数值: summary.afterCount + '笔',
            说明: '金额: ' + summary.afterAmount.toFixed(2) + '元',
          },
          {
            指标: '跨期记录数',
            数值: summary.cutoffErrorCount + '笔',
            说明: '占比: ' + ((summary.cutoffErrorCount / (summary.beforeCount + summary.afterCount)) * 100).toFixed(2) + '%',
          },
          {
            指标: '截止准确率',
            数值: (summary.accuracyRate * 100).toFixed(2) + '%',
            说明: summary.accuracyRate >= 0.95 ? '✓ 符合要求' : '✗ 需关注',
          },
        ],
      },
      {
        title: '二、测试样本明细（前20笔）',
        headers: ['销售单号', '客户名称', '销售日期', '销售金额', '记录期间', '是否跨期'],
        data: records.slice(0, 20).map(r => ({
          销售单号: r.salesNo,
          客户名称: r.customerName,
          销售日期: r.salesDate,
          销售金额: r.amount,
          记录期间: r.period,
          是否跨期: r.isCutoffError ? '是' : '否',
        })),
      },
    ];

    if (errors.length > 0) {
      sections.push({
        title: '三、跨期收入分析',
        headers: ['销售单号', '客户名称', '金额', '跨期类型', '跨期原因', '建议调整'],
        data: errors.slice(0, 20).map(r => ({
          销售单号: r.salesNo,
          客户名称: r.customerName,
          金额: r.amount,
          跨期类型: r.errorType || '',
          跨期原因: r.reason || '',
          建议调整: (r.adjustmentAmount || 0).toFixed(2) + '元',
        })),
      });

      sections.push({
        title: '四、跨期影响汇总',
        headers: ['跨期类型', '笔数', '金额', '影响'],
        data: [
          {
            跨期类型: '提前确认收入',
            笔数: summary.earlyRecognitionCount,
            金额: summary.earlyRecognitionAmount.toFixed(2),
            影响: '虚增本期收入',
          },
          {
            跨期类型: '延后确认收入',
            笔数: summary.lateRecognitionCount,
            金额: summary.lateRecognitionAmount.toFixed(2),
            影响: '少计本期收入',
          },
          {
            跨期类型: '合计',
            笔数: summary.cutoffErrorCount,
            金额: summary.cutoffErrorAmount.toFixed(2),
            影响: '需要调整',
          },
        ],
      });
    }

    sections.push({
      title: '五、审计结论',
      headers: ['项目', '结论'],
      data: [
        {
          项目: '截止性测试执行情况',
          结论: `本次测试覆盖截止日前后各期间，共测试${summary.beforeCount + summary.afterCount}笔收入记录`,
        },
        {
          项目: '截止准确性评价',
          结论: summary.accuracyRate >= 0.95
            ? `截止准确率${(summary.accuracyRate * 100).toFixed(2)}%，收入确认截止基本正确`
            : `截止准确率${(summary.accuracyRate * 100).toFixed(2)}%，存在一定跨期问题，需要进一步关注`,
        },
        {
          项目: '跨期收入影响',
          结论: errors.length > 0
            ? `识别出${errors.length}笔跨期收入，其中提前确认${summary.earlyRecognitionCount}笔（${summary.earlyRecognitionAmount.toFixed(2)}元），延后确认${summary.lateRecognitionCount}笔（${summary.lateRecognitionAmount.toFixed(2)}元）`
            : '未发现重大跨期收入问题',
        },
        {
          项目: '调整建议',
          结论: adjustments.length > 0
            ? `建议对${adjustments.length}笔跨期收入进行会计调整，合计调整金额${summary.cutoffErrorAmount.toFixed(2)}元`
            : '无需调整',
        },
        {
          项目: '审计意见',
          结论: this.getAuditOpinion(summary, errors),
        },
      ],
    });

    return await this.generateWorkpaper(
      '收入截止性测试审计工作底稿',
      sections
    );
  }

  /**
   * 获取审计意见
   * 
   * @description 根据测试结果给出审计意见
   * 
   * @private
   * @param {CutoffTestSummary} summary - 汇总数据
   * @param {CutoffTestRecord[]} errors - 跨期记录
   * @returns {string} 审计意见
   */
  private getAuditOpinion(summary: CutoffTestSummary, errors: CutoffTestRecord[]): string {
    if (summary.accuracyRate >= 0.98 && summary.cutoffErrorAmount < 10000) {
      return '收入确认截止性测试结果良好，未发现重大跨期收入问题，收入确认符合会计准则要求';
    } else if (summary.accuracyRate >= 0.95) {
      return '收入确认截止性基本准确，存在少量跨期收入，建议进一步核实原因并评估对财务报表的影响';
    } else if (summary.cutoffErrorAmount > summary.beforeAmount * 0.05) {
      return '发现较多跨期收入问题，跨期金额占比较大，建议扩大测试范围，重点关注收入确认政策的执行情况';
    } else {
      return '发现一定数量的跨期收入，建议与被审计单位沟通，了解收入确认政策，必要时建议调整财务报表';
    }
  }
}
