/**
 * Data Validator - 数据验证工具类
 * 
 * 提供通用的数据验证功能，供所有节点使用
 */

import type { Records, FieldSchema } from '../../../types/AuditDataTypes';

export class DataValidator {
  /**
   * 验证Records数据完整性
   */
  static validateRecords(records: Records): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 验证基本结构
    if (!records.schema || records.schema.length === 0) {
      errors.push('Schema is empty or undefined');
      return { valid: false, errors, warnings };
    }

    if (!records.data || !Array.isArray(records.data)) {
      errors.push('Data is not an array');
      return { valid: false, errors, warnings };
    }

    // 2. 验证行数和列数
    if (records.rowCount !== records.data.length) {
      warnings.push(`Row count mismatch: expected ${records.rowCount}, got ${records.data.length}`);
    }

    if (records.columnCount !== records.schema.length) {
      warnings.push(`Column count mismatch: expected ${records.columnCount}, got ${records.schema.length}`);
    }

    // 3. 验证每行数据
    for (let i = 0; i < records.data.length; i++) {
      const row = records.data[i];
      const rowErrors = this.validateRow(row, records.schema, i);
      errors.push(...rowErrors);

      // 限制错误数量
      if (errors.length >= 50) {
        errors.push('... and more errors (showing first 50)');
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证单行数据
   */
  private static validateRow(
    row: Record<string, any>,
    schema: FieldSchema[],
    rowIndex: number
  ): string[] {
    const errors: string[] = [];

    for (const field of schema) {
      const value = row[field.name];

      // 检查必需字段
      if (field.required && (value === null || value === undefined || value === '')) {
        errors.push(`Row ${rowIndex + 1}: Missing required field '${field.name}'`);
        continue;
      }

      // 跳过空值的类型检查
      if (value === null || value === undefined) {
        continue;
      }

      // 类型检查
      const typeError = this.validateFieldType(value, field.type, field.name, rowIndex);
      if (typeError) {
        errors.push(typeError);
      }
    }

    return errors;
  }

  /**
   * 验证字段类型
   */
  private static validateFieldType(
    value: any,
    expectedType: string,
    fieldName: string,
    rowIndex: number
  ): string | null {
    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          return `Row ${rowIndex + 1}: Field '${fieldName}' should be string, got ${typeof value}`;
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return `Row ${rowIndex + 1}: Field '${fieldName}' should be number, got ${typeof value}`;
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return `Row ${rowIndex + 1}: Field '${fieldName}' should be boolean, got ${typeof value}`;
        }
        break;

      case 'date':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          return `Row ${rowIndex + 1}: Field '${fieldName}' should be date, got ${typeof value}`;
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return `Row ${rowIndex + 1}: Field '${fieldName}' should be array, got ${typeof value}`;
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          return `Row ${rowIndex + 1}: Field '${fieldName}' should be object, got ${typeof value}`;
        }
        break;
    }

    return null;
  }

  /**
   * 验证必需字段存在
   */
  static validateRequiredFields(
    data: Record<string, any>,
    requiredFields: string[]
  ): ValidationResult {
    const errors: string[] = [];

    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * 验证数值范围
   */
  static validateNumberRange(
    value: number,
    min?: number,
    max?: number,
    fieldName?: string
  ): ValidationResult {
    const errors: string[] = [];
    const name = fieldName || 'value';

    if (min !== undefined && value < min) {
      errors.push(`${name} must be >= ${min}, got ${value}`);
    }

    if (max !== undefined && value > max) {
      errors.push(`${name} must be <= ${max}, got ${value}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * 验证数组长度
   */
  static validateArrayLength(
    arr: any[],
    min?: number,
    max?: number,
    arrayName?: string
  ): ValidationResult {
    const errors: string[] = [];
    const name = arrayName || 'array';

    if (min !== undefined && arr.length < min) {
      errors.push(`${name} must have at least ${min} items, got ${arr.length}`);
    }

    if (max !== undefined && arr.length > max) {
      errors.push(`${name} must have at most ${max} items, got ${arr.length}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * 验证字符串格式
   */
  static validateStringFormat(
    value: string,
    pattern?: RegExp,
    fieldName?: string
  ): ValidationResult {
    const errors: string[] = [];
    const name = fieldName || 'value';

    if (pattern && !pattern.test(value)) {
      errors.push(`${name} does not match required pattern`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
