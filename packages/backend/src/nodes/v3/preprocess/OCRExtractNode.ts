/**
 * OCR Extract Node - OCR文本提取节点
 * 
 * 功能：
 * - 统一OCR服务接口
 * - 多云服务支持（阿里云、百度、腾讯云）
 * - 批量图片处理
 * - 结果缓存
 * - 置信度过滤
 * 
 * 复杂度：M（中）
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, AuditDataType } from '../../../types/AuditDataTypes';

interface OCRConfig {
  provider?: 'aliyun' | 'baidu' | 'tencent' | 'azure' | 'google';
  language?: 'zh' | 'en' | 'auto';
  minConfidence?: number;      // 最小置信度（0-1）
  enableCache?: boolean;       // 启用缓存
  batchSize?: number;          // 批处理大小
  timeout?: number;            // 超时时间（毫秒）
}

interface OCRResult {
  text: string;
  confidence: number;
  lines: Array<{
    text: string;
    confidence: number;
    boundingBox?: number[];
  }>;
  words: Array<{
    text: string;
    confidence: number;
  }>;
}

export class OCRExtractNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'preprocess.ocr_extract',
      version: '1.0.0',
      category: 'preprocess',
      
      label: {
        zh: 'OCR文本提取',
        en: 'OCR Text Extract'
      },
      
      description: {
        zh: '从图片中提取文本。支持多个OCR服务提供商（阿里云、百度、腾讯云等），批量处理，结果缓存，置信度过滤。',
        en: 'Extract text from images. Support multiple OCR providers (Aliyun, Baidu, Tencent, etc.), batch processing, result caching, confidence filtering.'
      },
      
      icon: '🔍',
      color: '#3498DB',
      
      inputs: [
        {
          id: 'images',
          name: 'images',
          type: 'Records',
          required: true,
          description: {
            zh: '包含图片路径的记录',
            en: 'Records with image paths'
          }
        }
      ],
      
      outputs: [
        {
          id: 'texts',
          name: 'texts',
          type: 'Records',
          required: true,
          description: {
            zh: '提取的文本记录',
            en: 'Extracted text records'
          }
        },
        {
          id: 'metadata',
          name: 'metadata',
          type: 'Records',
          required: true,
          description: {
            zh: 'OCR元数据（置信度、行数等）',
            en: 'OCR metadata (confidence, line count, etc.)'
          }
        }
      ],
      
      config: [
        {
          id: 'provider',
          name: { zh: 'OCR服务商', en: 'OCR Provider' },
          type: 'select',
          required: false,
          defaultValue: 'aliyun',
          options: [
            { label: '阿里云 OCR', value: 'aliyun' },
            { label: '百度 OCR', value: 'baidu' },
            { label: '腾讯云 OCR', value: 'tencent' },
            { label: 'Azure Computer Vision', value: 'azure' },
            { label: 'Google Cloud Vision', value: 'google' }
          ]
        },
        {
          id: 'language',
          name: { zh: '语言', en: 'Language' },
          type: 'select',
          required: false,
          defaultValue: 'auto',
          options: [
            { label: '自动检测', value: 'auto' },
            { label: '中文', value: 'zh' },
            { label: 'English', value: 'en' }
          ]
        },
        {
          id: 'minConfidence',
          name: { zh: '最小置信度', en: 'Min Confidence' },
          type: 'number',
          required: false,
          defaultValue: 0.5,
          description: {
            zh: '过滤置信度低于此值的结果（0-1）',
            en: 'Filter results with confidence below this value (0-1)'
          }
        },
        {
          id: 'enableCache',
          name: { zh: '启用缓存', en: 'Enable Cache' },
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: {
            zh: '缓存OCR结果以避免重复调用',
            en: 'Cache OCR results to avoid duplicate calls'
          }
        },
        {
          id: 'batchSize',
          name: { zh: '批处理大小', en: 'Batch Size' },
          type: 'number',
          required: false,
          defaultValue: 10,
          description: {
            zh: '每批处理的图片数量',
            en: 'Number of images to process per batch'
          }
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['preprocess', 'ocr', 'image', 'text-extraction', 'ai'],
        documentation: 'https://docs.audit-system.com/nodes/preprocess/ocr-extract',
        examples: [
          {
            title: '提取发票文本',
            description: '使用阿里云OCR提取发票图片文本',
            inputs: {
              images: {
                type: 'Records',
                data: [
                  { id: '001', image_path: '/path/to/invoice1.jpg' },
                  { id: '002', image_path: '/path/to/invoice2.jpg' }
                ]
              }
            },
            config: {
              provider: 'aliyun',
              language: 'zh',
              minConfidence: 0.8
            }
          }
        ]
      },
      
      capabilities: {
        cacheable: true,
        parallel: true,
        streaming: true,
        aiPowered: true
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
      const images = inputs.images as Records;
      const cfg: OCRConfig = {
        provider: config.provider || 'aliyun',
        language: config.language || 'auto',
        minConfidence: config.minConfidence ?? 0.5,
        enableCache: config.enableCache !== false,
        batchSize: config.batchSize || 10,
        timeout: config.timeout || 30000
      };
      
      context.logger?.info?.(`🔍 Processing ${images.rowCount} images with ${cfg.provider} OCR`);
      
      // 提取图片路径
      const imagePaths = this.extractImagePaths(images.data);
      
      // 批量处理
      const results: Array<OCRResult> = [];
      const batches = this.createBatches(imagePaths, cfg.batchSize || 10);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        context.logger?.info?.(`  Processing batch ${i + 1}/${batches.length} (${batch.length} images)`);
        
        const batchResults = await this.processBatch(batch, cfg, context);
        results.push(...batchResults);
      }
      
      // 过滤低置信度结果
      const filteredResults = results.filter(r => r.confidence >= (cfg.minConfidence || 0));
      
      context.logger?.info?.(`  Filtered: ${filteredResults.length}/${results.length} results (min confidence: ${cfg.minConfidence})`);
      
      // 构造输出
      const texts: Records = {
        type: 'Records',
        schema: [
          { name: 'id', type: 'string', required: true, description: 'Image ID' },
          { name: 'text', type: 'string', required: true, description: 'Extracted Text' },
          { name: 'confidence', type: 'number', required: true, description: 'Confidence Score' },
          { name: 'line_count', type: 'number', required: false, description: 'Line Count' },
          { name: 'word_count', type: 'number', required: false, description: 'Word Count' }
        ],
        data: filteredResults.map((result, index) => ({
          id: images.data[index]?.id || `img_${index}`,
          text: result.text,
          confidence: result.confidence,
          line_count: result.lines.length,
          word_count: result.words.length
        })),
        metadata: this.createMetadata(context.nodeId, context.executionId, cfg.provider || 'unknown'),
        rowCount: filteredResults.length,
        columnCount: 5
      };
      
      const metadata: Records = {
        type: 'Records',
        schema: [
          { name: 'metric', type: 'string', required: true, description: 'Metric' },
          { name: 'value', type: 'number', required: true, description: 'Value' }
        ],
        data: [
          { metric: 'total_images', value: images.rowCount },
          { metric: 'successful', value: filteredResults.length },
          { metric: 'failed', value: images.rowCount - filteredResults.length },
          { metric: 'avg_confidence', value: this.calculateAvgConfidence(filteredResults) },
          { metric: 'total_lines', value: filteredResults.reduce((sum, r) => sum + r.lines.length, 0) }
        ],
        metadata: this.createMetadata(context.nodeId, context.executionId, 'metadata'),
        rowCount: 5,
        columnCount: 2
      };
      
      const duration = Date.now() - startTime;
      
      context.logger?.info?.(`✅ OCR completed: ${filteredResults.length}/${images.rowCount} images (${duration}ms)`);
      
      return this.wrapSuccess(
        { texts, metadata },
        duration,
        context
      );
      
    } catch (error: any) {
      context.logger?.error?.('❌ OCR extraction failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private extractImagePaths(data: Array<Record<string, any>>): string[] {
    return data.map(row => {
      // 尝试多种可能的字段名
      return row.image_path || row.imagePath || row.path || row.file || row.url || '';
    }).filter(path => path !== '');
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processBatch(
    imagePaths: string[],
    config: OCRConfig,
    context: NodeExecutionContext
  ): Promise<OCRResult[]> {
    const results: OCRResult[] = [];
    
    for (const imagePath of imagePaths) {
      try {
        // 检查缓存
        if (config.enableCache && context.cache) {
          const cacheKey = `ocr:${config.provider}:${imagePath}`;
          const cached = await context.cache.get(cacheKey);
          if (cached) {
            results.push(cached as OCRResult);
            continue;
          }
        }
        
        // 调用OCR服务
        const result = await this.callOCRService(imagePath, config, context);
        results.push(result);
        
        // 保存缓存
        if (config.enableCache && context.cache) {
          const cacheKey = `ocr:${config.provider}:${imagePath}`;
          await context.cache.set(cacheKey, result);
        }
        
      } catch (error: any) {
        context.logger?.warn?.(`⚠️  OCR failed for ${imagePath}: ${error.message}`);
        // 返回空结果
        results.push({
          text: '',
          confidence: 0,
          lines: [],
          words: []
        });
      }
    }
    
    return results;
  }

  private async callOCRService(
    imagePath: string,
    config: OCRConfig,
    context: NodeExecutionContext
  ): Promise<OCRResult> {
    // 如果有AI服务，使用AI服务
    if (context.ai?.ocr) {
      const text = await context.ai.ocr(imagePath);
      
      // 解析OCR响应
      return this.parseOCRResponse(text, config.provider || 'aliyun');
    }
    
    // 否则返回模拟结果（开发环境）
    return this.mockOCRResult(imagePath);
  }

  private parseOCRResponse(response: any, provider: string): OCRResult {
    // 根据不同服务商解析响应格式
    switch (provider) {
      case 'aliyun':
        return this.parseAliyunResponse(response);
      case 'baidu':
        return this.parseBaiduResponse(response);
      case 'tencent':
        return this.parseTencentResponse(response);
      default:
        return this.parseGenericResponse(response);
    }
  }

  private parseAliyunResponse(response: any): OCRResult {
    // 阿里云OCR响应格式
    const lines = response.prism_wordsInfo || [];
    const allText = lines.map((line: any) => line.word).join('\n');
    
    return {
      text: allText,
      confidence: lines.reduce((sum: number, line: any) => sum + (line.prob || 0), 0) / lines.length || 0,
      lines: lines.map((line: any) => ({
        text: line.word,
        confidence: line.prob || 0,
        boundingBox: line.pos
      })),
      words: allText.split(/\s+/).map((word: string) => ({
        text: word,
        confidence: 0.9  // 阿里云不提供单词级别置信度
      }))
    };
  }

  private parseBaiduResponse(response: any): OCRResult {
    // 百度OCR响应格式
    const words = response.words_result || [];
    const allText = words.map((w: any) => w.words).join('\n');
    
    return {
      text: allText,
      confidence: words.reduce((sum: number, w: any) => sum + (w.probability?.average || 0), 0) / words.length || 0,
      lines: words.map((w: any) => ({
        text: w.words,
        confidence: w.probability?.average || 0,
        boundingBox: [w.location.left, w.location.top, w.location.width, w.location.height]
      })),
      words: allText.split(/\s+/).map((word: string) => ({
        text: word,
        confidence: 0.9
      }))
    };
  }

  private parseTencentResponse(response: any): OCRResult {
    // 腾讯云OCR响应格式
    const textDetections = response.TextDetections || [];
    const allText = textDetections.map((t: any) => t.DetectedText).join('\n');
    
    return {
      text: allText,
      confidence: textDetections.reduce((sum: number, t: any) => sum + (t.Confidence || 0), 0) / textDetections.length / 100 || 0,
      lines: textDetections.map((t: any) => ({
        text: t.DetectedText,
        confidence: (t.Confidence || 0) / 100,
        boundingBox: t.Polygon
      })),
      words: allText.split(/\s+/).map((word: string) => ({
        text: word,
        confidence: 0.9
      }))
    };
  }

  private parseGenericResponse(response: any): OCRResult {
    // 通用响应格式（假设返回纯文本）
    const text = typeof response === 'string' ? response : JSON.stringify(response);
    
    return {
      text,
      confidence: 0.8,
      lines: text.split('\n').map(line => ({
        text: line,
        confidence: 0.8
      })),
      words: text.split(/\s+/).map(word => ({
        text: word,
        confidence: 0.8
      }))
    };
  }

  private mockOCRResult(imagePath: string): OCRResult {
    // 开发环境模拟结果
    const mockText = `Mock OCR result for ${imagePath}\nLine 1: Sample text\nLine 2: Another line`;
    
    return {
      text: mockText,
      confidence: 0.95,
      lines: mockText.split('\n').map(line => ({
        text: line,
        confidence: 0.95
      })),
      words: mockText.split(/\s+/).map(word => ({
        text: word,
        confidence: 0.95
      }))
    };
  }

  private calculateAvgConfidence(results: OCRResult[]): number {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, r) => acc + r.confidence, 0);
    return sum / results.length;
  }
}
