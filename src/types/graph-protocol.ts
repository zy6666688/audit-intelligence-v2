/**
 * 核心数据协议定义
 * 用于前后端解耦及跨端渲染
 */

// 1. 数据句柄 (Data Handle) - 替代直接的 JSON 数据传递
export type DataHandleType = 'table' | 'file' | 'json' | 'image' | 'model';

export interface DataHandle {
  type: DataHandleType;
  refId: string; // 后端存储的唯一标识 (UUID / S3 Key / DB Table Name)
  meta: {
    name?: string;
    schema?: Record<string, any>; // 数据结构定义
    rowCount?: number;
    sizeBytes?: number;
    createTime?: number;
    preview?: any[]; // 仅携带少量预览数据 (如前 10 行)
  };
}

// 2. 节点执行状态
export type NodeStatus = 'idle' | 'running' | 'success' | 'error' | 'waiting';

// 3. 统一图协议 (Unified Graph Protocol)
export interface GraphNode {
  id: string;
  type: string; // 节点类型定义
  position: { x: number; y: number };
  data: {
    label?: string;
    config: Record<string, any>; // 节点的静态配置 (阈值、Prompt等)
    inputs: Record<string, DataHandle | null>; // 运行时输入
    outputs: Record<string, DataHandle | null>; // 运行时输出
    status: NodeStatus;
    progress?: number; // 0-100
    errorMessage?: string;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string; // 输出端口名
  targetHandle: string; // 输入端口名
  type?: 'default' | 'smoothstep';
  animated?: boolean;
}

export interface GraphSchema {
  id: string;
  version: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport?: { x: number; y: number; zoom: number };
}
