/**
 * DirtyTracker测试
 * Week 2 Day 3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DirtyTracker, DirtyReason } from './DirtyTracker';
import { DependencyGraph } from './DependencyGraph';

describe('DirtyTracker', () => {
  let tracker: DirtyTracker;
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
    tracker = new DirtyTracker(graph);
  });

  describe('基本操作', () => {
    it('应该标记节点为Dirty', () => {
      tracker.markDirty('node1');
      expect(tracker.isDirty('node1')).toBe(true);
    });

    it('应该清除Dirty标记', () => {
      tracker.markDirty('node1');
      tracker.clearDirty('node1');
      expect(tracker.isDirty('node1')).toBe(false);
    });

    it('应该获取所有Dirty节点', () => {
      tracker.markDirty('node1');
      tracker.markDirty('node2');
      
      const dirtyNodes = tracker.getDirtyNodes();
      expect(dirtyNodes.size).toBe(2);
      expect(dirtyNodes.has('node1')).toBe(true);
      expect(dirtyNodes.has('node2')).toBe(true);
    });
  });

  describe('Dirty传播', () => {
    it('应该传播Dirty到下游节点', () => {
      // 构建依赖: A -> B -> C
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      
      tracker.markDirty('A');
      const affected = tracker.propagateDirty('A');
      
      expect(affected.size).toBe(2);
      expect(tracker.isDirty('B')).toBe(true);
      expect(tracker.isDirty('C')).toBe(true);
    });

    it('不应该重复标记已Dirty的节点', () => {
      graph.addDependency('B', 'A');
      
      tracker.markDirty('A');
      tracker.markDirty('B'); // 已经Dirty
      
      const affected = tracker.propagateDirty('A');
      expect(affected.size).toBe(0); // B已经是Dirty，不计入affected
    });
  });

  describe('批量操作', () => {
    it('应该批量标记多个节点', () => {
      tracker.markDirtyBatch(['node1', 'node2', 'node3']);
      
      expect(tracker.isDirty('node1')).toBe(true);
      expect(tracker.isDirty('node2')).toBe(true);
      expect(tracker.isDirty('node3')).toBe(true);
    });

    it('批量标记应该传播到下游', () => {
      // A -> B, C -> D
      graph.addDependency('B', 'A');
      graph.addDependency('D', 'C');
      
      tracker.markDirtyBatch(['A', 'C']);
      
      expect(tracker.isDirty('B')).toBe(true);
      expect(tracker.isDirty('D')).toBe(true);
    });
  });

  describe('Dirty原因', () => {
    it('应该记录Dirty原因', () => {
      tracker.markDirty('node1', DirtyReason.DATA_CHANGED);
      const record = tracker.getRecord('node1');
      
      expect(record?.reason).toBe(DirtyReason.DATA_CHANGED);
    });

    it('应该记录源节点', () => {
      tracker.markDirty('node2', DirtyReason.DEPENDENCY_CHANGED, 'node1');
      const record = tracker.getRecord('node2');
      
      expect(record?.sourceNodeId).toBe('node1');
    });
  });

  describe('统计信息', () => {
    it('应该返回正确的统计', () => {
      tracker.markDirty('node1', DirtyReason.DATA_CHANGED);
      tracker.markDirty('node2', DirtyReason.CONFIG_CHANGED);
      tracker.markDirty('node3', DirtyReason.DATA_CHANGED);
      tracker.clearDirty('node3');
      
      const stats = tracker.getStats();
      
      expect(stats.totalTracked).toBe(3);
      expect(stats.dirtyCount).toBe(2);
      expect(stats.cleanCount).toBe(1);
      expect(stats.byReason.get(DirtyReason.DATA_CHANGED)).toBe(1);
      expect(stats.byReason.get(DirtyReason.CONFIG_CHANGED)).toBe(1);
    });
  });

  describe('执行顺序', () => {
    it('应该返回Dirty节点的拓扑排序', () => {
      // A -> B -> C, D -> E
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.addDependency('E', 'D');
      
      tracker.markDirty('A');
      tracker.markDirty('C');
      tracker.markDirty('D');
      
      const order = tracker.getExecutionOrder();
      
      // A应该在C之前，D可以在任何位置
      const indexA = order.indexOf('A');
      const indexC = order.indexOf('C');
      const indexD = order.indexOf('D');
      
      expect(indexA).toBeLessThan(indexC);
      expect(order).toContain('D');
    });
  });

  describe('重置', () => {
    it('应该清空所有记录', () => {
      tracker.markDirty('node1');
      tracker.markDirty('node2');
      
      tracker.reset();
      
      expect(tracker.getStats().totalTracked).toBe(0);
      expect(tracker.isDirty('node1')).toBe(false);
    });
  });
});
