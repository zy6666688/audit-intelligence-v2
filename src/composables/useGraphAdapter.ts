import { ref, computed } from 'vue';
import type { NodeInstance, EdgeBinding } from '@audit/shared';
import type { GraphSchema, GraphNode, GraphEdge } from '@/types/graph-protocol';

/**
 * 图数据适配器
 * 负责将业务数据模型转换为渲染引擎可用的标准图模型
 */
export function useGraphAdapter() {
  
  // 将业务节点转换为渲染节点
  const toGraphNode = (node: NodeInstance): GraphNode => {
    return {
      id: node.id,
      type: node.type,
      position: node.position || { x: 0, y: 0 },
      data: {
        label: (node.config as any)?.title || node.type,
        config: node.config || {},
        inputs: {},  // 运行时填充
        outputs: {}, // 运行时填充
        status: 'idle'
      }
    };
  };

  // 将业务连线转换为渲染连线
  const toGraphEdge = (conn: EdgeBinding): GraphEdge => {
    return {
      id: `edge_${conn.from.nodeId}_${conn.from.portName}_to_${conn.to.nodeId}_${conn.to.portName}`,
      source: conn.from.nodeId,
      target: conn.to.nodeId,
      sourceHandle: conn.from.portName,
      targetHandle: conn.to.portName,
      type: 'smoothstep',
      animated: true
    };
  };

  // 批量转换
  const transformToGraph = (nodes: NodeInstance[], connections: EdgeBinding[]): GraphSchema => {
    return {
      id: 'graph_' + Date.now(),
      version: '1.0.0',
      nodes: nodes.map(toGraphNode),
      edges: connections.map(toGraphEdge)
    };
  };

  // 反向同步：当画布发生变化时，更新业务数据
  const syncFromGraph = (graph: GraphSchema) => {
    const nodes: Partial<NodeInstance>[] = graph.nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      config: n.data.config
    }));
    
    // TODO: 转换 Edges 回 EdgeBinding
    return nodes;
  };

  return {
    toGraphNode,
    toGraphEdge,
    transformToGraph,
    syncFromGraph
  };
}
