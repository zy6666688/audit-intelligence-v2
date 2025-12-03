import type { 
  NodeGraph, NodeInstance, NodeManifest, 
  NodeDefinition, NodeCategory, I18nString,
  ExecutionContext, NodeExecuteFn
} from '@audit/shared';

/**
 * 创建 Mock I18nString
 */
export function createMockI18n(zh: string = '测试', en: string = 'Test'): I18nString {
  return { zh, en };
}

/**
 * 创建 Mock NodeManifest
 */
export function createMockManifest(overrides: Partial<NodeManifest> = {}): NodeManifest {
  return {
    type: 'test-node',
    version: '1.0.0',
    category: 'utility', // 确保是有效的 NodeCategory
    label: createMockI18n('测试节点', 'Test Node'),
    description: createMockI18n('用于测试的节点', 'Node for testing'),
    inputsSchema: {},
    outputsSchema: {},
    capabilities: [],
    ...overrides
  };
}

/**
 * 创建 Mock NodeDefinition
 */
export function createMockDefinition(
  manifestOverrides: Partial<NodeManifest> = {},
  execute: NodeExecuteFn = async () => ({})
): NodeDefinition {
  return {
    manifest: createMockManifest(manifestOverrides),
    execute
  };
}

/**
 * 创建 Mock NodeInstance
 */
export function createMockNode(id: string, type: string = 'test-node', config: any = {}): NodeInstance {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    config,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // createdBy 是可选的，但为了完整性可以加上
    createdBy: 'test-user' 
  };
}

/**
 * 创建 Mock NodeGraph
 */
export function createMockGraph(overrides: Partial<NodeGraph> = {}): NodeGraph {
  return {
    id: 'test-graph',
    name: 'Test Graph',
    version: '1.0.0',
    nodes: new Map(),
    edges: new Map(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test-user', // 必须字段
    ...overrides
  };
}

/**
 * 创建 Mock ExecutionContext
 */
export function createMockContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    executionId: 'exec-1',
    nodeId: 'node-1',
    graphId: 'graph-1',
    userId: 'user-1',
    ...overrides
  };
}
