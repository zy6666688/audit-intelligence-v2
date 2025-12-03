/**
 * 银行询证节点
 * 
 * @description 向银行发送询证函，验证银行存款、借款等账户信息的真实性
 * 核对账面余额与银行回函余额，分析差异原因
 * 
 * @author SHENJI Team
 * @date 2025-12-03
 * @version 1.0.0
 * @since Week 2: 核心节点开发 - 货币资金循环
 * 
 * @example
 * ```typescript
 * const node = new BankConfirmationNode();
 * const result = await node.execute({
 *   bankAccountList: '/path/to/accounts.xlsx',
 *   balanceSheet: '/path/to/balance.xlsx'
 * }, {
 *   confirmAllAccounts: true
 * });
 * ```
 */

import { BaseNode, NodeExecutionResult } from './BaseNode';
import { BusinessError, ErrorCode } from '../constants/ErrorCode';

/**
 * 银行账户信息接口
 */
interface BankAccount {
  /** 银行账号 */
  accountNumber: string;
  /** 银行名称 */
  bankName: string;
  /** 开户行 */
  bankBranch: string;
  /** 账户类型（存款/借款） */
  accountType: '存款' | '借款' | '其他';
  /** 账面余额 */
  bookBalance: number;
  /** 币种 */
  currency: string;
  /** 银行联系人 */
  contact?: string;
  /** 银行联系电话 */
  phone?: string;
  /** 银行联系邮箱 */
  email?: string;
  /** 银行地址 */
  address?: string;
}

/**
 * 询证记录接口
 */
interface ConfirmationRecord extends BankAccount {
  /** 是否发函 */
  sent: boolean;
  /** 发函日期 */
  sentDate?: string;
  /** 是否回函 */
  responded: boolean;
  /** 回函日期 */
  responseDate?: string;
  /** 银行确认余额 */
  confirmedBalance?: number;
  /** 是否相符 */
  matched: boolean;
  /** 差异金额 */
  difference: number;
  /** 差异原因 */
  reason?: string;
  /** 未达账项 */
  reconciliationItems?: string[];
}

/**
 * 询证结果汇总接口
 */
interface ConfirmationSummary {
  /** 账户总数 */
  totalAccounts: number;
  /** 发函账户数 */
  sentCount: number;
  /** 发函账户余额 */
  sentBalance: number;
  /** 回函账户数 */
  respondedCount: number;
  /** 回函账户余额 */
  respondedBalance: number;
  /** 回函率 */
  responseRate: number;
  /** 相符账户数 */
  matchedCount: number;
  /** 相符账户余额 */
  matchedBalance: number;
  /** 相符率 */
  matchRate: number;
  /** 不符账户数 */
  unmatchedCount: number;
  /** 不符账户余额 */
  unmatchedBalance: number;
  /** 差异总额 */
  totalDifference: number;
  /** 未回函账户数 */
  noResponseCount: number;
  /** 未回函账户余额 */
  noResponseBalance: number;
}

/**
 * 银行询证节点
 * 
 * @description 执行银行询证程序的审计节点
 * 包括账户选择、询证函生成、回函处理、差异分析等完整流程
 * 
 * @extends {BaseNode}
 */
export class BankConfirmationNode extends BaseNode {
  /**
   * 节点元数据
   */
  static metadata = {
    id: 'bank-confirmation',
    name: '银行询证',
    category: '货币资金循环',
    description: '向银行发送询证函，验证银行存款、借款等账户信息的真实性和准确性',
    icon: 'bank',
    version: '1.0.0',
  };

  /**
   * 输入定义
   */
  static inputs = [
    {
      name: 'bankAccountList',
      label: '银行账户清单',
      type: 'excel' as const,
      required: true,
      description: '从财务系统导出的银行账户清单（包含：账号、银行名称、开户行、账户类型、账面余额等）',
    },
    {
      name: 'balanceSheet',
      label: '银行存款余额调节表',
      type: 'excel' as const,
      required: false,
      description: '银行存款余额调节表（可选，包含未达账项等信息）',
    },
    {
      name: 'responseRecords',
      label: '银行回函记录',
      type: 'excel' as const,
      required: false,
      description: '已收到的银行回函记录（可选，包含：账号、回函日期、确认余额等）',
    },
  ];

  /**
   * 输出定义
   */
  static outputs = [
    {
      name: 'summary',
      label: '询证结果汇总',
      type: 'data' as const,
      description: '询证程序执行的汇总数据（发函率、回函率、相符率等关键指标）',
    },
    {
      name: 'confirmationList',
      label: '询证明细表',
      type: 'excel' as const,
      description: '详细的询证记录清单（发函情况、回函情况、差异分析）',
    },
    {
      name: 'differenceList',
      label: '差异清单',
      type: 'excel' as const,
      description: '回函不符账户的详细清单及差异分析',
    },
    {
      name: 'confirmationLetters',
      label: '询证函文件',
      type: 'pdf' as const,
      description: '批量生成的银行询证函PDF文件',
    },
    {
      name: 'workpaper',
      label: '审计底稿',
      type: 'excel' as const,
      description: '银行询证审计工作底稿',
    },
  ];

  /**
   * 配置项定义
   */
  static config = {
    confirmAllAccounts: {
      label: '是否全部发函',
      type: 'boolean' as const,
      default: true,
      description: '是否对所有银行账户都发询证函（银行询证通常100%发函）',
    },
    materialityAmount: {
      label: '重要性金额',
      type: 'number' as const,
      default: 50000,
      description: '重要性水平金额（元），用于评估差异重要性',
    },
    includeZeroBalance: {
      label: '是否函证零余额账户',
      type: 'boolean' as const,
      default: true,
      description: '是否对余额为零的银行账户也发函',
    },
    includeClosed: {
      label: '是否函证已销户账户',
      type: 'boolean' as const,
      default: false,
      description: '是否对已注销的银行账户也发函',
    },
    autoMatchTolerance: {
      label: '自动匹配容差',
      type: 'number' as const,
      default: 1,
      description: '自动判定相符的金额容差（元），差异在此范围内视为相符',
    },
  };

  /**
   * 执行节点逻辑
   * 
   * @description 执行银行询证的完整流程
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
      this.log('========== 开始执行银行询证节点 ==========');

      // 1. 验证输入
      await this.validateInputs(inputs);
      this.log('✓ 输入验证通过');

      // 2. 解析银行账户清单
      this.log('开始解析银行账户清单...');
      const accounts = await this.parseExcel(inputs.bankAccountList);
      this.log(`✓ 成功解析银行账户：${accounts.length}个账户`);

      // 3. 解析余额调节表（如果有）
      let reconciliationData: any[] = [];
      if (inputs.balanceSheet) {
        reconciliationData = await this.parseExcel(inputs.balanceSheet);
        this.log(`✓ 成功解析余额调节表：${reconciliationData.length}条记录`);
      }

      // 4. 解析回函记录（如果有）
      let responses: any[] = [];
      if (inputs.responseRecords) {
        responses = await this.parseExcel(inputs.responseRecords);
        this.log(`✓ 成功解析回函记录：${responses.length}条记录`);
      }

      // 5. 数据清洗和规范化
      this.log('开始数据清洗和规范化...');
      const cleanedAccounts = this.cleanBankAccounts(accounts);
      this.log('✓ 数据清洗完成');

      // 6. 选择询证对象
      this.log('根据配置选择询证对象...');
      const confirmationTargets = this.selectConfirmationTargets(
        cleanedAccounts,
        config
      );
      this.log(`✓ 已选择${confirmationTargets.length}个询证对象`);

      // 7. 处理回函记录
      this.log('处理回函记录...');
      const confirmationRecords = this.processResponses(
        confirmationTargets,
        responses,
        config.autoMatchTolerance || 1
      );
      this.log('✓ 回函记录处理完成');

      // 8. 计算汇总数据
      this.log('计算询证结果汇总...');
      const summary = this.calculateSummary(confirmationRecords);
      this.log('✓ 汇总数据计算完成');

      // 9. 识别差异账户
      this.log('识别差异账户...');
      const differences = confirmationRecords.filter(r => !r.matched && r.responded);
      this.log(`✓ 识别出${differences.length}个差异账户`);

      // 10. 导出询证明细表
      this.log('导出询证明细表...');
      const confirmationListPath = await this.exportConfirmationList(confirmationRecords);
      this.log(`✓ 询证明细表已导出：${confirmationListPath}`);

      // 11. 导出差异清单
      let differenceListPath = '';
      if (differences.length > 0) {
        this.log('导出差异清单...');
        differenceListPath = await this.exportDifferenceList(differences);
        this.log(`✓ 差异清单已导出：${differenceListPath}`);
      }

      // 12. 生成审计底稿
      this.log('生成审计底稿...');
      const workpaperPath = await this.generateBankConfirmationWorkpaper(
        summary,
        confirmationRecords,
        differences
      );
      this.log(`✓ 审计底稿已生成：${workpaperPath}`);

      // 13. 完成执行
      const duration = Date.now() - startTime;
      this.log(`========== 银行询证节点执行完成，耗时：${duration}ms ==========`);

      return {
        success: true,
        data: {
          summary,
          confirmationRecords,
          differences,
        },
        outputs: {
          summary,
          confirmationList: confirmationListPath,
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
   * 清洗银行账户数据
   * 
   * @description 规范化数据格式，过滤无效记录
   * 
   * @private
   * @param {any[]} accounts - 原始银行账户数据
   * @returns {BankAccount[]} 清洗后的数据
   */
  private cleanBankAccounts(accounts: any[]): BankAccount[] {
    return accounts
      .filter(a => a.账号 && a.银行名称)
      .map(a => ({
        accountNumber: String(a.账号).trim(),
        bankName: String(a.银行名称).trim(),
        bankBranch: String(a.开户行 || a.银行名称).trim(),
        accountType: (a.账户类型 || '存款') as '存款' | '借款' | '其他',
        bookBalance: Number(a.账面余额 || a.余额 || 0),
        currency: String(a.币种 || 'CNY').trim(),
        contact: a.联系人 ? String(a.联系人).trim() : undefined,
        phone: a.联系电话 ? String(a.联系电话).trim() : undefined,
        email: a.邮箱 ? String(a.邮箱).trim() : undefined,
        address: a.地址 ? String(a.地址).trim() : undefined,
      }));
  }

  /**
   * 选择询证对象
   * 
   * @description 根据配置选择需要发函的银行账户
   * 
   * @private
   * @param {BankAccount[]} accounts - 银行账户列表
   * @param {Record<string, any>} config - 配置参数
   * @returns {BankAccount[]} 需要发函的账户
   */
  private selectConfirmationTargets(
    accounts: BankAccount[],
    config: Record<string, any>
  ): BankAccount[] {
    const confirmAllAccounts = config.confirmAllAccounts !== false; // 默认true
    const includeZeroBalance = config.includeZeroBalance !== false; // 默认true
    const includeClosed = config.includeClosed || false;

    let targets = accounts;

    // 如果不函证零余额账户
    if (!includeZeroBalance) {
      targets = targets.filter(a => a.bookBalance !== 0);
    }

    // 如果不函证已销户账户（这里假设账户类型为"已销户"）
    if (!includeClosed) {
      targets = targets.filter(a => a.accountType !== '已销户' as any);
    }

    // 银行询证通常100%发函
    if (confirmAllAccounts) {
      return targets;
    }

    return targets;
  }

  /**
   * 处理回函记录
   * 
   * @description 将回函记录与发函记录匹配，分析差异
   * 
   * @private
   * @param {BankAccount[]} targets - 发函对象
   * @param {any[]} responses - 回函记录
   * @param {number} tolerance - 容差金额
   * @returns {ConfirmationRecord[]} 处理后的询证记录
   */
  private processResponses(
    targets: BankAccount[],
    responses: any[],
    tolerance: number
  ): ConfirmationRecord[] {
    const responseMap = new Map<string, any>();
    responses.forEach(r => {
      if (r.账号) {
        responseMap.set(String(r.账号).trim(), r);
      }
    });

    return targets.map(target => {
      const response = responseMap.get(target.accountNumber);

      if (!response) {
        // 未回函
        return {
          ...target,
          sent: true,
          sentDate: new Date().toISOString().split('T')[0],
          responded: false,
          matched: false,
          difference: Math.abs(target.bookBalance),
        };
      }

      // 已回函
      const confirmedBalance = Number(response.确认余额 || response.银行余额 || 0);
      const difference = Math.abs(target.bookBalance - confirmedBalance);
      const matched = difference <= tolerance;

      return {
        ...target,
        sent: true,
        sentDate: new Date().toISOString().split('T')[0],
        responded: true,
        responseDate: response.回函日期 || new Date().toISOString().split('T')[0],
        confirmedBalance,
        matched,
        difference,
        reason: response.差异原因 || (matched ? '' : '余额不符'),
        reconciliationItems: response.未达账项 ? String(response.未达账项).split(/[,;，；]/) : undefined,
      };
    });
  }

  /**
   * 计算询证结果汇总
   * 
   * @description 统计发函率、回函率、相符率等关键指标
   * 
   * @private
   * @param {ConfirmationRecord[]} records - 询证记录
   * @returns {ConfirmationSummary} 汇总数据
   */
  private calculateSummary(records: ConfirmationRecord[]): ConfirmationSummary {
    const totalAccounts = records.length;
    const sentRecords = records.filter(r => r.sent);
    const respondedRecords = records.filter(r => r.responded);
    const matchedRecords = respondedRecords.filter(r => r.matched);
    const unmatchedRecords = respondedRecords.filter(r => !r.matched);
    const noResponseRecords = records.filter(r => r.sent && !r.responded);

    const sentBalance = sentRecords.reduce((sum, r) => sum + Math.abs(r.bookBalance), 0);
    const respondedBalance = respondedRecords.reduce((sum, r) => sum + Math.abs(r.bookBalance), 0);
    const matchedBalance = matchedRecords.reduce((sum, r) => sum + Math.abs(r.bookBalance), 0);
    const unmatchedBalance = unmatchedRecords.reduce((sum, r) => sum + Math.abs(r.bookBalance), 0);
    const totalDifference = unmatchedRecords.reduce((sum, r) => sum + r.difference, 0);
    const noResponseBalance = noResponseRecords.reduce((sum, r) => sum + Math.abs(r.bookBalance), 0);

    return {
      totalAccounts,
      sentCount: sentRecords.length,
      sentBalance,
      respondedCount: respondedRecords.length,
      respondedBalance,
      responseRate: sentRecords.length > 0 ? respondedRecords.length / sentRecords.length : 0,
      matchedCount: matchedRecords.length,
      matchedBalance,
      matchRate: respondedRecords.length > 0 ? matchedRecords.length / respondedRecords.length : 0,
      unmatchedCount: unmatchedRecords.length,
      unmatchedBalance,
      totalDifference,
      noResponseCount: noResponseRecords.length,
      noResponseBalance,
    };
  }

  /**
   * 导出询证明细表
   * 
   * @description 将询证记录导出为Excel文件
   * 
   * @private
   * @param {ConfirmationRecord[]} records - 询证记录
   * @returns {Promise<string>} 文件路径
   */
  private async exportConfirmationList(records: ConfirmationRecord[]): Promise<string> {
    const headers = [
      '银行账号',
      '银行名称',
      '开户行',
      '账户类型',
      '账面余额',
      '币种',
      '是否发函',
      '发函日期',
      '是否回函',
      '回函日期',
      '确认余额',
      '是否相符',
      '差异金额',
      '差异原因',
    ];

    const data = records.map(r => ({
      银行账号: r.accountNumber,
      银行名称: r.bankName,
      开户行: r.bankBranch,
      账户类型: r.accountType,
      账面余额: r.bookBalance,
      币种: r.currency,
      是否发函: r.sent ? '是' : '否',
      发函日期: r.sentDate || '',
      是否回函: r.responded ? '是' : '否',
      回函日期: r.responseDate || '',
      确认余额: r.confirmedBalance !== undefined ? r.confirmedBalance : '',
      是否相符: r.matched ? '是' : '否',
      差异金额: r.difference,
      差异原因: r.reason || '',
    }));

    return await this.exportExcel(
      data,
      headers,
      `银行询证明细_${Date.now()}.xlsx`
    );
  }

  /**
   * 导出差异清单
   * 
   * @description 导出回函不符账户的详细清单
   * 
   * @private
   * @param {ConfirmationRecord[]} differences - 差异记录
   * @returns {Promise<string>} 文件路径
   */
  private async exportDifferenceList(differences: ConfirmationRecord[]): Promise<string> {
    const headers = [
      '银行账号',
      '银行名称',
      '账面余额',
      '确认余额',
      '差异金额',
      '差异率',
      '差异原因',
      '未达账项',
      '建议处理',
    ];

    const data = differences.map(r => ({
      银行账号: r.accountNumber,
      银行名称: r.bankName,
      账面余额: r.bookBalance,
      确认余额: r.confirmedBalance || 0,
      差异金额: r.difference,
      差异率: r.bookBalance !== 0 
        ? ((r.difference / Math.abs(r.bookBalance)) * 100).toFixed(2) + '%'
        : 'N/A',
      差异原因: r.reason || '未说明',
      未达账项: r.reconciliationItems ? r.reconciliationItems.join('; ') : '',
      建议处理: r.difference > Math.abs(r.bookBalance) * 0.1 
        ? '重点关注，建议编制余额调节表'
        : '建议核对未达账项',
    }));

    return await this.exportExcel(
      data,
      headers,
      `银行询证差异清单_${Date.now()}.xlsx`
    );
  }

  /**
   * 生成银行询证审计底稿
   * 
   * @description 生成标准格式的银行询证审计工作底稿
   * 
   * @private
   * @param {ConfirmationSummary} summary - 汇总数据
   * @param {ConfirmationRecord[]} records - 询证记录
   * @param {ConfirmationRecord[]} differences - 差异记录
   * @returns {Promise<string>} 底稿文件路径
   */
  private async generateBankConfirmationWorkpaper(
    summary: ConfirmationSummary,
    records: ConfirmationRecord[],
    differences: ConfirmationRecord[]
  ): Promise<string> {
    const sections: Array<{
      title: string;
      headers: string[];
      data: any[];
    }> = [
      {
        title: '一、银行询证程序执行情况',
        headers: ['指标', '数量', '金额（元）', '比率'],
        data: [
          {
            指标: '银行账户总数',
            数量: summary.totalAccounts,
            '金额（元）': summary.sentBalance.toFixed(2),
            比率: '100%',
          },
          {
            指标: '发函账户数',
            数量: summary.sentCount,
            '金额（元）': summary.sentBalance.toFixed(2),
            比率: ((summary.sentCount / summary.totalAccounts) * 100).toFixed(2) + '%',
          },
          {
            指标: '回函账户数',
            数量: summary.respondedCount,
            '金额（元）': summary.respondedBalance.toFixed(2),
            比率: (summary.responseRate * 100).toFixed(2) + '%',
          },
          {
            指标: '相符账户数',
            数量: summary.matchedCount,
            '金额（元）': summary.matchedBalance.toFixed(2),
            比率: (summary.matchRate * 100).toFixed(2) + '%',
          },
          {
            指标: '不符账户数',
            数量: summary.unmatchedCount,
            '金额（元）': summary.unmatchedBalance.toFixed(2),
            比率: ((1 - summary.matchRate) * 100).toFixed(2) + '%',
          },
          {
            指标: '未回函账户数',
            数量: summary.noResponseCount,
            '金额（元）': summary.noResponseBalance.toFixed(2),
            比率: ((summary.noResponseCount / summary.sentCount) * 100).toFixed(2) + '%',
          },
        ],
      },
      {
        title: '二、银行账户明细（前20个）',
        headers: ['银行名称', '账号', '账户类型', '账面余额', '是否回函', '确认余额', '是否相符'],
        data: records.slice(0, 20).map(r => ({
          银行名称: r.bankName,
          账号: r.accountNumber,
          账户类型: r.accountType,
          账面余额: r.bookBalance,
          是否回函: r.responded ? '是' : '否',
          确认余额: r.confirmedBalance !== undefined ? r.confirmedBalance : '',
          是否相符: r.matched ? '是' : '否',
        })),
      },
    ];

    if (differences.length > 0) {
      sections.push({
        title: '三、差异账户分析',
        headers: ['银行名称', '账号', '账面余额', '确认余额', '差异金额', '差异原因'],
        data: differences.map(r => ({
          银行名称: r.bankName,
          账号: r.accountNumber,
          账面余额: r.bookBalance,
          确认余额: r.confirmedBalance || 0,
          差异金额: r.difference,
          差异原因: r.reason || '未说明',
        })),
      });
    }

    sections.push({
      title: '四、审计结论',
      headers: ['项目', '结论'],
      data: [
        {
          项目: '询证程序执行情况',
          结论: `本次共向${summary.sentCount}个银行账户发函，收到${summary.respondedCount}个账户的回函，回函率${(summary.responseRate * 100).toFixed(2)}%`,
        },
        {
          项目: '询证结果评价',
          结论: summary.matchRate >= 0.95
            ? '银行回函结果总体相符，银行存款余额真实性得到验证'
            : summary.matchRate >= 0.85
            ? '银行回函结果基本相符，部分差异需要进一步核实'
            : '银行回函结果存在较多差异，需要执行补充审计程序',
        },
        {
          项目: '差异处理建议',
          结论: differences.length > 0
            ? `识别出${differences.length}个差异账户，差异总额${summary.totalDifference.toFixed(2)}元，建议编制银行存款余额调节表，核实未达账项`
            : '所有账户余额均相符',
        },
        {
          项目: '后续审计程序',
          结论: summary.noResponseCount > 0
            ? `对${summary.noResponseCount}个未回函的银行账户，建议执行替代审计程序（如检查银行对账单、期后银行流水等）`
            : '所有发函账户均已收到回函',
        },
      ],
    });

    return await this.generateWorkpaper(
      '银行询证审计工作底稿',
      sections
    );
  }
}
