/**
 * GraphStore V2 - 节点图状态管理
 * Week 1 Day 3
 * 
 * 使用Pinia管理节点图的状态
 */

import { defineStore } from 'pinia';
import type {
  NodeId,
  EdgeId,
  NodeInstance,
  EdgeBinding,
  Viewport,
  NodeGraph,
  Position
} from '@audit/shared';

/**
 * 图状态接口
 */
interface GraphState {
  // 当前图ID
  currentGraphId: string | null;
  
  // 节点和连线（使用Map以提高查找性能）
  nodes: Map<NodeId, NodeInstance>;
  edges: Map<EdgeId, EdgeBinding>;
  
  // 选中状态
  selectedNodes: Set<NodeId>;
  selectedEdges: Set<EdgeId>;
  
  // 视口状态
  viewport: Viewport;
  
  // UI状态
  draggingNodeId: NodeId | null;
  connectingFrom: { nodeId: NodeId; portName: string } | null;
  
  // 历史记录（用于撤销/重做）
  history: GraphSnapshot[];
  historyIndex: number;
  maxHistory: number;
}

/**
 * 图快照（用于历史记录）
 */
interface GraphSnapshot {
  nodes: NodeInstance[];
  edges: EdgeBinding[];
  timestamp: number;
}

/**
 * GraphStore V2
 */
export const useGraphStoreV2 = defineStore('graphV2', {
  state: (): GraphState => ({
    currentGraphId: null,
    nodes: new Map(),
    edges: new Map(),
    selectedNodes: new Set(),
    selectedEdges: new Set(),
    viewport: {
      x: 0,
      y: 0,
      zoom: 1
    },
    draggingNodeId: null,
    connectingFrom: null,
    history: [],
    historyIndex: -1,
    maxHistory: 50
  }),
  
  getters: {
    /**
     * 获取所有节点（数组形式）
     */
    nodeList: (state): NodeInstance[] => {
      return Array.from(state.nodes.values());
    },
    
    /**
     * 获取所有连线（数组形式）
     */
    edgeList: (state): EdgeBinding[] => {
      return Array.from(state.edges.values());
    },
    
    /**
     * 获取选中的节点
     */
    selectedNodeList: (state): NodeInstance[] => {
      return Array.from(state.selectedNodes)
        .map(id => state.nodes.get(id))
        .filter(Boolean) as NodeInstance[];
    },
    
    /**
     * 获取节点数量
     */
    nodeCount: (state): number => {
      return state.nodes.size;
    },
    
    /**
     * 获取连线数量
     */
    edgeCount: (state): number => {
      return state.edges.size;
    },
    
    /**
     * 检查是否有选中的节点
     */
    hasSelection: (state): boolean => {
      return state.selectedNodes.size > 0 || state.selectedEdges.size > 0;
    },
    
    /**
     * 获取节点的输入连线
     */
    getNodeInputEdges: (state: GraphState) => (nodeId: NodeId): EdgeBinding[] => {
      return Array.from(state.edges.values()).filter(
        (edge: EdgeBinding) => edge.to.nodeId === nodeId
      );
    },
    
    /**
     * 获取节点的输出连线
     */
    getNodeOutputEdges: (state: GraphState) => (nodeId: NodeId): EdgeBinding[] => {
      return Array.from(state.edges.values()).filter(
        (edge: EdgeBinding) => edge.from.nodeId === nodeId
      );
    },
    
    /**
     * 检查是否可以撤销
     */
    canUndo: (state): boolean => {
      return state.historyIndex > 0;
    },
    
    /**
     * 检查是否可以重做
     */
    canRedo: (state): boolean => {
      return state.historyIndex < state.history.length - 1;
    }
  },
  
  actions: {
    // ==========================================
    // 节点操作
    // ==========================================
    
    /**
     * 添加节点
     */
    addNode(node: NodeInstance) {
      this.nodes.set(node.id, node);
      this.saveSnapshot();
      console.log(`✅ Node added: ${node.id} (${node.type})`);
    },
    
    /**
     * 更新节点
     */
    updateNode(nodeId: NodeId, updates: Partial<NodeInstance>) {
      const node = this.nodes.get(nodeId);
      if (node) {
        const updatedNode = {
          ...node,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        this.nodes.set(nodeId, updatedNode);
        console.log(`✅ Node updated: ${nodeId}`);
      }
    },
    
    /**
     * 删除节点
     */
    deleteNode(nodeId: NodeId) {
      // 删除节点
      this.nodes.delete(nodeId);
      
      // 删除相关连线
      const edgesToDelete: EdgeId[] = [];
      this.edges.forEach((edge, id) => {
        if (edge.from.nodeId === nodeId || edge.to.nodeId === nodeId) {
          edgesToDelete.push(id);
        }
      });
      
      edgesToDelete.forEach(id => this.edges.delete(id));
      
      // 从选中集合中移除
      this.selectedNodes.delete(nodeId);
      
      this.saveSnapshot();
      console.log(`❌ Node deleted: ${nodeId} (${edgesToDelete.length} edges removed)`);
    },
    
    /**
     * 批量删除节点
     */
    deleteNodes(nodeIds: NodeId[]) {
      nodeIds.forEach(id => this.deleteNode(id));
    },
    
    /**
     * 更新节点配置
     */
    updateNodeConfig(nodeId: NodeId, config: Record<string, any>) {
      this.updateNode(nodeId, { config });
    },
    
    /**
     * 更新节点位置
     */
    updateNodePosition(nodeId: NodeId, position: Position) {
      this.updateNode(nodeId, { position });
    },
    
    /**
     * 删除节点（别名）
     */
    removeNode(nodeId: NodeId) {
      this.deleteNode(nodeId);
    },
    
    /**
     * 批量更新节点位置
     */
    updateNodesPosition(updates: { nodeId: NodeId; position: Position }[]) {
      updates.forEach(({ nodeId, position }) => {
        this.updateNodePosition(nodeId, position);
      });
    },
    
    // ==========================================
    // 连线操作
    // ==========================================
    
    /**
     * 添加连线
     */
    addEdge(edge: EdgeBinding) {
      // 检查是否已存在相同的连线
      const exists = Array.from(this.edges.values()).some(
        (e: EdgeBinding) => e.from.nodeId === edge.from.nodeId &&
             e.from.portName === edge.from.portName &&
             e.to.nodeId === edge.to.nodeId &&
             e.to.portName === edge.to.portName
      );
      
      if (exists) {
        console.warn('⚠️  Edge already exists');
        return false;
      }
      
      this.edges.set(edge.id, edge);
      this.saveSnapshot();
      console.log(`✅ Edge added: ${edge.id}`);
      return true;
    },
    
    /**
     * 删除连线
     */
    deleteEdge(edgeId: EdgeId) {
      this.edges.delete(edgeId);
      this.selectedEdges.delete(edgeId);
      this.saveSnapshot();
      console.log(`❌ Edge deleted: ${edgeId}`);
    },
    
    /**
     * 批量删除连线
     */
    deleteEdges(edgeIds: EdgeId[]) {
      edgeIds.forEach(id => this.deleteEdge(id));
    },
    
    // ==========================================
    // 选中操作
    // ==========================================
    
    /**
     * 选中节点
     */
    selectNode(nodeId: NodeId, multi: boolean = false) {
      if (!multi) {
        this.clearSelection();
      }
      this.selectedNodes.add(nodeId);
      
      // 更新节点的selected状态
      const node = this.nodes.get(nodeId);
      if (node) {
        node.selected = true;
      }
    },
    
    /**
     * 取消选中节点
     */
    deselectNode(nodeId: NodeId) {
      this.selectedNodes.delete(nodeId);
      
      const node = this.nodes.get(nodeId);
      if (node) {
        node.selected = false;
      }
    },
    
    /**
     * 切换节点选中状态
     */
    toggleNodeSelection(nodeId: NodeId, multi: boolean = false) {
      if (this.selectedNodes.has(nodeId)) {
        this.deselectNode(nodeId);
      } else {
        this.selectNode(nodeId, multi);
      }
    },
    
    /**
     * 选中多个节点
     */
    selectNodes(nodeIds: NodeId[], multi: boolean = false) {
      if (!multi) {
        this.clearSelection();
      }
      nodeIds.forEach(id => this.selectNode(id, true));
    },
    
    /**
     * 选中矩形区域内的节点
     */
    selectNodesInRect(rect: { x: number; y: number; width: number; height: number }) {
      this.clearSelection();
      
      this.nodes.forEach((node, id) => {
        const { x, y } = node.position;
        
        if (x >= rect.x && x <= rect.x + rect.width &&
            y >= rect.y && y <= rect.y + rect.height) {
          this.selectNode(id, true);
        }
      });
    },
    
    /**
     * 选中所有节点
     */
    selectAll() {
      this.nodes.forEach((_, id) => this.selectNode(id, true));
    },
    
    /**
     * 清除选中
     */
    clearSelection() {
      this.selectedNodes.forEach(id => {
        const node = this.nodes.get(id);
        if (node) {
          node.selected = false;
        }
      });
      
      this.selectedNodes.clear();
      this.selectedEdges.clear();
    },
    
    // ==========================================
    // 视口操作
    // ==========================================
    
    /**
     * 更新视口
     */
    updateViewport(updates: Partial<Viewport>) {
      this.viewport = { ...this.viewport, ...updates };
    },
    
    /**
     * 缩放视口
     */
    zoomViewport(delta: number, center?: Position) {
      const newZoom = Math.max(0.1, Math.min(3, this.viewport.zoom + delta));
      
      // 如果提供了中心点，围绕中心点缩放
      if (center) {
        const scale = newZoom / this.viewport.zoom;
        this.viewport.x = center.x - (center.x - this.viewport.x) * scale;
        this.viewport.y = center.y - (center.y - this.viewport.y) * scale;
      }
      
      this.viewport.zoom = newZoom;
    },
    
    /**
     * 重置视口
     */
    resetViewport() {
      this.viewport = { x: 0, y: 0, zoom: 1 };
    },
    
    /**
     * 适应画布
     */
    fitView() {
      if (this.nodes.size === 0) return;
      
      // 计算所有节点的包围盒
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
      
      this.nodes.forEach(node => {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + 260); // 节点宽度
        maxY = Math.max(maxY, node.position.y + 200); // 节点高度
      });
      
      const width = maxX - minX;
      const height = maxY - minY;
      
      // 计算适合的缩放比例（假设画布大小为1000x800）
      const canvasWidth = 1000;
      const canvasHeight = 800;
      const padding = 50;
      
      const scaleX = (canvasWidth - padding * 2) / width;
      const scaleY = (canvasHeight - padding * 2) / height;
      const zoom = Math.min(scaleX, scaleY, 1);
      
      this.viewport = {
        x: -minX * zoom + padding,
        y: -minY * zoom + padding,
        zoom
      };
    },
    
    // ==========================================
    // 图操作
    // ==========================================
    
    /**
     * 加载图
     */
    loadGraph(graph: NodeGraph) {
      this.currentGraphId = graph.id;
      this.nodes = new Map(graph.nodes);
      this.edges = new Map(graph.edges);
      this.viewport = graph.viewport || { x: 0, y: 0, zoom: 1 };
      this.clearSelection();
      this.history = [];
      this.historyIndex = -1;
      this.saveSnapshot();
      console.log(`📂 Graph loaded: ${graph.id} (${this.nodes.size} nodes, ${this.edges.size} edges)`);
    },
    
    /**
     * 清空图
     */
    clearGraph() {
      this.nodes.clear();
      this.edges.clear();
      this.clearSelection();
      this.resetViewport();
      this.history = [];
      this.historyIndex = -1;
      console.log('🗑️  Graph cleared');
    },
    
    /**
     * 导出图
     */
    exportGraph(): NodeGraph {
      return {
        id: this.currentGraphId || `graph-${Date.now()}`,
        name: '未命名图',
        nodes: this.nodes,
        edges: this.edges,
        viewport: this.viewport,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'current-user'
      };
    },
    
    // ==========================================
    // 历史记录
    // ==========================================
    
    /**
     * 保存快照
     */
    saveSnapshot() {
      // 移除当前位置之后的历史
      this.history = this.history.slice(0, this.historyIndex + 1);
      
      // 添加新快照
      const snapshot: GraphSnapshot = {
        nodes: Array.from(this.nodes.values()),
        edges: Array.from(this.edges.values()),
        timestamp: Date.now()
      };
      
      this.history.push(snapshot);
      this.historyIndex++;
      
      // 限制历史记录数量
      if (this.history.length > this.maxHistory) {
        this.history.shift();
        this.historyIndex--;
      }
    },
    
    /**
     * 撤销
     */
    undo() {
      if (!this.canUndo) return;
      
      this.historyIndex--;
      this.restoreSnapshot(this.history[this.historyIndex]);
      console.log('↶ Undo');
    },
    
    /**
     * 重做
     */
    redo() {
      if (!this.canRedo) return;
      
      this.historyIndex++;
      this.restoreSnapshot(this.history[this.historyIndex]);
      console.log('↷ Redo');
    },
    
    /**
     * 恢复快照
     */
    restoreSnapshot(snapshot: GraphSnapshot) {
      this.nodes = new Map(snapshot.nodes.map(n => [n.id, n]));
      this.edges = new Map(snapshot.edges.map(e => [e.id, e]));
      this.clearSelection();
    },
    
    // ==========================================
    // 工具方法
    // ==========================================
    
    /**
     * 生成唯一ID
     */
    generateId(prefix: string = 'node'): string {
      return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },
    
    /**
     * 获取节点
     */
    getNode(nodeId: NodeId): NodeInstance | undefined {
      return this.nodes.get(nodeId);
    },
    
    /**
     * 获取连线
     */
    getEdge(edgeId: EdgeId): EdgeBinding | undefined {
      return this.edges.get(edgeId);
    },
    
    /**
     * 检查节点是否存在
     */
    hasNode(nodeId: NodeId): boolean {
      return this.nodes.has(nodeId);
    },
    
    /**
     * 检查连线是否存在
     */
    hasEdge(edgeId: EdgeId): boolean {
      return this.edges.has(edgeId);
    }
  }
});
