/**
 * DependencyGraph测试
 * Week 2 Day 1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from './DependencyGraph';
import type { NodeGraph, NodeId } from '@audit/shared';
import { createMockGraph, createMockNode } from '../utils/testHelpers';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('基本操作', () => {
    it('应该正确添加依赖关系', () => {
      graph.addDependency('B', 'A'); // B依赖A
      
      expect(graph.getDependencies('B').has('A')).toBe(true);
      expect(graph.getDependents('A').has('B')).toBe(true);
      expect(graph.getInDegree('B')).toBe(1);
      expect(graph.getOutDegree('A')).toBe(1);
    });

    it('应该正确计算入度和出度', () => {
      // A → B → C
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      
      expect(graph.getInDegree('A')).toBe(0);
      expect(graph.getInDegree('B')).toBe(1);
      expect(graph.getInDegree('C')).toBe(1);
      
      expect(graph.getOutDegree('A')).toBe(1);
      expect(graph.getOutDegree('B')).toBe(1);
      expect(graph.getOutDegree('C')).toBe(0);
    });
  });

  describe('从NodeGraph构建', () => {
    it('应该从NodeGraph正确构建依赖图', () => {
      const nodeGraph = createMockGraph({
        id: 'test-graph',
        name: 'Test Graph',
        version: '1.0.0',
        nodes: new Map([
          ['A', createMockNode('A', 'test')],
          ['B', createMockNode('B', 'test')],
          ['C', createMockNode('C', 'test')]
        ]),
        edges: new Map([
          ['e1', {
            id: 'e1',
            from: { nodeId: 'A', portName: 'out' },
            to: { nodeId: 'B', portName: 'in' },
            createdAt: new Date().toISOString()
          }],
          ['e2', {
            id: 'e2',
            from: { nodeId: 'B', portName: 'out' },
            to: { nodeId: 'C', portName: 'in' },
            createdAt: new Date().toISOString()
          }]
        ])
      });
      
      graph.buildFromGraph(nodeGraph);
      
      expect(graph.getDependencies('B').has('A')).toBe(true);
      expect(graph.getDependencies('C').has('B')).toBe(true);
      expect(graph.getInDegree('A')).toBe(0);
      expect(graph.getInDegree('C')).toBe(1);
    });
  });

  describe('拓扑排序', () => {
    it('应该对线性图正确排序', () => {
      // A → B → C
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      
      const sorted = graph.topologicalSort();
      
      expect(sorted).toEqual(['A', 'B', 'C']);
    });

    it('应该对分支图正确排序', () => {
      // A → B
      // A → C
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'A');
      
      const sorted = graph.topologicalSort();
      
      expect(sorted[0]).toBe('A');
      expect(sorted.slice(1)).toContain('B');
      expect(sorted.slice(1)).toContain('C');
    });

    it('应该对复杂图正确排序', () => {
      // A → B → D
      //  ↓   ↓
      //  C → E
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'A');
      graph.addDependency('D', 'B');
      graph.addDependency('E', 'B');
      graph.addDependency('E', 'C');
      
      const sorted = graph.topologicalSort();
      
      // 验证顺序正确性
      expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('B'));
      expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('C'));
      expect(sorted.indexOf('B')).toBeLessThan(sorted.indexOf('D'));
      expect(sorted.indexOf('B')).toBeLessThan(sorted.indexOf('E'));
      expect(sorted.indexOf('C')).toBeLessThan(sorted.indexOf('E'));
    });

    it('应该对单个节点正确排序', () => {
      // 创建一个没有依赖的节点
      graph.buildFromGraph(createMockGraph({
        id: 'test',
        nodes: new Map([
          ['A', createMockNode('A', 'test')]
        ])
      }));
      
      const sorted = graph.topologicalSort();
      
      expect(sorted).toEqual(['A']);
    });
  });

  describe('循环依赖检测', () => {
    it('应该检测简单循环', () => {
      // A → B → A
      graph.addDependency('B', 'A');
      graph.addDependency('A', 'B');
      
      expect(() => graph.topologicalSort()).toThrow('Circular dependency');
    });

    it('应该检测复杂循环', () => {
      // A → B → C → A
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.addDependency('A', 'C');
      
      expect(() => graph.topologicalSort()).toThrow('Circular dependency');
    });

    it('使用detectCycle应该找到循环路径', () => {
      // A → B → C → A
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.addDependency('A', 'C');
      
      const cycle = graph.detectCycle();
      
      expect(cycle).not.toBeNull();
      expect(cycle!.length).toBeGreaterThan(2);
    });

    it('无循环时detectCycle应该返回null', () => {
      // A → B → C
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      
      const cycle = graph.detectCycle();
      
      expect(cycle).toBeNull();
    });
  });

  describe('层级计算', () => {
    it('应该正确计算节点层级', () => {
      // A → B → C
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.computeLevels(); // 手动触发层级计算
      
      expect(graph.getLevel('A')).toBe(0);
      expect(graph.getLevel('B')).toBe(1);
      expect(graph.getLevel('C')).toBe(2);
    });

    it('应该正确计算分支图的层级', () => {
      // A → B → D
      //  ↓   ↓
      //  C → E
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'A');
      graph.addDependency('D', 'B');
      graph.addDependency('E', 'B');
      graph.addDependency('E', 'C');
      graph.computeLevels(); // 手动触发层级计算
      
      expect(graph.getLevel('A')).toBe(0);
      expect(graph.getLevel('B')).toBe(1);
      expect(graph.getLevel('C')).toBe(1);
      expect(graph.getLevel('D')).toBe(2);
      expect(graph.getLevel('E')).toBe(2);
    });

    it('应该按层级分组节点', () => {
      // A → B → D
      //  ↓   ↓
      //  C → E
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'A');
      graph.addDependency('D', 'B');
      graph.addDependency('E', 'B');
      graph.addDependency('E', 'C');
      graph.computeLevels(); // 手动触发层级计算
      
      const byLevel = graph.getNodesByLevel();
      
      expect(byLevel.get(0)).toEqual(['A']);
      expect(byLevel.get(1)).toContain('B');
      expect(byLevel.get(1)).toContain('C');
      expect(byLevel.get(2)).toContain('D');
      expect(byLevel.get(2)).toContain('E');
    });
  });

  describe('祖先和后代', () => {
    beforeEach(() => {
      // A → B → D
      //  ↓   ↓
      //  C → E
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'A');
      graph.addDependency('D', 'B');
      graph.addDependency('E', 'B');
      graph.addDependency('E', 'C');
    });

    it('应该正确获取祖先', () => {
      const ancestors = graph.getAncestors('E');
      
      expect(ancestors.has('A')).toBe(true);
      expect(ancestors.has('B')).toBe(true);
      expect(ancestors.has('C')).toBe(true);
      expect(ancestors.size).toBe(3);
    });

    it('应该正确获取后代', () => {
      const descendants = graph.getDescendants('A');
      
      expect(descendants.has('B')).toBe(true);
      expect(descendants.has('C')).toBe(true);
      expect(descendants.has('D')).toBe(true);
      expect(descendants.has('E')).toBe(true);
      expect(descendants.size).toBe(4);
    });
  });

  describe('统计信息', () => {
    it('应该返回正确的统计信息', () => {
      // A → B → C
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.computeLevels(); // 手动触发层级计算
      
      const stats = graph.getStats();
      
      expect(stats.nodeCount).toBe(3);
      expect(stats.edgeCount).toBe(2);
      expect(stats.maxLevel).toBe(2);
      expect(stats.rootNodes).toContain('A');
      expect(stats.leafNodes).toContain('C');
    });
  });
});
