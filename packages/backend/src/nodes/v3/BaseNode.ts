/**
 * Node V3 - 完全重构的节点基类
 * 对标 ComfyUI 的节点系统设计
 * 
 * 核心改进:
 * 1. 强类型支持 - 使用审计类型系统
 * 2. 纯函数节点 - 无副作用，可缓存
 * 3. 元数据丰富 - 支持版本、作者、标签
 * 4. 可组合性 - 支持复合节点
 */

import type { 
  AuditDataType,
  AuditDataTypeName,
  DataMetadata 
} from '../../types/AuditDataTypes';
import type { ExecutionContext } from '@audit/shared';

// ============================================
// 节点端口定义
// ============================================

export interface PortDefinition {
  id: string;
  name: string;
  type: AuditDataTypeName | AuditDataTypeName[];  // 支持联合类型
  required: boolean;
  description: {
    zh: string;
    en: string;
  };
  defaultValue?: any;
  constraints?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
  };
}

// ============================================
// 节点配置定义
// ============================================

export interface ConfigField {
  id: string;
  name: {
    zh: string;
    en: string;
  };
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'text' | 'json';
  required: boolean;
  defaultValue?: any;
  description?: {
    zh: string;
    en: string;
  };
  options?: Array<{
    label: string;
    value: any;
  }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean;
  };
}

// ============================================
// 节点清单（Manifest）
// ============================================

export interface NodeManifest {
  // 基础信息
  type: string;                // 节点类型，如 "input.csv_reader"
  version: string;             // 版本号
  category: string;            // 分类
  
  // 显示信息（多语言）
  label: {
    zh: string;
    en: string;
  };
  description: {
    zh: string;
    en: string;
  };
  icon?: string;               // 图标（emoji或URL）
  color?: string;              // 节点颜色
  
  // 端口定义
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  
  // 配置定义
  config: ConfigField[];
  
  // 元数据
  metadata: {
    author?: string;
    tags?: string[];
    documentation?: string;
    examples?: NodeExample[];
    deprecated?: boolean;
    experimental?: boolean;
  };
  
  // 能力标记
  capabilities: {
    cacheable: boolean;        // 是否可缓存
    parallel: boolean;         // 是否支持并行
    streaming: boolean;        // 是否支持流式处理
    aiPowered: boolean;        // 是否使用AI
  };
}

export interface NodeExample {
  title: string;
  description: string;
  inputs: Record<string, any>;
  config: Record<string, any>;
  expectedOutput?: Record<string, any>;
}

// ============================================
// 节点执行结果
// ============================================

export interface NodeExecutionResult {
  success: boolean;
  outputs: Record<string, AuditDataType>;
  metadata: {
    duration: number;
    cached: boolean;
    traceId: string;
    timestamp: Date;
    nodeVersion: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  warnings?: Array<{
    code: string;
    message: string;
  }>;
}

// ============================================
// 节点上下文（增强版）
// ============================================

export interface NodeExecutionContext extends ExecutionContext {
  // 新增字段（原有字段从ExecutionContext继承）
  cache?: CacheProvider;
  ai?: AIProvider;
  storage?: StorageProvider;
  metadata?: Record<string, any>;
  
  // 证据追踪
  traceEvidence?: (evidence: any) => void;
}

// ============================================
// 服务提供者接口
// ============================================

export interface CacheProvider {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export interface AIProvider {
  chat(messages: any[], options?: any): Promise<string>;
  embedding(text: string): Promise<number[]>;
  ocr(image: Buffer | string): Promise<string>;
  analyze(data: any, prompt: string): Promise<any>;
}

export interface StorageProvider {
  save(path: string, data: Buffer): Promise<string>;
  load(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

// ============================================
// 节点基类
// ============================================

export abstract class BaseNodeV3 {
  /**
   * 节点清单 - 必须由子类实现
   */
  abstract getManifest(): NodeManifest;

  /**
   * 执行节点 - 必须由子类实现
   * 
   * 要求:
   * 1. 纯函数 - 相同输入产生相同输出
   * 2. 无副作用 - 不修改输入，不访问全局状态
   * 3. 类型安全 - 输入输出符合类型定义
   */
  abstract execute(
    inputs: Record<string, AuditDataType>,
    config: Record<string, any>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult>;

  /**
   * 验证输入 - 可选覆盖
   */
  validateInputs(
    inputs: Record<string, AuditDataType>,
    manifest: NodeManifest
  ): ValidationResult {
    const errors: string[] = [];
    
    // 检查必需输入
    for (const inputDef of manifest.inputs) {
      if (inputDef.required && !inputs[inputDef.id]) {
        errors.push(`Missing required input: ${inputDef.name}`);
      }
      
      // 检查类型
      if (inputs[inputDef.id]) {
        const inputData = inputs[inputDef.id];
        const expectedTypes = Array.isArray(inputDef.type) 
          ? inputDef.type 
          : [inputDef.type];
        
        if (!expectedTypes.includes(inputData.type)) {
          errors.push(
            `Invalid type for ${inputDef.name}: expected ${expectedTypes.join('|')}, got ${inputData.type}`
          );
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证配置 - 可选覆盖
   */
  validateConfig(
    config: Record<string, any>,
    manifest: NodeManifest
  ): ValidationResult {
    const errors: string[] = [];
    
    for (const configField of manifest.config) {
      const value = config[configField.id];
      
      // 检查必需字段
      if (configField.required && (value === undefined || value === null)) {
        errors.push(`Missing required config: ${configField.name.en}`);
        continue;
      }
      
      // 检查验证规则
      if (value !== undefined && configField.validation) {
        const validation = configField.validation;
        
        if (validation.min !== undefined && value < validation.min) {
          errors.push(`${configField.name.en} must be >= ${validation.min}`);
        }
        
        if (validation.max !== undefined && value > validation.max) {
          errors.push(`${configField.name.en} must be <= ${validation.max}`);
        }
        
        if (validation.pattern && !validation.pattern.test(value)) {
          errors.push(`${configField.name.en} does not match required pattern`);
        }
        
        if (validation.custom && !validation.custom(value)) {
          errors.push(`${configField.name.en} failed custom validation`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 生成元数据
   */
  protected createMetadata(
    nodeId: string,
    executionId: string,
    source: string
  ): DataMetadata {
    return {
      source,
      timestamp: new Date(),
      version: this.getManifest().version,
      traceId: executionId,
      nodeId,
      executionId
    };
  }

  /**
   * 包装执行结果
   */
  protected wrapSuccess(
    outputs: Record<string, AuditDataType>,
    duration: number,
    context: NodeExecutionContext,
    cached: boolean = false
  ): NodeExecutionResult {
    // 记录性能指标
    const inputSize = Object.keys(outputs).length;
    const outputSize = Object.values(outputs).reduce((sum, output) => {
      if ('rowCount' in output) {
        return sum + (output as any).rowCount;
      }
      return sum + 1;
    }, 0);

    // 动态导入避免循环依赖
    try {
      const { PerformanceMonitor } = require('./utils/PerformanceMonitor');
      PerformanceMonitor.recordExecution(
        this.getManifest().type,
        duration,
        inputSize,
        outputSize,
        cached
      );
    } catch (e) {
      // 忽略性能监控错误
    }

    return {
      success: true,
      outputs,
      metadata: {
        duration,
        cached,
        traceId: context.executionId,
        timestamp: new Date(),
        nodeVersion: this.getManifest().version
      }
    };
  }

  /**
   * 包装错误结果
   */
  protected wrapError(
    code: string,
    message: string,
    details?: any
  ): NodeExecutionResult {
    return {
      success: false,
      outputs: {},
      metadata: {
        duration: 0,
        cached: false,
        traceId: '',
        timestamp: new Date(),
        nodeVersion: this.getManifest().version
      },
      error: {
        code,
        message,
        details
      }
    };
  }

  /**
   * 获取缓存键
   */
  protected getCacheKey(
    inputs: Record<string, AuditDataType>,
    config: Record<string, any>
  ): string {
    const manifest = this.getManifest();
    return `node:${manifest.type}:${JSON.stringify({ inputs, config })}`;
  }

  /**
   * 尝试从缓存获取结果
   */
  protected async tryGetFromCache(
    context: NodeExecutionContext,
    cacheKey: string
  ): Promise<NodeExecutionResult | null> {
    if (!context.cache) return null;
    
    const manifest = this.getManifest();
    if (!manifest.capabilities.cacheable) return null;
    
    const cached = await context.cache.get(cacheKey);
    if (cached) {
      context.logger?.info?.(`📦 Cache hit for ${manifest.type}`);
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cached: true
        }
      };
    }
    
    return null;
  }

  /**
   * 保存结果到缓存
   */
  protected async saveToCache(
    context: NodeExecutionContext,
    cacheKey: string,
    result: NodeExecutionResult,
    ttl?: number
  ): Promise<void> {
    if (!context.cache) return;
    
    const manifest = this.getManifest();
    if (!manifest.capabilities.cacheable) return;
    
    await context.cache.set(cacheKey, result, ttl);
    context.logger?.info?.(`💾 Cached result for ${manifest.type}`);
  }
}

// ============================================
// 辅助类型
// ============================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
