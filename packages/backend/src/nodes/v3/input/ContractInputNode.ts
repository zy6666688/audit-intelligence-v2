/**
 * Contract Input Node - 合同导入节点
 * 
 * 功能：
 * - PDF/Word文档解析
 * - OCR文本提取
 * - 合同要素自动识别
 * - 结构化输出
 * 
 * 复杂度：M（中）- 涉及文档解析和OCR
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, AuditDataType } from '../../../types/AuditDataTypes';
import { DataValidator } from '../utils/DataValidator';

interface ContractConfig {
  extractMethod?: 'text' | 'ocr' | 'auto';  // 提取方法
  identifyParties?: boolean;                  // 识别甲乙方
  identifyAmount?: boolean;                   // 识别合同金额
  identifyDates?: boolean;                    // 识别关键日期
  detectRisks?: boolean;                      // 检测风险条款
}

interface ContractElement {
  partyA?: string;           // 甲方
  partyB?: string;           // 乙方
  amount?: number;           // 合同金额
  startDate?: Date;          // 开始日期
  endDate?: Date;            // 结束日期
  paymentTerms?: string;     // 付款条款
  riskClauses?: string[];    // 风险条款
}

export class ContractInputNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'input.contract',
      version: '1.0.0',
      category: 'input',
      
      label: {
        zh: '合同导入',
        en: 'Contract Input'
      },
      
      description: {
        zh: '导入合同文档（PDF/Word/图片），自动提取文本、识别合同要素（甲乙方、金额、日期），检测风险条款。支持OCR识别。',
        en: 'Import contract documents (PDF/Word/Images), auto-extract text, identify contract elements (parties, amount, dates), and detect risk clauses. OCR supported.'
      },
      
      icon: '📄',
      color: '#E67E22',
      
      inputs: [],
      
      outputs: [
        {
          id: 'contracts',
          name: 'contracts',
          type: 'Records',
          required: true,
          description: {
            zh: '结构化的合同记录',
            en: 'Structured contract records'
          }
        },
        {
          id: 'elements',
          name: 'elements',
          type: 'Records',
          required: true,
          description: {
            zh: '提取的合同要素',
            en: 'Extracted contract elements'
          }
        }
      ],
      
      config: [
        {
          id: 'files',
          name: { zh: '合同文件', en: 'Contract Files' },
          type: 'json',
          required: true,
          description: {
            zh: '合同文件路径或数据',
            en: 'Contract file paths or data'
          }
        },
        {
          id: 'extractMethod',
          name: { zh: '提取方法', en: 'Extract Method' },
          type: 'select',
          required: false,
          defaultValue: 'auto',
          options: [
            { label: 'Auto (智能选择)', value: 'auto' },
            { label: 'Text (文本提取)', value: 'text' },
            { label: 'OCR (图像识别)', value: 'ocr' }
          ],
          description: {
            zh: '文本提取方法',
            en: 'Text extraction method'
          }
        },
        {
          id: 'identifyParties',
          name: { zh: '识别甲乙方', en: 'Identify Parties' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '自动识别合同甲乙方',
            en: 'Auto-identify contract parties'
          }
        },
        {
          id: 'identifyAmount',
          name: { zh: '识别金额', en: 'Identify Amount' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '提取合同金额',
            en: 'Extract contract amount'
          }
        },
        {
          id: 'identifyDates',
          name: { zh: '识别日期', en: 'Identify Dates' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '识别关键日期',
            en: 'Identify key dates'
          }
        },
        {
          id: 'detectRisks',
          name: { zh: '检测风险', en: 'Detect Risks' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '检测风险条款（如违约、赔偿等）',
            en: 'Detect risk clauses (breach, penalty, etc.)'
          }
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['input', 'contract', 'pdf', 'ocr', 'nlp'],
        documentation: 'https://docs.audit-system.com/nodes/input/contract',
        examples: [
          {
            title: '导入PDF合同',
            description: '从PDF提取合同要素',
            inputs: {},
            config: {
              files: [
                { path: '/contracts/contract_001.pdf', type: 'pdf' }
              ],
              extractMethod: 'auto',
              identifyParties: true,
              identifyAmount: true
            }
          }
        ]
      },
      
      capabilities: {
        cacheable: true,
        parallel: true,
        streaming: false,
        aiPowered: true    // 使用NLP/AI识别
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
      const files = config.files as Array<{ path?: string; content?: string; type?: string }>;
      const cfg: ContractConfig = {
        extractMethod: config.extractMethod || 'auto',
        identifyParties: config.identifyParties !== false,
        identifyAmount: config.identifyAmount !== false,
        identifyDates: config.identifyDates !== false,
        detectRisks: config.detectRisks !== false
      };
      
      context.logger?.info?.(`📄 Processing ${files.length} contract files`);
      
      // 1. 提取文本
      const extractedTexts = await this.extractTexts(files, cfg, context);
      
      // 2. 识别合同要素
      const elements = await this.identifyElements(extractedTexts, cfg, context);
      
      // 3. 构造输出
      const contracts: Records = {
        type: 'Records',
        schema: this.getContractSchema(),
        data: extractedTexts.map((text, i) => ({
          contract_id: `CONTRACT_${String(i + 1).padStart(4, '0')}`,
          file_path: files[i].path || 'unknown',
          file_type: files[i].type || 'unknown',
          text_length: text.length,
          extracted_at: new Date().toISOString(),
          extract_method: cfg.extractMethod
        })),
        metadata: this.createMetadata(context.nodeId, context.executionId, 'contract_import'),
        rowCount: files.length,
        columnCount: 6
      };
      
      const elementsRecords: Records = {
        type: 'Records',
        schema: this.getElementsSchema(),
        data: elements.map((elem, i) => ({
          contract_id: `CONTRACT_${String(i + 1).padStart(4, '0')}`,
          party_a: elem.partyA || '',
          party_b: elem.partyB || '',
          amount: elem.amount || 0,
          start_date: elem.startDate?.toISOString() || '',
          end_date: elem.endDate?.toISOString() || '',
          payment_terms: elem.paymentTerms || '',
          risk_count: elem.riskClauses?.length || 0,
          risk_clauses: elem.riskClauses?.join('; ') || ''
        })),
        metadata: this.createMetadata(context.nodeId, context.executionId, 'contract_elements'),
        rowCount: elements.length,
        columnCount: 9
      };
      
      const duration = Date.now() - startTime;
      
      context.logger?.info?.(`✅ Contracts processed: ${files.length} files, ${elements.length} elements extracted (${duration}ms)`);
      
      return this.wrapSuccess(
        { contracts, elements: elementsRecords },
        duration,
        context
      );
      
    } catch (error: any) {
      context.logger?.error?.('❌ Contract import failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private async extractTexts(
    files: Array<{ path?: string; content?: string; type?: string }>,
    config: ContractConfig,
    context: NodeExecutionContext
  ): Promise<string[]> {
    const texts: string[] = [];
    
    for (const file of files) {
      let text = '';
      
      if (file.content) {
        // 直接使用提供的内容
        text = file.content;
      } else if (file.path) {
        // 从文件路径提取
        text = await this.extractFromFile(file.path, file.type || 'pdf', config, context);
      } else {
        context.logger?.warn?.(`⚠️  File has no content or path, skipping`);
        text = '';
      }
      
      texts.push(text);
    }
    
    return texts;
  }

  private async extractFromFile(
    path: string,
    fileType: string,
    config: ContractConfig,
    context: NodeExecutionContext
  ): Promise<string> {
    // 根据文件类型和配置选择提取方法
    const method = config.extractMethod === 'auto' 
      ? this.determineExtractMethod(fileType)
      : config.extractMethod;
    
    if (method === 'ocr' || fileType === 'image') {
      // 使用OCR提取（需要集成OCR服务）
      return await this.extractViaOCR(path, context);
    } else {
      // 文本提取（PDF/Word）
      return await this.extractViaText(path, fileType, context);
    }
  }

  private determineExtractMethod(fileType: string): 'text' | 'ocr' {
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];
    return imageTypes.includes(fileType.toLowerCase()) ? 'ocr' : 'text';
  }

  private async extractViaOCR(
    path: string,
    context: NodeExecutionContext
  ): Promise<string> {
    // OCR提取逻辑
    // 实际应该调用云OCR服务（阿里云/百度/Google）
    
    if (context.ai?.ocr) {
      try {
        context.logger?.info?.(`🔍 Using OCR to extract: ${path}`);
        const text = await context.ai.ocr(path);
        return text;
      } catch (error: any) {
        context.logger?.warn?.(`⚠️  OCR failed: ${error.message}`);
        return `[OCR Error: ${error.message}]`;
      }
    } else {
      context.logger?.warn?.('⚠️  OCR not available, returning placeholder');
      return `[OCR Placeholder for ${path}]`;
    }
  }

  private async extractViaText(
    path: string,
    fileType: string,
    context: NodeExecutionContext
  ): Promise<string> {
    // 文本提取逻辑
    // 实际应该使用pdf-parse或docx解析库
    
    context.logger?.info?.(`📄 Extracting text from ${fileType}: ${path}`);
    
    // 模拟文本提取（实际应该读取文件）
    return `[Extracted text from ${path}]`;
  }

  private async identifyElements(
    texts: string[],
    config: ContractConfig,
    context: NodeExecutionContext
  ): Promise<ContractElement[]> {
    const elements: ContractElement[] = [];
    
    for (const text of texts) {
      const element: ContractElement = {};
      
      // 识别甲乙方
      if (config.identifyParties) {
        const parties = this.extractParties(text);
        element.partyA = parties.partyA;
        element.partyB = parties.partyB;
      }
      
      // 识别金额
      if (config.identifyAmount) {
        element.amount = this.extractAmount(text);
      }
      
      // 识别日期
      if (config.identifyDates) {
        const dates = this.extractDates(text);
        element.startDate = dates.start;
        element.endDate = dates.end;
      }
      
      // 识别付款条款
      element.paymentTerms = this.extractPaymentTerms(text);
      
      // 检测风险条款
      if (config.detectRisks) {
        element.riskClauses = this.detectRiskClauses(text);
      }
      
      elements.push(element);
    }
    
    return elements;
  }

  private extractParties(text: string): { partyA?: string; partyB?: string } {
    // 简化版：查找"甲方"和"乙方"关键词
    const partyAMatch = text.match(/甲方[：:]\s*([^\n（\(]+)/);
    const partyBMatch = text.match(/乙方[：:]\s*([^\n（\(]+)/);
    
    return {
      partyA: partyAMatch ? partyAMatch[1].trim() : undefined,
      partyB: partyBMatch ? partyBMatch[1].trim() : undefined
    };
  }

  private extractAmount(text: string): number | undefined {
    // 查找金额模式（人民币、元、万元等）
    const patterns = [
      /(?:人民币|RMB|金额)[：:￥$]\s*([\d,]+(?:\.\d+)?)\s*(?:元|万元)?/,
      /(?:合同金额|总价)[：:￥$]\s*([\d,]+(?:\.\d+)?)\s*(?:元|万元)?/,
      /(?:￥|¥)\s*([\d,]+(?:\.\d+)?)/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const amountStr = match[1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        
        // 检查单位（万元需要乘以10000）
        if (match[0].includes('万元')) {
          return amount * 10000;
        }
        
        return amount;
      }
    }
    
    return undefined;
  }

  private extractDates(text: string): { start?: Date; end?: Date } {
    // 查找日期模式
    const datePattern = /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})日?/g;
    const dates: Date[] = [];
    
    let match;
    while ((match = datePattern.exec(text)) !== null) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;  // JS月份从0开始
      const day = parseInt(match[3]);
      dates.push(new Date(year, month, day));
    }
    
    // 假设第一个日期是开始日期，最后一个是结束日期
    if (dates.length >= 2) {
      return {
        start: dates[0],
        end: dates[dates.length - 1]
      };
    } else if (dates.length === 1) {
      return {
        start: dates[0]
      };
    }
    
    return {};
  }

  private extractPaymentTerms(text: string): string {
    // 查找付款条款
    const patterns = [
      /付款方式[：:]\s*([^\n。；;]+)/,
      /付款条件[：:]\s*([^\n。；;]+)/,
      /结算方式[：:]\s*([^\n。；;]+)/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return '';
  }

  private detectRiskClauses(text: string): string[] {
    // 检测风险关键词
    const riskKeywords = [
      '违约',
      '赔偿',
      '解除合同',
      '终止',
      '保证金',
      '罚款',
      '滞纳金',
      '逾期',
      '责任',
      '争议',
      '仲裁',
      '诉讼'
    ];
    
    const clauses: string[] = [];
    
    // 分句
    const sentences = text.split(/[。；;]/);
    
    for (const sentence of sentences) {
      for (const keyword of riskKeywords) {
        if (sentence.includes(keyword)) {
          clauses.push(`${keyword}: ${sentence.trim().substring(0, 50)}...`);
          break;  // 每个句子只记录一次
        }
      }
    }
    
    return clauses;
  }

  private getContractSchema() {
    return [
      { name: 'contract_id', type: 'string' as const, required: true, description: 'Contract ID' },
      { name: 'file_path', type: 'string' as const, required: true, description: 'File Path' },
      { name: 'file_type', type: 'string' as const, required: true, description: 'File Type' },
      { name: 'text_length', type: 'number' as const, required: true, description: 'Text Length' },
      { name: 'extracted_at', type: 'string' as const, required: true, description: 'Extracted At' },
      { name: 'extract_method', type: 'string' as const, required: false, description: 'Extract Method' }
    ];
  }

  private getElementsSchema() {
    return [
      { name: 'contract_id', type: 'string' as const, required: true, description: 'Contract ID' },
      { name: 'party_a', type: 'string' as const, required: false, description: 'Party A' },
      { name: 'party_b', type: 'string' as const, required: false, description: 'Party B' },
      { name: 'amount', type: 'number' as const, required: false, description: 'Contract Amount' },
      { name: 'start_date', type: 'string' as const, required: false, description: 'Start Date' },
      { name: 'end_date', type: 'string' as const, required: false, description: 'End Date' },
      { name: 'payment_terms', type: 'string' as const, required: false, description: 'Payment Terms' },
      { name: 'risk_count', type: 'number' as const, required: false, description: 'Risk Count' },
      { name: 'risk_clauses', type: 'string' as const, required: false, description: 'Risk Clauses' }
    ];
  }
}
