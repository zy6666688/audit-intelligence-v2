/**
 * Normalize Data Node - 数据标准化节点
 * 
 * 功能：
 * - 数据格式统一
 * - 单位转换（金额、日期、编码等）
 * - 空值处理
 * - 字符串清理
 * - 编码转换
 * 
 * 复杂度： M（中）
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, AuditDataType } from '../../../types/AuditDataTypes';

interface NormalizeConfig {
  dateFormat?: string;           // 日期格式 ('YYYY-MM-DD', 'MM/DD/YYYY', etc.)
  amountUnit?: 'yuan' | 'wan' | 'yi';  // 金额单位
  trimStrings?: boolean;         // 去除字符串空格
  lowercaseStrings?: boolean;    // 字符串转小写
  removeEmptyRows?: boolean;     // 移除空行
  fillNullValues?: boolean;      // 填充空值
  nullValueMap?: Record<string, any>;  // 空值映射
  encoding?: 'utf8' | 'gbk' | 'gb2312';  // 编码转换
}

export class NormalizeDataNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'preprocess.normalize',
      version: '1.0.0',
      category: 'preprocess',
      
      label: {
        zh: '数据标准化',
        en: 'Normalize Data'
      },
      
      description: {
        zh: '标准化数据格式。统一日期格式、金额单位、字符串格式，处理空值，清理异常字符。',
        en: 'Normalize data formats. Unify date formats, amount units, string formats, handle null values, clean abnormal characters.'
      },
      
      icon: '🔧',
      color: '#16A085',
      
      inputs: [
        {
          id: 'records',
          name: 'records',
          type: 'Records',
          required: true,
          description: {
            zh: '待标准化的记录',
            en: 'Records to normalize'
          }
        }
      ],
      
      outputs: [
        {
          id: 'normalized',
          name: 'normalized',
          type: 'Records',
          required: true,
          description: {
            zh: '标准化后的记录',
            en: 'Normalized records'
          }
        },
        {
          id: 'report',
          name: 'report',
          type: 'Records',
          required: true,
          description: {
            zh: '标准化报告',
            en: 'Normalization report'
          }
        }
      ],
      
      config: [
        {
          id: 'dateFormat',
          name: { zh: '日期格式', en: 'Date Format' },
          type: 'select',
          required: false,
          defaultValue: 'YYYY-MM-DD',
          options: [
            { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
            { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
            { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
            { label: 'YYYY年MM月DD日', value: 'YYYY年MM月DD日' }
          ]
        },
        {
          id: 'amountUnit',
          name: { zh: '金额单位', en: 'Amount Unit' },
          type: 'select',
          required: false,
          defaultValue: 'yuan',
          options: [
            { label: '元', value: 'yuan' },
            { label: '万元', value: 'wan' },
            { label: '亿元', value: 'yi' }
          ]
        },
        {
          id: 'trimStrings',
          name: { zh: '去除空格', en: 'Trim Strings' },
          type: 'boolean',
          required: false,
          defaultValue: true
        },
        {
          id: 'removeEmptyRows',
          name: { zh: '移除空行', en: 'Remove Empty Rows' },
          type: 'boolean',
          required: false,
          defaultValue: true
        },
        {
          id: 'fillNullValues',
          name: { zh: '填充空值', en: 'Fill Null Values' },
          type: 'boolean',
          required: false,
          defaultValue: false
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['preprocess', 'normalize', 'format', 'clean', 'standardize'],
        documentation: 'https://docs.audit-system.com/nodes/preprocess/normalize',
        examples: [
          {
            title: '统一日期和金额格式',
            description: '将不同格式的日期和金额标准化',
            inputs: {
              records: {
                type: 'Records',
                data: [
                  { date: '2025/01/01', amount: '10000元' },
                  { date: '01-01-2025', amount: '1万元' }
                ]
              }
            },
            config: {
              dateFormat: 'YYYY-MM-DD',
              amountUnit: 'yuan',
              trimStrings: true
            }
          }
        ]
      },
      
      capabilities: {
        cacheable: true,
        parallel: true,
        streaming: false,
        aiPowered: false
      }
    };
  }

  async execute(
    inputs: Record<string, AuditDataType>,
    config: Record<string, any>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      const records = inputs.records as Records;
      const cfg: NormalizeConfig = {
        dateFormat: config.dateFormat || 'YYYY-MM-DD',
        amountUnit: config.amountUnit || 'yuan',
        trimStrings: config.trimStrings !== false,
        lowercaseStrings: config.lowercaseStrings === true,
        removeEmptyRows: config.removeEmptyRows !== false,
        fillNullValues: config.fillNullValues === true,
        nullValueMap: config.nullValueMap || {}
      };
      
      context.logger?.info?.(`🔧 Normalizing ${records.rowCount} records`);
      
      // 统计信息
      const stats = {
        originalRows: records.rowCount,
        emptyRowsRemoved: 0,
        nullValuesFilled: 0,
        datesFormatted: 0,
        amountsConverted: 0,
        stringsNormalized: 0
      };
      
      // 1. 移除空行
      let processedData = records.data;
      if (cfg.removeEmptyRows) {
        const before = processedData.length;
        processedData = processedData.filter(row => !this.isEmptyRow(row));
        stats.emptyRowsRemoved = before - processedData.length;
      }
      
      // 2. 标准化每一行
      processedData = processedData.map(row => {
        return this.normalizeRow(row, cfg, stats, context);
      });
      
      // 3. 构造输出
      const normalized: Records = {
        type: 'Records',
        schema: records.schema,
        data: processedData,
        metadata: this.createMetadata(context.nodeId, context.executionId, 'normalized'),
        rowCount: processedData.length,
        columnCount: records.schema.length
      };
      
      const report: Records = {
        type: 'Records',
        schema: [
          { name: 'metric', type: 'string', required: true, description: 'Metric' },
          { name: 'value', type: 'number', required: true, description: 'Value' }
        ],
        data: Object.entries(stats).map(([key, value]) => ({
          metric: key,
          value: typeof value === 'number' ? value : 0
        })),
        metadata: this.createMetadata(context.nodeId, context.executionId, 'report'),
        rowCount: Object.keys(stats).length,
        columnCount: 2
      };
      
      const duration = Date.now() - startTime;
      
      context.logger?.info?.(`✅ Normalization completed: ${processedData.length} rows (${duration}ms)`);
      context.logger?.info?.(`  - Empty rows removed: ${stats.emptyRowsRemoved}`);
      context.logger?.info?.(`  - Null values filled: ${stats.nullValuesFilled}`);
      context.logger?.info?.(`  - Dates formatted: ${stats.datesFormatted}`);
      
      return this.wrapSuccess(
        { normalized, report },
        duration,
        context
      );
      
    } catch (error: any) {
      context.logger?.error?.('❌ Data normalization failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private isEmptyRow(row: Record<string, any>): boolean {
    const values = Object.values(row);
    return values.every(val => 
      val === null || 
      val === undefined || 
      val === '' || 
      (typeof val === 'string' && val.trim() === '')
    );
  }

  private normalizeRow(
    row: Record<string, any>,
    config: NormalizeConfig,
    stats: Record<string, number>,
    context: NodeExecutionContext
  ): Record<string, any> {
    const normalized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(row)) {
      let normalizedValue = value;
      
      // 处理null值
      if (value === null || value === undefined || value === '') {
        if (config.fillNullValues) {
          normalizedValue = config.nullValueMap?.[key] ?? this.getDefaultValue(key);
          stats.nullValuesFilled++;
        }
      } else {
        // 字符串处理
        if (typeof value === 'string') {
          normalizedValue = this.normalizeString(value, config);
          stats.stringsNormalized++;
          
          // 日期字段
          if (this.isDateField(key)) {
            normalizedValue = this.normalizeDate(value, config.dateFormat || 'YYYY-MM-DD');
            if (normalizedValue !== value) {
              stats.datesFormatted++;
            }
          }
          
          // 金额字段
          if (this.isAmountField(key)) {
            normalizedValue = this.normalizeAmount(value, config.amountUnit || 'yuan');
            if (normalizedValue !== value) {
              stats.amountsConverted++;
            }
          }
        }
      }
      
      normalized[key] = normalizedValue;
    }
    
    return normalized;
  }

  private normalizeString(value: string, config: NormalizeConfig): string {
    let result = value;
    
    // 去除空格
    if (config.trimStrings) {
      result = result.trim();
    }
    
    // 转小写
    if (config.lowercaseStrings) {
      result = result.toLowerCase();
    }
    
    // 移除特殊字符
    result = result.replace(/[\u200B-\u200D\uFEFF]/g, '');  // 零宽字符
    
    return result;
  }

  private isDateField(fieldName: string): boolean {
    const dateKeywords = ['date', 'time', '日期', '时间', 'created', 'updated', 'start', 'end'];
    const lowerName = fieldName.toLowerCase();
    return dateKeywords.some(keyword => lowerName.includes(keyword));
  }

  private normalizeDate(value: string, targetFormat: string): string {
    // 尝试解析日期
    const date = this.parseDate(value);
    if (!date) return value;
    
    // 格式化为目标格式
    return this.formatDate(date, targetFormat);
  }

  private parseDate(value: string): Date | null {
    // 尝试多种日期格式
    const patterns = [
      /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,  // YYYY-MM-DD or YYYY/MM/DD
      /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/,  // MM-DD-YYYY or DD-MM-YYYY
      /(\d{4})年(\d{1,2})月(\d{1,2})日?/    // YYYY年MM月DD日
    ];
    
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match) {
        let year: number, month: number, day: number;
        
        if (pattern.source.includes('年')) {
          // 中文格式
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else if (match[1].length === 4) {
          // YYYY-MM-DD
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else {
          // MM-DD-YYYY or DD-MM-YYYY（假设为MM-DD-YYYY）
          month = parseInt(match[1]);
          day = parseInt(match[2]);
          year = parseInt(match[3]);
        }
        
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    // 尝试直接解析
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('年', '年')
      .replace('月', '月')
      .replace('日', '日');
  }

  private isAmountField(fieldName: string): boolean {
    const amountKeywords = ['amount', 'price', 'cost', 'salary', 'money', 'sum', 'total', '金额', '价格', '工资'];
    const lowerName = fieldName.toLowerCase();
    return amountKeywords.some(keyword => lowerName.includes(keyword));
  }

  private normalizeAmount(value: string, targetUnit: string): number {
    // 移除货币符号和空格
    let cleanValue = value.replace(/[￥$,\s]/g, '');
    
    // 检测当前单位
    let amount: number;
    if (cleanValue.includes('亿') || cleanValue.includes('yi')) {
      amount = parseFloat(cleanValue.replace(/[亿yi]/g, '')) * 100000000;
    } else if (cleanValue.includes('万') || cleanValue.includes('wan')) {
      amount = parseFloat(cleanValue.replace(/[万wan]/g, '')) * 10000;
    } else if (cleanValue.includes('元') || cleanValue.includes('yuan')) {
      amount = parseFloat(cleanValue.replace(/[元yuan]/g, ''));
    } else {
      amount = parseFloat(cleanValue);
    }
    
    if (isNaN(amount)) {
      return parseFloat(value) || 0;
    }
    
    // 转换到目标单位
    switch (targetUnit) {
      case 'yi':
        return amount / 100000000;
      case 'wan':
        return amount / 10000;
      case 'yuan':
      default:
        return amount;
    }
  }

  private getDefaultValue(fieldName: string): any {
    if (this.isDateField(fieldName)) {
      return new Date().toISOString().split('T')[0];
    }
    if (this.isAmountField(fieldName)) {
      return 0;
    }
    return '';
  }
}
