/**
 * NodeRegistryV2 - 节点注册表
 * Week 1 Day 2 - 核心实现
 * 
 * 功能:
 * 1. 注册节点定义
 * 2. 验证节点Schema
 * 3. 执行节点
 * 4. 缓存管理
 */

import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type {
  NodeDefinition,
  NodeManifest,
  ExecutionContext,
  ExecutionResult,
  NodeExecuteFn
} from '@audit/shared';

/**
 * 注册错误
 */
export class RegistryError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'RegistryError';
  }
}

/**
 * 执行错误
 */
export class ExecutionError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'ExecutionError';
  }
}

/**
 * NodeRegistryV2 - 核心注册表类
 */
export class NodeRegistryV2 {
  // 存储所有注册的节点定义
  private nodes = new Map<string, NodeDefinition>();
  
  // JSON Schema验证器
  private ajv: Ajv;
  
  // 编译后的Schema验证器缓存
  private inputValidators = new Map<string, ValidateFunction>();
  private outputValidators = new Map<string, ValidateFunction>();
  private configValidators = new Map<string, ValidateFunction>();
  
  constructor() {
    // 初始化AJV
    this.ajv = new Ajv({
      allErrors: true,           // 返回所有错误
      strict: false,             // 允许未知格式
      coerceTypes: true          // 类型强制转换
    });
    
    // 添加常用格式支持（date, email等）
    addFormats(this.ajv);
  }
  
  /**
   * 注册节点定义
   */
  register(definition: NodeDefinition): void {
    const { manifest } = definition;
    
    // 1. 验证Manifest基本字段
    this.validateManifest(manifest);
    
    // 2. 编译Schema
    try {
      // 编译输入Schema
      if (manifest.inputsSchema) {
        const inputValidator = this.ajv.compile(manifest.inputsSchema);
        this.inputValidators.set(manifest.type, inputValidator);
      }
      
      // 编译输出Schema
      if (manifest.outputsSchema) {
        const outputValidator = this.ajv.compile(manifest.outputsSchema);
        this.outputValidators.set(manifest.type, outputValidator);
      }
      
      // 编译配置Schema
      if (manifest.configSchema) {
        const configValidator = this.ajv.compile(manifest.configSchema);
        this.configValidators.set(manifest.type, configValidator);
      }
      
    } catch (error: any) {
      throw new RegistryError(
        `Schema compilation failed for node ${manifest.type}`,
        'SCHEMA_COMPILE_ERROR',
        { error: error.message }
      );
    }
    
    // 3. 验证execute函数存在
    if (typeof definition.execute !== 'function') {
      throw new RegistryError(
        `Execute function is required for node ${manifest.type}`,
        'MISSING_EXECUTE_FUNCTION'
      );
    }
    
    // 4. 存储定义
    this.nodes.set(manifest.type, definition);
    
    console.log(`✅ Node registered: ${manifest.type} v${manifest.version}`);
  }
  
  /**
   * 批量注册节点
   */
  registerAll(definitions: NodeDefinition[]): void {
    for (const definition of definitions) {
      try {
        this.register(definition);
      } catch (error: any) {
        console.error(`Failed to register node ${definition.manifest.type}:`, error.message);
      }
    }
  }
  
  /**
   * 获取节点定义
   */
  get(nodeType: string): NodeDefinition {
    const definition = this.nodes.get(nodeType);
    
    if (!definition) {
      throw new RegistryError(
        `Node type not found: ${nodeType}`,
        'NODE_NOT_FOUND',
        { nodeType, availableNodes: Array.from(this.nodes.keys()) }
      );
    }
    
    return definition;
  }
  
  /**
   * 获取所有已注册的节点类型
   */
  list(): string[] {
    return Array.from(this.nodes.keys());
  }
  
  /**
   * 获取节点清单（不含execute函数）
   */
  getManifest(nodeType: string): NodeManifest {
    const definition = this.get(nodeType);
    return definition.manifest;
  }
  
  /**
   * 获取所有节点清单
   */
  listManifests(): NodeManifest[] {
    return Array.from(this.nodes.values()).map(def => def.manifest);
  }
  
  /**
   * 执行节点
   */
  async execute(
    nodeType: string,
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const definition = this.get(nodeType);
    const { manifest, execute } = definition;
    
    try {
      // 1. 验证输入
      this.validateInputs(nodeType, inputs);
      
      // 2. 验证配置
      if (config && Object.keys(config).length > 0) {
        this.validateConfig(nodeType, config);
      }
      
      // 3. 执行节点
      context.logger?.info(`Executing node: ${nodeType}`);
      const outputs = await execute(inputs, config, context);
      
      // 4. 验证输出
      this.validateOutputs(nodeType, outputs);
      
      // 5. 返回结果
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      context.logger?.info(`Node ${nodeType} completed in ${duration}ms`);
      
      return {
        nodeId: context.nodeId,
        success: true,
        outputs,
        duration,
        cached: false,
        metadata: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString()
        }
      };
      
    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      context.logger?.error(`Node ${nodeType} failed:`, error);
      
      return {
        nodeId: context.nodeId,
        success: false,
        error: {
          code: error.code || 'EXECUTION_ERROR',
          message: error.message,
          details: error.details,
          stack: error.stack
        },
        duration,
        cached: false,
        metadata: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString()
        }
      };
    }
  }
  
  /**
   * 验证节点示例（用于自动化测试）
   */
  async validateExamples(nodeType: string): Promise<{ passed: number; failed: number; errors: any[] }> {
    const definition = this.get(nodeType);
    const { manifest } = definition;
    
    if (!manifest.examples || manifest.examples.length === 0) {
      return { passed: 0, failed: 0, errors: [] };
    }
    
    const results = {
      passed: 0,
      failed: 0,
      errors: [] as any[]
    };
    
    for (const example of manifest.examples) {
      try {
        const context: ExecutionContext = {
          executionId: 'test-' + Date.now(),
          nodeId: 'test-node',
          graphId: 'test-graph',
          userId: 'test-user',
          logger: console
        };
        
        const result = await this.execute(
          nodeType,
          example.inputs,
          example.config || {},
          context
        );
        
        if (result.success) {
          // 简单对比输出（深度对比可以用库如lodash.isEqual）
          const outputMatches = JSON.stringify(result.outputs) === JSON.stringify(example.expectedOutputs);
          
          if (outputMatches) {
            results.passed++;
          } else {
            results.failed++;
            results.errors.push({
              example: example.name,
              error: 'Output mismatch',
              expected: example.expectedOutputs,
              actual: result.outputs
            });
          }
        } else {
          results.failed++;
          results.errors.push({
            example: example.name,
            error: result.error
          });
        }
        
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          example: example.name,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * 验证Manifest基本字段
   */
  private validateManifest(manifest: NodeManifest): void {
    if (!manifest.type) {
      throw new RegistryError('Node type is required', 'MISSING_TYPE');
    }
    
    if (!manifest.version) {
      throw new RegistryError('Node version is required', 'MISSING_VERSION');
    }
    
    if (!manifest.category) {
      throw new RegistryError('Node category is required', 'MISSING_CATEGORY');
    }
    
    if (!manifest.label || !manifest.label.zh || !manifest.label.en) {
      throw new RegistryError('Node label (zh and en) is required', 'MISSING_LABEL');
    }
    
    if (!manifest.inputsSchema) {
      throw new RegistryError('Node inputsSchema is required', 'MISSING_INPUTS_SCHEMA');
    }
    
    if (!manifest.outputsSchema) {
      throw new RegistryError('Node outputsSchema is required', 'MISSING_OUTPUTS_SCHEMA');
    }
  }
  
  /**
   * 验证输入数据
   */
  private validateInputs(nodeType: string, inputs: Record<string, any>): void {
    const validator = this.inputValidators.get(nodeType);
    
    if (!validator) {
      throw new ExecutionError(
        `No input validator found for node ${nodeType}`,
        'VALIDATOR_NOT_FOUND'
      );
    }
    
    const valid = validator(inputs);
    
    if (!valid) {
      throw new ExecutionError(
        `Input validation failed for node ${nodeType}`,
        'INPUT_VALIDATION_FAILED',
        { errors: validator.errors }
      );
    }
  }
  
  /**
   * 验证配置数据
   */
  private validateConfig(nodeType: string, config: Record<string, any>): void {
    const validator = this.configValidators.get(nodeType);
    
    if (!validator) {
      // 配置Schema是可选的
      return;
    }
    
    const valid = validator(config);
    
    if (!valid) {
      throw new ExecutionError(
        `Config validation failed for node ${nodeType}`,
        'CONFIG_VALIDATION_FAILED',
        { errors: validator.errors }
      );
    }
  }
  
  /**
   * 验证输出数据
   */
  private validateOutputs(nodeType: string, outputs: Record<string, any>): void {
    const validator = this.outputValidators.get(nodeType);
    
    if (!validator) {
      throw new ExecutionError(
        `No output validator found for node ${nodeType}`,
        'VALIDATOR_NOT_FOUND'
      );
    }
    
    const valid = validator(outputs);
    
    if (!valid) {
      throw new ExecutionError(
        `Output validation failed for node ${nodeType}`,
        'OUTPUT_VALIDATION_FAILED',
        { errors: validator.errors }
      );
    }
  }
  
  /**
   * 检查节点是否已注册
   */
  has(nodeType: string): boolean {
    return this.nodes.has(nodeType);
  }
  
  /**
   * 注销节点
   */
  unregister(nodeType: string): boolean {
    const existed = this.nodes.delete(nodeType);
    
    if (existed) {
      this.inputValidators.delete(nodeType);
      this.outputValidators.delete(nodeType);
      this.configValidators.delete(nodeType);
      console.log(`❌ Node unregistered: ${nodeType}`);
    }
    
    return existed;
  }
  
  /**
   * 清空所有注册
   */
  clear(): void {
    this.nodes.clear();
    this.inputValidators.clear();
    this.outputValidators.clear();
    this.configValidators.clear();
    console.log('🗑️  Registry cleared');
  }
}

// 导出单例
export const nodeRegistry = new NodeRegistryV2();
