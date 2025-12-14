/**
 * Field Mapper Node - 字段映射节点
 * 
 * 功能：
 * - 自定义字段映射规则
 * - 类型转换（字符串→数字、日期等）
 * - 字段计算（公式支持）
 * - 条件映射
 * - 默认值填充
 * 
 * 复杂度：M（中）
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, FieldSchema, AuditDataType } from '../../../types/AuditDataTypes';

interface MappingRule {
  sourceField: string;           // 源字段
  targetField: string;           // 目标字段
  targetType?: 'string' | 'number' | 'boolean' | 'date';  // 目标类型
  transform?: string;            // 转换函数（'uppercase', 'lowercase', 'trim', 'abs', etc.）
  formula?: string;              // 计算公式
  defaultValue?: any;            // 默认值
  condition?: {                  // 条件映射
    field: string;
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
    value: any;
  };
}

interface FieldMapperConfig {
  mappings: MappingRule[];       // 映射规则
  keepUnmapped?: boolean;        // 保留未映射字段
  strictMode?: boolean;          // 严格模式（缺失必需字段时报错）
}

export class FieldMapperNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'preprocess.field_mapper',
      version: '1.0.0',
      category: 'preprocess',
      
      label: {
        zh: '字段映射',
        en: 'Field Mapper'
      },
      
      description: {
        zh: '自定义字段映射和转换。支持字段重命名、类型转换、公式计算、条件映射、默认值填充。',
        en: 'Custom field mapping and transformation. Support field renaming, type conversion, formula calculation, conditional mapping, default value filling.'
      },
      
      icon: '🔄',
      color: '#E67E22',
      
      inputs: [
        {
          id: 'records',
          name: 'records',
          type: 'Records',
          required: true,
          description: {
            zh: '待映射的记录',
            en: 'Records to map'
          }
        }
      ],
      
      outputs: [
        {
          id: 'mapped',
          name: 'mapped',
          type: 'Records',
          required: true,
          description: {
            zh: '映射后的记录',
            en: 'Mapped records'
          }
        }
      ],
      
      config: [
        {
          id: 'mappings',
          name: { zh: '映射规则', en: 'Mapping Rules' },
          type: 'json',
          required: true,
          description: {
            zh: '字段映射规则列表',
            en: 'List of field mapping rules'
          }
        },
        {
          id: 'keepUnmapped',
          name: { zh: '保留未映射字段', en: 'Keep Unmapped Fields' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '保留未在映射规则中的字段',
            en: 'Keep fields not in mapping rules'
          }
        },
        {
          id: 'strictMode',
          name: { zh: '严格模式', en: 'Strict Mode' },
          type: 'boolean',
          required: false,
          defaultValue: false,
          description: {
            zh: '严格模式下，缺失必需字段时报错',
            en: 'In strict mode, error on missing required fields'
          }
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['preprocess', 'mapping', 'transform', 'conversion'],
        documentation: 'https://docs.audit-system.com/nodes/preprocess/field-mapper',
        examples: [
          {
            title: '字段重命名和类型转换',
            description: '将old_name映射到new_name并转换类型',
            inputs: {
              records: {
                type: 'Records',
                data: [
                  { old_name: 'John', old_age: '30', old_salary: '50000' }
                ]
              }
            },
            config: {
              mappings: [
                { sourceField: 'old_name', targetField: 'name', targetType: 'string' },
                { sourceField: 'old_age', targetField: 'age', targetType: 'number' },
                { sourceField: 'old_salary', targetField: 'salary', targetType: 'number' }
              ],
              keepUnmapped: false
            }
          },
          {
            title: '公式计算',
            description: '计算税后工资',
            inputs: {
              records: {
                type: 'Records',
                data: [
                  { salary: 10000, tax_rate: 0.2 }
                ]
              }
            },
            config: {
              mappings: [
                { sourceField: 'salary', targetField: 'salary', targetType: 'number' },
                { sourceField: 'salary', targetField: 'after_tax', targetType: 'number', formula: 'salary * (1 - tax_rate)' }
              ]
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
      const cfg: FieldMapperConfig = {
        mappings: config.mappings || [],
        keepUnmapped: config.keepUnmapped !== false,
        strictMode: config.strictMode === true
      };
      
      context.logger?.info?.(`🔄 Mapping ${records.rowCount} records with ${cfg.mappings.length} rules`);
      
      // 验证映射规则
      this.validateMappings(cfg.mappings, context);
      
      // 应用映射
      const mappedData = records.data.map((row, index) => {
        try {
          return this.applyMappings(row, cfg, context);
        } catch (error: any) {
          context.logger?.warn?.(`⚠️  Mapping failed for row ${index}: ${error.message}`);
          if (cfg.strictMode) {
            throw error;
          }
          return row;  // 严格模式关闭时返回原始行
        }
      });
      
      // 生成新schema
      const newSchema = this.generateSchema(cfg.mappings, records.schema, cfg.keepUnmapped);
      
      // 构造输出
      const mapped: Records = {
        type: 'Records',
        schema: newSchema,
        data: mappedData,
        metadata: this.createMetadata(context.nodeId, context.executionId, 'mapped'),
        rowCount: mappedData.length,
        columnCount: newSchema.length
      };
      
      const duration = Date.now() - startTime;
      
      context.logger?.info?.(`✅ Mapping completed: ${mappedData.length} records, ${newSchema.length} fields (${duration}ms)`);
      
      return this.wrapSuccess(
        { mapped },
        duration,
        context
      );
      
    } catch (error: any) {
      context.logger?.error?.('❌ Field mapping failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private validateMappings(mappings: MappingRule[], context: NodeExecutionContext): void {
    for (const mapping of mappings) {
      if (!mapping.sourceField || !mapping.targetField) {
        throw new Error('Mapping rule must have sourceField and targetField');
      }
      
      if (mapping.formula && !this.isValidFormula(mapping.formula)) {
        context.logger?.warn?.(`⚠️  Invalid formula: ${mapping.formula}`);
      }
    }
  }

  private isValidFormula(formula: string): boolean {
    // 简单验证：检查是否包含危险字符
    const dangerous = ['eval', 'Function', 'require', 'import', 'exec'];
    return !dangerous.some(keyword => formula.includes(keyword));
  }

  private applyMappings(
    row: Record<string, any>,
    config: FieldMapperConfig,
    context: NodeExecutionContext
  ): Record<string, any> {
    const result: Record<string, any> = {};
    
    // 1. 应用映射规则
    for (const mapping of config.mappings) {
      // 检查条件
      if (mapping.condition && !this.checkCondition(row, mapping.condition)) {
        continue;
      }
      
      let value = row[mapping.sourceField];
      
      // 使用默认值
      if (value === undefined || value === null) {
        value = mapping.defaultValue;
      }
      
      // 应用转换
      if (value !== undefined && value !== null) {
        value = this.applyTransform(value, mapping, context);
        value = this.convertType(value, mapping.targetType);
      }
      
      // 应用公式
      if (mapping.formula) {
        value = this.evaluateFormula(mapping.formula, row, context);
      }
      
      result[mapping.targetField] = value;
    }
    
    // 2. 保留未映射字段
    if (config.keepUnmapped === true) {
      const mappedSourceFields = config.mappings.map(m => m.sourceField);
      for (const [key, value] of Object.entries(row)) {
        if (!mappedSourceFields.includes(key) && !(key in result)) {
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  private checkCondition(row: Record<string, any>, condition: MappingRule['condition']): boolean {
    if (!condition) return true;
    
    const fieldValue = row[condition.field];
    const targetValue = condition.value;
    
    switch (condition.operator) {
      case '==':
        return fieldValue == targetValue;
      case '!=':
        return fieldValue != targetValue;
      case '>':
        return fieldValue > targetValue;
      case '<':
        return fieldValue < targetValue;
      case '>=':
        return fieldValue >= targetValue;
      case '<=':
        return fieldValue <= targetValue;
      default:
        return true;
    }
  }

  private applyTransform(value: any, mapping: MappingRule, context: NodeExecutionContext): any {
    if (!mapping.transform) return value;
    
    const strValue = String(value);
    
    switch (mapping.transform.toLowerCase()) {
      case 'uppercase':
        return strValue.toUpperCase();
      case 'lowercase':
        return strValue.toLowerCase();
      case 'trim':
        return strValue.trim();
      case 'abs':
        return Math.abs(Number(value));
      case 'round':
        return Math.round(Number(value));
      case 'floor':
        return Math.floor(Number(value));
      case 'ceil':
        return Math.ceil(Number(value));
      default:
        context.logger?.warn?.(`⚠️  Unknown transform: ${mapping.transform}`);
        return value;
    }
  }

  private convertType(value: any, targetType?: string): any {
    if (!targetType) return value;
    
    switch (targetType) {
      case 'string':
        return String(value);
      
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);
      
      case 'date':
        if (value instanceof Date) return value;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      
      default:
        return value;
    }
  }

  private evaluateFormula(
    formula: string,
    row: Record<string, any>,
    context: NodeExecutionContext
  ): any {
    try {
      // 创建安全的求值环境
      const safeEval = this.createSafeEvaluator(row);
      return safeEval(formula);
    } catch (error: any) {
      context.logger?.warn?.(`⚠️  Formula evaluation failed: ${formula} - ${error.message}`);
      return null;
    }
  }

  private createSafeEvaluator(context: Record<string, any>) {
    // 创建安全的求值函数，只允许访问上下文变量和基本数学运算
    return (formula: string): any => {
      // 替换字段名为实际值
      let expression = formula;
      for (const [key, value] of Object.entries(context)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        const safeValue = typeof value === 'number' ? value : JSON.stringify(value);
        expression = expression.replace(regex, String(safeValue));
      }
      
      // 只允许基本数学运算
      const allowedPattern = /^[\d\s+\-*/(). ]+$/;
      if (!allowedPattern.test(expression)) {
        throw new Error('Formula contains invalid characters');
      }
      
      // 使用Function构造器求值（受限环境）
      try {
        return new Function(`return ${expression}`)();
      } catch (error) {
        throw new Error('Formula evaluation failed');
      }
    };
  }

  private generateSchema(
    mappings: MappingRule[],
    originalSchema: FieldSchema[],
    keepUnmapped: boolean | undefined
  ): FieldSchema[] {
    const newSchema: FieldSchema[] = [];
    
    // 添加映射字段
    for (const mapping of mappings) {
      const existingField = originalSchema.find(f => f.name === mapping.sourceField);
      
      newSchema.push({
        name: mapping.targetField,
        type: (mapping.targetType || existingField?.type || 'string') as any,
        required: existingField?.required || false,
        description: existingField?.description || mapping.targetField
      });
    }
    
    // 保留未映射字段
    if (keepUnmapped) {
      const mappedSourceFields = mappings.map(m => m.sourceField);
      const mappedTargetFields = mappings.map(m => m.targetField);
      
      for (const field of originalSchema) {
        if (!mappedSourceFields.includes(field.name) && !mappedTargetFields.includes(field.name)) {
          newSchema.push(field);
        }
      }
    }
    
    return newSchema;
  }
}
