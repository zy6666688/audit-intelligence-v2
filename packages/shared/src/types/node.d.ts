/**
 * 节点核心类型定义
 * Week 1 Day 1 - 核心类型定义
 */
export type NodeId = string;
export type EdgeId = string;
export type DataBlockId = string;
export type ExecutionId = string;
export type GraphId = string;
/**
 * 节点分类
 */
export type NodeCategory = 'input' | 'transformation' | 'filter' | 'audit' | 'ai' | 'analysis' | 'output' | 'utility' | 'group';
/**
 * 节点能力标签
 */
export type Capability = 'cpu-bound' | 'io-bound' | 'ai' | 'long-running' | 'stateful' | 'streaming';
/**
 * 国际化字符串
 */
export interface I18nString {
    zh: string;
    en: string;
}
/**
 * 节点清单（元数据定义）
 * 这是新架构的核心：每个节点都必须提供完整的清单
 */
export interface NodeManifest {
    type: string;
    version: string;
    category: NodeCategory;
    label: I18nString;
    description: I18nString;
    icon?: string;
    inputsSchema: Record<string, any>;
    outputsSchema: Record<string, any>;
    configSchema?: Record<string, any>;
    capabilities: Capability[];
    estimatedCost?: {
        timeMs: number;
        memoryMB: number;
        aiTokens?: number;
    };
    cachePolicy?: {
        enabled: boolean;
        ttl: number;
        keyFields: string[];
    };
    fallbackStrategy?: {
        enabled: boolean;
        type: 'rule-based' | 'static' | 'skip';
        fallbackFn?: string;
        staticValue?: any;
    };
    retryPolicy?: {
        enabled: boolean;
        maxRetries: number;
        backoffMs: number;
    };
    examples?: NodeExample[];
    compliance?: {
        dataPrivacy: boolean;
        auditTrail: boolean;
        approvalRequired: boolean;
    };
    metadata?: {
        author: string;
        createdAt: string;
        updatedAt: string;
        tags: string[];
        documentation?: string;
    };
}
/**
 * 节点示例（用于自动化测试）
 */
export interface NodeExample {
    name: string;
    description?: string;
    inputs: Record<string, any>;
    config?: Record<string, any>;
    expectedOutputs: Record<string, any>;
    tags?: string[];
}
/**
 * 执行上下文
 */
export interface ExecutionContext {
    executionId: ExecutionId;
    nodeId: NodeId;
    graphId: GraphId;
    userId: string;
    cache?: CacheService;
    logger?: Logger;
    dataBlockManager?: DataBlockManager;
    aiExecutor?: AIExecutor;
    reportProgress?: (progress: ProgressUpdate) => void;
    signal?: AbortSignal;
}
/**
 * 节点执行函数
 */
export type NodeExecuteFn = (inputs: Record<string, any>, config: Record<string, any>, context: ExecutionContext) => Promise<Record<string, any>>;
/**
 * 节点定义（Manifest + Execute）
 */
export interface NodeDefinition {
    manifest: NodeManifest;
    execute: NodeExecuteFn;
}
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
    progress: number;
    message?: string;
    data?: any;
}
/**
 * 端口类型
 */
export type PortType = 'vouchers' | 'ledgers' | 'flows' | 'contracts' | 'invoices' | 'dataBlock' | 'number' | 'string' | 'boolean' | 'object' | 'array' | 'any';
/**
 * 端口定义
 */
export interface PortDefinition {
    name: string;
    type: PortType;
    label: I18nString;
    description?: I18nString;
    required?: boolean;
    multiple?: boolean;
}
/**
 * 执行结果
 */
export interface ExecutionResult {
    nodeId: NodeId;
    success: boolean;
    outputs?: Record<string, any>;
    error?: ExecutionError;
    duration: number;
    cached: boolean;
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
