/**
 * Invoice Input Node - 发票导入节点
 * 
 * 功能：
 * - CSV/Excel发票数据导入
 * - 图片OCR识别（准备）
 * - 发票要素提取
 * - 格式验证（发票号、税号）
 * - 重复发票检测
 * 
 * 复杂度：M（中）
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, AuditDataType } from '../../../types/AuditDataTypes';
import { DataValidator } from '../utils/DataValidator';

interface InvoiceConfig {
  source?: 'csv' | 'excel' | 'image' | 'api';
  validateFormat?: boolean;      // 验证格式
  detectDuplicates?: boolean;    // 检测重复
  verifyTax?: boolean;          // 验证税额计算
  ocrEnabled?: boolean;         // 启用OCR
}

export class InvoiceInputNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'input.invoice',
      version: '1.0.0',
      category: 'input',
      
      label: {
        zh: '发票导入',
        en: 'Invoice Input'
      },
      
      description: {
        zh: '导入发票数据，支持CSV/Excel/图片。自动提取发票要素（发票号、金额、税额），验证格式和税额计算，检测重复发票。',
        en: 'Import invoice data from CSV/Excel/Images. Auto-extract invoice elements (number, amount, tax), validate format and tax calculation, detect duplicates.'
      },
      
      icon: '🧾',
      color: '#9B59B6',
      
      inputs: [],
      
      outputs: [
        {
          id: 'invoices',
          name: 'invoices',
          type: 'Records',
          required: true,
          description: {
            zh: '标准化的发票记录',
            en: 'Standardized invoice records'
          }
        },
        {
          id: 'validation',
          name: 'validation',
          type: 'Records',
          required: true,
          description: {
            zh: '验证结果',
            en: 'Validation results'
          }
        }
      ],
      
      config: [
        {
          id: 'data',
          name: { zh: '发票数据', en: 'Invoice Data' },
          type: 'json',
          required: true,
          description: {
            zh: '发票数据或图片路径',
            en: 'Invoice data or image paths'
          }
        },
        {
          id: 'source',
          name: { zh: '数据来源', en: 'Data Source' },
          type: 'select',
          required: false,
          defaultValue: 'csv',
          options: [
            { label: 'CSV', value: 'csv' },
            { label: 'Excel', value: 'excel' },
            { label: 'Image (OCR)', value: 'image' },
            { label: 'API', value: 'api' }
          ]
        },
        {
          id: 'validateFormat',
          name: { zh: '验证格式', en: 'Validate Format' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '验证发票号码和税号格式',
            en: 'Validate invoice number and tax ID format'
          }
        },
        {
          id: 'detectDuplicates',
          name: { zh: '检测重复', en: 'Detect Duplicates' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '检测重复发票',
            en: 'Detect duplicate invoices'
          }
        },
        {
          id: 'verifyTax',
          name: { zh: '验证税额', en: 'Verify Tax' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '验证税额计算是否正确',
            en: 'Verify tax calculation accuracy'
          }
        },
        {
          id: 'ocrEnabled',
          name: { zh: '启用OCR', en: 'Enable OCR' },
          type: 'boolean',
          required: false,
          defaultValue: false,
          description: {
            zh: '对图片发票使用OCR识别',
            en: 'Use OCR for image invoices'
          }
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['input', 'invoice', 'ocr', 'tax', 'duplicate-detection'],
        documentation: 'https://docs.audit-system.com/nodes/input/invoice',
        examples: [
          {
            title: '导入增值税发票',
            description: '验证格式和税额',
            inputs: {},
            config: {
              data: [
                {
                  invoice_no: '12345678',
                  invoice_code: '1100192130',
                  date: '2025-01-01',
                  seller: '某某公司',
                  buyer: '采购方公司',
                  amount: 10000,
                  tax_rate: 0.13,
                  tax: 1300,
                  total: 11300
                }
              ],
              validateFormat: true,
              verifyTax: true,
              detectDuplicates: true
            }
          }
        ]
      },
      
      capabilities: {
        cacheable: true,
        parallel: true,
        streaming: false,
        aiPowered: true    // OCR功能
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
      const data = config.data as Array<Record<string, any>>;
      const cfg: InvoiceConfig = {
        source: config.source || 'csv',
        validateFormat: config.validateFormat !== false,
        detectDuplicates: config.detectDuplicates !== false,
        verifyTax: config.verifyTax !== false,
        ocrEnabled: config.ocrEnabled === true
      };
      
      context.logger?.info?.(`🧾 Processing ${data.length} invoices from ${cfg.source}`);
      
      // 1. 如果是图片，使用OCR提取
      let processedData = data;
      if (cfg.source === 'image' && cfg.ocrEnabled) {
        processedData = await this.extractFromImages(data, context);
      }
      
      // 2. 字段标准化
      const normalizedData = this.normalizeFields(processedData);
      
      // 3. 验证发票
      const validationResults = this.validateInvoices(normalizedData, cfg, context);
      
      // 4. 构造输出
      const invoices: Records = {
        type: 'Records',
        schema: this.getInvoiceSchema(),
        data: normalizedData,
        metadata: this.createMetadata(context.nodeId, context.executionId, cfg.source || 'unknown'),
        rowCount: normalizedData.length,
        columnCount: this.getInvoiceSchema().length
      };
      
      const validation: Records = {
        type: 'Records',
        schema: [
          { name: 'invoice_no', type: 'string', required: true, description: 'Invoice No' },
          { name: 'status', type: 'string', required: true, description: 'Status' },
          { name: 'issues', type: 'string', required: false, description: 'Issues' }
        ],
        data: validationResults,
        metadata: this.createMetadata(context.nodeId, context.executionId, 'validation'),
        rowCount: validationResults.length,
        columnCount: 3
      };
      
      const duration = Date.now() - startTime;
      
      const validCount = validationResults.filter(v => v.status === 'valid').length;
      const invalidCount = validationResults.length - validCount;
      
      context.logger?.info?.(`✅ Invoices processed: ${validCount} valid, ${invalidCount} invalid (${duration}ms)`);
      
      return this.wrapSuccess(
        { invoices, validation },
        duration,
        context
      );
      
    } catch (error: any) {
      context.logger?.error?.('❌ Invoice import failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private async extractFromImages(
    data: Array<Record<string, any>>,
    context: NodeExecutionContext
  ): Promise<Array<Record<string, any>>> {
    const extracted: Array<Record<string, any>> = [];
    
    for (const item of data) {
      if (item.image_path) {
        // 使用OCR提取（需要AI服务）
        if (context.ai?.ocr) {
          try {
            const text = await context.ai.ocr(item.image_path);
            const invoice = this.parseInvoiceText(text);
            extracted.push(invoice);
          } catch (error: any) {
            context.logger?.warn?.(`⚠️  OCR failed for ${item.image_path}: ${error.message}`);
            extracted.push({ invoice_no: 'OCR_FAILED', error: error.message });
          }
        } else {
          context.logger?.warn?.('⚠️  OCR service not available');
          extracted.push(item);
        }
      } else {
        extracted.push(item);
      }
    }
    
    return extracted;
  }

  private parseInvoiceText(text: string): Record<string, any> {
    // 从OCR文本中解析发票要素
    const invoice: Record<string, any> = {};
    
    // 发票号码（8位数字）
    const invoiceNoMatch = text.match(/发票号码[：:]\s*(\d{8})/);
    if (invoiceNoMatch) {
      invoice.invoice_no = invoiceNoMatch[1];
    }
    
    // 发票代码（10-12位数字）
    const invoiceCodeMatch = text.match(/发票代码[：:]\s*(\d{10,12})/);
    if (invoiceCodeMatch) {
      invoice.invoice_code = invoiceCodeMatch[1];
    }
    
    // 开票日期
    const dateMatch = text.match(/开票日期[：:]\s*(\d{4})[年\-](\d{1,2})[月\-](\d{1,2})/);
    if (dateMatch) {
      invoice.date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }
    
    // 金额
    const amountMatch = text.match(/[价金额合计|小写][：:￥¥]\s*([\d,]+\.?\d*)/);
    if (amountMatch) {
      invoice.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
    
    // 税额
    const taxMatch = text.match(/税额[：:￥¥]\s*([\d,]+\.?\d*)/);
    if (taxMatch) {
      invoice.tax = parseFloat(taxMatch[1].replace(/,/g, ''));
    }
    
    // 价税合计
    const totalMatch = text.match(/[价税合计|总计][：:￥¥]\s*([\d,]+\.?\d*)/);
    if (totalMatch) {
      invoice.total = parseFloat(totalMatch[1].replace(/,/g, ''));
    }
    
    return invoice;
  }

  private normalizeFields(data: Array<Record<string, any>>): Array<Record<string, any>> {
    // 字段映射规则
    const fieldMap: Record<string, string[]> = {
      invoice_no: ['invoice_no', 'invoiceno', 'no', 'number', '发票号码', '号码'],
      invoice_code: ['invoice_code', 'code', '发票代码', '代码'],
      date: ['date', 'invoice_date', '开票日期', '日期'],
      seller: ['seller', 'seller_name', '销售方', '销方'],
      seller_tax_no: ['seller_tax_no', 'seller_taxno', '销方税号'],
      buyer: ['buyer', 'buyer_name', '购买方', '购方'],
      buyer_tax_no: ['buyer_tax_no', 'buyer_taxno', '购方税号'],
      amount: ['amount', 'price', 'sum', '金额', '价款'],
      tax_rate: ['tax_rate', 'taxrate', 'rate', '税率'],
      tax: ['tax', 'tax_amount', '税额'],
      total: ['total', 'total_amount', '价税合计', '合计']
    };
    
    return data.map(row => {
      const normalized: Record<string, any> = {};
      
      for (const [standardField, variants] of Object.entries(fieldMap)) {
        for (const variant of variants) {
          const matchedKey = Object.keys(row).find(key => 
            key.toLowerCase() === variant.toLowerCase()
          );
          
          if (matchedKey) {
            normalized[standardField] = row[matchedKey];
            break;
          }
        }
      }
      
      // 保留未映射字段
      for (const key of Object.keys(row)) {
        if (!Object.values(fieldMap).flat().some(v => 
          v.toLowerCase() === key.toLowerCase()
        )) {
          normalized[key] = row[key];
        }
      }
      
      return normalized;
    });
  }

  private validateInvoices(
    data: Array<Record<string, any>>,
    config: InvoiceConfig,
    context: NodeExecutionContext
  ): Array<Record<string, any>> {
    const seenInvoices = new Set<string>();
    
    return data.map(invoice => {
      const issues: string[] = [];
      
      // 1. 检查必需字段
      if (!invoice.invoice_no) {
        issues.push('Missing invoice number');
      }
      
      // 2. 验证格式
      if (config.validateFormat) {
        // 发票号码格式（8位数字）
        if (invoice.invoice_no && !/^\d{8}$/.test(invoice.invoice_no)) {
          issues.push(`Invalid invoice number format: ${invoice.invoice_no}`);
        }
        
        // 发票代码格式（10-12位数字）
        if (invoice.invoice_code && !/^\d{10,12}$/.test(invoice.invoice_code)) {
          issues.push(`Invalid invoice code format: ${invoice.invoice_code}`);
        }
        
        // 税号格式（15或18位）
        if (invoice.seller_tax_no && !/^[\dA-Z]{15,18}$/.test(invoice.seller_tax_no)) {
          issues.push('Invalid seller tax number format');
        }
      }
      
      // 3. 验证税额计算
      if (config.verifyTax) {
        const amount = parseFloat(invoice.amount || 0);
        const taxRate = parseFloat(invoice.tax_rate || 0);
        const tax = parseFloat(invoice.tax || 0);
        const total = parseFloat(invoice.total || 0);
        
        // 检查税额计算
        const expectedTax = amount * taxRate;
        if (Math.abs(tax - expectedTax) > 0.01) {
          issues.push(`Tax calculation error: expected ${expectedTax.toFixed(2)}, got ${tax}`);
        }
        
        // 检查合计
        const expectedTotal = amount + tax;
        if (Math.abs(total - expectedTotal) > 0.01) {
          issues.push(`Total calculation error: expected ${expectedTotal.toFixed(2)}, got ${total}`);
        }
      }
      
      // 4. 检测重复
      if (config.detectDuplicates && invoice.invoice_no) {
        if (seenInvoices.has(invoice.invoice_no)) {
          issues.push('Duplicate invoice number');
        } else {
          seenInvoices.add(invoice.invoice_no);
        }
      }
      
      return {
        invoice_no: invoice.invoice_no || 'UNKNOWN',
        status: issues.length === 0 ? 'valid' : 'invalid',
        issues: issues.join('; ')
      };
    });
  }

  private getInvoiceSchema() {
    return [
      { name: 'invoice_no', type: 'string' as const, required: true, description: 'Invoice Number' },
      { name: 'invoice_code', type: 'string' as const, required: false, description: 'Invoice Code' },
      { name: 'date', type: 'date' as const, required: true, description: 'Invoice Date' },
      { name: 'seller', type: 'string' as const, required: true, description: 'Seller Name' },
      { name: 'seller_tax_no', type: 'string' as const, required: false, description: 'Seller Tax No' },
      { name: 'buyer', type: 'string' as const, required: true, description: 'Buyer Name' },
      { name: 'buyer_tax_no', type: 'string' as const, required: false, description: 'Buyer Tax No' },
      { name: 'amount', type: 'number' as const, required: true, description: 'Amount' },
      { name: 'tax_rate', type: 'number' as const, required: false, description: 'Tax Rate' },
      { name: 'tax', type: 'number' as const, required: true, description: 'Tax' },
      { name: 'total', type: 'number' as const, required: true, description: 'Total Amount' }
    ];
  }
}
