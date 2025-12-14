/**
 * Deduplicate Node - 去重节点
 * 
 * 功能：
 * - 精确去重（完全匹配）
 * - 模糊去重（相似度匹配）
 * - 字段组合去重
 * - 哈希去重
 * - 保留首次/最后/最佳记录
 * 
 * 复杂度：M（中）
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, AuditDataType } from '../../../types/AuditDataTypes';
import * as crypto from 'crypto';

interface DeduplicateConfig {
  method?: 'exact' | 'fuzzy' | 'hash' | 'composite';  // 去重方法
  fields?: string[];                 // 用于去重的字段
  keepStrategy?: 'first' | 'last' | 'best';  // 保留策略
  fuzzyThreshold?: number;          // 模糊匹配阈值（0-1）
  caseSensitive?: boolean;          // 大小写敏感
  ignoreWhitespace?: boolean;       // 忽略空格
}

export class DeduplicateNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'preprocess.deduplicate',
      version: '1.0.0',
      category: 'preprocess',
      
      label: {
        zh: '数据去重',
        en: 'Deduplicate'
      },
      
      description: {
        zh: '识别并移除重复记录。支持精确去重、模糊去重、哈希去重、字段组合去重。可配置保留策略（首次/最后/最佳）。',
        en: 'Identify and remove duplicate records. Support exact, fuzzy, hash, and composite field deduplication. Configurable retention strategy (first/last/best).'
      },
      
      icon: '🔍',
      color: '#8E44AD',
      
      inputs: [
        {
          id: 'records',
          name: 'records',
          type: 'Records',
          required: true,
          description: {
            zh: '待去重的记录',
            en: 'Records to deduplicate'
          }
        }
      ],
      
      outputs: [
        {
          id: 'unique',
          name: 'unique',
          type: 'Records',
          required: true,
          description: {
            zh: '去重后的唯一记录',
            en: 'Unique records after deduplication'
          }
        },
        {
          id: 'duplicates',
          name: 'duplicates',
          type: 'Records',
          required: true,
          description: {
            zh: '被移除的重复记录',
            en: 'Duplicate records removed'
          }
        },
        {
          id: 'report',
          name: 'report',
          type: 'Records',
          required: true,
          description: {
            zh: '去重报告',
            en: 'Deduplication report'
          }
        }
      ],
      
      config: [
        {
          id: 'method',
          name: { zh: '去重方法', en: 'Deduplication Method' },
          type: 'select',
          required: false,
          defaultValue: 'exact',
          options: [
            { label: '精确匹配', value: 'exact' },
            { label: '模糊匹配', value: 'fuzzy' },
            { label: '哈希匹配', value: 'hash' },
            { label: '字段组合', value: 'composite' }
          ]
        },
        {
          id: 'fields',
          name: { zh: '去重字段', en: 'Fields' },
          type: 'json',
          required: false,
          description: {
            zh: '用于去重的字段列表（留空表示所有字段）',
            en: 'List of fields to use for deduplication (empty means all fields)'
          }
        },
        {
          id: 'keepStrategy',
          name: { zh: '保留策略', en: 'Keep Strategy' },
          type: 'select',
          required: false,
          defaultValue: 'first',
          options: [
            { label: '保留首次', value: 'first' },
            { label: '保留最后', value: 'last' },
            { label: '保留最佳', value: 'best' }
          ]
        },
        {
          id: 'fuzzyThreshold',
          name: { zh: '模糊阈值', en: 'Fuzzy Threshold' },
          type: 'number',
          required: false,
          defaultValue: 0.8,
          description: {
            zh: '模糊匹配相似度阈值（0-1）',
            en: 'Fuzzy matching similarity threshold (0-1)'
          }
        },
        {
          id: 'caseSensitive',
          name: { zh: '大小写敏感', en: 'Case Sensitive' },
          type: 'boolean',
          required: false,
          defaultValue: false
        },
        {
          id: 'ignoreWhitespace',
          name: { zh: '忽略空格', en: 'Ignore Whitespace' },
          type: 'boolean',
          required: false,
          defaultValue: true
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['preprocess', 'deduplicate', 'unique', 'duplicate-detection', 'fuzzy-match'],
        documentation: 'https://docs.audit-system.com/nodes/preprocess/deduplicate',
        examples: [
          {
            title: '精确去重',
            description: '基于指定字段进行精确去重',
            inputs: {
              records: {
                type: 'Records',
                data: [
                  { id: '001', name: 'John', email: 'john@example.com' },
                  { id: '002', name: 'John', email: 'john@example.com' },
                  { id: '003', name: 'Jane', email: 'jane@example.com' }
                ]
              }
            },
            config: {
              method: 'exact',
              fields: ['email'],
              keepStrategy: 'first'
            }
          },
          {
            title: '模糊去重',
            description: '基于相似度进行模糊去重',
            inputs: {
              records: {
                type: 'Records',
                data: [
                  { name: 'John Smith' },
                  { name: 'John  Smith' },
                  { name: 'john smith' }
                ]
              }
            },
            config: {
              method: 'fuzzy',
              fuzzyThreshold: 0.9,
              caseSensitive: false,
              ignoreWhitespace: true
            }
          }
        ]
      },
      
      capabilities: {
        cacheable: true,
        parallel: false,  // 去重需要全局状态
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
      const cfg: DeduplicateConfig = {
        method: config.method || 'exact',
        fields: config.fields || [],
        keepStrategy: config.keepStrategy || 'first',
        fuzzyThreshold: config.fuzzyThreshold ?? 0.8,
        caseSensitive: config.caseSensitive === true,
        ignoreWhitespace: config.ignoreWhitespace !== false
      };
      
      context.logger?.info?.(`🔍 Deduplicating ${records.rowCount} records using ${cfg.method} method`);
      
      // 执行去重
      const { unique, duplicates } = this.deduplicate(records.data, cfg, context);
      
      // 生成报告
      const stats = {
        original_count: records.rowCount,
        unique_count: unique.length,
        duplicate_count: duplicates.length,
        dedup_rate: ((duplicates.length / records.rowCount) * 100).toFixed(2)
      };
      
      // 构造输出
      const uniqueRecords: Records = {
        type: 'Records',
        schema: records.schema,
        data: unique,
        metadata: this.createMetadata(context.nodeId, context.executionId, 'unique'),
        rowCount: unique.length,
        columnCount: records.schema.length
      };
      
      const duplicateRecords: Records = {
        type: 'Records',
        schema: records.schema,
        data: duplicates,
        metadata: this.createMetadata(context.nodeId, context.executionId, 'duplicates'),
        rowCount: duplicates.length,
        columnCount: records.schema.length
      };
      
      const report: Records = {
        type: 'Records',
        schema: [
          { name: 'metric', type: 'string', required: true, description: 'Metric' },
          { name: 'value', type: 'string', required: true, description: 'Value' }
        ],
        data: Object.entries(stats).map(([key, value]) => ({
          metric: key,
          value: String(value)
        })),
        metadata: this.createMetadata(context.nodeId, context.executionId, 'report'),
        rowCount: Object.keys(stats).length,
        columnCount: 2
      };
      
      const duration = Date.now() - startTime;
      
      context.logger?.info?.(`✅ Deduplication completed: ${unique.length} unique, ${duplicates.length} duplicates (${duration}ms)`);
      context.logger?.info?.(`  Deduplication rate: ${stats.dedup_rate}%`);
      
      return this.wrapSuccess(
        { unique: uniqueRecords, duplicates: duplicateRecords, report },
        duration,
        context
      );
      
    } catch (error: any) {
      context.logger?.error?.('❌ Deduplication failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private deduplicate(
    data: Array<Record<string, any>>,
    config: DeduplicateConfig,
    context: NodeExecutionContext
  ): { unique: Array<Record<string, any>>; duplicates: Array<Record<string, any>> } {
    const unique: Array<Record<string, any>> = [];
    const duplicates: Array<Record<string, any>> = [];
    const seen = new Map<string, number>();  // key -> index in unique array
    
    for (const row of data) {
      const key = this.generateKey(row, config, context);
      
      if (config.method === 'fuzzy') {
        // 模糊匹配
        const matchIndex = this.findFuzzyMatch(row, unique, config, context);
        if (matchIndex !== -1) {
          // 找到匹配项
          if (config.keepStrategy === 'last') {
            unique[matchIndex] = row;
          } else if (config.keepStrategy === 'best') {
            unique[matchIndex] = this.selectBest(unique[matchIndex], row, context);
          }
          duplicates.push(row);
        } else {
          unique.push(row);
        }
      } else {
        // 精确匹配、哈希匹配、字段组合
        if (seen.has(key)) {
          const existingIndex = seen.get(key)!;
          
          if (config.keepStrategy === 'last') {
            unique[existingIndex] = row;
          } else if (config.keepStrategy === 'best') {
            unique[existingIndex] = this.selectBest(unique[existingIndex], row, context);
          }
          // 'first' 策略：不做任何操作，保留现有记录
          
          duplicates.push(row);
        } else {
          seen.set(key, unique.length);
          unique.push(row);
        }
      }
    }
    
    return { unique, duplicates };
  }

  private generateKey(
    row: Record<string, any>,
    config: DeduplicateConfig,
    context: NodeExecutionContext
  ): string {
    const fields = config.fields && config.fields.length > 0 
      ? config.fields 
      : Object.keys(row);
    
    const values = fields.map(field => {
      let value = row[field];
      
      if (value === null || value === undefined) {
        return 'NULL';
      }
      
      if (typeof value === 'string') {
        if (!config.caseSensitive) {
          value = value.toLowerCase();
        }
        if (config.ignoreWhitespace) {
          value = value.replace(/\s+/g, '');
        }
      }
      
      return String(value);
    });
    
    const combined = values.join('|');
    
    if (config.method === 'hash') {
      return crypto.createHash('md5').update(combined).digest('hex');
    }
    
    return combined;
  }

  private findFuzzyMatch(
    row: Record<string, any>,
    existingRows: Array<Record<string, any>>,
    config: DeduplicateConfig,
    context: NodeExecutionContext
  ): number {
    for (let i = 0; i < existingRows.length; i++) {
      const similarity = this.calculateSimilarity(row, existingRows[i], config);
      if (similarity >= (config.fuzzyThreshold || 0.8)) {
        return i;
      }
    }
    return -1;
  }

  private calculateSimilarity(
    row1: Record<string, any>,
    row2: Record<string, any>,
    config: DeduplicateConfig
  ): number {
    const fields = config.fields && config.fields.length > 0 
      ? config.fields 
      : Object.keys(row1);
    
    let totalSimilarity = 0;
    let fieldCount = 0;
    
    for (const field of fields) {
      const val1 = this.normalizeForComparison(row1[field], config);
      const val2 = this.normalizeForComparison(row2[field], config);
      
      if (val1 !== null && val2 !== null) {
        totalSimilarity += this.stringSimilarity(val1, val2);
        fieldCount++;
      }
    }
    
    return fieldCount > 0 ? totalSimilarity / fieldCount : 0;
  }

  private normalizeForComparison(value: any, config: DeduplicateConfig): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    
    let str = String(value);
    
    if (!config.caseSensitive) {
      str = str.toLowerCase();
    }
    
    if (config.ignoreWhitespace) {
      str = str.replace(/\s+/g, '');
    }
    
    return str;
  }

  private stringSimilarity(str1: string, str2: string): number {
    // 使用Levenshtein距离计算相似度
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    const matrix: number[][] = [];
    
    // 初始化矩阵
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    // 填充矩阵
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,  // 替换
            matrix[i][j - 1] + 1,      // 插入
            matrix[i - 1][j] + 1       // 删除
          );
        }
      }
    }
    
    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    
    return 1 - (distance / maxLength);
  }

  private selectBest(
    row1: Record<string, any>,
    row2: Record<string, any>,
    context: NodeExecutionContext
  ): Record<string, any> {
    // 选择"最佳"记录的策略：
    // 1. 非空字段更多的记录
    // 2. 如果相同，选择字段值更长的记录
    
    const nonNullCount1 = Object.values(row1).filter(v => v !== null && v !== undefined && v !== '').length;
    const nonNullCount2 = Object.values(row2).filter(v => v !== null && v !== undefined && v !== '').length;
    
    if (nonNullCount1 > nonNullCount2) {
      return row1;
    } else if (nonNullCount2 > nonNullCount1) {
      return row2;
    }
    
    // 非空字段数相同，比较总长度
    const totalLength1 = Object.values(row1).reduce((sum, v) => sum + String(v || '').length, 0);
    const totalLength2 = Object.values(row2).reduce((sum, v) => sum + String(v || '').length, 0);
    
    return totalLength1 >= totalLength2 ? row1 : row2;
  }
}
