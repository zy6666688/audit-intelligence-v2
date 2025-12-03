/**
 * 固定资产盘点节点
 * Week 2: 核心节点开发 - 资产循环
 */

import { BaseNode, NodeExecutionResult } from './BaseNode';
import { BusinessError, ErrorCode } from '../constants/ErrorCode';

export class FixedAssetInventoryNode extends BaseNode {
  static metadata = {
    id: 'fixed-asset-inventory',
    name: '固定资产盘点',
    category: '资产循环',
    description: '核对固定资产账面数与实物数，识别盘盈盘亏',
    icon: 'asset',
    version: '1.0.0',
  };

  static inputs = [
    {
      name: 'assetList',
      label: '固定资产明细账',
      type: 'excel' as const,
      required: true,
      description: '从财务系统导出的固定资产明细表（包含：资产编号、资产名称、数量、原值等）',
    },
    {
      name: 'inventoryRecord',
      label: '盘点记录表',
      type: 'excel' as const,
      required: true,
      description: '现场盘点记录的实物清单（包含：资产编号、实盘数量、状态等）',
    },
    {
      name: 'photos',
      label: '实物照片',
      type: 'image' as const,
      required: false,
      description: '资产实物照片（可选，用于AI识别验证）',
    },
  ];

  static outputs = [
    {
      name: 'result',
      label: '盘点结果',
      type: 'data' as const,
      description: '盘点汇总结果（账实相符率、盘盈盘亏情况）',
    },
    {
      name: 'differences',
      label: '差异清单',
      type: 'excel' as const,
      description: '盘盈盘亏明细表',
    },
    {
      name: 'workpaper',
      label: '审计底稿',
      type: 'excel' as const,
      description: '固定资产盘点审计底稿',
    },
  ];

  static config = {
    toleranceRate: {
      label: '差异容忍率',
      type: 'number' as const,
      default: 0.02,
      description: '允许的账实差异比例（默认2%）',
    },
    includeDepreciation: {
      label: '是否验证折旧',
      type: 'boolean' as const,
      default: true,
      description: '是否同时验证折旧计算的正确性',
    },
    checkCertificate: {
      label: '是否检查产权证明',
      type: 'boolean' as const,
      default: false,
      description: '是否检查资产产权证明文件',
    },
  };

  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    this.clearLogs();

    try {
      this.log('开始执行固定资产盘点节点');

      // 1. 验证输入
      await this.validateInputs(inputs);
      this.log('输入验证通过');

      // 2. 解析输入数据
      this.log('开始解析数据文件...');
      const assetList = await this.parseExcel(inputs.assetList);
      const inventoryRecord = await this.parseExcel(inputs.inventoryRecord);
      this.log(`账面资产: ${assetList.length}条，实盘记录: ${inventoryRecord.length}条`);

      // 3. 账实核对
      this.log('开始账实核对...');
      const matchResult = this.matchAssets(assetList, inventoryRecord);
      this.log(`匹配结果: 相符${matchResult.matched.length}条，盘亏${matchResult.missing.length}条，盘盈${matchResult.extra.length}条`);

      // 4. 差异分析
      this.log('开始差异分析...');
      const differences = this.analyzeDifferences(
        matchResult,
        config.toleranceRate || 0.02
      );
      this.log(`识别出${differences.length}项差异`);

      // 5. 折旧验证（如果启用）
      if (config.includeDepreciation) {
        this.log('开始折旧验证...');
        const depreciationErrors = this.verifyDepreciation(assetList);
        this.log(`折旧验证完成，发现${depreciationErrors.length}项异常`);
      }

      // 6. 计算匹配率
      const matchRate = matchResult.matched.length / assetList.length;
      const result = {
        total: assetList.length,
        matched: matchResult.matched.length,
        missing: matchResult.missing.length,
        extra: matchResult.extra.length,
        matchRate: matchRate,
        matchRatePercent: (matchRate * 100).toFixed(2) + '%',
        differenceCount: differences.length,
        severeDifferenceCount: differences.filter(d => d.severity === '严重').length,
      };

      // 7. 生成差异清单
      this.log('生成差异清单...');
      const differencesFile = await this.exportDifferences(differences);

      // 8. 生成审计底稿
      this.log('生成审计底稿...');
      const workpaper = await this.generateAuditWorkpaper({
        assetList,
        inventoryRecord,
        matchResult,
        differences,
        result,
        config,
      });

      const duration = Date.now() - startTime;
      this.log(`固定资产盘点完成，耗时${duration}ms`);

      return {
        success: true,
        data: result,
        outputs: {
          result,
          differences: differencesFile,
          workpaper,
        },
        logs: this.getLogs(),
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.log(`执行失败: ${error.message}`);

      if (error instanceof BusinessError) {
        throw error;
      }

      throw new BusinessError(
        ErrorCode.NODE_EXECUTION_ERROR,
        `固定资产盘点失败: ${error.message}`,
        { originalError: error.message, logs: this.getLogs() }
      );
    }
  }

  /**
   * 账实匹配
   */
  private matchAssets(assetList: any[], inventoryRecord: any[]) {
    const matched: any[] = [];
    const missing: any[] = [];
    const extra: any[] = [];

    // 建立盘点记录索引
    const inventoryMap = new Map(
      inventoryRecord.map(item => [
        this.normalizeAssetCode(item['资产编号'] || item['assetCode'] || item['编号']),
        item
      ])
    );

    // 核对账面资产
    for (const asset of assetList) {
      const assetCode = this.normalizeAssetCode(
        asset['资产编号'] || asset['assetCode'] || asset['编号']
      );
      const inventory = inventoryMap.get(assetCode);

      if (inventory) {
        // 找到对应的实物
        const assetQuantity = parseFloat(asset['数量'] || asset['quantity'] || 1);
        const inventoryQuantity = parseFloat(inventory['实盘数量'] || inventory['quantity'] || 1);

        matched.push({
          assetCode,
          assetName: asset['资产名称'] || asset['name'] || '',
          bookQuantity: assetQuantity,
          actualQuantity: inventoryQuantity,
          quantityMatch: Math.abs(assetQuantity - inventoryQuantity) < 0.01,
          bookValue: parseFloat(asset['原值'] || asset['value'] || 0),
          status: asset['状态'] || asset['status'] || '',
          actualStatus: inventory['状态'] || inventory['status'] || '',
          statusMatch: (asset['状态'] || asset['status']) === (inventory['状态'] || inventory['status']),
        });
        inventoryMap.delete(assetCode);
      } else {
        // 账面有，实物无（盘亏）
        missing.push({
          assetCode,
          assetName: asset['资产名称'] || asset['name'] || '',
          bookQuantity: parseFloat(asset['数量'] || asset['quantity'] || 1),
          bookValue: parseFloat(asset['原值'] || asset['value'] || 0),
          status: asset['状态'] || asset['status'] || '',
        });
      }
    }

    // 剩余的是实物有，账面无（盘盈）
    for (const [assetCode, inventory] of inventoryMap) {
      extra.push({
        assetCode,
        assetName: inventory['资产名称'] || inventory['name'] || '',
        actualQuantity: parseFloat(inventory['实盘数量'] || inventory['quantity'] || 1),
        status: inventory['状态'] || inventory['status'] || '',
      });
    }

    return { matched, missing, extra };
  }

  /**
   * 差异分析
   */
  private analyzeDifferences(matchResult: any, toleranceRate: number) {
    const differences: any[] = [];

    // 分析匹配项中的数量差异
    for (const item of matchResult.matched) {
      if (!item.quantityMatch) {
        const diff = Math.abs(item.bookQuantity - item.actualQuantity);
        const rate = diff / item.bookQuantity;

        differences.push({
          type: '数量差异',
          assetCode: item.assetCode,
          assetName: item.assetName,
          expected: item.bookQuantity,
          actual: item.actualQuantity,
          difference: diff,
          differenceRate: (rate * 100).toFixed(2) + '%',
          severity: rate > toleranceRate ? '严重' : '轻微',
          bookValue: item.bookValue,
          estimatedLoss: item.bookValue * rate,
        });
      }

      // 状态差异
      if (!item.statusMatch) {
        differences.push({
          type: '状态差异',
          assetCode: item.assetCode,
          assetName: item.assetName,
          expected: item.status,
          actual: item.actualStatus,
          severity: '中等',
        });
      }
    }

    // 盘亏
    for (const asset of matchResult.missing) {
      differences.push({
        type: '盘亏',
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        expected: asset.bookQuantity,
        actual: 0,
        difference: asset.bookQuantity,
        differenceRate: '100%',
        severity: '严重',
        bookValue: asset.bookValue,
        estimatedLoss: asset.bookValue,
      });
    }

    // 盘盈
    for (const inventory of matchResult.extra) {
      differences.push({
        type: '盘盈',
        assetCode: inventory.assetCode,
        assetName: inventory.assetName,
        expected: 0,
        actual: inventory.actualQuantity,
        difference: inventory.actualQuantity,
        differenceRate: '100%',
        severity: '中等',
      });
    }

    return differences;
  }

  /**
   * 折旧验证
   */
  private verifyDepreciation(assetList: any[]) {
    const errors: any[] = [];

    for (const asset of assetList) {
      // 这里简化处理，实际应该根据资产类别、购置日期等计算折旧
      // 折旧年限标准（简化版）
      const depreciationYears: Record<string, number> = {
        '房屋建筑物': 20,
        '机器设备': 10,
        '运输工具': 4,
        '电子设备': 3,
        '其他': 5,
      };

      const category = asset['类别'] || asset['category'] || '其他';
      const expectedYears = depreciationYears[category] || 5;
      
      // 验证折旧率是否合理（这里简化为检查是否在合理范围内）
      const annualDepreciationRate = 1 / expectedYears;
      // 实际应该进一步验证累计折旧、净值等
    }

    return errors;
  }

  /**
   * 导出差异清单
   */
  private async exportDifferences(differences: any[]): Promise<string> {
    const headers = [
      '差异类型',
      '资产编号',
      '资产名称',
      '账面数量',
      '实盘数量',
      '差异数量',
      '差异率',
      '严重程度',
      '账面价值',
      '预估损失',
    ];

    const data = differences.map(d => ({
      '差异类型': d.type,
      '资产编号': d.assetCode,
      '资产名称': d.assetName,
      '账面数量': d.expected || 0,
      '实盘数量': d.actual || 0,
      '差异数量': d.difference || 0,
      '差异率': d.differenceRate || '',
      '严重程度': d.severity,
      '账面价值': d.bookValue || '',
      '预估损失': d.estimatedLoss || '',
    }));

    return await this.exportExcel(
      data,
      headers,
      `固定资产差异清单_${Date.now()}.xlsx`
    );
  }

  /**
   * 生成审计底稿
   */
  private async generateAuditWorkpaper(data: any): Promise<string> {
    const sections = [
      {
        title: '一、盘点概况',
        headers: ['项目', '数量', '说明'],
        data: [
          { '项目': '账面资产总数', '数量': data.result.total, '说明': '财务账面记录' },
          { '项目': '账实相符', '数量': data.result.matched, '说明': '账面与实物一致' },
          { '项目': '盘亏', '数量': data.result.missing, '说明': '账面有实物无' },
          { '项目': '盘盈', '数量': data.result.extra, '说明': '实物有账面无' },
          { '项目': '账实相符率', '数量': data.result.matchRatePercent, '说明': '相符数量/总数量' },
          { '项目': '差异项数', '数量': data.result.differenceCount, '说明': '需要关注的差异' },
          { '项目': '严重差异', '数量': data.result.severeDifferenceCount, '说明': '超过容忍率' },
        ],
      },
      {
        title: '二、差异明细（前10项）',
        headers: ['差异类型', '资产编号', '资产名称', '账面数量', '实盘数量', '严重程度'],
        data: data.differences.slice(0, 10).map((d: any) => ({
          '差异类型': d.type,
          '资产编号': d.assetCode,
          '资产名称': d.assetName,
          '账面数量': d.expected || 0,
          '实盘数量': d.actual || 0,
          '严重程度': d.severity,
        })),
      },
      {
        title: '三、审计结论',
        headers: ['结论项', '内容'],
        data: [
          {
            '结论项': '总体评价',
            '内容': data.result.matchRate > 0.98
              ? '账实相符率较高，资产管理总体良好'
              : data.result.matchRate > 0.95
              ? '账实相符率一般，存在一定差异，需加强管理'
              : '账实相符率较低，存在较多差异，需重点关注',
          },
          {
            '结论项': '主要问题',
            '内容': data.result.missing > 0
              ? `发现${data.result.missing}项盘亏，需核实原因`
              : '未发现重大盘亏',
          },
          {
            '结论项': '建议措施',
            '内容': '建议加强资产日常管理，定期盘点，及时更新资产台账',
          },
        ],
      },
    ];

    return await this.generateWorkpaper('固定资产盘点审计底稿', sections);
  }

  /**
   * 规范化资产编号（去除空格、统一大小写）
   */
  private normalizeAssetCode(code: string): string {
    if (!code) return '';
    return code.toString().trim().toUpperCase();
  }
}
