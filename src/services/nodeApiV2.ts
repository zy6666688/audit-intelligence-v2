/**
 * Node API Service V2
 * Week 1 Day 3
 * 
 * 封装与后端NodeRegistry的通信
 */

import type { NodeManifest, ExecutionResult, ExecutionContext } from '@audit/shared';

/**
 * API基础URL
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * API响应接口
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: any;
}

/**
 * Node API Service V2
 */
export class NodeApiServiceV2 {
  private baseUrl: string;
  
  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }
  
  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error('Health check failed');
    }
    return response.json();
  }
  
  /**
   * 获取所有节点清单
   */
  async listNodes(): Promise<NodeManifest[]> {
    const response = await fetch(`${this.baseUrl}/api/nodes`);
    
    if (!response.ok) {
      throw new Error(`Failed to list nodes: ${response.statusText}`);
    }
    
    const result: ApiResponse<NodeManifest[]> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to list nodes');
    }
    
    return result.data;
  }
  
  /**
   * 获取单个节点清单
   */
  async getNodeManifest(nodeType: string): Promise<NodeManifest> {
    const response = await fetch(`${this.baseUrl}/api/nodes/${nodeType}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get node manifest: ${response.statusText}`);
    }
    
    const result: ApiResponse<NodeManifest> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get node manifest');
    }
    
    return result.data;
  }
  
  /**
   * 执行节点
   */
  async executeNode(
    nodeType: string,
    inputs: Record<string, any>,
    config: Record<string, any> = {}
  ): Promise<ExecutionResult> {
    const response = await fetch(
      `${this.baseUrl}/api/nodes/${nodeType}/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs, config })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to execute node: ${response.statusText}`);
    }
    
    const result: ApiResponse = await response.json();
    
    // 构造ExecutionResult
    return {
      nodeId: `node-${Date.now()}`,
      success: result.success,
      outputs: result.data,
      duration: result.metadata?.duration || 0,
      cached: result.metadata?.cached || false,
      error: result.error ? {
        code: 'EXECUTION_ERROR',
        message: result.error
      } : undefined,
      metadata: result.metadata
    };
  }
  
  /**
   * 测试节点示例
   */
  async testNodeExamples(nodeType: string): Promise<{
    passed: number;
    failed: number;
    errors: any[];
  }> {
    const response = await fetch(
      `${this.baseUrl}/api/nodes/${nodeType}/test`,
      {
        method: 'POST'
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to test node examples: ${response.statusText}`);
    }
    
    const result: ApiResponse = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to test node examples');
    }
    
    return result.data;
  }
  
  /**
   * 批量执行节点（用于图执行）
   */
  async executeNodes(
    executions: Array<{
      nodeType: string;
      inputs: Record<string, any>;
      config?: Record<string, any>;
    }>
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    // 目前是串行执行，后续可以改为并行
    for (const exec of executions) {
      try {
        const result = await this.executeNode(
          exec.nodeType,
          exec.inputs,
          exec.config
        );
        results.push(result);
      } catch (error: any) {
        results.push({
          nodeId: `node-${Date.now()}`,
          success: false,
          duration: 0,
          cached: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: error.message
          }
        });
      }
    }
    
    return results;
  }
}

/**
 * 创建Node API Service实例
 */
export function createNodeApiService(baseUrl?: string): NodeApiServiceV2 {
  return new NodeApiServiceV2(baseUrl);
}

/**
 * 默认实例（单例）
 */
export const nodeApiService = new NodeApiServiceV2();

/**
 * 便捷函数：列出所有节点
 */
export async function listNodes(): Promise<NodeManifest[]> {
  return nodeApiService.listNodes();
}

/**
 * 便捷函数：执行节点
 */
export async function executeNode(
  nodeType: string,
  inputs: Record<string, any>,
  config?: Record<string, any>
): Promise<ExecutionResult> {
  return nodeApiService.executeNode(nodeType, inputs, config);
}

/**
 * 便捷函数：测试节点
 */
export async function testNode(nodeType: string) {
  return nodeApiService.testNodeExamples(nodeType);
}
