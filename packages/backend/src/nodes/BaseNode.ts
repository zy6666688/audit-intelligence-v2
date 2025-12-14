/**
 * 审计节点基类
 * 
 * @description 定义审计工作流节点的基础结构和通用功能
 * 所有审计节点（如固定资产盘点、应收账款函证等）都必须继承此类
 * 提供Excel解析、导出、审计底稿生成等通用功能
 * 
 * @author SHENJI Team
 * @date 2025-12-03
 * @version 1.0.0
 * @since Week 2-3: 核心节点开发 - 基础类
 * 
 * @example
 * ```typescript
 * // 创建自定义审计节点
 * export class CustomAuditNode extends BaseNode {
 *   static metadata: NodeMetadata = {
 *     id: 'custom-audit',
 *     name: '自定义审计',
 *     category: 'audit',
 *     description: '自定义审计节点'
 *   };
 * 
 *   async execute(inputs, config) {
 *     await this.validateInputs(inputs);
 *     const data = await this.parseExcel(inputs.excelFile);
 *     // ... 审计逻辑
 *     return { success: true, data };
 *   }
 * }
 * ```
 */

import { BusinessError, ErrorCode } from '../constants/ErrorCode';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * 节点元数据接口
 * 
 * @description 定义节点的基本信息和属性
 * 用于节点注册表和前端显示
 * 
 * @interface
 */
export interface NodeMetadata {
  id: string;
  name: string;
  category: string;
  description: string;
  icon?: string;
  version?: string;
}

/**
 * 节点输入定义接口
 * 
 * @description 定义节点的输入项，包括类型、校验规则等
 * 支持Excel、CSV、PDF、图片、文本、JSON和手动输入
 * 
 * @interface
 */
export interface NodeInput {
  name: string;
  label: string;
  type: 'excel' | 'csv' | 'pdf' | 'image' | 'text' | 'json' | 'manual';
  required: boolean;
  description?: string;
  validation?: (value: any) => boolean;
}

/**
 * 节点输出定义接口
 * 
 * @description 定义节点的输出项，用于连接到下一个节点
 * 支持数据、Excel、PDF和JSON格式
 * 
 * @interface
 */
export interface NodeOutput {
  name: string;
  label: string;
  type: 'data' | 'excel' | 'pdf' | 'json';
  description?: string;
}

/**
 * 节点配置项接口
 * 
 * @description 定义节点的可配置参数
 * 支持字符串、数字、布尔值和下拉选项
 * 
 * @interface
 */
export interface NodeConfig {
  [key: string]: {
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    default: any;
    options?: any[];
    description?: string;
  };
}

/**
 * 节点执行上下文接口
 * 
 * @description 定义节点执行时的上下文信息
 * 包括工作流ID、节点ID、用户ID等
 * 
 * @interface
 */
export interface NodeExecutionContext {
  workflowId: string;
  nodeId: string;
  userId: string;
  timestamp: number;
}

/**
 * 节点执行结果接口
 * 
 * @description 定义节点执行后返回的结果格式
 * 包括执行状态、输出数据、日志和错误信息
 * 
 * @interface
 */
export interface NodeExecutionResult {
  success: boolean;
  data?: any;
  outputs?: Record<string, any>;
  logs?: string[];
  duration?: number;
  error?: string;
}

/**
 * 审计节点抽象基类
 * 
 * @description 所有审计节点的抽象基类，定义了节点的核心结构和通用功能
 * 子类必须实现execute方法，并定义metadata、inputs、outputs和config静态属性
 * 
 * @abstract
 * 
 * @remarks
 * 提供的通用功能：
 * - validateInputs: 输入数据校验
 * - parseExcel: Excel文件解析
 * - exportExcel: Excel文件导出
 * - generateWorkpaper: 审计底稿生成
 * - log: 日志记录
 * 
 * @example
 * ```typescript
 * export class FixedAssetInventoryNode extends BaseNode {
 *   static metadata = {
 *     id: 'fixed-asset-inventory',
 *     name: '固定资产盘点',
 *     category: 'audit',
 *     description: '处理固定资产盘点数据'
 *   };
 * 
 *   async execute(inputs, config) {
 *     this.log('开始执行固定资产盘点');
 *     await this.validateInputs(inputs);
 *     
 *     const assetData = await this.parseExcel(inputs.assetList);
 *     const inventoryData = await this.parseExcel(inputs.inventoryRecord);
 *     
 *     // ... 审计逻辑
 *     
 *     const workpaperPath = await this.generateWorkpaper(
 *       '固定资产盘点底稿',
 *       [{ title: '盘点结果', headers: [...], data: [...] }]
 *     );
 *     
 *     return {
 *       success: true,
 *       data: { workpaperPath },
 *       logs: this.getLogs()
 *     };
 *   }
 * }
 * ```
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
   * 执行节点逻辑（抽象方法，子类必须实现）
   * 
   * @description 节点的核心执行逻辑，每个子类必须根据自身业务实现
   * 应包含数据处理、业务逻辑和结果输出
   * 
   * @abstract
   * @param {Record<string, any>} inputs - 输入数据，键为输入名，值为输入数据
   * @param {Record<string, any>} config - 配置参数，键为配置项名，值为配置值
   * @returns {Promise<NodeExecutionResult>} 节点执行结果
   * 
   * @throws {BusinessError} 当执行失败时抛出业务异常
   * 
   * @example
   * ```typescript
   * async execute(inputs, config) {
   *   try {
   *     // 1. 验证输入
   *     await this.validateInputs(inputs);
   *     
   *     // 2. 处理数据
   *     const data = await this.parseExcel(inputs.excelFile);
   *     
   *     // 3. 执行业务逻辑
   *     const result = this.processData(data, config);
   *     
   *     // 4. 生成输出
   *     const outputPath = await this.exportExcel(result, headers, 'output.xlsx');
   *     
   *     // 5. 返回结果
   *     return {
   *       success: true,
   *       data: result,
   *       outputs: { excelFile: outputPath },
   *       logs: this.getLogs()
   *     };
   *   } catch (error) {
   *     return {
   *       success: false,
   *       error: error.message,
   *       logs: this.getLogs()
   *     };
   *   }
   * }
   * ```
   */
  abstract execute(
    inputs: Record<string, any>,
    config: Record<string, any>
  ): Promise<NodeExecutionResult>;

  /**
   * 验证输入数据
   * 
   * @description 校验输入数据的完整性和有效性
   * 检查必填项是否提供，执行自定义校验函数
   * 
   * @protected
   * @param {Record<string, any>} inputs - 输入数据对象
   * @returns {Promise<void>}
   * 
   * @throws {BusinessError} 当缺少必填参数或校验失败时抛出异常
   * 
   * @example
   * ```typescript
   * await this.validateInputs(inputs);
   * ```
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
   * 
   * @description 读取并解析Excel文件，将数据转换为对象数组
   * 自动读取第一行作为表头，将每行数据转换为对象
   * 
   * @protected
   * @param {string} filePath - Excel文件路径
   * @returns {Promise<any[]>} 解析后的数据数组
   * 
   * @throws {BusinessError} 当文件不存在或格式错误时抛出异常
   * 
   * @example
   * ```typescript
   * const data = await this.parseExcel('/path/to/file.xlsx');
   * // 返回: [{ 列头1: 值1, 列头2: 值2 }, ...]
   * ```
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
   * 
   * @description 将数据导出为Excel文件
   * 自动创建输出目录并设置列宽
   * 
   * @protected
   * @param {any[]} data - 要导出的数据数组
   * @param {string[]} headers - 列头数组，决定列的顺序和显示名称
   * @param {string} filename - 输出文件名
   * @returns {Promise<string>} 输出文件的绝对路径
   * 
   * @throws {BusinessError} 当文件创建失败时抛出异常
   * 
   * @example
   * ```typescript
   * const data = [{ 姓名: '张三', 年龄: 25 }, { 姓名: '李四', 年龄: 30 }];
   * const headers = ['姓名', '年龄'];
   * const filePath = await this.exportExcel(data, headers, 'users.xlsx');
   * // 返回: '/path/to/uploads/outputs/users.xlsx'
   * ```
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
   * 
   * @description 生成标准格式的审计工作底稿文档
   * 包括标题、多个数据区块，带有格式化和边框
   * 
   * @protected
   * @param {string} title - 底稿标题
   * @param {Array} sections - 底稿数据区块数组
   * @param {string} sections[].title - 区块标题
   * @param {string[]} sections[].headers - 区块表头
   * @param {any[]} sections[].data - 区块数据
   * @returns {Promise<string>} 底稿文件的绝对路径
   * 
   * @throws {BusinessError} 当文件生成失败时抛出异常
   * 
   * @example
   * ```typescript
   * const workpaperPath = await this.generateWorkpaper(
   *   '固定资产盘点底稿',
   *   [
   *     {
   *       title: '盘点情况汇总',
   *       headers: ['资产编号', '资产名称', '盘点状态'],
   *       data: [
   *         { 资产编号: 'A001', 资产名称: '电脑', 盘点状态: '正常' }
   *       ]
   *     },
   *     {
   *       title: '异常情况',
   *       headers: ['资产编号', '问题描述'],
   *       data: []
   *     }
   *   ]
   * );
   * // 返回: '/path/to/uploads/workpapers/固定资产盘点底稿_1701619200000.xlsx'
   * ```
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
   * 记录执行日志
   * 
   * @description 记录节点执行过程中的日志信息
   * 同时输出到控制台和保存到内部日志数组
   * 
   * @protected
   * @param {string} message - 日志消息
   * @returns {void}
   * 
   * @example
   * ```typescript
   * this.log('开始处理数据');
   * this.log(`处理了 ${count} 条记录`);
   * ```
   */
  protected log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.logs.push(logMessage);
    console.log(`[${this.constructor.name}]`, logMessage);
  }

  /**
   * 设置节点执行上下文
   * 
   * @description 在节点执行前设置上下文信息
   * 包括工作流ID、节点ID、用户ID等
   * 
   * @public
   * @param {NodeExecutionContext} context - 执行上下文对象
   * @returns {void}
   * 
   * @example
   * ```typescript
   * const node = new SomeNode();
   * node.setContext({
   *   workflowId: 'wf-123',
   *   nodeId: 'node-456',
   *   userId: 'user-789',
   *   timestamp: Date.now()
   * });
   * ```
   */
  setContext(context: NodeExecutionContext): void {
    this.context = context;
  }

  /**
   * 获取执行日志
   * 
   * @description 获取节点执行过程中记录的所有日志
   * 
   * @public
   * @returns {string[]} 日志消息数组
   * 
   * @example
   * ```typescript
   * const logs = node.getLogs();
   * console.log(logs);
   * // ['[2025-12-03T...] 开始执行', '[2025-12-03T...] 处理完成']
   * ```
   */
  getLogs(): string[] {
    return this.logs;
  }

  /**
   * 清除执行日志
   * 
   * @description 清空内部日志数组，通常在新一轮执行前调用
   * 
   * @public
   * @returns {void}
   * 
   * @example
   * ```typescript
   * node.clearLogs();
   * // 清空后重新开始记录
   * ```
   */
  clearLogs(): void {
    this.logs = [];
  }
}
