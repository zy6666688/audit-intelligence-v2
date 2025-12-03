<template>
  <view class="workflow-editor">
    <!-- 顶部工具栏 -->
    <view class="toolbar">
      <view class="toolbar-left">
        <button class="btn-back" @click="goBack" size="mini">
          <text class="icon">◀</text> 返回
        </button>
        <input 
          v-model="workflowName" 
          class="workflow-name-input" 
          placeholder="工作流名称"
          @blur="saveWorkflowName"
        />
      </view>
      <view class="toolbar-right">
        <button class="btn-tool" @click="showNodePalette = !showNodePalette" size="mini">
          <text class="icon">➕</text> 节点
        </button>
        <button class="btn-tool" @click="handleSave" size="mini" :disabled="saving">
          <text class="icon">💾</text> {{ saving ? '保存中...' : '保存' }}
        </button>
        <button class="btn-primary" @click="handleExecute" size="mini" :disabled="executing">
          <text class="icon">▶</text> {{ executing ? '执行中...' : '执行' }}
        </button>
      </view>
    </view>

    <!-- 主编辑区域 -->
    <view class="editor-container">
      <!-- 左侧节点面板 -->
      <view class="node-palette" v-if="showNodePalette">
        <view class="palette-header">
          <text class="palette-title">可用节点</text>
          <button class="btn-close" @click="showNodePalette = false" size="mini">✕</button>
        </view>
        <scroll-view class="palette-content" scroll-y>
          <view 
            v-for="category in nodeCategories" 
            :key="category.name"
            class="category-section"
          >
            <text class="category-title">{{ category.label }}</text>
            <view 
              v-for="node in category.nodes" 
              :key="node.type"
              class="node-item"
              @click="addNode(node)"
            >
              <text class="node-icon">{{ node.icon }}</text>
              <text class="node-label">{{ node.label }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 中央画布区域 -->
      <view class="canvas-wrapper">
        <scroll-view 
          class="canvas-scroll"
          scroll-x 
          scroll-y
          :scroll-left="scrollLeft"
          :scroll-top="scrollTop"
          @scroll="handleScroll"
        >
          <view 
            class="canvas" 
            :style="canvasStyle"
            @click="handleCanvasClick"
          >
            <!-- 网格背景 -->
            <view class="grid-background"></view>

            <!-- 连线层 -->
            <view class="edges-layer">
              <view 
                v-for="edge in edges" 
                :key="edge.id"
                class="edge"
                :style="getEdgeStyle(edge)"
                @click.stop="selectEdge(edge)"
              >
                <view class="edge-path" :class="{ selected: edge.id === selectedEdgeId }"></view>
              </view>
            </view>

            <!-- 节点层 -->
            <view class="nodes-layer">
              <view 
                v-for="node in nodes" 
                :key="node.id"
                class="node"
                :class="{ 
                  selected: node.id === selectedNodeId,
                  dragging: node.id === draggingNodeId
                }"
                :style="getNodeStyle(node)"
                @touchstart="handleNodeTouchStart(node, $event)"
                @touchmove.prevent="handleNodeTouchMove($event)"
                @touchend="handleNodeTouchEnd"
                @click.stop="selectNode(node)"
              >
                <!-- 节点主体 -->
                <view class="node-header" :style="{ backgroundColor: node.color || '#1890ff' }">
                  <text class="node-icon">{{ node.icon || '📦' }}</text>
                  <text class="node-title">{{ node.label || node.type }}</text>
                </view>
                <view class="node-body">
                  <text class="node-description">{{ node.description || '无描述' }}</text>
                </view>

                <!-- 连接点 -->
                <view class="node-ports">
                  <view 
                    class="port port-input"
                    @touchstart.stop="handlePortTouchStart(node, 'input', $event)"
                  >
                    <view class="port-dot"></view>
                  </view>
                  <view 
                    class="port port-output"
                    @touchstart.stop="handlePortTouchStart(node, 'output', $event)"
                  >
                    <view class="port-dot"></view>
                  </view>
                </view>

                <!-- 删除按钮 -->
                <view class="node-delete" @click.stop="deleteNode(node)" v-if="node.id === selectedNodeId">
                  <text>✕</text>
                </view>
              </view>
            </view>

            <!-- 临时连线 -->
            <view v-if="tempEdge" class="temp-edge" :style="getTempEdgeStyle()"></view>
          </view>
        </scroll-view>
      </view>

      <!-- 右侧属性面板 -->
      <view class="property-panel" v-if="selectedNodeId">
        <view class="panel-header">
          <text class="panel-title">节点属性</text>
          <button class="btn-close" @click="selectedNodeId = null" size="mini">✕</button>
        </view>
        <scroll-view class="panel-content" scroll-y>
          <view class="form-group">
            <text class="form-label">节点名称</text>
            <input 
              v-model="selectedNode.label" 
              class="form-input"
              placeholder="请输入节点名称"
            />
          </view>
          <view class="form-group">
            <text class="form-label">节点描述</text>
            <textarea 
              v-model="selectedNode.description" 
              class="form-textarea"
              placeholder="请输入节点描述"
            />
          </view>
          <view class="form-group">
            <text class="form-label">节点类型</text>
            <text class="form-value">{{ selectedNode.type }}</text>
          </view>
          <!-- 节点特定配置 -->
          <view class="form-group" v-if="selectedNode.config">
            <text class="form-label">配置</text>
            <view class="config-items">
              <view v-for="(value, key) in selectedNode.config" :key="key" class="config-item">
                <text class="config-key">{{ key }}:</text>
                <input 
                  v-model="selectedNode.config[key]" 
                  class="config-input"
                />
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 底部状态栏 -->
    <view class="statusbar">
      <text class="status-text">节点: {{ nodes.length }} | 连线: {{ edges.length }}</text>
      <text class="status-text" v-if="lastSaved">上次保存: {{ lastSaved }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getWorkflowDetail, updateWorkflow, executeWorkflow } from '@/api/workflow-new';

// 路由参数
const workflowId = ref('');
const workflowName = ref('新建工作流');
const lastSaved = ref('');

// 画布状态
const canvasWidth = ref(3000);
const canvasHeight = ref(2000);
const scrollLeft = ref(0);
const scrollTop = ref(0);
const zoom = ref(1);

// 节点和连线
const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);

// 选择状态
const selectedNodeId = ref<string | null>(null);
const selectedEdgeId = ref<string | null>(null);
const draggingNodeId = ref<string | null>(null);
const draggingStart = ref({ x: 0, y: 0 });

// 临时连线
const tempEdge = ref<any>(null);
const connectingFrom = ref<any>(null);

// UI状态
const showNodePalette = ref(true);
const saving = ref(false);
const executing = ref(false);

// 节点分类
const nodeCategories = ref([
  {
    name: 'data',
    label: '数据处理',
    nodes: [
      { type: 'data_input', label: '数据输入', icon: '📥', color: '#52c41a' },
      { type: 'data_transform', label: '数据转换', icon: '🔄', color: '#1890ff' },
      { type: 'data_filter', label: '数据筛选', icon: '🔍', color: '#13c2c2' },
      { type: 'data_aggregate', label: '数据聚合', icon: '📊', color: '#722ed1' },
    ]
  },
  {
    name: 'audit',
    label: '审计分析',
    nodes: [
      { type: 'risk_assessment', label: '风险评估', icon: '⚠️', color: '#fa8c16' },
      { type: 'compliance_check', label: '合规检查', icon: '✓', color: '#52c41a' },
      { type: 'anomaly_detection', label: '异常检测', icon: '🔎', color: '#f5222d' },
      { type: 'trend_analysis', label: '趋势分析', icon: '📈', color: '#1890ff' },
    ]
  },
  {
    name: 'ai',
    label: 'AI分析',
    nodes: [
      { type: 'ai_classification', label: 'AI分类', icon: '🤖', color: '#722ed1' },
      { type: 'ai_prediction', label: 'AI预测', icon: '🔮', color: '#eb2f96' },
      { type: 'ai_sentiment', label: '情感分析', icon: '💭', color: '#fa541c' },
    ]
  },
  {
    name: 'output',
    label: '输出',
    nodes: [
      { type: 'report_generator', label: '报告生成', icon: '📄', color: '#13c2c2' },
      { type: 'data_export', label: '数据导出', icon: '📤', color: '#52c41a' },
      { type: 'notification', label: '通知', icon: '🔔', color: '#faad14' },
    ]
  }
]);

// 计算属性
const selectedNode = computed(() => {
  return nodes.value.find(n => n.id === selectedNodeId.value);
});

const canvasStyle = computed(() => ({
  width: `${canvasWidth.value}px`,
  height: `${canvasHeight.value}px`,
  transform: `scale(${zoom.value})`,
  transformOrigin: '0 0'
}));

// 页面加载
onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as any;
  const options = (currentPage.options || currentPage.$page?.options || {}) as any;
  
  if (options.id) {
    workflowId.value = options.id;
    loadWorkflow();
  } else {
    // 新建工作流，添加默认节点
    addDefaultNodes();
  }
});

// 加载工作流
async function loadWorkflow() {
  try {
    const result = await getWorkflowDetail(workflowId.value) as any;
    workflowName.value = result.name;
    
    if (result.nodes) {
      nodes.value = typeof result.nodes === 'string' ? JSON.parse(result.nodes) : result.nodes;
    }
    if (result.edges) {
      edges.value = typeof result.edges === 'string' ? JSON.parse(result.edges) : result.edges;
    }
  } catch (error: any) {
    uni.showToast({
      title: '加载失败',
      icon: 'none'
    });
  }
}

// 添加默认节点
function addDefaultNodes() {
  const inputNode = {
    id: generateId(),
    type: 'data_input',
    label: '数据输入',
    icon: '📥',
    color: '#52c41a',
    position: { x: 100, y: 100 },
    config: {}
  };
  
  const outputNode = {
    id: generateId(),
    type: 'data_export',
    label: '数据导出',
    icon: '📤',
    color: '#52c41a',
    position: { x: 500, y: 100 },
    config: {}
  };
  
  nodes.value = [inputNode, outputNode];
}

// 添加节点
function addNode(nodeTemplate: any) {
  const newNode = {
    id: generateId(),
    type: nodeTemplate.type,
    label: nodeTemplate.label,
    icon: nodeTemplate.icon,
    color: nodeTemplate.color,
    position: {
      x: scrollLeft.value + 200,
      y: scrollTop.value + 200
    },
    config: {},
    description: ''
  };
  
  nodes.value.push(newNode);
  selectedNodeId.value = newNode.id;
  
  uni.showToast({
    title: '节点已添加',
    icon: 'success',
    duration: 1000
  });
}

// 删除节点
function deleteNode(node: any) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除节点"${node.label}"吗？`,
    success: (res) => {
      if (res.confirm) {
        nodes.value = nodes.value.filter(n => n.id !== node.id);
        edges.value = edges.value.filter(e => e.source !== node.id && e.target !== node.id);
        selectedNodeId.value = null;
      }
    }
  });
}

// 选择节点
function selectNode(node: any) {
  selectedNodeId.value = node.id;
  selectedEdgeId.value = null;
}

// 选择连线
function selectEdge(edge: any) {
  selectedEdgeId.value = edge.id;
  selectedNodeId.value = null;
}

// 节点拖拽
function handleNodeTouchStart(node: any, event: any) {
  draggingNodeId.value = node.id;
  const touch = event.touches[0];
  draggingStart.value = {
    x: touch.clientX - node.position.x,
    y: touch.clientY - node.position.y
  };
}

function handleNodeTouchMove(event: any) {
  if (!draggingNodeId.value) return;
  
  const node = nodes.value.find(n => n.id === draggingNodeId.value);
  if (!node) return;
  
  const touch = event.touches[0];
  node.position = {
    x: Math.max(0, touch.clientX - draggingStart.value.x),
    y: Math.max(0, touch.clientY - draggingStart.value.y)
  };
}

function handleNodeTouchEnd() {
  draggingNodeId.value = null;
}

// 连接点拖拽
function handlePortTouchStart(node: any, portType: string, event: any) {
  event.stopPropagation();
  
  connectingFrom.value = {
    nodeId: node.id,
    portType,
    startX: node.position.x + (portType === 'output' ? 260 : 0),
    startY: node.position.y + 50
  };
  
  const touch = event.touches[0];
  tempEdge.value = {
    x1: connectingFrom.value.startX,
    y1: connectingFrom.value.startY,
    x2: touch.clientX,
    y2: touch.clientY
  };
}

// 画布点击
function handleCanvasClick() {
  selectedNodeId.value = null;
  selectedEdgeId.value = null;
}

// 滚动处理
function handleScroll(event: any) {
  scrollLeft.value = event.detail.scrollLeft;
  scrollTop.value = event.detail.scrollTop;
}

// 保存工作流
async function handleSave() {
  if (saving.value) return;
  
  saving.value = true;
  try {
    const data = {
      name: workflowName.value,
      nodes: nodes.value,
      edges: edges.value,
      viewport: {
        zoom: zoom.value,
        scrollLeft: scrollLeft.value,
        scrollTop: scrollTop.value
      }
    };
    
    if (workflowId.value) {
      await updateWorkflow(workflowId.value, data);
    } else {
      // 创建新工作流的逻辑
      // const result = await createWorkflow(data);
      // workflowId.value = result.id;
    }
    
    lastSaved.value = new Date().toLocaleTimeString();
    uni.showToast({
      title: '保存成功',
      icon: 'success'
    });
  } catch (error: any) {
    uni.showToast({
      title: '保存失败',
      icon: 'none'
    });
  } finally {
    saving.value = false;
  }
}

// 保存工作流名称
function saveWorkflowName() {
  if (workflowId.value) {
    handleSave();
  }
}

// 执行工作流
async function handleExecute() {
  if (executing.value || !workflowId.value) return;
  
  executing.value = true;
  try {
    await executeWorkflow(workflowId.value, {});
    uni.showToast({
      title: '执行成功',
      icon: 'success'
    });
  } catch (error: any) {
    uni.showToast({
      title: '执行失败',
      icon: 'none'
    });
  } finally {
    executing.value = false;
  }
}

// 返回
function goBack() {
  uni.navigateBack();
}

// 工具函数
function generateId() {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getNodeStyle(node: any) {
  return {
    left: `${node.position.x}px`,
    top: `${node.position.y}px`
  };
}

function getEdgeStyle(edge: any) {
  const sourceNode = nodes.value.find(n => n.id === edge.source);
  const targetNode = nodes.value.find(n => n.id === edge.target);
  
  if (!sourceNode || !targetNode) return {};
  
  const x1 = sourceNode.position.x + 260;
  const y1 = sourceNode.position.y + 50;
  const x2 = targetNode.position.x;
  const y2 = targetNode.position.y + 50;
  
  return {
    left: `${Math.min(x1, x2)}px`,
    top: `${Math.min(y1, y2)}px`,
    width: `${Math.abs(x2 - x1)}px`,
    height: `${Math.abs(y2 - y1)}px`
  };
}

function getTempEdgeStyle() {
  if (!tempEdge.value) return {};
  
  const { x1, y1, x2, y2 } = tempEdge.value;
  return {
    left: `${Math.min(x1, x2)}px`,
    top: `${Math.min(y1, y2)}px`,
    width: `${Math.abs(x2 - x1)}px`,
    height: `${Math.abs(y2 - y1)}px`
  };
}
</script>

<style scoped>
.workflow-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f0f2f5;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-back {
  background: #fff;
  border: 1px solid #d9d9d9;
  color: #333;
}

.workflow-name-input {
  height: 32px;
  padding: 0 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  min-width: 200px;
}

.btn-tool {
  background: #fff;
  border: 1px solid #d9d9d9;
}

.btn-primary {
  background: #1890ff;
  color: #fff;
  border: none;
}

.icon {
  margin-right: 4px;
}

/* 编辑区域 */
.editor-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 节点面板 */
.node-palette {
  width: 250px;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
}

.palette-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #e8e8e8;
}

.palette-title {
  font-size: 16px;
  font-weight: bold;
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #999;
  padding: 0;
  width: 24px;
  height: 24px;
}

.palette-content {
  flex: 1;
  padding: 10px;
}

.category-section {
  margin-bottom: 20px;
}

.category-title {
  display: block;
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
  padding-left: 5px;
  font-weight: bold;
}

.node-item {
  display: flex;
  align-items: center;
  padding: 10px;
  margin-bottom: 5px;
  background: #f5f5f5;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.node-item:hover {
  background: #e6f7ff;
  transform: translateX(4px);
}

.node-icon {
  font-size: 20px;
  margin-right: 10px;
}

.node-label {
  font-size: 13px;
  color: #333;
}

/* 画布 */
.canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.canvas-scroll {
  width: 100%;
  height: 100%;
}

.canvas {
  position: relative;
  background: #fafafa;
}

.grid-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: 
    linear-gradient(to right, #e8e8e8 1px, transparent 1px),
    linear-gradient(to bottom, #e8e8e8 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}

/* 节点样式 */
.nodes-layer {
  position: relative;
  z-index: 10;
}

.node {
  position: absolute;
  width: 260px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transition: all 0.2s;
  cursor: move;
}

.node.selected {
  box-shadow: 0 4px 16px rgba(24,144,255,0.4);
  border: 2px solid #1890ff;
}

.node.dragging {
  opacity: 0.7;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.node-header {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px 8px 0 0;
  color: #fff;
}

.node-icon {
  font-size: 20px;
  margin-right: 8px;
}

.node-title {
  flex: 1;
  font-size: 14px;
  font-weight: bold;
}

.node-body {
  padding: 12px;
  min-height: 60px;
}

.node-description {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

/* 连接点 */
.node-ports {
  position: relative;
}

.port {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
}

.port-input {
  left: -8px;
}

.port-output {
  right: -8px;
}

.port-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #1890ff;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  cursor: crosshair;
}

.port-dot:hover {
  background: #40a9ff;
  transform: scale(1.2);
}

/* 删除按钮 */
.node-delete {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 24px;
  height: 24px;
  background: #ff4d4f;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* 连线 */
.edges-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
  pointer-events: none;
}

.edge {
  position: absolute;
  pointer-events: auto;
}

.edge-path {
  width: 100%;
  height: 100%;
  border: 2px solid #999;
  border-radius: 4px;
}

.edge-path.selected {
  border-color: #1890ff;
  border-width: 3px;
}

.temp-edge {
  position: absolute;
  border: 2px dashed #1890ff;
  border-radius: 4px;
  z-index: 15;
  pointer-events: none;
}

/* 属性面板 */
.property-panel {
  width: 300px;
  background: #fff;
  border-left: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #e8e8e8;
}

.panel-title {
  font-size: 16px;
  font-weight: bold;
}

.panel-content {
  flex: 1;
  padding: 15px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
}

.form-textarea {
  height: 80px;
  resize: vertical;
}

.form-value {
  display: block;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
}

.config-items {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
}

.config-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.config-key {
  width: 100px;
  font-size: 12px;
  color: #666;
}

.config-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 12px;
}

/* 状态栏 */
.statusbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 15px;
  background: #fff;
  border-top: 1px solid #e8e8e8;
  font-size: 12px;
  color: #999;
}

.status-text {
  margin-right: 20px;
}
</style>
