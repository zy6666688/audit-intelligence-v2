/**
 * DependencyGraph - 节点依赖图管理
 * 
 * 功能：
 * 1. 管理节点间的依赖关系
 * 2. 拓扑排序（Kahn算法）
 * 3. 循环依赖检测
 * 4. 计算节点层级
 * 
 * Week 2 Day 1
 */

import type { NodeGraph, NodeId, EdgeBinding } from '@audit/shared';

/**
 * 依赖图类
 */
export class DependencyGraph {
  // 依赖关系: nodeId -> 该节点依赖的节点集合
  private dependencies: Map<NodeId, Set<NodeId>>;
  
  // 被依赖关系: nodeId -> 依赖该节点的节点集合
  private dependents: Map<NodeId, Set<NodeId>>;
  
  // 节点层级: nodeId -> 层级（从0开始）
  private levels: Map<NodeId, number>;
  
  // 入度: nodeId -> 入边数量
  private inDegree: Map<NodeId, number>;
  
  // 出度: nodeId -> 出边数量
  private outDegree: Map<NodeId, number>;

  constructor() {
    this.dependencies = new Map();
    this.dependents = new Map();
    this.levels = new Map();
    this.inDegree = new Map();
    this.outDegree = new Map();
  }

  /**
   * 从NodeGraph构建依赖图
   */
  buildFromGraph(graph: NodeGraph): void {
    // 清空现有数据
    this.clear();
    
    // 初始化所有节点
    for (const [nodeId] of graph.nodes) {
      this.dependencies.set(nodeId, new Set());
      this.dependents.set(nodeId, new Set());
      this.inDegree.set(nodeId, 0);
      this.outDegree.set(nodeId, 0);
    }
    
    // 构建依赖关系
    for (const edge of graph.edges.values()) {
      this.addDependency(edge.to.nodeId, edge.from.nodeId);
    }
    
    // 计算层级
    this.computeLevels();
  }

  /**
   * 添加依赖关系
   * @param nodeId - 节点ID
   * @param dependsOn - 该节点依赖的节点ID
   */
  addDependency(nodeId: NodeId, dependsOn: NodeId): void {
    // 确保两个节点都已初始化
    if (!this.dependencies.has(nodeId)) {
      this.dependencies.set(nodeId, new Set());
      this.dependents.set(nodeId, new Set());
      this.inDegree.set(nodeId, 0);
      this.outDegree.set(nodeId, 0);
    }
    
    if (!this.dependencies.has(dependsOn)) {
      this.dependencies.set(dependsOn, new Set());
      this.dependents.set(dependsOn, new Set());
      this.inDegree.set(dependsOn, 0);
      this.outDegree.set(dependsOn, 0);
    }
    
    // 添加到dependencies
    this.dependencies.get(nodeId)!.add(dependsOn);
    
    // 添加到dependents（反向）
    this.dependents.get(dependsOn)!.add(nodeId);
    
    // 更新入度
    const currentInDegree = this.inDegree.get(nodeId)!;
    this.inDegree.set(nodeId, currentInDegree + 1);
    
    // 更新出度
    const currentOutDegree = this.outDegree.get(dependsOn)!;
    this.outDegree.set(dependsOn, currentOutDegree + 1);
  }

  /**
   * 获取节点的所有依赖（直接依赖）
   */
  getDependencies(nodeId: NodeId): Set<NodeId> {
    return this.dependencies.get(nodeId) || new Set();
  }

  /**
   * 获取依赖该节点的所有节点（直接被依赖）
   */
  getDependents(nodeId: NodeId): Set<NodeId> {
    return this.dependents.get(nodeId) || new Set();
  }

  /**
   * 获取节点的入度
   */
  getInDegree(nodeId: NodeId): number {
    return this.inDegree.get(nodeId) || 0;
  }

  /**
   * 获取节点的出度
   */
  getOutDegree(nodeId: NodeId): number {
    return this.outDegree.get(nodeId) || 0;
  }

  /**
   * 获取节点的层级
   */
  getLevel(nodeId: NodeId): number {
    return this.levels.get(nodeId) || 0;
  }

  /**
   * 拓扑排序（Kahn算法）
   * 
   * @returns 排序后的节点ID数组
   * @throws 如果存在循环依赖
   */
  topologicalSort(): NodeId[] {
    const result: NodeId[] = [];
    const queue: NodeId[] = [];
    
    // 复制入度，避免修改原始数据
    const inDegreeCopy = new Map(this.inDegree);
    
    // 1. 将所有入度为0的节点入队
    for (const [nodeId, degree] of inDegreeCopy) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    // 2. BFS处理
    while (queue.length > 0) {
      // 取出入度为0的节点
      const nodeId = queue.shift()!;
      result.push(nodeId);
      
      // 获取所有依赖该节点的节点
      const deps = this.getDependents(nodeId);
      
      // 减少这些节点的入度
      for (const depNodeId of deps) {
        const newDegree = inDegreeCopy.get(depNodeId)! - 1;
        inDegreeCopy.set(depNodeId, newDegree);
        
        // 如果入度变为0，入队
        if (newDegree === 0) {
          queue.push(depNodeId);
        }
      }
    }
    
    // 3. 检测循环依赖
    if (result.length !== this.dependencies.size) {
      const remaining = Array.from(this.dependencies.keys()).filter(
        id => !result.includes(id)
      );
      throw new Error(
        `Circular dependency detected. Remaining nodes: ${remaining.join(', ')}`
      );
    }
    
    return result;
  }

  /**
   * 检测循环依赖
   * 
   * @returns 如果有循环，返回循环路径；否则返回null
   */
  detectCycle(): NodeId[] | null {
    const visited = new Set<NodeId>();
    const recursionStack = new Set<NodeId>();
    const path: NodeId[] = [];
    
    // DFS检测环
    const dfs = (nodeId: NodeId): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      // 检查所有依赖该节点的节点
      const deps = this.getDependents(nodeId);
      for (const depNodeId of deps) {
        if (!visited.has(depNodeId)) {
          if (dfs(depNodeId)) {
            return true;
          }
        } else if (recursionStack.has(depNodeId)) {
          // 找到环
          path.push(depNodeId);
          return true;
        }
      }
      
      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };
    
    // 对每个未访问的节点运行DFS
    for (const nodeId of this.dependencies.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) {
          return path;
        }
      }
    }
    
    return null;
  }

  /**
   * 计算节点层级
   * 层级0: 没有依赖的节点
   * 层级N: 依赖最大层级为N-1的节点
   */
  computeLevels(): void {
    this.levels.clear();
    
    // 使用拓扑排序的顺序
    try {
      const sorted = this.topologicalSort();
      
      for (const nodeId of sorted) {
        // 计算当前节点的层级
        // = max(依赖节点的层级) + 1
        const deps = this.getDependencies(nodeId);
        let maxLevel = -1;
        
        for (const depId of deps) {
          const depLevel = this.levels.get(depId) || 0;
          maxLevel = Math.max(maxLevel, depLevel);
        }
        
        this.levels.set(nodeId, maxLevel + 1);
      }
    } catch (error) {
      // 如果有循环依赖，所有节点层级为0
      for (const nodeId of this.dependencies.keys()) {
        this.levels.set(nodeId, 0);
      }
    }
  }

  /**
   * 获取按层级分组的节点
   * 
   * @returns Map<层级, 节点ID数组>
   */
  getNodesByLevel(): Map<number, NodeId[]> {
    const result = new Map<number, NodeId[]>();
    
    for (const [nodeId, level] of this.levels) {
      if (!result.has(level)) {
        result.set(level, []);
      }
      result.get(level)!.push(nodeId);
    }
    
    return result;
  }

  /**
   * 获取节点的所有祖先（递归）
   */
  getAncestors(nodeId: NodeId): Set<NodeId> {
    const ancestors = new Set<NodeId>();
    const visited = new Set<NodeId>();
    
    const dfs = (id: NodeId) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const deps = this.getDependencies(id);
      for (const depId of deps) {
        ancestors.add(depId);
        dfs(depId);
      }
    };
    
    dfs(nodeId);
    return ancestors;
  }

  /**
   * 获取节点的所有后代（递归）
   */
  getDescendants(nodeId: NodeId): Set<NodeId> {
    const descendants = new Set<NodeId>();
    const visited = new Set<NodeId>();
    
    const dfs = (id: NodeId) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const deps = this.getDependents(id);
      for (const depId of deps) {
        descendants.add(depId);
        dfs(depId);
      }
    };
    
    dfs(nodeId);
    return descendants;
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    this.dependencies.clear();
    this.dependents.clear();
    this.levels.clear();
    this.inDegree.clear();
    this.outDegree.clear();
  }

  /**
   * 获取图的统计信息
   */
  getStats() {
    return {
      nodeCount: this.dependencies.size,
      edgeCount: Array.from(this.dependencies.values()).reduce(
        (sum, deps) => sum + deps.size,
        0
      ),
      maxLevel: Math.max(...Array.from(this.levels.values()), 0),
      rootNodes: Array.from(this.dependencies.entries())
        .filter(([_, deps]) => deps.size === 0)
        .map(([id]) => id),
      leafNodes: Array.from(this.dependents.entries())
        .filter(([_, deps]) => deps.size === 0)
        .map(([id]) => id)
    };
  }
}
