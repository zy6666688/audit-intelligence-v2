/**
 * 审计节点基类
 * Week 2-3: 核心节点开发 - 基础类
 */

import { BusinessError, ErrorCode } from '../constants/ErrorCode';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface NodeMetadata {
  id: string;
  name: string;
  category: string;
  description: string;
  icon?: string;
  version?: string;
}

export interface NodeInput {
  name: string;
  label: string;
  type: 'excel' | 'csv' | 'pdf' | 'image' | 'text' | 'json' | 'manual';
  required: boolean;
  description?: string;
  validation?: (value: any) => boolean;
}

export interface NodeOutput {
  name: string;
  label: string;
  type: 'data' | 'excel' | 'pdf' | 'json';
  description?: string;
}

export interface NodeConfig {
  [key: string]: {
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    default: any;
    options?: any[];
    description?: string;
  };
}

export interface NodeExecutionContext {
  workflowId: string;
  nodeId: string;
  userId: string;
  timestamp: number;
}

export interface NodeExecutionResult {
  success: boolean;
  data?: any;
  outputs?: Record<string, any>;
  logs?: string[];
  duration?: number;
  error?: string;
}

/**
 * 审计节点基类
 * 所有审计节点都继承此类
 */
export abstract class BaseNode {
  // 节点元数据
  static metadata: NodeMetadata;

  // 输入定义
  static inputs: NodeInput[];

  // 输出定义
  static outputs: NodeOutput[];

  // 配置项
  static config: NodeConfig;

  // 执行上下文
  protected context?: NodeExecutionContext;

  // 执行日志
  protected logs: string[] = [];

  /**
   * 执行节点（子类必须实现）
   */
  abstract execute(
    inputs: Record<string, any>,
    config: Record<string, any>
  ): Promise<NodeExecutionResult>;

  /**
   * 验证输入
   */
  protected async validateInputs(
    inputs: Record<string, any>
  ): Promise<void> {
    const constructor = this.constructor as typeof BaseNode;
    
    for (const inputDef of constructor.inputs) {
      // 检查必填项
      if (inputDef.required && !inputs[inputDef.name]) {
        throw new BusinessError(
          ErrorCode.MISSING_PARAMS,
          `缺少必需参数: ${inputDef.label}`
        );
      }

      // 自定义验证
      if (inputs[inputDef.name] && inputDef.validation) {
        const isValid = inputDef.validation(inputs[inputDef.name]);
        if (!isValid) {
          throw new BusinessError(
            ErrorCode.INVALID_PARAMS,
            `参数验证失败: ${inputDef.label}`
          );
        }
      }
    }
  }

  /**
   * 解析Excel文件
   */
  protected async parseExcel(filePath: string): Promise<any[]> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('Excel文件为空');
      }

      const data: any[] = [];
      const headers: string[] = [];

      // 读取表头
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.value?.toString() || `col${colNumber}`;
      });

      // 读取数据
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 跳过表头

        const rowData: any = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          rowData[header] = cell.value;
        });
        data.push(rowData);
      });

      this.log(`成功解析Excel文件: ${path.basename(filePath)}, 共${data.length}行数据`);
      return data;
    } catch (error: any) {
      throw new BusinessError(
        ErrorCode.INVALID_FORMAT,
        `Excel文件解析失败: ${error.message}`
      );
    }
  }

  /**
   * 导出Excel文件
   */
  protected async exportExcel(
    data: any[],
    headers: string[],
    filename: string
  ): Promise<string> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('数据');

      // 添加表头
      worksheet.addRow(headers);

      // 添加数据
      data.forEach(row => {
        const rowData = headers.map(header => row[header] || '');
        worksheet.addRow(rowData);
      });

      // 设置列宽
      worksheet.columns.forEach(column => {
        column.width = 15;
      });

      // 保存文件
      const outputDir = path.join(process.cwd(), 'uploads', 'outputs');
      await fs.mkdir(outputDir, { recursive: true });
      
      const outputPath = path.join(outputDir, filename);
      await workbook.xlsx.writeFile(outputPath);

      this.log(`成功导出Excel文件: ${filename}`);
      return outputPath;
    } catch (error: any) {
      throw new BusinessError(
        ErrorCode.INTERNAL_ERROR,
        `Excel文件导出失败: ${error.message}`
      );
    }
  }

  /**
   * 生成审计底稿
   */
  protected async generateWorkpaper(
    title: string,
    sections: Array<{
      title: string;
      headers: string[];
      data: any[];
    }>
  ): Promise<string> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(title);

      let currentRow = 1;

      // 标题
      worksheet.mergeCells(currentRow, 1, currentRow, 6);
      const titleCell = worksheet.getCell(currentRow, 1);
      titleCell.value = title;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      currentRow += 2;

      // 添加各个部分
      for (const section of sections) {
        // 部分标题
        worksheet.mergeCells(currentRow, 1, currentRow, 6);
        const sectionTitleCell = worksheet.getCell(currentRow, 1);
        sectionTitleCell.value = section.title;
        sectionTitleCell.font = { bold: true, size: 14 };
        sectionTitleCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
        currentRow++;

        // 表头
        const headerRow = worksheet.getRow(currentRow);
        section.headers.forEach((header, index) => {
          const cell = headerRow.getCell(index + 1);
          cell.value = header;
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F0F0' },
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
        currentRow++;

        // 数据
        section.data.forEach(row => {
          const dataRow = worksheet.getRow(currentRow);
          section.headers.forEach((header, index) => {
            const cell = dataRow.getCell(index + 1);
            cell.value = row[header] || '';
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          });
          currentRow++;
        });

        currentRow += 2; // 空行
      }

      // 设置列宽
      worksheet.columns.forEach(column => {
        column.width = 15;
      });

      // 保存文件
      const outputDir = path.join(process.cwd(), 'uploads', 'workpapers');
      await fs.mkdir(outputDir, { recursive: true });
      
      const timestamp = Date.now();
      const filename = `${title}_${timestamp}.xlsx`;
      const outputPath = path.join(outputDir, filename);
      await workbook.xlsx.writeFile(outputPath);

      this.log(`成功生成审计底稿: ${filename}`);
      return outputPath;
    } catch (error: any) {
      throw new BusinessError(
        ErrorCode.INTERNAL_ERROR,
        `审计底稿生成失败: ${error.message}`
      );
    }
  }

  /**
   * 记录日志
   */
  protected log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.logs.push(logMessage);
    console.log(`[${this.constructor.name}]`, logMessage);
  }

  /**
   * 设置执行上下文
   */
  setContext(context: NodeExecutionContext): void {
    this.context = context;
  }

  /**
   * 获取执行日志
   */
  getLogs(): string[] {
    return this.logs;
  }

  /**
   * 清除日志
   */
  clearLogs(): void {
    this.logs = [];
  }
}
