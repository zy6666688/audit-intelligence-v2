/**
 * 图结构类型定义
 * Week 1 Day 1 - 图和连接定义
 */
import type { NodeId, EdgeId, NodeManifest } from './node';
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
/**
 * 节点实例（运行时）
 */
export interface NodeInstance {
    id: NodeId;
    type: string;
    position: Position;
    config: Record<string, any>;
    definition?: NodeManifest;
    selected?: boolean;
    locked?: boolean;
    collapsed?: boolean;
    status?: NodeStatus;
    lastExecutionResult?: any;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
}
/**
 * 节点状态
 */
export type NodeStatus = 'idle' | 'running' | 'success' | 'error' | 'cached';
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
    from: PortRef;
    to: PortRef;
    selected?: boolean;
    animated?: boolean;
    createdAt: string;
    createdBy?: string;
}
/**
 * 节点图
 */
export interface NodeGraph {
    id: string;
    name: string;
    description?: string;
    nodes: Map<NodeId, NodeInstance>;
    edges: Map<EdgeId, EdgeBinding>;
    viewport?: Viewport;
    version: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    tags?: string[];
    permissions?: GraphPermissions;
}
/**
 * 视口状态
 */
export interface Viewport {
    x: number;
    y: number;
    zoom: number;
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
/**
 * 图序列化格式（用于保存和传输）
 */
export interface SerializedGraph {
    id: string;
    name: string;
    description?: string;
    version: string;
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
export declare class GraphSerializer {
    /**
     * 序列化图
     */
    static serialize(graph: NodeGraph): SerializedGraph;
    /**
     * 反序列化图
     */
    static deserialize(data: SerializedGraph): NodeGraph;
}
