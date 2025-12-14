/**
 * ExecutionEngineV2测试
 * Week 2 Day 1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionEngineV2, NodeExecutionStatus } from './ExecutionEngineV2';
import { NodeRegistryV2 } from './NodeRegistryV2';
import type { NodeDefinition } from '@audit/shared';
import { createMockGraph, createMockNode, createMockDefinition, createMockI18n } from '../utils/testHelpers';

describe('ExecutionEngineV2', () => {
  let engine: ExecutionEngineV2;
  let registry: NodeRegistryV2;

  beforeEach(() => {
    registry = new NodeRegistryV2();
    
    // 注册加法节点
    const addNode: NodeDefinition = createMockDefinition({
      type: 'test.add',
      label: createMockI18n('加法', 'Add'),
      inputsSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['a', 'b']
      }
    }, async (inputs) => {
      return {
        outputs: {
          result: inputs.a + inputs.b
        }
      };
    });

    // 注册乘法节点
    const multiplyNode: NodeDefinition = createMockDefinition({
      type: 'test.multiply',
      label: createMockI18n('乘法', 'Multiply'),
      inputsSchema: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        },
        required: ['x', 'y']
      }
    }, async (inputs) => {
      return {
        outputs: {
          result: inputs.x * inputs.y
        }
      };
    });

    registry.register(addNode);
    registry.register(multiplyNode);
    
    engine = new ExecutionEngineV2(registry);
  });

  describe('执行计划', () => {
    it('应该创建正确的执行计划', () => {
      const graph = createMockGraph({
        nodes: new Map([
          ['A', createMockNode('A', 'test.add')],
          ['B', createMockNode('B', 'test.multiply')]
        ]),
        edges: new Map([
          ['e1', {
            id: 'e1',
            from: { nodeId: 'A', portName: 'result' },
            to: { nodeId: 'B', portName: 'x' },
            createdAt: new Date().toISOString()
          }]
        ])
      });

      const plan = engine.createExecutionPlan(graph);

      expect(plan.executionOrder).toEqual(['A', 'B']);
      expect(plan.totalNodes).toBe(2);
      expect(plan.levels.get(0)).toContain('A');
      expect(plan.levels.get(1)).toContain('B');
    });
  });

  describe('图验证', () => {
    it('应该通过有效图的验证', () => {
      const graph = createMockGraph({
        nodes: new Map([
          ['A', createMockNode('A', 'test.add')]
        ])
      });

      const validation = engine.validateGraph(graph);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该检测循环依赖', () => {
      const graph = createMockGraph({
        nodes: new Map([
          ['A', createMockNode('A', 'test.add')],
          ['B', createMockNode('B', 'test.multiply')]
        ]),
        edges: new Map([
          ['e1', {
            id: 'e1',
            from: { nodeId: 'A', portName: 'result' },
            to: { nodeId: 'B', portName: 'x' },
            createdAt: new Date().toISOString()
          }],
          ['e2', {
            id: 'e2',
            from: { nodeId: 'B', portName: 'result' },
            to: { nodeId: 'A', portName: 'a' },
            createdAt: new Date().toISOString()
          }]
        ])
      });

      const validation = engine.validateGraph(graph);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Circular dependency');
    });

    it('应该检测未注册的节点类型', () => {
      const graph = createMockGraph({
        nodes: new Map([
          ['A', createMockNode('A', 'unknown.type')]
        ])
      });

      const validation = engine.validateGraph(graph);

      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('unregistered type');
    });
  });

  describe('图执行', () => {
    it('应该成功执行简单图', async () => {
      const graph = createMockGraph({
        nodes: new Map([
          ['A', createMockNode('A', 'test.add', { a: 1, b: 2 })]
        ])
      });

      const result = await engine.executeGraph(graph);

      expect(result.success).toBe(true);
      expect(result.nodeStates.size).toBe(1);
      
      const nodeState = result.nodeStates.get('A');
      expect(nodeState?.status).toBe(NodeExecutionStatus.SUCCESS);
    });

    it('应该按拓扑顺序执行多个节点', async () => {
      const graph = createMockGraph({
        nodes: new Map([
          ['A', createMockNode('A', 'test.add', { a: 1, b: 2 })], // 1 + 2 = 3
          ['B', createMockNode('B', 'test.multiply', { y: 4 })]   // 3 * 4 = 12 (x comes from A)
        ]),
        edges: new Map([
          ['e1', {
            id: 'e1',
            from: { nodeId: 'A', portName: 'result' },
            to: { nodeId: 'B', portName: 'x' },
            createdAt: new Date().toISOString()
          }]
        ])
      });

      const result = await engine.executeGraph(graph);

      expect(result.success).toBe(true);
      
      const stateA = result.nodeStates.get('A');
      const stateB = result.nodeStates.get('B');
      
      expect(stateA?.status).toBe(NodeExecutionStatus.SUCCESS);
      expect(stateB?.status).toBe(NodeExecutionStatus.SUCCESS);
      
      expect(stateA?.startTime).toBeDefined();
      expect(stateB?.startTime).toBeDefined();
      if (stateA?.startTime && stateB?.startTime) {
        expect(stateA.startTime).toBeLessThanOrEqual(stateB.startTime);
      }
    });
  });

  describe('执行状态', () => {
    it('应该跟踪执行状态', async () => {
      const graph = createMockGraph({
        nodes: new Map([
          ['A', createMockNode('A', 'test.add')]
        ])
      });

      expect(engine.getIsExecuting()).toBe(false);

      const promise = engine.executeGraph(graph);
      
      await promise;

      expect(engine.getIsExecuting()).toBe(false);
      expect(engine.getExecutionId()).not.toBeNull();
    });
  });
});
