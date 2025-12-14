import { getNodeDefinition, type NodeDefinition } from './nodeRegistry';
import type { NodeInstance, EdgeBinding } from '@audit/shared';
import { engineApi, type TaskStatusResponse } from '@/api/engineApi';

/**
 * 工作流执行引擎 (V2.6 - Async Polling)
 * 支持本地执行（兼容旧模式）和远程异步执行（新架构）
 */

export interface ExecutionResult {
  success: boolean;
  outputs: Record<string, any>; // 节点ID -> 输出数据
  errors: Record<string, string>; // 节点ID -> 错误信息
  order: string[]; // 执行顺序
}

export interface FlowHooks {
  onNodeStart?: (nodeId: string) => void;
  onNodeEnd?: (nodeId: string, result: any) => void;
  onNodeError?: (nodeId: string, error: any) => void;
  onNodeProgress?: (nodeId: string, progress: number) => void; // 新增进度回调
}

export type EngineMode = 'local' | 'remote';

export interface FlowEngineConfig {
  mode: EngineMode;
  apiEndpoint?: string;
  pollInterval?: number; // 轮询间隔 ms
  timeout?: number;      // 超时时间 ms
}

export class FlowEngine {
  private nodes: NodeInstance[];
  private connections: EdgeBinding[];
  private nodeResults: Record<string, any> = {};
  private hooks: FlowHooks = {};
  private cacheStore: Map<string, any> = new Map();
  private config: FlowEngineConfig;

  constructor(
    nodes: NodeInstance[], 
    connections: EdgeBinding[], 
    config: FlowEngineConfig = { mode: 'local' }
  ) {
    this.nodes = nodes;
    this.connections = connections;
    this.config = {
      pollInterval: 1000,
      timeout: 60000, // 默认60秒超时
      ...config
    };
  }

  /**
   * 执行工作流 (支持并行)
   */
  public async execute(hooks?: FlowHooks): Promise<ExecutionResult> {
    this.hooks = hooks || {};
    const errors: Record<string, string> = {};
    this.nodeResults = {};
    const executionLog: string[] = [];

    console.log(`开始执行工作流 (模式: ${this.config.mode})...`);

    const { graph, inDegree } = this.buildGraph();
    const queue: string[] = [];

    this.nodes.forEach(node => {
      if ((inDegree.get(node.id) || 0) === 0) {
        queue.push(node.id);
      }
    });

    while (queue.length > 0) {
      const currentLayer = [...queue];
      queue.length = 0;

      console.log(`正在执行层级: ${currentLayer.join(', ')}`);
      
      await Promise.all(currentLayer.map(async (nodeId) => {
        try {
          executionLog.push(nodeId);
          
          if (this.config.mode === 'remote') {
            await this.executeNodeRemote(nodeId);
          } else {
            await this.executeNodeLocal(nodeId);
          }
          
          const downstream = graph.get(nodeId) || [];
          for (const targetId of downstream) {
            const currentDegree = inDegree.get(targetId) || 0;
            inDegree.set(targetId, currentDegree - 1);
            
            if (inDegree.get(targetId) === 0) {
              queue.push(targetId);
            }
          }
        } catch (error: any) {
          errors[nodeId] = error.message || 'Unknown error';
        }
      }));
    }

    const executedCount = Object.keys(this.nodeResults).length + Object.keys(errors).length;
    if (executedCount < this.nodes.length) {
      console.warn(`部分节点未执行. 已执行: ${executedCount}/${this.nodes.length}`);
    }

    const success = Object.keys(errors).length === 0;
    return { success, outputs: this.nodeResults, errors, order: executionLog };
  }

  /**
   * 本地执行单个节点
   */
  private async executeNodeLocal(nodeId: string): Promise<void> {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;

    this.hooks.onNodeStart?.(nodeId);
    const nodeData = node.config || {};
    console.log(`[Local] 执行节点: ${node.type} (${node.id})`);

    try {
      const inputs = this.gatherInputs(nodeId);
      const def = getNodeDefinition(node.type);
      
      if (def?.cache) {
        const cacheKey = `${node.type}:${JSON.stringify(inputs)}`;
        if (this.cacheStore.has(cacheKey)) {
           this.nodeResults[nodeId] = this.cacheStore.get(cacheKey);
           this.hooks.onNodeEnd?.(nodeId, this.nodeResults[nodeId]);
           return;
        }
      }

      const maxRetries = def?.retry || 0;
      let outputs: Record<string, any> = {};

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (def && def.execute) {
            outputs = await def.execute(inputs, nodeData);
          } else {
            outputs = await this.defaultExecute(node, inputs);
          }
          break;
        } catch (err) {
          if (attempt === maxRetries) throw err;
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }

      this.nodeResults[nodeId] = outputs;
      
      if (def?.cache) {
         const cacheKey = `${node.type}:${JSON.stringify(inputs)}`;
         this.cacheStore.set(cacheKey, outputs);
      }

      this.hooks.onNodeEnd?.(nodeId, outputs);

    } catch (error) {
      console.error(`节点 ${nodeId} 执行失败:`, error);
      this.hooks.onNodeError?.(nodeId, error);
      throw error;
    }
  }

  /**
   * 远程执行单个节点 (Async Polling)
   */
  private async executeNodeRemote(nodeId: string): Promise<void> {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;

    this.hooks.onNodeStart?.(nodeId);
    console.log(`[Remote] 提交节点任务: ${node.type} (${node.id})`);

    try {
      const inputs = this.gatherInputs(nodeId);
      
      // 1. 提交任务
      const submitRes = await engineApi.submitTask(node.id, node.type, node.config, inputs);
      const taskId = submitRes.taskId;
      console.log(`[Remote] 任务已提交, TaskID: ${taskId}`);

      // 2. 轮询状态
      const result = await this.pollTask(taskId, nodeId);

      // 3. 存储结果
      this.nodeResults[nodeId] = result;
      this.hooks.onNodeEnd?.(nodeId, result);

    } catch (error) {
      console.error(`[Remote] 节点执行失败:`, error);
      this.hooks.onNodeError?.(nodeId, error);
      throw error;
    }
  }

  /**
   * 轮询任务状态
   */
  private async pollTask(taskId: string, nodeId: string): Promise<any> {
    const startTime = Date.now();
    const { pollInterval = 1000, timeout = 60000 } = this.config;

    while (Date.now() - startTime < timeout) {
      try {
        const statusRes = await engineApi.getTaskStatus(taskId);
        
        if (statusRes.status === 'completed') {
          return statusRes.result;
        }
        
        if (statusRes.status === 'failed') {
          throw new Error(statusRes.error || 'Remote execution failed');
        }

        // 更新进度
        if (statusRes.progress !== undefined) {
          this.hooks.onNodeProgress?.(nodeId, statusRes.progress);
        }

        // 等待下一次轮询
        await new Promise(resolve => setTimeout(resolve, pollInterval));

      } catch (err: any) {
        // 如果是网络错误，可能需要重试；如果是业务错误(failed status)，直接抛出
        if (err.message === 'Remote execution failed') throw err;
        console.warn(`[Remote] 轮询出错 (Task: ${taskId}):`, err);
        // 继续轮询，除非超时
      }
    }

    throw new Error(`Task ${taskId} timed out after ${timeout}ms`);
  }

  private buildGraph() {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    this.nodes.forEach(n => {
      graph.set(n.id, []);
      inDegree.set(n.id, 0);
    });

    this.connections.forEach(conn => {
      const from = conn.from.nodeId;
      const to = conn.to.nodeId;
      if (graph.has(from) && graph.has(to)) {
        graph.get(from)?.push(to);
        inDegree.set(to, (inDegree.get(to) || 0) + 1);
      }
    });

    return { graph, inDegree };
  }

  private gatherInputs(nodeId: string): Record<string, any> {
    const inputs: Record<string, any> = {};
    const incomingConns = this.connections.filter(c => c.to.nodeId === nodeId);
    
    for (const conn of incomingConns) {
      const sourceNodeId = conn.from.nodeId;
      const sourcePort = conn.from.portName; 
      const targetPort = conn.to.portName;
      
      const sourceResult = this.nodeResults[sourceNodeId];
      if (sourceResult && sourceResult[sourcePort] !== undefined) {
        inputs[targetPort] = sourceResult[sourcePort];
      } else if (sourceResult && this.config.mode === 'remote') {
         inputs[targetPort] = sourceResult;
      }
    }
    
    return inputs;
  }

  private async defaultExecute(node: NodeInstance, inputs: Record<string, any>): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { ...inputs, _default: true };
  }
}
