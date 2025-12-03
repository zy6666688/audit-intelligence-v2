/**
 * 图结构类型定义
 * Week 1 Day 1 - 图和连接定义
 */

import type { NodeId, EdgeId, NodeManifest } from './node';

// ==========================================
// 位置和几何
// ==========================================

/**
 * 2D位置
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 尺寸
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * 矩形区域
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ==========================================
// 节点实例
// ==========================================

/**
 * 节点实例（运行时）
 */
export interface NodeInstance {
  id: NodeId;
  type: string;                    // 节点类型（对应NodeManifest.type）
  position: Position;              // 画布位置
  config: Record<string, any>;     // 节点配置
  definition?: NodeManifest;       // 节点定义（可选，由Registry填充）
  
  // UI状态
  selected?: boolean;
  locked?: boolean;
  collapsed?: boolean;
  
  // 执行状态
  status?: NodeStatus;
  lastExecutionResult?: any;
  
  // 元数据
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * 节点状态
 */
export type NodeStatus = 
  | 'idle'          // 空闲
  | 'running'       // 执行中
  | 'success'       // 成功
  | 'error'         // 错误
  | 'cached';       // 缓存命中

// ==========================================
// 连接
// ==========================================

/**
 * 端口引用
 */
export interface PortRef {
  nodeId: NodeId;
  portName: string;
}

/**
 * 边/连接
 */
export interface EdgeBinding {
  id: EdgeId;
  from: PortRef;               // 输出端口
  to: PortRef;                 // 输入端口
  
  // UI状态
  selected?: boolean;
  animated?: boolean;
  
  // 元数据
  createdAt: string;
  createdBy?: string;
}

// ==========================================
// 图
// ==========================================

/**
 * 节点图
 */
export interface NodeGraph {
  id: string;
  name: string;
  description?: string;
  
  // 图数据
  nodes: Map<NodeId, NodeInstance>;
  edges: Map<EdgeId, EdgeBinding>;
  
  // 视口状态
  viewport?: Viewport;
  
  // 元数据
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags?: string[];
  
  // 权限
  permissions?: GraphPermissions;
}

/**
 * 视口状态
 */
export interface Viewport {
  x: number;           // 偏移量
  y: number;
  zoom: number;        // 缩放比例（1.0 = 100%）
}

/**
 * 图权限
 */
export interface GraphPermissions {
  owner: string;
  editors: string[];
  viewers: string[];
  public: boolean;
}

// ==========================================
// 序列化格式
// ==========================================

/**
 * 图序列化格式（用于保存和传输）
 */
export interface SerializedGraph {
  id: string;
  name: string;
  description?: string;
  version: string;
  
  // 使用数组而不是Map（JSON兼容）
  nodes: NodeInstance[];
  edges: EdgeBinding[];
  
  viewport?: Viewport;
  
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags?: string[];
}

/**
 * 图转换工具
 */
export class GraphSerializer {
  /**
   * 序列化图
   */
  static serialize(graph: NodeGraph): SerializedGraph {
    return {
      id: graph.id,
      name: graph.name,
      description: graph.description,
      version: graph.version,
      nodes: Array.from(graph.nodes.values()),
      edges: Array.from(graph.edges.values()),
      viewport: graph.viewport,
      createdAt: graph.createdAt,
      updatedAt: graph.updatedAt,
      createdBy: graph.createdBy,
      tags: graph.tags
    };
  }
  
  /**
   * 反序列化图
   */
  static deserialize(data: SerializedGraph): NodeGraph {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      version: data.version,
      nodes: new Map(data.nodes.map(n => [n.id, n])),
      edges: new Map(data.edges.map(e => [e.id, e])),
      viewport: data.viewport,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      createdBy: data.createdBy,
      tags: data.tags
    };
  }
}
