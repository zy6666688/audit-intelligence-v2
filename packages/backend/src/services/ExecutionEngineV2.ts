/**
 * ExecutionEngineV2 - 图执行引擎
 * 
 * 功能：
 * 1. 使用拓扑排序规划执行顺序
 * 2. 按层级并行执行节点
 * 3. 处理循环依赖
 * 4. 执行状态管理
 * 
 * Week 2 Day 1
 */

import type { NodeId, NodeGraph, ExecutionContext } from '@audit/shared';
import { DependencyGraph } from './DependencyGraph';
import { NodeRegistryV2 } from './NodeRegistryV2';
import { DirtyTracker } from './DirtyTracker';
import { CacheManager } from './CacheManager';

/**
 * 节点执行状态
 */
export enum NodeExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  ERROR = 'error',
  SKIPPED = 'skipped'
}

/**
 * 节点执行状态信息
 */
export interface NodeExecutionState {
  nodeId: NodeId;
  status: NodeExecutionStatus;
  startTime?: number;
  endTime?: number;
  error?: Error;
  output?: any;
}

/**
 * 执行计划
 */
export interface ExecutionPlan {
  executionOrder: NodeId[];
  levels: Map<number, NodeId[]>;
  totalNodes: number;
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  success: boolean;
  executionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  nodeStates: Map<NodeId, NodeExecutionState>;
  error?: Error;
}

/**
 * 执行引擎V2
 */
export class ExecutionEngineV2 {
  private registry: NodeRegistryV2;
  private executionId: string | null = null;
  private isExecuting: boolean = false;
  private nodeStates: Map<NodeId, NodeExecutionState> = new Map();
  private dirtyTracker: DirtyTracker | null = null;
  private cacheManager: CacheManager;
  private enableCache: boolean = true;

  constructor(registry: NodeRegistryV2, options?: { enableCache?: boolean; maxCacheSize?: number }) {
    this.registry = registry;
    this.enableCache = options?.enableCache ?? true;
    this.cacheManager = new CacheManager(options?.maxCacheSize);
  }

  /**
   * 创建执行计划
   */
  createExecutionPlan(graph: NodeGraph): ExecutionPlan {
    // 构建依赖图
    const depGraph = new DependencyGraph();
    depGraph.buildFromGraph(graph);

    // 拓扑排序
    const executionOrder = depGraph.topologicalSort();

    // 按层级分组
    const levels = depGraph.getNodesByLevel();

    return {
      executionOrder,
      levels,
      totalNodes: executionOrder.length
    };
  }

  /**
   * 验证图是否可执行
   */
  validateGraph(graph: NodeGraph): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // 检查循环依赖
      const depGraph = new DependencyGraph();
      depGraph.buildFromGraph(graph);
      
      const cycle = depGraph.detectCycle();
      if (cycle) {
        errors.push(`Circular dependency detected: ${cycle.join(' → ')}`);
      }

      // 检查所有节点类型是否已注册
      for (const [nodeId, node] of graph.nodes) {
        if (!this.registry.has(node.type)) {
          errors.push(`Node ${nodeId} has unregistered type: ${node.type}`);
        }
      }

      // 检查边的连接是否有效
      for (const edge of graph.edges.values()) {
        const fromNode = graph.nodes.get(edge.from.nodeId);
        const toNode = graph.nodes.get(edge.to.nodeId);

        if (!fromNode) {
          errors.push(`Edge ${edge.id} references non-existent source node: ${edge.from.nodeId}`);
        }

        if (!toNode) {
          errors.push(`Edge ${edge.id} references non-existent target node: ${edge.to.nodeId}`);
        }
      }

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 执行图（简单顺序执行）
   */
  async executeGraph(graph: NodeGraph): Promise<ExecutionResult> {
    const executionId = `exec_${Date.now()}`;
    const startTime = Date.now();
    this.executionId = executionId;
    this.isExecuting = true;
    this.nodeStates.clear();

    try {
      // 1. 验证图
      const validation = this.validateGraph(graph);
      if (!validation.valid) {
        throw new Error(`Graph validation failed: ${validation.errors.join(', ')}`);
      }

      // 2. 创建执行计划
      const plan = this.createExecutionPlan(graph);
      console.log(`[ExecutionEngine] Execution plan created: ${plan.totalNodes} nodes`);
      console.log(`[ExecutionEngine] Execution order: ${plan.executionOrder.join(' → ')}`);

      // 3. 初始化节点状态
      for (const nodeId of plan.executionOrder) {
        this.nodeStates.set(nodeId, {
          nodeId,
          status: NodeExecutionStatus.PENDING
        });
      }

      // 4. 按顺序执行节点
      for (const nodeId of plan.executionOrder) {
        await this.executeNode(graph, nodeId);
      }

      const endTime = Date.now();
      this.isExecuting = false;

      return {
        success: true,
        executionId,
        startTime,
        endTime,
        duration: endTime - startTime,
        nodeStates: new Map(this.nodeStates)
      };

    } catch (error) {
      const endTime = Date.now();
      this.isExecuting = false;

      return {
        success: false,
        executionId,
        startTime,
        endTime,
        duration: endTime - startTime,
        nodeStates: new Map(this.nodeStates),
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * 执行单个节点
   */
  private async executeNode(graph: NodeGraph, nodeId: NodeId): Promise<void> {
    const node = graph.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // 更新状态为运行中
    this.updateNodeState(nodeId, {
      nodeId,
      status: NodeExecutionStatus.RUNNING,
      startTime: Date.now()
    });

    try {
      console.log(`[ExecutionEngine] Executing node: ${nodeId} (${node.type})`);

      // 收集输入（从依赖节点获取输出）
      const inputs: Record<string, any> = {};
      const incomingEdges = Array.from(graph.edges.values()).filter(
        edge => edge.to.nodeId === nodeId
      );

      for (const edge of incomingEdges) {
        const sourceState = this.nodeStates.get(edge.from.nodeId);
        if (sourceState && sourceState.output) {
          inputs[edge.to.portName] = sourceState.output[edge.from.portName];
        }
      }

      // 执行节点
      const result = await this.registry.execute(
        node.type,
        inputs,
        node.config,
        {
          executionId: this.executionId || '',
          nodeId,
          graphId: graph.id,
          userId: 'system'
        }
      );
      
      const output = result.outputs;

      // 更新缓存
      if (this.enableCache) {
        this.cacheManager.set(nodeId, output);
      }
      
      // 清除Dirty标记
      if (this.dirtyTracker) {
        this.dirtyTracker.clearDirty(nodeId);
      }

      // 更新状态为成功
      this.updateNodeState(nodeId, {
        nodeId,
        status: NodeExecutionStatus.SUCCESS,
        endTime: Date.now(),
        output
      });

      console.log(`[ExecutionEngine] Node ${nodeId} completed successfully`);

    } catch (error) {
      // 更新状态为错误
      this.updateNodeState(nodeId, {
        nodeId,
        status: NodeExecutionStatus.ERROR,
        endTime: Date.now(),
        error: error instanceof Error ? error : new Error(String(error))
      });

      console.error(`[ExecutionEngine] Node ${nodeId} failed:`, error);
      throw error;
    }
  }

  /**
   * 更新节点状态
   */
  private updateNodeState(nodeId: NodeId, state: NodeExecutionState): void {
    const existing = this.nodeStates.get(nodeId);
    this.nodeStates.set(nodeId, {
      ...existing,
      ...state
    });
  }

  /**
   * 获取节点状态
   */
  getNodeState(nodeId: NodeId): NodeExecutionState | undefined {
    return this.nodeStates.get(nodeId);
  }

  /**
   * 获取所有节点状态
   */
  getAllNodeStates(): Map<NodeId, NodeExecutionState> {
    return new Map(this.nodeStates);
  }

  /**
   * 是否正在执行
   */
  getIsExecuting(): boolean {
    return this.isExecuting;
  }

  /**
   * 获取执行ID
   */
  getExecutionId(): string | null {
    return this.executionId;
  }

  /**
   * 标记节点为Dirty
   */
  markDirty(nodeId: NodeId): void {
    if (!this.dirtyTracker) {
      console.warn('[ExecutionEngine] DirtyTracker not initialized');
      return;
    }
    this.dirtyTracker.markDirty(nodeId);
    this.dirtyTracker.propagateDirty(nodeId);
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cacheManager.getStats();
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cacheManager.clear();
  }
}
