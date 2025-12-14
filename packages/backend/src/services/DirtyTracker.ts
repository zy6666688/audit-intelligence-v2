/**
 * DirtyTracker - Dirty状态追踪器
 * Week 2 Day 3
 * 
 * 实现智能重计算：追踪节点依赖，传播Dirty状态
 */

import type { NodeId } from '@audit/shared';
import { DependencyGraph } from './DependencyGraph';

/**
 * Dirty原因
 */
export enum DirtyReason {
  /** 数据变化 */
  DATA_CHANGED = 'data_changed',
  /** 配置变化 */
  CONFIG_CHANGED = 'config_changed',
  /** 上游依赖变化 */
  DEPENDENCY_CHANGED = 'dependency_changed',
  /** 手动标记 */
  MANUAL = 'manual'
}

/**
 * Dirty记录
 */
export interface DirtyRecord {
  nodeId: NodeId;
  isDirty: boolean;
  reason: DirtyReason;
  timestamp: number;
  sourceNodeId?: NodeId; // 导致Dirty的源节点
}

/**
 * DirtyTracker - Dirty状态追踪器
 * 
 * 核心功能:
 * - 追踪节点Dirty状态
 * - 传播Dirty到下游节点
 * - 记录Dirty原因
 * - 支持批量操作
 */
export class DirtyTracker {
  private dirtyRecords: Map<NodeId, DirtyRecord> = new Map();
  private dependencyGraph: DependencyGraph;

  constructor(dependencyGraph: DependencyGraph) {
    this.dependencyGraph = dependencyGraph;
  }

  /**
   * 标记节点为Dirty
   */
  markDirty(nodeId: NodeId, reason: DirtyReason = DirtyReason.MANUAL, sourceNodeId?: NodeId): void {
    const record: DirtyRecord = {
      nodeId,
      isDirty: true,
      reason,
      timestamp: Date.now(),
      sourceNodeId
    };
    
    this.dirtyRecords.set(nodeId, record);
  }

  /**
   * 检查节点是否Dirty
   */
  isDirty(nodeId: NodeId): boolean {
    const record = this.dirtyRecords.get(nodeId);
    return record?.isDirty ?? false;
  }

  /**
   * 清除节点的Dirty标记
   */
  clearDirty(nodeId: NodeId): void {
    const record = this.dirtyRecords.get(nodeId);
    if (record) {
      record.isDirty = false;
    }
  }

  /**
   * 获取所有Dirty节点
   */
  getDirtyNodes(): Set<NodeId> {
    const dirtyNodes = new Set<NodeId>();
    
    for (const [nodeId, record] of this.dirtyRecords) {
      if (record.isDirty) {
        dirtyNodes.add(nodeId);
      }
    }
    
    return dirtyNodes;
  }

  /**
   * 传播Dirty状态到下游节点
   * 使用BFS遍历依赖图
   */
  propagateDirty(nodeId: NodeId): Set<NodeId> {
    const affectedNodes = new Set<NodeId>();
    const descendants = this.dependencyGraph.getDescendants(nodeId);
    
    // 标记所有下游节点为Dirty
    for (const descendantId of descendants) {
      if (!this.isDirty(descendantId)) {
        this.markDirty(descendantId, DirtyReason.DEPENDENCY_CHANGED, nodeId);
        affectedNodes.add(descendantId);
      }
    }
    
    return affectedNodes;
  }

  /**
   * 批量标记多个节点为Dirty
   */
  markDirtyBatch(nodeIds: NodeId[], reason: DirtyReason = DirtyReason.MANUAL): void {
    const allAffected = new Set<NodeId>();
    
    // 先标记所有指定节点
    for (const nodeId of nodeIds) {
      this.markDirty(nodeId, reason);
      allAffected.add(nodeId);
    }
    
    // 传播到下游（去重）
    for (const nodeId of nodeIds) {
      const affected = this.propagateDirty(nodeId);
      for (const affectedId of affected) {
        allAffected.add(affectedId);
      }
    }
  }

  /**
   * 获取Dirty记录
   */
  getRecord(nodeId: NodeId): DirtyRecord | undefined {
    return this.dirtyRecords.get(nodeId);
  }

  /**
   * 获取所有Dirty记录
   */
  getAllRecords(): DirtyRecord[] {
    return Array.from(this.dirtyRecords.values()).filter(r => r.isDirty);
  }

  /**
   * 清除所有Dirty标记
   */
  clearAll(): void {
    for (const record of this.dirtyRecords.values()) {
      record.isDirty = false;
    }
  }

  /**
   * 重置追踪器（清空所有记录）
   */
  reset(): void {
    this.dirtyRecords.clear();
  }

  /**
   * 获取Dirty统计信息
   */
  getStats(): {
    totalTracked: number;
    dirtyCount: number;
    cleanCount: number;
    byReason: Map<DirtyReason, number>;
  } {
    const byReason = new Map<DirtyReason, number>();
    let dirtyCount = 0;
    
    for (const record of this.dirtyRecords.values()) {
      if (record.isDirty) {
        dirtyCount++;
        const count = byReason.get(record.reason) || 0;
        byReason.set(record.reason, count + 1);
      }
    }
    
    return {
      totalTracked: this.dirtyRecords.size,
      dirtyCount,
      cleanCount: this.dirtyRecords.size - dirtyCount,
      byReason
    };
  }

  /**
   * 计算需要重新执行的节点（拓扑排序）
   */
  getExecutionOrder(): NodeId[] {
    const dirtyNodes = this.getDirtyNodes();
    
    if (dirtyNodes.size === 0) {
      return [];
    }
    
    // 使用依赖图的拓扑排序
    const allOrder = this.dependencyGraph.topologicalSort();
    
    // 过滤出Dirty节点，保持拓扑顺序
    return allOrder.filter(nodeId => dirtyNodes.has(nodeId));
  }
}
