/**
 * 审计节点编译器
 * 对标 ComfyUI 的执行调度器，提供智能执行和优化
 * 
 * 核心功能:
 * 1. 类型检查 - 确保节点连接类型正确
 * 2. 依赖分析 - 分析节点之间的数据依赖关系
 * 3. 风险追踪 - 追踪风险从源头到报告的完整路径
 * 4. 并行优化 - 自动识别可并行执行的节点
 * 5. 证据链生成 - 自动建立审计证据链
 * 6. 执行计划 - 生成优化的执行计划
 */

import type { 
  AuditDataType, 
  AuditDataTypeName,
  Evidence,
  RiskSet 
} from '../types/AuditDataTypes';

// ============================================
// 节点图定义
// ============================================

export interface NodePort {
  id: string;
  name: string;
  type: AuditDataTypeName | AuditDataTypeName[];  // 支持多类型
  required: boolean;
  description?: string;
}

export interface NodeDefinition {
  id: string;
  type: string;
  category: string;
  inputs: NodePort[];
  outputs: NodePort[];
  config: Record<string, any>;
  metadata?: {
    tags?: string[];
    author?: string;
    version?: string;
  };
}

export interface NodeConnection {
  from: {
    nodeId: string;
    portId: string;
  };
  to: {
    nodeId: string;
    portId: string;
  };
  dataType: AuditDataTypeName;
}

export interface NodeGraph {
  id: string;
  name: string;
  nodes: NodeDefinition[];
  connections: NodeConnection[];
  version: string;
  metadata?: Record<string, any>;
}

// ============================================
// 编译结果类型
// ============================================

export interface TypeCheckResult {
  valid: boolean;
  errors: TypeCheckError[];
  warnings: TypeCheckWarning[];
}

export interface TypeCheckError {
  nodeId: string;
  portId: string;
  message: string;
  expected: AuditDataTypeName[];
  actual?: AuditDataTypeName;
}

export interface TypeCheckWarning {
  nodeId: string;
  message: string;
  suggestion?: string;
}

export interface DependencyNode {
  nodeId: string;
  dependencies: string[];     // 依赖的节点ID
  dependents: string[];        // 被哪些节点依赖
  depth: number;               // 深度（拓扑排序）
  fields: string[];            // 使用的字段
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  executionOrder: string[];    // 拓扑排序结果
  parallelGroups: string[][];  // 可并行执行的节点组
}

export interface RiskFlowMap {
  sources: Map<string, RiskSource>;      // 风险源
  flows: RiskFlow[];                     // 风险传播路径
  sinks: Map<string, RiskSink>;          // 风险汇聚点
}

export interface RiskSource {
  nodeId: string;
  riskTypes: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RiskFlow {
  from: string;
  to: string;
  riskTypes: string[];
  transformation?: string;     // 风险如何转换
}

export interface RiskSink {
  nodeId: string;
  aggregatedRisks: RiskSet;
}

export interface VolumeEstimate {
  nodeEstimates: Map<string, NodeVolumeEstimate>;
  totalDataVolume: number;     // 字节
  estimatedMemory: number;     // 字节
  estimatedDuration: number;   // 毫秒
}

export interface NodeVolumeEstimate {
  nodeId: string;
  inputVolume: number;
  outputVolume: number;
  processingTime: number;
  memoryUsage: number;
}

export interface ExecutionPlan {
  phases: ExecutionPhase[];
  totalPhases: number;
  estimatedDuration: number;
  parallelization: number;     // 并行度
}

export interface ExecutionPhase {
  phase: number;
  nodes: string[];             // 该阶段执行的节点
  parallel: boolean;           // 是否并行执行
  estimatedDuration: number;
}

export interface OptimizedGraph {
  original: NodeGraph;
  optimized: NodeGraph;
  removedNodes: string[];      // 被移除的冗余节点
  addedNodes: NodeDefinition[]; // 添加的优化节点（如缓存）
  optimizations: Optimization[];
}

export interface Optimization {
  type: 'remove_redundant' | 'add_cache' | 'merge_nodes' | 'reorder';
  description: string;
  impact: {
    speedup?: number;
    memoryReduction?: number;
  };
}

export interface EvidenceChain {
  chains: Chain[];
  graph: EvidenceGraph;
}

export interface Chain {
  id: string;
  nodes: string[];             // 节点路径
  dataFlow: DataFlow[];
  riskFlow: RiskFlow[];
  evidenceItems: string[];     // 生成的证据ID
}

export interface DataFlow {
  from: string;
  to: string;
  dataType: AuditDataTypeName;
  volume: number;
}

export interface EvidenceGraph {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
}

export interface EvidenceGraphNode {
  id: string;
  type: 'data' | 'process' | 'evidence' | 'risk';
  label: string;
  data?: any;
}

export interface EvidenceGraphEdge {
  from: string;
  to: string;
  label: string;
}

// ============================================
// 审计节点编译器
// ============================================

export class AuditNodeCompiler {
  private typeCompatibility: Map<string, Set<string>>;

  constructor() {
    this.typeCompatibility = this.buildTypeCompatibility();
  }

  /**
   * 1. 类型检查
   * 确保所有节点连接的类型兼容
   */
  validateTypes(graph: NodeGraph): TypeCheckResult {
    const errors: TypeCheckError[] = [];
    const warnings: TypeCheckWarning[] = [];

    // 检查每个连接
    for (const conn of graph.connections) {
      const fromNode = graph.nodes.find(n => n.id === conn.from.nodeId);
      const toNode = graph.nodes.find(n => n.id === conn.to.nodeId);

      if (!fromNode || !toNode) {
        errors.push({
          nodeId: conn.from.nodeId,
          portId: conn.from.portId,
          message: 'Node not found in graph',
          expected: []
        });
        continue;
      }

      const outputPort = fromNode.outputs.find(p => p.id === conn.from.portId);
      const inputPort = toNode.inputs.find(p => p.id === conn.to.portId);

      if (!outputPort || !inputPort) {
        errors.push({
          nodeId: conn.from.nodeId,
          portId: conn.from.portId,
          message: 'Port not found',
          expected: []
        });
        continue;
      }

      // 检查类型兼容性
      const outputType = Array.isArray(outputPort.type) ? outputPort.type[0] : outputPort.type;
      const inputTypes = Array.isArray(inputPort.type) ? inputPort.type : [inputPort.type];

      if (!this.isTypeCompatible(outputType, inputTypes)) {
        errors.push({
          nodeId: toNode.id,
          portId: inputPort.id,
          message: `Type mismatch: ${outputType} cannot connect to ${inputTypes.join('|')}`,
          expected: inputTypes,
          actual: outputType
        });
      }
    }

    // 检查必需输入
    for (const node of graph.nodes) {
      for (const input of node.inputs) {
        if (input.required) {
          const hasConnection = graph.connections.some(
            c => c.to.nodeId === node.id && c.to.portId === input.id
          );
          if (!hasConnection) {
            warnings.push({
              nodeId: node.id,
              message: `Required input '${input.name}' is not connected`,
              suggestion: `Connect a node that outputs ${Array.isArray(input.type) ? input.type.join('|') : input.type}`
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 2. 字段依赖追踪
   * 分析节点之间的数据依赖和字段使用
   */
  analyzeFieldDependencies(graph: NodeGraph): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    
    // 初始化依赖节点
    for (const node of graph.nodes) {
      nodes.set(node.id, {
        nodeId: node.id,
        dependencies: [],
        dependents: [],
        depth: 0,
        fields: []
      });
    }

    // 构建依赖关系
    for (const conn of graph.connections) {
      const depNode = nodes.get(conn.to.nodeId)!;
      const sourceNode = nodes.get(conn.from.nodeId)!;
      
      depNode.dependencies.push(conn.from.nodeId);
      sourceNode.dependents.push(conn.to.nodeId);
    }

    // 拓扑排序
    const executionOrder = this.topologicalSort(graph, nodes);
    
    // 计算深度
    for (const nodeId of executionOrder) {
      const node = nodes.get(nodeId)!;
      node.depth = this.calculateDepth(node, nodes);
    }

    // 识别并行组
    const parallelGroups = this.identifyParallelGroups(nodes, executionOrder);

    return {
      nodes,
      executionOrder,
      parallelGroups
    };
  }

  /**
   * 3. 风险传播分析
   * 追踪风险如何在节点间传播
   */
  traceRiskFlow(graph: NodeGraph): RiskFlowMap {
    const sources = new Map<string, RiskSource>();
    const flows: RiskFlow[] = [];
    const sinks = new Map<string, RiskSink>();

    // 识别风险源节点
    for (const node of graph.nodes) {
      if (this.isRiskSourceNode(node)) {
        sources.set(node.id, {
          nodeId: node.id,
          riskTypes: this.extractRiskTypes(node),
          severity: this.calculateSeverity(node)
        });
      }
    }

    // 追踪风险流动
    for (const conn of graph.connections) {
      if (conn.dataType === 'RiskSet') {
        flows.push({
          from: conn.from.nodeId,
          to: conn.to.nodeId,
          riskTypes: this.getRiskTypesInConnection(conn, graph)
        });
      }
    }

    // 识别风险汇聚点
    for (const node of graph.nodes) {
      if (this.isRiskAggregationNode(node)) {
        sinks.set(node.id, {
          nodeId: node.id,
          aggregatedRisks: this.aggregateRisks(node, flows)
        });
      }
    }

    return { sources, flows, sinks };
  }

  /**
   * 4. 数据量预估
   * 估算每个节点的数据量和资源使用
   */
  estimateDataVolume(graph: NodeGraph): VolumeEstimate {
    const nodeEstimates = new Map<string, NodeVolumeEstimate>();
    
    // TODO: 实现数据量预估逻辑
    // 需要考虑：
    // - 输入数据大小
    // - 节点操作的数据放大/缩小系数
    // - 历史统计数据
    
    return {
      nodeEstimates,
      totalDataVolume: 0,
      estimatedMemory: 0,
      estimatedDuration: 0
    };
  }

  /**
   * 5. 生成并行执行计划
   * 识别可并行执行的节点并生成执行计划
   */
  generateParallelPlan(graph: NodeGraph): ExecutionPlan {
    const deps = this.analyzeFieldDependencies(graph);
    const phases: ExecutionPhase[] = [];

    // 按深度分组
    const depthGroups = new Map<number, string[]>();
    for (const [nodeId, node] of deps.nodes) {
      const nodes = depthGroups.get(node.depth) || [];
      nodes.push(nodeId);
      depthGroups.set(node.depth, nodes);
    }

    // 生成执行阶段
    let totalDuration = 0;
    for (const [depth, nodeIds] of depthGroups) {
      const parallel = nodeIds.length > 1;
      const duration = this.estimatePhaseDuration(nodeIds, graph);
      
      phases.push({
        phase: depth,
        nodes: nodeIds,
        parallel,
        estimatedDuration: duration
      });

      totalDuration += duration;
    }

    return {
      phases,
      totalPhases: phases.length,
      estimatedDuration: totalDuration,
      parallelization: this.calculateParallelization(phases)
    };
  }

  /**
   * 6. 优化图
   * 移除冗余节点、添加缓存节点等
   */
  optimizeGraph(graph: NodeGraph): OptimizedGraph {
    const optimizations: Optimization[] = [];
    const removedNodes: string[] = [];
    const addedNodes: NodeDefinition[] = [];

    // TODO: 实现图优化逻辑
    // 1. 识别冗余节点（相同输入产生相同输出）
    // 2. 识别可缓存的节点
    // 3. 识别可合并的节点
    // 4. 节点重排序优化

    return {
      original: graph,
      optimized: graph,
      removedNodes,
      addedNodes,
      optimizations
    };
  }

  /**
   * 7. 生成证据链图
   * 自动建立审计证据链
   */
  generateEvidenceChain(graph: NodeGraph): EvidenceChain {
    const chains: Chain[] = [];
    const evidenceNodes: EvidenceGraphNode[] = [];
    const evidenceEdges: EvidenceGraphEdge[] = [];

    // 找到所有证据生成节点
    const evidenceGenerators = graph.nodes.filter(n => 
      n.outputs.some(o => o.type === 'Evidence' || o.type === 'DraftPage')
    );

    // 为每个证据生成节点追溯源头
    for (const generator of evidenceGenerators) {
      const chain = this.traceChainToSource(generator, graph);
      chains.push(chain);

      // 构建证据图
      this.buildEvidenceGraph(chain, evidenceNodes, evidenceEdges);
    }

    return {
      chains,
      graph: {
        nodes: evidenceNodes,
        edges: evidenceEdges
      }
    };
  }

  // ============================================
  // 私有辅助方法
  // ============================================

  private buildTypeCompatibility(): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    
    // Records可以转换为其他类型
    map.set('Records', new Set(['Records', 'Ledger', 'Vouchers', 'Invoices', 'BankFlow']));
    
    // 其他类型只能匹配自己
    map.set('Ledger', new Set(['Ledger']));
    map.set('Vouchers', new Set(['Vouchers']));
    map.set('Invoices', new Set(['Invoices']));
    map.set('BankFlow', new Set(['BankFlow']));
    map.set('RiskSet', new Set(['RiskSet']));
    map.set('Evidence', new Set(['Evidence']));
    map.set('DraftPage', new Set(['DraftPage']));
    map.set('ReportSection', new Set(['ReportSection']));

    return map;
  }

  private isTypeCompatible(output: AuditDataTypeName, inputs: AuditDataTypeName[]): boolean {
    const compatible = this.typeCompatibility.get(output);
    if (!compatible) return false;
    return inputs.some(input => compatible.has(input));
  }

  private topologicalSort(graph: NodeGraph, nodes: Map<string, DependencyNode>): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected at node ${nodeId}`);
      }

      visiting.add(nodeId);
      const node = nodes.get(nodeId)!;
      
      for (const depId of node.dependencies) {
        visit(depId);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      result.push(nodeId);
    };

    for (const nodeId of nodes.keys()) {
      visit(nodeId);
    }

    return result;
  }

  private calculateDepth(node: DependencyNode, nodes: Map<string, DependencyNode>): number {
    if (node.dependencies.length === 0) return 0;
    
    const depthsOfDeps = node.dependencies.map(depId => {
      const depNode = nodes.get(depId)!;
      return depNode.depth !== undefined ? depNode.depth : this.calculateDepth(depNode, nodes);
    });

    return Math.max(...depthsOfDeps) + 1;
  }

  private identifyParallelGroups(nodes: Map<string, DependencyNode>, order: string[]): string[][] {
    const groups: string[][] = [];
    const depthMap = new Map<number, string[]>();

    for (const nodeId of order) {
      const node = nodes.get(nodeId)!;
      const group = depthMap.get(node.depth) || [];
      group.push(nodeId);
      depthMap.set(node.depth, group);
    }

    return Array.from(depthMap.values());
  }

  private isRiskSourceNode(node: NodeDefinition): boolean {
    return node.outputs.some(o => o.type === 'RiskSet');
  }

  private isRiskAggregationNode(node: NodeDefinition): boolean {
    // TODO: 识别风险聚合节点
    return false;
  }

  private extractRiskTypes(node: NodeDefinition): string[] {
    // TODO: 从节点配置提取风险类型
    return [];
  }

  private calculateSeverity(node: NodeDefinition): 'low' | 'medium' | 'high' | 'critical' {
    // TODO: 计算风险严重程度
    return 'medium';
  }

  private getRiskTypesInConnection(conn: NodeConnection, graph: NodeGraph): string[] {
    // TODO: 获取连接中传递的风险类型
    return [];
  }

  private aggregateRisks(node: NodeDefinition, flows: RiskFlow[]): RiskSet {
    // TODO: 聚合风险
    return {
      type: 'RiskSet',
      risks: [],
      summary: {
        total: 0,
        bySeverity: {},
        byCategory: {}
      },
      metadata: {
        source: node.id,
        timestamp: new Date(),
        version: '1.0',
        traceId: '',
        nodeId: node.id,
        executionId: ''
      }
    };
  }

  private estimatePhaseDuration(nodeIds: string[], graph: NodeGraph): number {
    // TODO: 估算阶段执行时间
    return 1000;
  }

  private calculateParallelization(phases: ExecutionPhase[]): number {
    const totalNodes = phases.reduce((sum, p) => sum + p.nodes.length, 0);
    const sequentialTime = phases.reduce((sum, p) => sum + p.estimatedDuration, 0);
    const parallelTime = phases.reduce((sum, p) => 
      sum + (p.parallel ? p.estimatedDuration / p.nodes.length : p.estimatedDuration), 0
    );
    return sequentialTime / parallelTime;
  }

  private traceChainToSource(node: NodeDefinition, graph: NodeGraph): Chain {
    // TODO: 追溯证据链到源头
    return {
      id: `chain-${node.id}`,
      nodes: [node.id],
      dataFlow: [],
      riskFlow: [],
      evidenceItems: []
    };
  }

  private buildEvidenceGraph(
    chain: Chain,
    nodes: EvidenceGraphNode[],
    edges: EvidenceGraphEdge[]
  ): void {
    // TODO: 构建证据图
  }
}
