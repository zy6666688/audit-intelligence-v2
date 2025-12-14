"use strict";
/**
 * 图结构类型定义
 * Week 1 Day 1 - 图和连接定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphSerializer = void 0;
/**
 * 图转换工具
 */
class GraphSerializer {
    /**
     * 序列化图
     */
    static serialize(graph) {
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
    static deserialize(data) {
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
exports.GraphSerializer = GraphSerializer;
