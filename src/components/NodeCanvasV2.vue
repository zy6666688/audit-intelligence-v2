<!--
  NodeCanvas V2 - SVG节点画布
  Week 1 Day 4
-->

<template>
  <div class="node-canvas-container">
    <!-- SVG画布 -->
    <svg
      ref="svgRef"
      class="node-canvas"
      :viewBox="viewBoxString"
      @mousedown="handleCanvasMouseDown"
      @mousemove="handleCanvasMouseMove"
      @mouseup="handleCanvasMouseUp"
      @mouseleave="handleCanvasMouseUp"
      @wheel.prevent="handleWheel"
    >
      <!-- 定义 -->
      <defs>
        <!-- 网格图案 -->
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>
        </pattern>
        
        <!-- 大网格图案 -->
        <pattern id="grid-large" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#grid)"/>
          <rect width="100" height="100" fill="none" stroke="#d0d0d0" stroke-width="1"/>
        </pattern>
      </defs>
      
      <!-- 背景网格 -->
      <rect width="10000" height="10000" x="-5000" y="-5000" fill="url(#grid-large)" />
      
      <!-- 连线层 -->
      <g class="edges-layer">
        <path
          v-for="edge in graphStore.edgeList"
          :key="edge.id"
          :d="getEdgePath(edge)"
          fill="none"
          stroke="#999"
          stroke-width="2"
          :class="{ selected: edge.selected }"
        />
      </g>
      
      <!-- 节点层 -->
      <g class="nodes-layer">
        <g
          v-for="node in graphStore.nodeList"
          :key="node.id"
          :transform="`translate(${node.position.x}, ${node.position.y})`"
          @mousedown="handleNodeMouseDown(node.id, $event)"
          class="node-group"
          :class="{
            selected: node.selected,
            dragging: draggingNodeId === node.id
          }"
        >
          <!-- 节点阴影 -->
          <rect
            :width="260"
            :height="getNodeHeight(node)"
            rx="8"
            fill="black"
            opacity="0.1"
            transform="translate(2, 2)"
          />
          
          <!-- 节点主体 -->
          <rect
            :width="260"
            :height="getNodeHeight(node)"
            rx="8"
            fill="white"
            :stroke="node.selected ? '#ff4d4f' : '#1890ff'"
            :stroke-width="node.selected ? 3 : 2"
          />
          
          <!-- 头部区域 -->
          <rect
            :width="260"
            :height="40"
            rx="8"
            fill="#1890ff"
            opacity="0.1"
          />
          
          <!-- 节点图标 -->
          <text x="15" y="27" font-size="18">
            {{ getNodeIcon(node) }}
          </text>
          
          <!-- 节点标题 -->
          <text
            x="45"
            y="27"
            font-size="14"
            font-weight="bold"
            fill="#333"
          >
            {{ getNodeLabel(node) }}
          </text>
          
          <!-- 节点版本 -->
          <text
            x="240"
            y="27"
            text-anchor="end"
            font-size="11"
            fill="#999"
          >
            v{{ node.definition?.version || '1.0.0' }}
          </text>
          
          <!-- 分隔线 -->
          <line
            x1="10"
            y1="40"
            x2="250"
            y2="40"
            stroke="#e0e0e0"
            stroke-width="1"
          />
          
          <!-- 输入端口区域 -->
          <g class="input-ports" transform="translate(0, 55)">
            <g
              v-for="(input, idx) in getNodeInputs(node)"
              :key="input.name"
              :transform="`translate(0, ${idx * 30})`"
            >
              <!-- 端口圆点 -->
              <circle
                cx="0"
                cy="0"
                r="6"
                :fill="getPortColor(input.type)"
                stroke="white"
                stroke-width="2"
                class="port-dot"
              />
              <!-- 端口标签 -->
              <text
                x="15"
                y="4"
                font-size="12"
                fill="#666"
              >
                {{ input.label }}
              </text>
              <!-- 端口类型 -->
              <text
                x="15"
                y="16"
                font-size="10"
                fill="#999"
              >
                {{ input.type }}
              </text>
            </g>
          </g>
          
          <!-- 输出端口区域 -->
          <g class="output-ports" :transform="`translate(260, ${getOutputPortsY(node)})`">
            <g
              v-for="(output, idx) in getNodeOutputs(node)"
              :key="output.name"
              :transform="`translate(0, ${idx * 30})`"
            >
              <!-- 端口圆点 -->
              <circle
                cx="0"
                cy="0"
                r="6"
                :fill="getPortColor(output.type)"
                stroke="white"
                stroke-width="2"
                class="port-dot"
              />
              <!-- 端口标签 -->
              <text
                x="-15"
                y="4"
                text-anchor="end"
                font-size="12"
                fill="#666"
              >
                {{ output.label }}
              </text>
              <!-- 端口类型 -->
              <text
                x="-15"
                y="16"
                text-anchor="end"
                font-size="10"
                fill="#999"
              >
                {{ output.type }}
              </text>
            </g>
          </g>
        </g>
      </g>
    </svg>
    
    <!-- 工具栏 -->
    <div class="toolbar">
      <button @click="zoomIn" title="放大">🔍+</button>
      <button @click="zoomOut" title="缩小">🔍-</button>
      <button @click="fitView" title="适应画布">📐</button>
      <button @click="resetView" title="重置视图">🔄</button>
      <div class="zoom-display">{{ Math.round(graphStore.viewport.zoom * 100) }}%</div>
    </div>
    
    <!-- 状态栏 -->
    <div class="statusbar">
      <span>节点: {{ graphStore.nodeCount }}</span>
      <span>连线: {{ graphStore.edgeCount }}</span>
      <span>选中: {{ graphStore.selectedNodes.size }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGraphStoreV2 } from '@/stores/graphV2';
import type { NodeInstance, EdgeBinding } from '@audit/shared';

const graphStore = useGraphStoreV2();
const svgRef = ref<SVGSVGElement>();

// ViewBox计算
const viewBoxString = computed(() => {
  const vp = graphStore.viewport;
  const width = 1000 / vp.zoom;
  const height = 800 / vp.zoom;
  return `${-vp.x} ${-vp.y} ${width} ${height}`;
});

// ==========================================
// 节点相关
// ==========================================

function getNodeHeight(node: NodeInstance): number {
  const inputs = getNodeInputs(node).length;
  const outputs = getNodeOutputs(node).length;
  const maxPorts = Math.max(inputs, outputs);
  return 55 + maxPorts * 30 + 15;
}

function getNodeIcon(node: NodeInstance): string {
  const icons: Record<string, string> = {
    simple_add: '➕',
    simple_multiply: '✖️',
    echo: '🔊',
    voucher_input: '📋',
    amount_filter: '🔍',
  };
  return node.definition?.icon || icons[node.type] || '🔧';
}

function getNodeLabel(node: NodeInstance): string {
  return node.definition?.label?.zh || node.type;
}

function getNodeInputs(node: NodeInstance) {
  const schema = node.definition?.inputsSchema;
  if (!schema || !schema.properties) return [];
  
  return Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
    name,
    type: prop.type || 'any',
    label: prop.description || name
  }));
}

function getNodeOutputs(node: NodeInstance) {
  const schema = node.definition?.outputsSchema;
  if (!schema || !schema.properties) return [];
  
  return Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
    name,
    type: prop.type || 'any',
    label: prop.description || name
  }));
}

function getOutputPortsY(node: NodeInstance): number {
  const inputs = getNodeInputs(node).length;
  return 55 + inputs * 30;
}

function getPortColor(type: string): string {
  const colors: Record<string, string> = {
    number: '#52c41a',
    string: '#1890ff',
    boolean: '#fa8c16',
    object: '#722ed1',
    array: '#eb2f96',
    vouchers: '#ff4d4f',
    dataBlock: '#13c2c2',
  };
  return colors[type] || '#999';
}

// ==========================================
// 连线相关
// ==========================================

function getEdgePath(edge: EdgeBinding): string {
  const fromNode = graphStore.getNode(edge.from.nodeId);
  const toNode = graphStore.getNode(edge.to.nodeId);
  
  if (!fromNode || !toNode) return '';
  
  // 计算起点和终点
  const fromOutputs = getNodeOutputs(fromNode);
  const fromPortIndex = fromOutputs.findIndex(p => p.name === edge.from.portName);
  const fromY = 55 + fromPortIndex * 30;
  
  const toInputs = getNodeInputs(toNode);
  const toPortIndex = toInputs.findIndex(p => p.name === edge.to.portName);
  const toY = 55 + toPortIndex * 30;
  
  const startX = fromNode.position.x + 260;
  const startY = fromNode.position.y + fromY;
  const endX = toNode.position.x;
  const endY = toNode.position.y + toY;
  
  // 贝塞尔曲线控制点
  const distance = Math.abs(endX - startX);
  const controlOffset = Math.min(distance / 2, 100);
  
  const controlX1 = startX + controlOffset;
  const controlY1 = startY;
  const controlX2 = endX - controlOffset;
  const controlY2 = endY;
  
  return `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
}

// ==========================================
// 视口操作
// ==========================================

function zoomIn() {
  graphStore.zoomViewport(0.1);
}

function zoomOut() {
  graphStore.zoomViewport(-0.1);
}

function fitView() {
  graphStore.fitView();
}

function resetView() {
  graphStore.resetViewport();
}

function handleWheel(event: WheelEvent) {
  const delta = event.deltaY > 0 ? -0.05 : 0.05;
  
  const svg = svgRef.value;
  if (!svg) return;
  
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
  
  graphStore.zoomViewport(delta, { x: svgP.x, y: svgP.y });
}

// ==========================================
// 拖拽操作
// ==========================================

const isDragging = ref(false);
const draggingNodeId = ref<string | null>(null);
const dragStartPos = ref({ x: 0, y: 0 });
const nodeStartPos = ref({ x: 0, y: 0 });

function handleNodeMouseDown(nodeId: string, event: MouseEvent) {
  event.stopPropagation();
  
  isDragging.value = true;
  draggingNodeId.value = nodeId;
  
  const svgPos = screenToSVG(event.clientX, event.clientY);
  dragStartPos.value = svgPos;
  
  const node = graphStore.getNode(nodeId);
  if (node) {
    nodeStartPos.value = { ...node.position };
    graphStore.selectNode(nodeId, event.shiftKey);
  }
}

function handleCanvasMouseDown(event: MouseEvent) {
  // 点击空白处清除选中
  if (event.button === 0 && !event.shiftKey) {
    graphStore.clearSelection();
  }
}

function handleCanvasMouseMove(event: MouseEvent) {
  if (!isDragging.value || !draggingNodeId.value) return;
  
  const svgPos = screenToSVG(event.clientX, event.clientY);
  
  const dx = svgPos.x - dragStartPos.value.x;
  const dy = svgPos.y - dragStartPos.value.y;
  
  graphStore.updateNodePosition(draggingNodeId.value, {
    x: nodeStartPos.value.x + dx,
    y: nodeStartPos.value.y + dy
  });
}

function handleCanvasMouseUp() {
  isDragging.value = false;
  draggingNodeId.value = null;
}

// ==========================================
// 工具函数
// ==========================================

function screenToSVG(screenX: number, screenY: number): { x: number, y: number } {
  const svg = svgRef.value;
  if (!svg) return { x: 0, y: 0 };
  
  const pt = svg.createSVGPoint();
  pt.x = screenX;
  pt.y = screenY;
  const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
  
  return { x: svgP.x, y: svgP.y };
}
</script>

<style scoped lang="scss">
.node-canvas-container {
  position: relative;
  width: 100%;
  height: 600px;
  background: #fafafa;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  overflow: hidden;
}

.node-canvas {
  width: 100%;
  height: 100%;
  cursor: grab;
  
  &:active {
    cursor: grabbing;
  }
}

.node-group {
  cursor: move;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 0.95;
  }
  
  &.selected rect {
    filter: drop-shadow(0 4px 12px rgba(255, 77, 79, 0.4));
  }
  
  &.dragging {
    opacity: 0.8;
  }
}

.port-dot {
  cursor: pointer;
  transition: r 0.2s;
  
  &:hover {
    r: 8;
  }
}

.edges-layer {
  path {
    transition: stroke-width 0.2s, stroke 0.2s;
    
    &:hover {
      stroke-width: 3;
      stroke: #1890ff;
    }
    
    &.selected {
      stroke: #ff4d4f;
      stroke-width: 3;
    }
  }
}

.toolbar {
  position: absolute;
  top: 15px;
  right: 15px;
  display: flex;
  gap: 8px;
  align-items: center;
  background: white;
  padding: 8px 12px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  
  button {
    padding: 6px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s;
    
    &:hover {
      border-color: #1890ff;
      color: #1890ff;
      transform: scale(1.05);
    }
    
    &:active {
      background: #f5f5f5;
      transform: scale(0.95);
    }
  }
  
  .zoom-display {
    font-size: 12px;
    color: #666;
    padding: 0 8px;
    border-left: 1px solid #d9d9d9;
    margin-left: 4px;
  }
}

.statusbar {
  position: absolute;
  bottom: 15px;
  left: 15px;
  display: flex;
  gap: 15px;
  background: white;
  padding: 8px 16px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  color: #666;
  
  span {
    padding: 0 8px;
    border-left: 1px solid #e0e0e0;
    
    &:first-child {
      border-left: none;
      padding-left: 0;
    }
  }
}
</style>
