/**
 * 节点核心类型定义
 * Week 1 Day 1 - 核心类型定义
 */

// ==========================================
// 基础类型
// ==========================================

export type NodeId = string;
export type EdgeId = string;
export type DataBlockId = string;
export type ExecutionId = string;
export type GraphId = string;

/**
 * 节点分类
 */
export type NodeCategory = 
  | 'input'           // 数据输入节点
  | 'transformation'  // 数据转换节点
  | 'filter'          // 过滤节点
  | 'audit'           // 审计规则节点
  | 'ai'              // AI推理节点
  | 'analysis'        // 分析节点
  | 'output'          // 输出节点
  | 'utility'         // 工具节点
  | 'group';          // 分组节点

/**
 * 节点能力标签
 */
export type Capability = 
  | 'cpu-bound'       // CPU密集型
  | 'io-bound'        // IO密集型
  | 'ai'              // AI调用
  | 'long-running'    // 长时间运行
  | 'stateful'        // 有状态
  | 'streaming';      // 流式处理

/**
 * 国际化字符串
 */
export interface I18nString {
  zh: string;
  en: string;
}

// ==========================================
// NodeManifest - 节点清单
// ==========================================

/**
 * 节点清单（元数据定义）
 * 这是新架构的核心：每个节点都必须提供完整的清单
 */
export interface NodeManifest {
  // 基础信息
  type: string;                    // 节点类型（唯一标识）
  version: string;                 // 版本号（语义化版本）
  category: NodeCategory;          // 节点分类
  label: I18nString;              // 显示名称
  description: I18nString;        // 描述
  icon?: string;                   // 图标名称
  
  // Schema定义（使用JSON Schema v7）
  inputsSchema: Record<string, any>;   // 输入端口Schema
  outputsSchema: Record<string, any>;  // 输出端口Schema
  configSchema?: Record<string, any>;  // 配置Schema
  
  // 性能和资源
  capabilities: Capability[];      // 能力标签
  estimatedCost?: {
    timeMs: number;                // 预计执行时间（毫秒）
    memoryMB: number;              // 预计内存占用（MB）
    aiTokens?: number;             // AI调用预计token数
  };
  
  // 缓存策略
  cachePolicy?: {
    enabled: boolean;              // 是否启用缓存
    ttl: number;                   // 缓存有效期（秒）
    keyFields: string[];           // 用于生成缓存key的字段
  };
  
  // 降级策略
  fallbackStrategy?: {
    enabled: boolean;
    type: 'rule-based' | 'static' | 'skip';
    fallbackFn?: string;           // 降级函数名
    staticValue?: any;             // 静态返回值
  };
  
  // 重试策略
  retryPolicy?: {
    enabled: boolean;
    maxRetries: number;
    backoffMs: number;             // 退避时间
  };
  
  // 测试示例
  examples?: NodeExample[];
  
  // 合规信息
  compliance?: {
    dataPrivacy: boolean;          // 是否涉及隐私数据
    auditTrail: boolean;           // 是否需要审计追踪
    approvalRequired: boolean;     // 是否需要审批
  };
  
  // 元数据
  metadata?: {
    author: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    documentation?: string;        // 文档链接
  };
}

/**
 * 节点示例（用于自动化测试）
 */
export interface NodeExample {
  name: string;                    // 示例名称
  description?: string;            // 示例描述
  inputs: Record<string, any>;     // 输入数据
  config?: Record<string, any>;    // 配置
  expectedOutputs: Record<string, any>; // 期望输出
  tags?: string[];                 // 标签
}

// ==========================================
// NodeDefinition - 节点定义
// ==========================================

/**
 * 执行上下文
 */
export interface ExecutionContext {
  // 执行信息
  executionId: ExecutionId;
  nodeId: NodeId;
  graphId: GraphId;
  userId: string;
  
  // 服务访问
  cache?: CacheService;
  logger?: Logger;
  dataBlockManager?: DataBlockManager;
  aiExecutor?: AIExecutor;
  
  // 进度报告
  reportProgress?: (progress: ProgressUpdate) => void;
  
  // 取消信号
  signal?: AbortSignal;
}

/**
 * 节点执行函数
 */
export type NodeExecuteFn = (
  inputs: Record<string, any>,
  config: Record<string, any>,
  context: ExecutionContext
) => Promise<Record<string, any>>;

/**
 * 节点定义（Manifest + Execute）
 */
export interface NodeDefinition {
  manifest: NodeManifest;
  execute: NodeExecuteFn;
}

// ==========================================
// 服务接口（占位符，稍后实现）
// ==========================================

export interface CacheService {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface DataBlockManager {
  get(id: DataBlockId): Promise<any>;
  create(data: any): Promise<DataBlockId>;
}

export interface AIExecutor {
  execute(promptId: string, variables: any): Promise<any>;
}

export interface ProgressUpdate {
  nodeId: NodeId;
  progress: number;      // 0-100
  message?: string;
  data?: any;
}

// ==========================================
// 端口定义
// ==========================================

/**
 * 端口类型
 */
export type PortType = 
  | 'vouchers'          // 凭证
  | 'ledgers'           // 分类账
  | 'flows'             // 银行流水
  | 'contracts'         // 合同
  | 'invoices'          // 发票
  | 'dataBlock'         // 数据块引用
  | 'number'            // 数字
  | 'string'            // 字符串
  | 'boolean'           // 布尔值
  | 'object'            // 对象
  | 'array'             // 数组
  | 'any';              // 任意类型

/**
 * 端口定义
 */
export interface PortDefinition {
  name: string;
  type: PortType;
  label: I18nString;
  description?: I18nString;
  required?: boolean;
  multiple?: boolean;        // 是否支持多连接
}

// ==========================================
// 执行结果
// ==========================================

/**
 * 执行结果
 */
export interface ExecutionResult {
  nodeId: NodeId;
  success: boolean;
  outputs?: Record<string, any>;
  error?: ExecutionError;
  duration: number;          // 执行时长（毫秒）
  cached: boolean;           // 是否来自缓存
  metadata?: {
    startTime: string;
    endTime: string;
    memoryUsed?: number;
    tokensUsed?: number;
  };
}

/**
 * 执行错误
 */
export interface ExecutionError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}
