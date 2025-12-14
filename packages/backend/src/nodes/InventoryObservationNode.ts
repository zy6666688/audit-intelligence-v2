/**
 * 存货监盘节点
 * 
 * @description 协助进行存货盘点，验证存货的存在性和完整性
 * 现场监督盘点过程，记录盘点结果，分析账实差异
 * 
 * @author SHENJI Team
 * @date 2025-12-04
 * @version 1.0.0
 * @since Week 2: 核心节点开发 - 存货循环
 * 
 * @example
 * ```typescript
 * const node = new InventoryObservationNode();
 * const result = await node.execute({
 *   inventoryBook: '/path/to/inventory.xlsx',
 *   countRecords: '/path/to/count.xlsx'
 * }, {
 *   toleranceRate: 0.02
 * });
 * ```
 */

import { BaseNode, NodeExecutionResult } from './BaseNode';
import { BusinessError, ErrorCode } from '../constants/ErrorCode';

/**
 * 存货账面记录接口
 */
interface InventoryBook {
  /** 存货编号 */
  itemCode: string;
  /** 存货名称 */
  itemName: string;
  /** 规格型号 */
  specification?: string;
  /** 计量单位 */
  unit: string;
  /** 账面数量 */
  bookQuantity: number;
  /** 单价 */
  unitPrice: number;
  /** 账面金额 */
  bookAmount: number;
  /** 存放地点 */
  location?: string;
  /** 存货类别 */
  category?: string;
}

/**
 * 盘点记录接口
 */
interface CountRecord extends InventoryBook {
  /** 实盘数量 */
  actualQuantity: number;
  /** 实盘金额 */
  actualAmount: number;
  /** 差异数量 */
  differenceQuantity: number;
  /** 差异金额 */
  differenceAmount: number;
  /** 差异率 */
  differenceRate: number;
  /** 是否相符 */
  matched: boolean;
  /** 盘点日期 */
  countDate?: string;
  /** 盘点人员 */
  counter?: string;
  /** 存货状况 */
  condition?: '良好' | '一般' | '损坏' | '过期';
  /** 差异原因 */
  reason?: string;
}

/**
 * 盘点结果汇总接口
 */
interface ObservationSummary {
  /** 存货品种总数 */
  totalItems: number;
  /** 账面总数量 */
  totalBookQuantity: number;
  /** 账面总金额 */
  totalBookAmount: number;
  /** 实盘品种数 */
  countedItems: number;
  /** 实盘总数量 */
  totalActualQuantity: number;
  /** 实盘总金额 */
  totalActualAmount: number;
  /** 盘点覆盖率 */
  coverageRate: number;
  /** 相符品种数 */
  matchedItems: number;
  /** 相符率 */
  matchRate: number;
  /** 盘盈品种数 */
  surplusItems: number;
  /** 盘盈金额 */
  surplusAmount: number;
  /** 盘亏品种数 */
  shortageItems: number;
  /** 盘亏金额 */
  shortageAmount: number;
  /** 差异总金额 */
  totalDifference: number;
  /** 账实相符率 */
  accuracyRate: number;
}

/**
 * 存货监盘节点
 * 
 * @description 执行存货监盘程序的审计节点
 * 包括盘点计划、现场监盘、差异分析、审计结论等完整流程
 * 
 * @extends {BaseNode}
 */
export class InventoryObservationNode extends BaseNode {
  /**
   * 节点元数据
   */
  static metadata = {
    id: 'inventory-observation',
    name: '存货监盘',
    category: '存货循环',
    description: '协助进行存货盘点，验证存货的存在性、完整性和计价准确性',
    icon: 'warehouse',
    version: '1.0.0',
  };

  /**
   * 输入定义
   */
  static inputs = [
    {
      name: 'inventoryBook',
      label: '存货明细账',
      type: 'excel' as const,
      required: true,
      description: '从财务系统导出的存货明细账（包含：存货编号、名称、数量、金额、存放地点等）',
    },
    {
      name: 'countRecords',
      label: '盘点记录表',
      type: 'excel' as const,
      required: true,
      description: '现场盘点记录（包含：存货编号、实盘数量、盘点日期、盘点人员等）',
    },
    {
      name: 'warehouseLayout',
      label: '仓库布局图',
      type: 'image' as const,
      required: false,
      description: '仓库布局图（可选，用于盘点计划和现场核对）',
    },
    {
      name: 'inventoryPhotos',
      label: '存货照片',
      type: 'image' as const,
      required: false,
      description: '存货实物照片（可选，作为监盘证据）',
    },
  ];

  /**
   * 输出定义
   */
  static outputs = [
    {
      name: 'summary',
      label: '盘点结果汇总',
      type: 'data' as const,
      description: '盘点程序执行的汇总数据（盘点覆盖率、账实相符率等关键指标）',
    },
    {
      name: 'countList',
      label: '盘点明细表',
      type: 'excel' as const,
      description: '详细的盘点记录清单（账面数、实盘数、差异分析）',
    },
    {
      name: 'differenceList',
      label: '差异清单',
      type: 'excel' as const,
      description: '盘盈盘亏明细清单及原因分析',
    },
    {
      name: 'observationMemo',
      label: '监盘备忘录',
      type: 'pdf' as const,
      description: '监盘过程记录和发现的问题',
    },
    {
      name: 'workpaper',
      label: '审计底稿',
      type: 'excel' as const,
      description: '存货监盘审计工作底稿',
    },
  ];

  /**
   * 配置项定义
   */
  static config = {
    toleranceRate: {
      label: '差异容忍率',
      type: 'number' as const,
      default: 0.02,
      description: '允许的账实差异比例（默认2%），差异在此范围内视为正常损耗',
    },
    countCoverageRate: {
      label: '盘点覆盖率',
      type: 'number' as const,
      default: 1.0,
      description: '要求的盘点覆盖率（0-1之间，1表示全部盘点）',
    },
    valueThreshold: {
      label: '重要性金额',
      type: 'number' as const,
      default: 50000,
      description: '重要性金额阈值（元），超过此金额的存货必须盘点',
    },
    checkCondition: {
      label: '是否检查存货状况',
      type: 'boolean' as const,
      default: true,
      description: '是否检查存货的物理状况（损坏、过期等）',
    },
    checkLocation: {
      label: '是否核对存放地点',
      type: 'boolean' as const,
      default: true,
      description: '是否核对存货的实际存放地点与账面记录是否一致',
    },
  };

  /**
   * 执行节点逻辑
   * 
   * @description 执行存货监盘的完整流程
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
      this.log('========== 开始执行存货监盘节点 ==========');

      // 1. 验证输入
      await this.validateInputs(inputs);
      this.log('✓ 输入验证通过');

      // 2. 解析存货明细账
      this.log('开始解析存货明细账...');
      const inventoryBook = await this.parseExcel(inputs.inventoryBook);
      this.log(`✓ 成功解析存货明细：${inventoryBook.length}个品种`);

      // 3. 解析盘点记录
      this.log('开始解析盘点记录...');
      const countRecords = await this.parseExcel(inputs.countRecords);
      this.log(`✓ 成功解析盘点记录：${countRecords.length}条记录`);

      // 4. 数据清洗和规范化
      this.log('开始数据清洗和规范化...');
      const cleanedBook = this.cleanInventoryBook(inventoryBook);
      const cleanedCounts = this.cleanCountRecords(countRecords);
      this.log('✓ 数据清洗完成');

      // 5. 匹配账面记录和盘点记录
      this.log('匹配账面记录和盘点记录...');
      const matchedRecords = this.matchRecords(
        cleanedBook,
        cleanedCounts,
        config.toleranceRate || 0.02
      );
      this.log(`✓ 匹配完成，共${matchedRecords.length}条记录`);

      // 6. 计算汇总数据
      this.log('计算盘点结果汇总...');
      const summary = this.calculateSummary(cleanedBook, matchedRecords);
      this.log('✓ 汇总数据计算完成');

      // 7. 识别差异项
      this.log('识别盘盈盘亏项...');
      const differences = matchedRecords.filter(r => !r.matched);
      this.log(`✓ 识别出${differences.length}个差异项`);

      // 8. 评估盘点质量
      this.log('评估盘点质量...');
      const qualityIssues = this.evaluateCountQuality(summary, config);
      if (qualityIssues.length > 0) {
        this.log(`⚠️ 发现${qualityIssues.length}个质量问题`);
        qualityIssues.forEach(issue => this.log(`  - ${issue}`));
      }

      // 9. 导出盘点明细表
      this.log('导出盘点明细表...');
      const countListPath = await this.exportCountList(matchedRecords);
      this.log(`✓ 盘点明细表已导出：${countListPath}`);

      // 10. 导出差异清单
      let differenceListPath = '';
      if (differences.length > 0) {
        this.log('导出差异清单...');
        differenceListPath = await this.exportDifferenceList(differences);
        this.log(`✓ 差异清单已导出：${differenceListPath}`);
      }

      // 11. 生成审计底稿
      this.log('生成审计底稿...');
      const workpaperPath = await this.generateObservationWorkpaper(
        summary,
        matchedRecords,
        differences,
        qualityIssues
      );
      this.log(`✓ 审计底稿已生成：${workpaperPath}`);

      // 12. 完成执行
      const duration = Date.now() - startTime;
      this.log(`========== 存货监盘节点执行完成，耗时：${duration}ms ==========`);

      return {
        success: true,
        data: {
          summary,
          matchedRecords,
          differences,
          qualityIssues,
        },
        outputs: {
          summary,
          countList: countListPath,
          differenceList: differenceListPath || null,
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
   * 清洗存货账面数据
   * 
   * @description 规范化数据格式，过滤无效记录
   * 
   * @private
   * @param {any[]} inventory - 原始存货数据
   * @returns {InventoryBook[]} 清洗后的数据
   */
  private cleanInventoryBook(inventory: any[]): InventoryBook[] {
    return inventory
      .filter(i => i.存货编号 && i.存货名称)
      .map(i => {
        const bookQuantity = Number(i.账面数量 || i.数量 || 0);
        const unitPrice = Number(i.单价 || 0);
        
        return {
          itemCode: String(i.存货编号).trim(),
          itemName: String(i.存货名称).trim(),
          specification: i.规格型号 ? String(i.规格型号).trim() : undefined,
          unit: String(i.计量单位 || i.单位 || '个').trim(),
          bookQuantity,
          unitPrice,
          bookAmount: i.账面金额 ? Number(i.账面金额) : bookQuantity * unitPrice,
          location: i.存放地点 ? String(i.存放地点).trim() : undefined,
          category: i.存货类别 ? String(i.存货类别).trim() : undefined,
        };
      });
  }

  /**
   * 清洗盘点记录数据
   * 
   * @description 规范化盘点记录格式
   * 
   * @private
   * @param {any[]} counts - 原始盘点记录
   * @returns {any[]} 清洗后的数据
   */
  private cleanCountRecords(counts: any[]): any[] {
    return counts
      .filter(c => c.存货编号)
      .map(c => ({
        itemCode: String(c.存货编号).trim(),
        actualQuantity: Number(c.实盘数量 || c.盘点数量 || 0),
        countDate: c.盘点日期 ? String(c.盘点日期) : undefined,
        counter: c.盘点人员 ? String(c.盘点人员).trim() : undefined,
        condition: c.存货状况 as '良好' | '一般' | '损坏' | '过期' | undefined,
        reason: c.差异原因 ? String(c.差异原因).trim() : undefined,
      }));
  }

  /**
   * 匹配账面记录和盘点记录
   * 
   * @description 将账面数据与盘点数据匹配，计算差异
   * 
   * @private
   * @param {InventoryBook[]} bookRecords - 账面记录
   * @param {any[]} countRecords - 盘点记录
   * @param {number} toleranceRate - 容差比率
   * @returns {CountRecord[]} 匹配后的记录
   */
  private matchRecords(
    bookRecords: InventoryBook[],
    countRecords: any[],
    toleranceRate: number
  ): CountRecord[] {
    const countMap = new Map<string, any>();
    countRecords.forEach(c => {
      countMap.set(c.itemCode, c);
    });

    return bookRecords.map(book => {
      const count = countMap.get(book.itemCode);
      
      if (!count) {
        // 未盘点
        return {
          ...book,
          actualQuantity: 0,
          actualAmount: 0,
          differenceQuantity: -book.bookQuantity,
          differenceAmount: -book.bookAmount,
          differenceRate: -1,
          matched: false,
          reason: '未盘点',
        };
      }

      // 已盘点
      const actualQuantity = count.actualQuantity;
      const actualAmount = actualQuantity * book.unitPrice;
      const differenceQuantity = actualQuantity - book.bookQuantity;
      const differenceAmount = actualAmount - book.bookAmount;
      const differenceRate = book.bookQuantity !== 0 
        ? Math.abs(differenceQuantity) / book.bookQuantity
        : (actualQuantity !== 0 ? 1 : 0);
      
      const matched = differenceRate <= toleranceRate;

      return {
        ...book,
        actualQuantity,
        actualAmount,
        differenceQuantity,
        differenceAmount,
        differenceRate,
        matched,
        countDate: count.countDate,
        counter: count.counter,
        condition: count.condition,
        reason: count.reason || (matched ? '' : this.analyzeDifferenceReason(differenceQuantity, differenceRate)),
      };
    });
  }

  /**
   * 分析差异原因
   * 
   * @description 根据差异数量和比率，推测可能的原因
   * 
   * @private
   * @param {number} differenceQuantity - 差异数量
   * @param {number} differenceRate - 差异率
   * @returns {string} 可能的差异原因
   */
  private analyzeDifferenceReason(differenceQuantity: number, differenceRate: number): string {
    if (differenceQuantity > 0) {
      // 盘盈
      if (differenceRate > 0.5) {
        return '可能原因：账务遗漏入库、盘点错误';
      } else if (differenceRate > 0.1) {
        return '可能原因：账务延迟、计量误差';
      } else {
        return '可能原因：正常损耗范围内的盘盈';
      }
    } else {
      // 盘亏
      if (differenceRate > 0.5) {
        return '可能原因：货物已发未记账、盘点遗漏、货物丢失';
      } else if (differenceRate > 0.1) {
        return '可能原因：正常损耗、账务延迟';
      } else {
        return '可能原因：正常损耗范围内的盘亏';
      }
    }
  }

  /**
   * 计算盘点结果汇总
   * 
   * @description 统计盘点覆盖率、账实相符率等关键指标
   * 
   * @private
   * @param {InventoryBook[]} bookRecords - 账面记录
   * @param {CountRecord[]} countRecords - 匹配后的记录
   * @returns {ObservationSummary} 汇总数据
   */
  private calculateSummary(
    bookRecords: InventoryBook[],
    countRecords: CountRecord[]
  ): ObservationSummary {
    const totalItems = bookRecords.length;
    const totalBookQuantity = bookRecords.reduce((sum, r) => sum + r.bookQuantity, 0);
    const totalBookAmount = bookRecords.reduce((sum, r) => sum + r.bookAmount, 0);

    const countedRecords = countRecords.filter(r => r.actualQuantity > 0 || r.reason !== '未盘点');
    const countedItems = countedRecords.length;
    const totalActualQuantity = countedRecords.reduce((sum, r) => sum + r.actualQuantity, 0);
    const totalActualAmount = countedRecords.reduce((sum, r) => sum + r.actualAmount, 0);

    const matchedRecords = countedRecords.filter(r => r.matched);
    const matchedItems = matchedRecords.length;

    const surplusRecords = countedRecords.filter(r => r.differenceQuantity > 0 && !r.matched);
    const surplusItems = surplusRecords.length;
    const surplusAmount = surplusRecords.reduce((sum, r) => sum + r.differenceAmount, 0);

    const shortageRecords = countedRecords.filter(r => r.differenceQuantity < 0 && !r.matched);
    const shortageItems = shortageRecords.length;
    const shortageAmount = Math.abs(shortageRecords.reduce((sum, r) => sum + r.differenceAmount, 0));

    const totalDifference = Math.abs(totalActualAmount - totalBookAmount);

    return {
      totalItems,
      totalBookQuantity,
      totalBookAmount,
      countedItems,
      totalActualQuantity,
      totalActualAmount,
      coverageRate: totalItems > 0 ? countedItems / totalItems : 0,
      matchedItems,
      matchRate: countedItems > 0 ? matchedItems / countedItems : 0,
      surplusItems,
      surplusAmount,
      shortageItems,
      shortageAmount,
      totalDifference,
      accuracyRate: totalBookAmount > 0 ? 1 - (totalDifference / totalBookAmount) : 1,
    };
  }

  /**
   * 评估盘点质量
   * 
   * @description 检查盘点是否符合审计要求
   * 
   * @private
   * @param {ObservationSummary} summary - 汇总数据
   * @param {Record<string, any>} config - 配置参数
   * @returns {string[]} 质量问题清单
   */
  private evaluateCountQuality(
    summary: ObservationSummary,
    config: Record<string, any>
  ): string[] {
    const issues: string[] = [];
    const requiredCoverage = config.countCoverageRate || 1.0;

    // 检查盘点覆盖率
    if (summary.coverageRate < requiredCoverage) {
      issues.push(
        `盘点覆盖率不足：实际${(summary.coverageRate * 100).toFixed(2)}%，要求${(requiredCoverage * 100).toFixed(2)}%`
      );
    }

    // 检查账实相符率
    if (summary.accuracyRate < 0.95) {
      issues.push(
        `账实相符率较低：${(summary.accuracyRate * 100).toFixed(2)}%，建议进一步核查差异原因`
      );
    }

    // 检查盘亏金额
    if (summary.shortageAmount > summary.totalBookAmount * 0.05) {
      issues.push(
        `盘亏金额较大：${summary.shortageAmount.toFixed(2)}元，占账面金额${((summary.shortageAmount / summary.totalBookAmount) * 100).toFixed(2)}%`
      );
    }

    // 检查盘盈金额
    if (summary.surplusAmount > summary.totalBookAmount * 0.05) {
      issues.push(
        `盘盈金额较大：${summary.surplusAmount.toFixed(2)}元，占账面金额${((summary.surplusAmount / summary.totalBookAmount) * 100).toFixed(2)}%`
      );
    }

    return issues;
  }

  /**
   * 导出盘点明细表
   * 
   * @description 将盘点记录导出为Excel文件
   * 
   * @private
   * @param {CountRecord[]} records - 盘点记录
   * @returns {Promise<string>} 文件路径
   */
  private async exportCountList(records: CountRecord[]): Promise<string> {
    const headers = [
      '存货编号',
      '存货名称',
      '规格型号',
      '计量单位',
      '账面数量',
      '实盘数量',
      '差异数量',
      '单价',
      '账面金额',
      '实盘金额',
      '差异金额',
      '差异率',
      '是否相符',
      '存货状况',
      '差异原因',
    ];

    const data = records.map(r => ({
      存货编号: r.itemCode,
      存货名称: r.itemName,
      规格型号: r.specification || '',
      计量单位: r.unit,
      账面数量: r.bookQuantity,
      实盘数量: r.actualQuantity,
      差异数量: r.differenceQuantity,
      单价: r.unitPrice,
      账面金额: r.bookAmount,
      实盘金额: r.actualAmount,
      差异金额: r.differenceAmount,
      差异率: (r.differenceRate * 100).toFixed(2) + '%',
      是否相符: r.matched ? '是' : '否',
      存货状况: r.condition || '',
      差异原因: r.reason || '',
    }));

    return await this.exportExcel(
      data,
      headers,
      `存货盘点明细_${Date.now()}.xlsx`
    );
  }

  /**
   * 导出差异清单
   * 
   * @description 导出盘盈盘亏明细清单
   * 
   * @private
   * @param {CountRecord[]} differences - 差异记录
   * @returns {Promise<string>} 文件路径
   */
  private async exportDifferenceList(differences: CountRecord[]): Promise<string> {
    const headers = [
      '存货编号',
      '存货名称',
      '账面数量',
      '实盘数量',
      '差异数量',
      '差异类型',
      '账面金额',
      '实盘金额',
      '差异金额',
      '差异率',
      '差异原因',
      '建议处理',
    ];

    const data = differences.map(r => ({
      存货编号: r.itemCode,
      存货名称: r.itemName,
      账面数量: r.bookQuantity,
      实盘数量: r.actualQuantity,
      差异数量: r.differenceQuantity,
      差异类型: r.differenceQuantity > 0 ? '盘盈' : '盘亏',
      账面金额: r.bookAmount,
      实盘金额: r.actualAmount,
      差异金额: r.differenceAmount,
      差异率: (r.differenceRate * 100).toFixed(2) + '%',
      差异原因: r.reason || '未说明',
      建议处理: this.getSuggestion(r),
    }));

    return await this.exportExcel(
      data,
      headers,
      `存货盘点差异清单_${Date.now()}.xlsx`
    );
  }

  /**
   * 获取差异处理建议
   * 
   * @description 根据差异情况给出处理建议
   * 
   * @private
   * @param {CountRecord} record - 差异记录
   * @returns {string} 处理建议
   */
  private getSuggestion(record: CountRecord): string {
    if (Math.abs(record.differenceAmount) > 10000) {
      return '金额重大，建议进一步核实并调整账务';
    } else if (record.differenceRate > 0.5) {
      return '差异率较大，建议重新盘点并核查原因';
    } else if (record.condition === '损坏' || record.condition === '过期') {
      return '存货状况异常，建议评估减值并计提准备';
    } else {
      return '建议核实差异原因，必要时调整账务';
    }
  }

  /**
   * 生成存货监盘审计底稿
   * 
   * @description 生成标准格式的存货监盘审计工作底稿
   * 
   * @private
   * @param {ObservationSummary} summary - 汇总数据
   * @param {CountRecord[]} records - 盘点记录
   * @param {CountRecord[]} differences - 差异记录
   * @param {string[]} qualityIssues - 质量问题
   * @returns {Promise<string>} 底稿文件路径
   */
  private async generateObservationWorkpaper(
    summary: ObservationSummary,
    records: CountRecord[],
    differences: CountRecord[],
    qualityIssues: string[]
  ): Promise<string> {
    const sections: Array<{
      title: string;
      headers: string[];
      data: any[];
    }> = [
      {
        title: '一、存货监盘程序执行情况',
        headers: ['指标', '数量/金额', '比率'],
        data: [
          {
            指标: '存货品种总数',
            '数量/金额': summary.totalItems + '个',
            比率: '100%',
          },
          {
            指标: '账面总金额',
            '数量/金额': summary.totalBookAmount.toFixed(2) + '元',
            比率: '100%',
          },
          {
            指标: '已盘点品种数',
            '数量/金额': summary.countedItems + '个',
            比率: (summary.coverageRate * 100).toFixed(2) + '%',
          },
          {
            指标: '实盘总金额',
            '数量/金额': summary.totalActualAmount.toFixed(2) + '元',
            比率: (summary.totalActualAmount / summary.totalBookAmount * 100).toFixed(2) + '%',
          },
          {
            指标: '账实相符品种数',
            '数量/金额': summary.matchedItems + '个',
            比率: (summary.matchRate * 100).toFixed(2) + '%',
          },
          {
            指标: '盘盈品种数',
            '数量/金额': summary.surplusItems + '个',
            比率: (summary.surplusItems / summary.countedItems * 100).toFixed(2) + '%',
          },
          {
            指标: '盘盈金额',
            '数量/金额': summary.surplusAmount.toFixed(2) + '元',
            比率: '',
          },
          {
            指标: '盘亏品种数',
            '数量/金额': summary.shortageItems + '个',
            比率: (summary.shortageItems / summary.countedItems * 100).toFixed(2) + '%',
          },
          {
            指标: '盘亏金额',
            '数量/金额': summary.shortageAmount.toFixed(2) + '元',
            比率: '',
          },
          {
            指标: '账实相符率',
            '数量/金额': (summary.accuracyRate * 100).toFixed(2) + '%',
            比率: summary.accuracyRate >= 0.95 ? '✓ 符合要求' : '✗ 需关注',
          },
        ],
      },
      {
        title: '二、存货明细（前20项）',
        headers: ['存货名称', '账面数量', '实盘数量', '差异数量', '账面金额', '差异金额', '是否相符'],
        data: records.slice(0, 20).map(r => ({
          存货名称: r.itemName,
          账面数量: r.bookQuantity,
          实盘数量: r.actualQuantity,
          差异数量: r.differenceQuantity,
          账面金额: r.bookAmount,
          差异金额: r.differenceAmount,
          是否相符: r.matched ? '是' : '否',
        })),
      },
    ];

    if (differences.length > 0) {
      sections.push({
        title: '三、盘盈盘亏分析',
        headers: ['存货名称', '差异类型', '差异数量', '差异金额', '差异率', '差异原因'],
        data: differences.slice(0, 20).map(r => ({
          存货名称: r.itemName,
          差异类型: r.differenceQuantity > 0 ? '盘盈' : '盘亏',
          差异数量: r.differenceQuantity,
          差异金额: r.differenceAmount,
          差异率: (r.differenceRate * 100).toFixed(2) + '%',
          差异原因: r.reason || '未说明',
        })),
      });
    }

    if (qualityIssues.length > 0) {
      sections.push({
        title: '四、盘点质量问题',
        headers: ['序号', '问题描述'],
        data: qualityIssues.map((issue, index) => ({
          序号: index + 1,
          问题描述: issue,
        })),
      });
    }

    sections.push({
      title: '五、审计结论',
      headers: ['项目', '结论'],
      data: [
        {
          项目: '监盘程序执行情况',
          结论: `本次监盘覆盖${summary.countedItems}个存货品种，盘点覆盖率${(summary.coverageRate * 100).toFixed(2)}%`,
        },
        {
          项目: '账实相符情况',
          结论: summary.accuracyRate >= 0.95
            ? `账实相符率${(summary.accuracyRate * 100).toFixed(2)}%，存货账面记录基本准确`
            : `账实相符率${(summary.accuracyRate * 100).toFixed(2)}%，存在一定差异，需要进一步核实`,
        },
        {
          项目: '盘盈盘亏情况',
          结论: differences.length > 0
            ? `识别出${differences.length}项差异，其中盘盈${summary.surplusItems}项（${summary.surplusAmount.toFixed(2)}元），盘亏${summary.shortageItems}项（${summary.shortageAmount.toFixed(2)}元）`
            : '未发现盘盈盘亏情况',
        },
        {
          项目: '审计评价',
          结论: summary.accuracyRate >= 0.95 && qualityIssues.length === 0
            ? '存货监盘程序执行充分，账实基本相符，存货数量和金额真实可靠'
            : '存货监盘发现一些问题，建议进一步执行审计程序，评估对财务报表的影响',
        },
        {
          项目: '后续审计建议',
          结论: this.getAuditSuggestion(summary, differences, qualityIssues),
        },
      ],
    });

    return await this.generateWorkpaper(
      '存货监盘审计工作底稿',
      sections
    );
  }

  /**
   * 获取后续审计建议
   * 
   * @description 根据监盘结果给出后续审计建议
   * 
   * @private
   * @param {ObservationSummary} summary - 汇总数据
   * @param {CountRecord[]} differences - 差异记录
   * @param {string[]} qualityIssues - 质量问题
   * @returns {string} 审计建议
   */
  private getAuditSuggestion(
    summary: ObservationSummary,
    differences: CountRecord[],
    qualityIssues: string[]
  ): string {
    const suggestions: string[] = [];

    if (summary.coverageRate < 1.0) {
      suggestions.push('对未盘点的存货执行替代程序（如检查收发存记录、期后盘点等）');
    }

    if (differences.length > 0) {
      suggestions.push('对盘盈盘亏项目进行详细调查，了解差异产生的具体原因');
      suggestions.push('评估差异对财务报表的影响，必要时建议调整');
    }

    if (summary.shortageAmount > summary.totalBookAmount * 0.02) {
      suggestions.push('盘亏金额较大，建议评估存货管理内部控制的有效性');
    }

    const damagedItems = differences.filter(r => r.condition === '损坏' || r.condition === '过期');
    if (damagedItems.length > 0) {
      suggestions.push('对损坏、过期等状况异常的存货，建议评估是否需要计提减值准备');
    }

    if (qualityIssues.length > 0) {
      suggestions.push('关注盘点质量问题，必要时扩大盘点范围或重新盘点');
    }

    if (suggestions.length === 0) {
      return '监盘结果良好，无需执行额外的审计程序';
    }

    return suggestions.join('；');
  }
}
