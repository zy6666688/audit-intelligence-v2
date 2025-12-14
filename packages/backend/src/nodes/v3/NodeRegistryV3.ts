/**
 * Node Registry V3 - 节点注册中心
 * 支持类型检查、依赖分析、智能推荐
 */

import type { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from './BaseNode';
import type { AuditDataType, AuditDataTypeName } from '../../types/AuditDataTypes';
import { AuditNodeCompiler } from '../../compiler/AuditNodeCompiler';
import type { NodeGraph } from '../../compiler/AuditNodeCompiler';

export class NodeRegistryV3 {
  private nodes: Map<string, BaseNodeV3>;
  private manifests: Map<string, NodeManifest>;
  private compiler: AuditNodeCompiler;
  private categories: Map<string, string[]>;
  private typeIndex: Map<AuditDataTypeName, string[]>;  // 输出类型 → 节点类型

  constructor() {
    this.nodes = new Map();
    this.manifests = new Map();
    this.compiler = new AuditNodeCompiler();
    this.categories = new Map();
    this.typeIndex = new Map();
  }

  /**
   * 注册单个节点
   */
  register(node: BaseNodeV3): void {
    const manifest = node.getManifest();
    
    // 验证清单
    this.validateManifest(manifest);
    
    // 存储节点
    this.nodes.set(manifest.type, node);
    this.manifests.set(manifest.type, manifest);
    
    // 更新分类索引
    const categoryNodes = this.categories.get(manifest.category) || [];
    categoryNodes.push(manifest.type);
    this.categories.set(manifest.category, categoryNodes);
    
    // 更新类型索引
    for (const output of manifest.outputs) {
      const types = Array.isArray(output.type) ? output.type : [output.type];
      for (const type of types) {
        const nodes = this.typeIndex.get(type) || [];
        if (!nodes.includes(manifest.type)) {
          nodes.push(manifest.type);
          this.typeIndex.set(type, nodes);
        }
      }
    }
    
    console.log(`✅ Registered node: ${manifest.type} v${manifest.version}`);
  }

  /**
   * 批量注册节点
   */
  registerAll(nodes: BaseNodeV3[]): void {
    for (const node of nodes) {
      try {
        this.register(node);
      } catch (error: any) {
        console.error(`❌ Failed to register node:`, error.message);
      }
    }
  }

  /**
   * 执行节点
   */
  async execute(
    nodeType: string,
    inputs: Record<string, AuditDataType>,
    config: Record<string, any>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const node = this.nodes.get(nodeType);
    if (!node) {
      throw new Error(`Node not found: ${nodeType}`);
    }

    const manifest = node.getManifest();
    
    // 验证输入
    const inputValidation = node.validateInputs(inputs, manifest);
    if (!inputValidation.valid) {
      return {
        success: false,
        outputs: {},
        metadata: {
          duration: 0,
          cached: false,
          traceId: context.executionId,
          timestamp: new Date(),
          nodeVersion: manifest.version
        },
        error: {
          code: 'INVALID_INPUTS',
          message: inputValidation.errors.join('; ')
        }
      };
    }
    
    // 验证配置
    const configValidation = node.validateConfig(config, manifest);
    if (!configValidation.valid) {
      return {
        success: false,
        outputs: {},
        metadata: {
          duration: 0,
          cached: false,
          traceId: context.executionId,
          timestamp: new Date(),
          nodeVersion: manifest.version
        },
        error: {
          code: 'INVALID_CONFIG',
          message: configValidation.errors.join('; ')
        }
      };
    }
    
    // 执行节点
    const startTime = Date.now();
    try {
      const result = await node.execute(inputs, config, context);
      const duration = Date.now() - startTime;
      
      context.logger?.info?.(`✅ Node ${nodeType} executed in ${duration}ms`);
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      context.logger?.error?.(`❌ Node ${nodeType} failed after ${duration}ms:`, error);
      
      return {
        success: false,
        outputs: {},
        metadata: {
          duration,
          cached: false,
          traceId: context.executionId,
          timestamp: new Date(),
          nodeVersion: manifest.version
        },
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message,
          details: error.stack
        }
      };
    }
  }

  /**
   * 执行节点图
   */
  async executeGraph(
    graph: NodeGraph,
    initialInputs: Record<string, AuditDataType>,
    context: NodeExecutionContext
  ): Promise<Record<string, NodeExecutionResult>> {
    // 1. 编译检查
    const typeCheck = this.compiler.validateTypes(graph);
    if (!typeCheck.valid) {
      throw new Error(`Type check failed: ${typeCheck.errors.map(e => e.message).join('; ')}`);
    }
    
    // 2. 生成执行计划
    const plan = this.compiler.generateParallelPlan(graph);
    context.logger?.info?.(`📊 Execution plan: ${plan.totalPhases} phases, ${plan.parallelization.toFixed(2)}x parallelization`);
    
    // 3. 执行计划
    const results = new Map<string, NodeExecutionResult>();
    const nodeOutputs = new Map<string, Record<string, AuditDataType>>();
    
    // 初始输入
    nodeOutputs.set('__initial__', initialInputs);
    
    for (const phase of plan.phases) {
      context.logger?.info?.(`▶️  Phase ${phase.phase}: ${phase.nodes.length} nodes (parallel: ${phase.parallel})`);
      
      if (phase.parallel && phase.nodes.length > 1) {
        // 并行执行
        const promises = phase.nodes.map(nodeId => 
          this.executeNodeInGraph(nodeId, graph, nodeOutputs, context)
        );
        const phaseResults = await Promise.all(promises);
        
        for (let i = 0; i < phase.nodes.length; i++) {
          results.set(phase.nodes[i], phaseResults[i]);
        }
      } else {
        // 串行执行
        for (const nodeId of phase.nodes) {
          const result = await this.executeNodeInGraph(nodeId, graph, nodeOutputs, context);
          results.set(nodeId, result);
        }
      }
    }
    
    return Object.fromEntries(results);
  }

  /**
   * 获取节点清单
   */
  getManifest(nodeType: string): NodeManifest | undefined {
    return this.manifests.get(nodeType);
  }

  /**
   * 列出所有清单
   */
  listManifests(): NodeManifest[] {
    return Array.from(this.manifests.values());
  }

  /**
   * 按分类获取节点
   */
  getNodesByCategory(category: string): NodeManifest[] {
    const nodeTypes = this.categories.get(category) || [];
    return nodeTypes
      .map(type => this.manifests.get(type))
      .filter(m => m !== undefined) as NodeManifest[];
  }

  /**
   * 智能推荐：根据输出类型推荐下游节点
   */
  recommendNextNodes(outputType: AuditDataTypeName): NodeManifest[] {
    // 找到所有接受该类型的节点
    const recommendations: NodeManifest[] = [];
    
    for (const manifest of this.manifests.values()) {
      for (const input of manifest.inputs) {
        const acceptedTypes = Array.isArray(input.type) ? input.type : [input.type];
        if (acceptedTypes.includes(outputType)) {
          recommendations.push(manifest);
          break;
        }
      }
    }
    
    return recommendations;
  }

  /**
   * 搜索节点
   */
  searchNodes(query: string): NodeManifest[] {
    const lowerQuery = query.toLowerCase();
    const results: NodeManifest[] = [];
    
    for (const manifest of this.manifests.values()) {
      // 搜索类型、标签、标签、描述
      if (
        manifest.type.toLowerCase().includes(lowerQuery) ||
        manifest.label.zh.toLowerCase().includes(lowerQuery) ||
        manifest.label.en.toLowerCase().includes(lowerQuery) ||
        manifest.description.zh.toLowerCase().includes(lowerQuery) ||
        manifest.description.en.toLowerCase().includes(lowerQuery) ||
        manifest.metadata.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      ) {
        results.push(manifest);
      }
    }
    
    return results;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalNodes: this.nodes.size,
      categories: Object.fromEntries(
        Array.from(this.categories.entries()).map(([cat, nodes]) => [cat, nodes.length])
      ),
      byCapability: {
        cacheable: Array.from(this.manifests.values()).filter(m => m.capabilities.cacheable).length,
        parallel: Array.from(this.manifests.values()).filter(m => m.capabilities.parallel).length,
        streaming: Array.from(this.manifests.values()).filter(m => m.capabilities.streaming).length,
        aiPowered: Array.from(this.manifests.values()).filter(m => m.capabilities.aiPowered).length
      }
    };
  }

  // ============================================
  // 私有方法
  // ============================================

  private validateManifest(manifest: NodeManifest): void {
    if (!manifest.type) {
      throw new Error('Node type is required');
    }
    
    if (!manifest.version) {
      throw new Error('Node version is required');
    }
    
    if (!manifest.category) {
      throw new Error('Node category is required');
    }
    
    if (this.manifests.has(manifest.type)) {
      throw new Error(`Node already registered: ${manifest.type}`);
    }
  }

  private async executeNodeInGraph(
    nodeId: string,
    graph: NodeGraph,
    nodeOutputs: Map<string, Record<string, AuditDataType>>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const nodeDef = graph.nodes.find(n => n.id === nodeId);
    if (!nodeDef) {
      throw new Error(`Node not found in graph: ${nodeId}`);
    }
    
    // 收集输入
    const inputs: Record<string, AuditDataType> = {};
    const inputConnections = graph.connections.filter(c => c.to.nodeId === nodeId);
    
    for (const conn of inputConnections) {
      const sourceOutputs = nodeOutputs.get(conn.from.nodeId);
      if (sourceOutputs) {
        inputs[conn.to.portId] = sourceOutputs[conn.from.portId];
      }
    }
    
    // 执行节点
    const result = await this.execute(nodeDef.type, inputs, nodeDef.config, {
      ...context,
      nodeId
    });
    
    // 保存输出
    if (result.success) {
      nodeOutputs.set(nodeId, result.outputs);
    }
    
    return result;
  }
}

// 全局实例
export const nodeRegistryV3 = new NodeRegistryV3();
