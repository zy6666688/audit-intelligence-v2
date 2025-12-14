/**
 * Records Input Node - 通用记录输入节点
 * 
 * 功能：
 * - 接受CSV/Excel数据
 * - 自动推断字段类型
 * - 输出标准Records类型
 * 
 * 这是V3节点的示例实现，展示了：
 * 1. 如何使用审计类型系统
 * 2. 如何定义节点清单
 * 3. 如何实现纯函数节点
 * 4. 如何使用缓存
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, FieldSchema, AuditDataType } from '../../../types/AuditDataTypes';
import { DataValidator } from '../utils/DataValidator';

export class RecordsInputNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'input.records',
      version: '3.0.0',
      category: 'input',
      
      label: {
        zh: '记录输入',
        en: 'Records Input'
      },
      
      description: {
        zh: '导入CSV、Excel或JSON数据并转换为标准Records类型。自动推断字段类型，支持数据验证。',
        en: 'Import CSV, Excel, or JSON data and convert to standard Records type. Auto-detect field types with data validation support.'
      },
      
      icon: '📥',
      color: '#4CAF50',
      
      inputs: [],  // 输入节点没有输入端口
      
      outputs: [
        {
          id: 'records',
          name: 'records',
          type: 'Records',
          required: true,
          description: {
            zh: '标准化的记录集',
            en: 'Standardized record set'
          }
        }
      ],
      
      config: [
        {
          id: 'data',
          name: {
            zh: '数据',
            en: 'Data'
          },
          type: 'json',
          required: true,
          description: {
            zh: '输入的原始数据数组',
            en: 'Input raw data array'
          }
        },
        {
          id: 'autoDetectTypes',
          name: {
            zh: '自动检测类型',
            en: 'Auto Detect Types'
          },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '自动推断字段类型',
            en: 'Automatically infer field types'
          }
        },
        {
          id: 'validateData',
          name: {
            zh: '验证数据',
            en: 'Validate Data'
          },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '验证数据完整性',
            en: 'Validate data integrity'
          }
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['input', 'csv', 'excel', 'data'],
        documentation: 'https://docs.audit-system.com/nodes/input/records',
        examples: [
          {
            title: '导入CSV数据',
            description: '从CSV文件读取并转换为Records',
            inputs: {},
            config: {
              data: [
                { id: 1, name: '张三', amount: 1000 },
                { id: 2, name: '李四', amount: 2000 }
              ],
              autoDetectTypes: true,
              validateData: true
            },
            expectedOutput: {
              records: {
                type: 'Records',
                rowCount: 2,
                columnCount: 3
              }
            }
          }
        ]
      },
      
      capabilities: {
        cacheable: true,      // 可以缓存结果
        parallel: true,       // 可以并行执行多个实例
        streaming: false,     // 不支持流式处理
        aiPowered: false      // 不使用AI
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
      // 1. 检查缓存
      const cacheKey = this.getCacheKey(inputs, config);
      const cached = await this.tryGetFromCache(context, cacheKey);
      if (cached) return cached;
      
      // 2. 获取配置
      const data = config.data as Array<Record<string, any>>;
      const autoDetectTypes = config.autoDetectTypes !== false;
      const validateData = config.validateData !== false;
      
      // 3. 验证输入
      if (!Array.isArray(data) || data.length === 0) {
        return this.wrapError(
          'INVALID_DATA',
          'Data must be a non-empty array'
        );
      }
      
      // 4. 推断schema
      const schema = autoDetectTypes 
        ? this.inferSchema(data)
        : this.createBasicSchema(data[0]);
      
      // 5. 验证数据（如果启用）
      if (validateData) {
        const validation = this.validateDataAgainstSchema(data, schema);
        if (!validation.valid) {
          context.logger?.warn?.(`⚠️  Data validation found ${validation.errors.length} errors`);
          return this.wrapError(
            'VALIDATION_FAILED',
            `Data validation failed: ${validation.errors.join(', ')}`
          );
        }
        if (validation.warnings.length > 0) {
          context.logger?.warn?.(`⚠️  Warnings: ${validation.warnings.join(', ')}`);
        }
      }
      
      // 6. 创建Records对象
      const records: Records = {
        type: 'Records',
        schema,
        data,
        metadata: this.createMetadata(
          context.nodeId,
          context.executionId,
          'user_input'
        ),
        rowCount: data.length,
        columnCount: schema.length
      };
      
      // 7. 包装结果
      const duration = Date.now() - startTime;
      const result = this.wrapSuccess(
        { records },
        duration,
        context
      );
      
      // 8. 缓存结果
      await this.saveToCache(context, cacheKey, result, 3600000); // 1小时
      
      context.logger?.info?.(`✅ Records created: ${records.rowCount} rows, ${records.columnCount} columns`);
      
      return result;
      
    } catch (error: any) {
      context.logger?.error?.(`❌ RecordsInputNode failed:`, error);
      return this.wrapError(
        'EXECUTION_ERROR',
        error.message,
        error.stack
      );
    }
  }

  /**
   * 推断字段schema
   */
  private inferSchema(data: Array<Record<string, any>>): FieldSchema[] {
    if (data.length === 0) return [];
    
    const firstRow = data[0];
    const schema: FieldSchema[] = [];
    
    for (const key of Object.keys(firstRow)) {
      const type = this.inferFieldType(data, key);
      const required = this.checkFieldRequired(data, key);
      
      schema.push({
        name: key,
        type,
        required,
        description: `Auto-detected field: ${key}`
      });
    }
    
    return schema;
  }

  /**
   * 推断单个字段的类型
   */
  private inferFieldType(
    data: Array<Record<string, any>>,
    fieldName: string
  ): 'string' | 'number' | 'date' | 'boolean' | 'object' | 'array' {
    // 取前100行样本
    const samples = data.slice(0, Math.min(100, data.length));
    const types = new Set<string>();
    
    for (const row of samples) {
      const value = row[fieldName];
      if (value === null || value === undefined) continue;
      
      if (Array.isArray(value)) {
        types.add('array');
      } else if (value instanceof Date) {
        types.add('date');
      } else if (typeof value === 'object') {
        types.add('object');
      } else {
        types.add(typeof value);
      }
    }
    
    // 如果所有样本类型一致，使用该类型
    if (types.size === 1) {
      const type = Array.from(types)[0];
      if (type === 'number' || type === 'boolean' || type === 'string') {
        return type;
      }
      if (type === 'array') return 'array';
      if (type === 'date') return 'date';
      return 'object';
    }
    
    // 类型不一致，默认为string
    return 'string';
  }

  /**
   * 检查字段是否必需
   */
  private checkFieldRequired(
    data: Array<Record<string, any>>,
    fieldName: string
  ): boolean {
    // 如果所有行都有该字段且非空，则认为必需
    for (const row of data) {
      const value = row[fieldName];
      if (value === null || value === undefined || value === '') {
        return false;
      }
    }
    return true;
  }

  /**
   * 创建基础schema（不推断类型）
   */
  private createBasicSchema(sampleRow: Record<string, any>): FieldSchema[] {
    return Object.keys(sampleRow).map(key => ({
      name: key,
      type: 'string' as const,
      required: false,
      description: key
    }));
  }

  /**
   * 验证数据是否符合schema
   */
  private validateDataAgainstSchema(
    data: Array<Record<string, any>>,
    schema: FieldSchema[]
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      for (const field of schema) {
        const value = row[field.name];
        
        // 检查必需字段
        if (field.required && (value === null || value === undefined || value === '')) {
          errors.push(`Row ${i + 1}: Missing required field '${field.name}'`);
        }
        
        // 检查类型（简化版）
        if (value !== null && value !== undefined) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (field.type === 'number' && actualType !== 'number') {
            errors.push(`Row ${i + 1}: Field '${field.name}' should be number, got ${actualType}`);
          }
          if (field.type === 'boolean' && actualType !== 'boolean') {
            errors.push(`Row ${i + 1}: Field '${field.name}' should be boolean, got ${actualType}`);
          }
        }
      }
      
      // 限制错误数量
      if (errors.length >= 10) {
        errors.push(`... and more errors (showing first 10)`);
        break;
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
