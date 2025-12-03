<template>
  <view 
    class="node-canvas"
    :class="{ 'shift-mode': isShiftPressed }"
    @touchmove="handleCanvasTouch"
    @touchend="handleCanvasTouchEnd"
    @mousemove="handleCanvasMouseMove"
    @mousedown="handleCanvasMouseDown"
    @mouseup="handleCanvasMouseUp"
    @contextmenu="handleContextMenu"
    @click="$emit('canvas-click')"
  >
    <view 
      class="canvas-content"
      :style="{
        transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${props.zoom})`,
        transformOrigin: '0 0'
      }"
    >
    <!-- SVG连线层 -->
    <svg class="connections-layer" width="10000" height="10000">
      <defs>
        <!-- 连线箭头定义 -->
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon 
            points="0 0, 10 3, 0 6" 
            fill="#666"
          />
        </marker>
      </defs>
      
      <!-- 绘制所有连线 -->
      <path
        v-for="conn in connections"
        :key="conn.id"
        :d="getConnectionPath(conn)"
        class="connection-line"
        :class="{ selected: selectedConnection === conn.id }"
        stroke="#666"
        stroke-width="2"
        fill="none"
        marker-end="url(#arrowhead)"
        @click.stop="handleConnectionClick(conn.id)"
      />
      
      <!-- 正在绘制的临时连线 -->
      <path
        v-if="draggingConnection"
        :d="getTempConnectionPath()"
        class="connection-line temp"
        stroke="#1890ff"
        stroke-width="2"
        stroke-dasharray="5,5"
        fill="none"
      />
    </svg>

    <!-- 节点层 -->
    <view 
      class="node-item"
      v-for="node in nodes"
      :key="node.id"
      :class="{ 
        selected: node.id === selectedNodeId,
        running: runningNodes && runningNodes.has(node.id)
      }"
      :style="{
        left: node.position.x + 'px',
        top: node.position.y + 'px'
      }"
      @click.stop="$emit('node-select', node.id)"
      @touchstart.stop="handleNodeTouchStart($event, node)"
      @touchmove.stop="handleNodeTouchMove"
      @touchend.stop="handleNodeTouchEnd"
      @mousedown.stop="handleNodeMouseDown($event, node)"
    >
      <!-- 节点头部 -->
      <view class="node-header" :class="'node-type-' + node.type">
        <text class="node-icon">{{ getNodeIcon(node.type) }}</text>
        <text class="node-title">{{ node.data.title || getNodeLabel(node.type) }}</text>
        <view class="node-menu" @click.stop="handleNodeMenu(node.id)">
          <text>⋮</text>
        </view>
      </view>
      
      <!-- 输入端口 -->
      <view class="node-ports inputs">
        <view 
          class="port"
          v-for="(port, index) in getNodeInputs(node)"
          :key="port.name"
          @touchstart.stop="handlePortTouchStart($event, node.id, port.name, 'input')"
          @mousedown.stop="handlePortMouseDown($event, node.id, port.name, 'input')"
        >
          <view 
            class="port-dot"
            :style="{ background: getPortColor(port.type), borderColor: getPortColor(port.type) }"
          ></view>
          <text class="port-label" :style="{ color: getPortColor(port.type) }">{{ getPortLabel(port.type) }}</text>
        </view>
      </view>
      
      <!-- 节点内容预览 -->
      <view class="node-content">
        <text class="content-preview">
          {{ node.data.content || '点击编辑内容...' }}
        </text>
      </view>
      
      <!-- 输出端口 -->
      <view class="node-ports outputs">
        <view 
          class="port"
          v-for="(port, index) in getNodeOutputs(node)"
          :key="port.name"
          @touchstart.stop="handlePortTouchStart($event, node.id, port.name, 'output')"
          @mousedown.stop="handlePortMouseDown($event, node.id, port.name, 'output')"
        >
          <text class="port-label" :style="{ color: getPortColor(port.type) }">{{ getPortLabel(port.type) }}</text>
          <view 
            class="port-dot"
            :style="{ background: getPortColor(port.type), borderColor: getPortColor(port.type) }"
          ></view>
        </view>
      </view>
      
      <!-- AI分析状态标记 -->
      <view v-if="node.aiAnalysis" class="ai-badge" :class="'risk-' + node.aiAnalysis.riskLevel">
        <text>🤖</text>
      </view>
    </view>
    </view><!-- /canvas-content -->
    
    <!-- 拖动状态提示 -->
    <view v-if="draggingCanvas" class="drag-status">
      <text>🖐️ 拖动画布中...</text>
    </view>
    <view v-else-if="isShiftPressed" class="drag-hint">
      <text>💡 按住左键拖动画布</text>
    </view>
  </view><!-- /node-canvas -->
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getNodeDefinition, getPortColor, isValidConnection, getNodeLabel, getPortLabel, type NodeDefinition, type PortDefinition } from '@/utils/nodeRegistry';
import { t } from '@/utils/i18n';

interface Props {
  nodes: any[];
  connections: any[];
  selectedNodeId?: string;
  runningNodes?: Set<string>;
  zoom?: number;
  lang?: 'zh' | 'en';
}

const props = withDefaults(defineProps<Props>(), {
  selectedNodeId: '',
  runningNodes: () => new Set(),
  zoom: 1,
  lang: 'zh'
});

const emit = defineEmits([
  'node-select',
  'node-move',
  'node-delete',
  'connection-create',
  'connection-delete',
  'canvas-click',
  'context-menu'
]);

// 节点拖拽状态
const draggingNode = ref<string | null>(null);
const dragStartPos = ref({ x: 0, y: 0 });
const dragOffset = ref({ x: 0, y: 0 });
const tempNodePositions = ref<Map<string, { x: number; y: number }>>(new Map()); // 临时节点位置（拖动中）

// 画布平移状态
const canvasOffset = ref({ x: 0, y: 0 });
const draggingCanvas = ref(false);
const canvasDragStart = ref({ x: 0, y: 0 });
const canvasDragOffset = ref({ x: 0, y: 0 });
const isShiftPressed = ref(false); // Shift键状态

// 连线拖拽状态
const draggingConnection = ref<any>(null);
const selectedConnection = ref<string | null>(null);

// 节点图标映射
const nodeIcons: Record<string, string> = {
  voucher: '📝',
  invoice: '🧾',
  contract: '📄',
  bank_flow: '💰',
  data_analysis: '📊',
  risk_assess: '⚠️',
  anomaly_detect: '🔍',
  summary: '📋',
  conclusion: '✅'
};

const getNodeIcon = (type: string) => {
  const def = getNodeDefinition(type);
  if (def && def.icon) return def.icon;
  return nodeIcons[type] || '📦';
};

// 获取节点的所有输入端口
const getNodeInputs = (node: any): PortDefinition[] => {
  const def = getNodeDefinition(node.type);
  if (def && def.inputs) return def.inputs;
  
  if (Array.isArray(node.inputs)) {
    return node.inputs.map((p: string, i: number) => ({
      name: p,
      label: `输入${i + 1}`,
      type: 'any'
    }));
  }
  return [];
};

// 获取节点的所有输出端口
const getNodeOutputs = (node: any): PortDefinition[] => {
  const def = getNodeDefinition(node.type);
  if (def && def.outputs) return def.outputs;
  
  if (Array.isArray(node.outputs)) {
    return node.outputs.map((p: string, i: number) => ({
      name: p,
      label: `输出${i + 1}`,
      type: 'any'
    }));
  }
  return [];
};

// 节点触摸开始
const handleNodeTouchStart = (event: any, node: any) => {
  const touch = event.touches[0];
  const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
  draggingNode.value = node.id;
  dragStartPos.value = canvasPos;
  dragOffset.value = {
    x: node.position.x,
    y: node.position.y
  };
  // 初始化临时位置
  tempNodePositions.value.set(node.id, { x: node.position.x, y: node.position.y });
};

// 节点拖拽移动
const handleNodeTouchMove = (event: any) => {
  if (!draggingNode.value) return;
  
  const touch = event.touches[0];
  const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
  const deltaX = canvasPos.x - dragStartPos.value.x;
  const deltaY = canvasPos.y - dragStartPos.value.y;
  
  const newPosition = {
    x: Math.max(0, dragOffset.value.x + deltaX),
    y: Math.max(0, dragOffset.value.y + deltaY)
  };
  
  // 更新临时位置，让连线实时跟随
  tempNodePositions.value.set(draggingNode.value, newPosition);
  
  emit('node-move', {
    nodeId: draggingNode.value,
    position: newPosition
  });
};

// 节点拖拽结束
const handleNodeTouchEnd = () => {
  if (draggingNode.value) {
    tempNodePositions.value.delete(draggingNode.value); // 清除临时位置
    draggingNode.value = null;
  }
};

// ===== 鼠标事件处理（H5支持） =====

// 将屏幕坐标转换为画布坐标
const screenToCanvas = (screenX: number, screenY: number) => {
  const zoom = props.zoom || 1;
  return {
    x: (screenX - canvasOffset.value.x) / zoom,
    y: (screenY - canvasOffset.value.y) / zoom
  };
};

// 节点鼠标按下
const handleNodeMouseDown = (event: any, node: any) => {
  // 如果是中键或Shift+左键，不拖动节点，让画布拖动生效
  if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
    return; // 不阻止事件，让它冒泡到画布层
  }
  
  event.stopPropagation(); // 防止触发画布拖动
  draggingNode.value = node.id;
  const canvasPos = screenToCanvas(event.clientX, event.clientY);
  dragStartPos.value = canvasPos;
  dragOffset.value = {
    x: node.position.x,
    y: node.position.y
  };
  // 初始化临时位置
  tempNodePositions.value.set(node.id, { x: node.position.x, y: node.position.y });
};

// 节点鼠标移动
const handleNodeMouseMove = (event: any) => {
  if (!draggingNode.value) return;
  
  const deltaX = event.clientX - dragStartPos.value.x;
  const deltaY = event.clientY - dragStartPos.value.y;
  
  const newPosition = {
    x: Math.max(0, dragOffset.value.x + deltaX),
    y: Math.max(0, dragOffset.value.y + deltaY)
  };
  
  emit('node-move', {
    nodeId: draggingNode.value,
    position: newPosition
  });
};

// 节点鼠标释放
const handleNodeMouseUp = () => {
  draggingNode.value = null;
};

// 端口鼠标按下（用于连线）
const handlePortMouseDown = (event: any, nodeId: string, portId: string, portType: 'input' | 'output') => {
  // 如果是中键或Shift+左键，不创建连线，让画布拖动生效
  if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
    return; // 不阻止事件，让它冒泡到画布层
  }
  
  if (portType === 'output') {
    event.stopPropagation(); // 防止触发画布拖动
    const canvasPos = screenToCanvas(event.clientX, event.clientY);
    draggingConnection.value = {
      from: nodeId,
      fromPort: portId,
      fromPortType: getNodeOutputs(props.nodes.find(n => n.id === nodeId))?.find(p => p.name === portId)?.type || 'any',
      currentPos: canvasPos
    };
  }
};

// 画布鼠标按下（用于画布平移）
const handleCanvasMouseDown = (event: any) => {
  // 中键按下：直接启动画布拖动
  if (event.button === 1) {
    event.preventDefault();
    draggingCanvas.value = true;
    canvasDragStart.value = {
      x: event.clientX,
      y: event.clientY
    };
    canvasDragOffset.value = {
      x: canvasOffset.value.x,
      y: canvasOffset.value.y
    };
    return;
  }
  
  // Shift + 左键：启动画布拖动
  if (event.button === 0 && event.shiftKey) {
    event.preventDefault();
    draggingCanvas.value = true;
    canvasDragStart.value = {
      x: event.clientX,
      y: event.clientY
    };
    canvasDragOffset.value = {
      x: canvasOffset.value.x,
      y: canvasOffset.value.y
    };
    return;
  }
};

// 右键菜单处理
const handleContextMenu = (event: any) => {
  event.preventDefault();
  const canvasPos = screenToCanvas(event.clientX, event.clientY);
  emit('context-menu', {
    x: canvasPos.x,
    y: canvasPos.y,
    clientX: event.clientX,
    clientY: event.clientY
  });
};

// 画布鼠标移动（统一处理节点拖动、连线拖动和画布平移）
const handleCanvasMouseMove = (event: any) => {
  // 处理画布平移
  if (draggingCanvas.value) {
    const deltaX = event.clientX - canvasDragStart.value.x;
    const deltaY = event.clientY - canvasDragStart.value.y;
    
    canvasOffset.value = {
      x: canvasDragOffset.value.x + deltaX,
      y: canvasDragOffset.value.y + deltaY
    };
    return;
  }
  
  // 处理节点拖动
  if (draggingNode.value) {
    const canvasPos = screenToCanvas(event.clientX, event.clientY);
    const deltaX = canvasPos.x - dragStartPos.value.x;
    const deltaY = canvasPos.y - dragStartPos.value.y;
    
    const newPosition = {
      x: Math.max(0, dragOffset.value.x + deltaX),
      y: Math.max(0, dragOffset.value.y + deltaY)
    };
    
    // 更新临时位置，让连线实时跟随
    tempNodePositions.value.set(draggingNode.value, newPosition);
    
    emit('node-move', {
      nodeId: draggingNode.value,
      position: newPosition
    });
    return;
  }
  
  // 处理连线拖动
  if (draggingConnection.value) {
    const canvasPos = screenToCanvas(event.clientX, event.clientY);
    draggingConnection.value.currentPos = canvasPos;
  }
};

// 画布鼠标释放（处理连线连接、节点拖动结束和画布拖动结束）
const handleCanvasMouseUp = (event: any) => {
  // 处理画布拖动结束
  if (draggingCanvas.value) {
    draggingCanvas.value = false;
    return;
  }
  
  // 处理节点拖动结束
  if (draggingNode.value) {
    tempNodePositions.value.delete(draggingNode.value); // 清除临时位置
    draggingNode.value = null;
    return;
  }
  
  // 处理连线创建
  if (!draggingConnection.value) return;
  
  const canvasPos = screenToCanvas(event.clientX, event.clientY);
  const x = canvasPos.x;
  const y = canvasPos.y;
  
  // 查找落点下的输入端口
  const target = findInputPortAt(x, y);
  
  if (target) {
    // 验证连接有效性
    const sourceNode = props.nodes.find(n => n.id === draggingConnection.value.from);
    const targetNode = props.nodes.find(n => n.id === target.nodeId);
    
    if (sourceNode && targetNode) {
      // 获取端口定义以检查类型
      const sourcePorts = getNodeOutputs(sourceNode);
      const targetPorts = getNodeInputs(targetNode);
      
      const sourcePortDef = sourcePorts.find(p => p.name === draggingConnection.value.fromPort);
      const targetPortDef = targetPorts.find(p => p.name === target.portId);
      
      if (sourcePortDef && targetPortDef) {
        if (isValidConnection(sourcePortDef.type, targetPortDef.type)) {
          // 避免连接到自己
          if (sourceNode.id !== targetNode.id) {
             emit('connection-create', {
               from: sourceNode.id,
               fromPort: draggingConnection.value.fromPort,
               to: targetNode.id,
               toPort: target.portId
             });
          }
        } else {
          uni.showToast({ title: t('messages.portTypeMismatch'), icon: 'none' });
        }
      }
    }
  }
  
  draggingConnection.value = null;
};

// ===== 触摸事件处理 =====

// 端口触摸开始（用于连线）
const handlePortTouchStart = (event: any, nodeId: string, portId: string, portType: 'input' | 'output') => {
  if (portType === 'output') {
    const touch = event.touches[0];
    const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
    draggingConnection.value = {
      from: nodeId,
      fromPort: portId,
      fromPortType: getNodeOutputs(props.nodes.find(n => n.id === nodeId)).find(p => p.name === portId)?.type || 'any',
      currentPos: canvasPos
    };
  }
};

// 画布触摸处理
const handleCanvasTouch = (event: any) => {
  if (draggingConnection.value) {
    const touch = event.touches[0];
    const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
    draggingConnection.value.currentPos = canvasPos;
  }
};

// 画布触摸结束（处理连线连接）
const handleCanvasTouchEnd = (event: any) => {
  if (!draggingConnection.value) return;
  
  const touch = event.changedTouches[0];
  const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
  const x = canvasPos.x;
  const y = canvasPos.y;
  
  // 查找落点下的输入端口
  const target = findInputPortAt(x, y);
  
  if (target) {
    // 验证连接有效性
    const sourceNode = props.nodes.find(n => n.id === draggingConnection.value.from);
    const targetNode = props.nodes.find(n => n.id === target.nodeId);
    
    if (sourceNode && targetNode) {
      // 获取端口定义以检查类型
      const sourcePorts = getNodeOutputs(sourceNode);
      const targetPorts = getNodeInputs(targetNode);
      
      const sourcePortDef = sourcePorts.find(p => p.name === draggingConnection.value.fromPort);
      const targetPortDef = targetPorts.find(p => p.name === target.portId);
      
      if (sourcePortDef && targetPortDef) {
        if (isValidConnection(sourcePortDef.type, targetPortDef.type)) {
          // 避免连接到自己
          if (sourceNode.id !== targetNode.id) {
             emit('connection-create', {
               from: sourceNode.id,
               fromPort: draggingConnection.value.fromPort,
               to: targetNode.id,
               toPort: target.portId
             });
          }
        } else {
          uni.showToast({ title: t('messages.portTypeMismatch'), icon: 'none' });
        }
      }
    }
  }
  
  draggingConnection.value = null;
};

// 查找坐标处的输入端口 - 改进精度
const findInputPortAt = (x: number, y: number) => {
  // 遍历所有节点
  for (const node of props.nodes) {
    // 检查是否在节点左侧范围内（输入端口区域）
    const nodeLeft = node.position.x - 20; // 扩展点击区域
    const nodeRight = node.position.x + 60; // 输入端口左侧区域
    
    if (x >= nodeLeft && x <= nodeRight) {
      const inputs = getNodeInputs(node);
      
      if (inputs.length === 0) continue;
      
      // 精确计算每个端口的位置
      // 头部高度45px + padding 8px
      const startY = node.position.y + 45 + 8;
      
      for (let i = 0; i < inputs.length; i++) {
        const portY = startY + (i * 35);
        
        // 端口触摸区域：每个端口35px高，允许一些误差
        if (y >= portY - 5 && y <= portY + 40) {
          return { nodeId: node.id, portId: inputs[i].name };
        }
      }
    }
  }
  return null;
};

// 获取连线路径（贝塞尔曲线）- 基于实际端口位置
const getConnectionPath = (conn: any) => {
  const fromNode = props.nodes.find(n => n.id === conn.from);
  const toNode = props.nodes.find(n => n.id === conn.to);
  
  if (!fromNode || !toNode) return '';
  
  // 使用临时位置（拖动中）或实际位置
  const fromPos = tempNodePositions.value.get(conn.from) || fromNode.position;
  const toPos = tempNodePositions.value.get(conn.to) || toNode.position;
  
  // 获取输出端口位置
  const fromOutputs = getNodeOutputs(fromNode);
  const fromPortIndex = fromOutputs.findIndex(p => p.name === conn.fromPort);
  // 头部45px + 输入端口区域 + 内容区域60px + 输出端口偏移
  const fromInputs = getNodeInputs(fromNode);
  const inputSectionHeight = fromInputs.length > 0 ? fromInputs.length * 35 + 16 : 0;
  const fromPortY = 45 + inputSectionHeight + 60 + 8 + (fromPortIndex >= 0 ? fromPortIndex * 35 : 0) + 17;
  
  // 获取输入端口位置
  const toInputs = getNodeInputs(toNode);
  const toPortIndex = toInputs.findIndex(p => p.name === conn.toPort);
  const toPortY = 45 + 8 + (toPortIndex >= 0 ? toPortIndex * 35 : 0) + 17;
  
  // 起点：输出端口右侧（使用实时位置）
  const startX = fromPos.x + 260; // 节点宽度
  const startY = fromPos.y + fromPortY;
  
  // 终点：输入端口左侧（使用实时位置）
  const endX = toPos.x;
  const endY = toPos.y + toPortY;
  
  // 控制点（使曲线更平滑）
  const distance = Math.abs(endX - startX);
  const controlOffset = Math.min(distance / 2, 100);
  
  const controlX1 = startX + controlOffset;
  const controlY1 = startY;
  const controlX2 = endX - controlOffset;
  const controlY2 = endY;
  
  return `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
};

// 获取临时连线路径
const getTempConnectionPath = () => {
  if (!draggingConnection.value) return '';
  
  const fromNode = props.nodes.find(n => n.id === draggingConnection.value.from);
  if (!fromNode) return '';
  
  // 计算输出端口的实际位置
  const fromOutputs = getNodeOutputs(fromNode);
  const fromPortIndex = fromOutputs.findIndex(p => p.name === draggingConnection.value.fromPort);
  const fromInputs = getNodeInputs(fromNode);
  const inputSectionHeight = fromInputs.length > 0 ? fromInputs.length * 35 + 16 : 0;
  const fromPortY = 45 + inputSectionHeight + 60 + 8 + (fromPortIndex >= 0 ? fromPortIndex * 35 : 0) + 17;
  
  const startX = fromNode.position.x + 260;
  const startY = fromNode.position.y + fromPortY;
  const endX = draggingConnection.value.currentPos.x;
  const endY = draggingConnection.value.currentPos.y;
  
  const distance = Math.abs(endX - startX);
  const controlOffset = Math.min(distance / 2, 100);
  
  const controlX1 = startX + controlOffset;
  const controlY1 = startY;
  const controlX2 = endX - controlOffset;
  const controlY2 = endY;
  
  return `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
};

// 连线点击
const handleConnectionClick = (connectionId: string) => {
  selectedConnection.value = connectionId;
};

// 节点菜单
const handleNodeMenu = (nodeId: string) => {
  uni.showActionSheet({
    itemList: ['编辑', 'AI分析', '删除'],
    success: (res) => {
      if (res.tapIndex === 2) {
        emit('node-delete', nodeId);
      }
    }
  });
};

// 键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Shift') {
    isShiftPressed.value = true;
  }
};

const handleKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Shift') {
    isShiftPressed.value = false;
  }
};

// 生命周期
onMounted(() => {
  // 添加全局键盘监听
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }
});

onUnmounted(() => {
  // 移除全局键盘监听
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  }
});
</script>

<style lang="scss" scoped>
.node-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  cursor: default;
  
  &:active {
    cursor: grabbing;
  }
  
  /* 按住Shift键时显示抓手 */
  &.shift-mode {
    cursor: grab !important;
    
    &:active {
      cursor: grabbing !important;
    }
  }
}

// 拖动状态提示
.drag-status,
.drag-hint {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(24, 144, 255, 0.95);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 1000;
  backdrop-filter: blur(10px);
  animation: fadeInDown 0.3s ease;
}

.drag-hint {
  background: rgba(82, 196, 26, 0.95);
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.canvas-content {
  width: 10000px;
  height: 10000px;
  position: relative;
  /* 移除transition以避免拖动延迟 */
  pointer-events: none; /* 默认不接收事件，由子元素接收 */
}

.connections-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  
  .connection-line {
    pointer-events: stroke;
    transition: all 0.2s;
    cursor: pointer;
    
    &:hover {
      stroke: #1890ff;
      stroke-width: 3;
      filter: drop-shadow(0 0 4px rgba(24, 144, 255, 0.5));
    }
    
    &.selected {
      stroke: #52c41a;
      stroke-width: 3;
      filter: drop-shadow(0 0 4px rgba(82, 196, 26, 0.5));
    }
    
    &.temp {
      stroke: #1890ff;
      animation: dash 1s linear infinite;
      filter: drop-shadow(0 0 6px rgba(24, 144, 255, 0.6));
    }
  }
}

@keyframes dash {
  to {
    stroke-dashoffset: -10;
  }
}

.node-item {
  position: absolute;
  width: 260px;
  background: #2d2d2d;
  border: 2px solid #3d3d3d;
  border-radius: 8px;
  cursor: move;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  user-select: none;
  will-change: transform;
  pointer-events: auto; /* 节点接收事件 */
  
  &.selected {
    border-color: #1890ff;
    box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.2),
                0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  &.running {
    border-color: #52c41a;
    box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.2),
                0 4px 12px rgba(0, 0, 0, 0.4);
    animation: pulse 1.5s infinite;
  }
  
  &:hover {
    border-color: #4d4d4d;
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(82, 196, 26, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(82, 196, 26, 0);
  }
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #3d3d3d;
  border-radius: 6px 6px 0 0;
  
  &.node-type-voucher {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  
  &.node-type-invoice {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }
  
  &.node-type-contract {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }
  
  &.node-type-bank_flow {
    background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  }
  
  &.node-type-data_analysis {
    background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  }
  
  &.node-type-risk_assess {
    background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%);
  }
  
  &.node-type-anomaly_detect {
    background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
  }
  
  &.node-type-summary,
  &.node-type-conclusion {
    background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  }
  
  // 新增节点类型样式
  &.node-type-contract_import,
  &.node-type-contract {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }
  
  &.node-type-bankflow_import,
  &.node-type-bank_flow {
    background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  }
  
  &.node-type-real_estate_presale_fund {
    background: linear-gradient(135deg, #fa8bff 0%, #2bd2ff 90%, #2bff88 100%);
  }
  
  &.node-type-ai_contract_risk {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  }
  
  &.node-type-risk_heatmap {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }
  
  &.node-type-voucher_input {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  
  .node-icon {
    font-size: 18px;
  }
  
  .node-title {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .node-menu {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: #fff;
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
}

.node-content {
  padding: 12px;
  min-height: 60px;
  max-height: 120px;
  overflow: hidden;
  
  .content-preview {
    font-size: 12px;
    color: #aaa;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
  }
}

.node-ports {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
  
  &.inputs {
    border-top: 1px solid #3d3d3d;
  }
  
  &.outputs {
    border-top: 1px solid #3d3d3d;
  }
  
  .port {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #888;
    
    &:hover {
      color: #1890ff;
      
      .port-dot {
        background: #1890ff;
        transform: scale(1.3);
      }
    }
    
    .port-dot {
      width: 14px;
      height: 14px;
      background: #666;
      border: 2px solid #fff;
      border-radius: 50%;
      cursor: crosshair;
      transition: all 0.2s;
      box-shadow: 0 0 6px rgba(0, 0, 0, 0.3);
      
      &:active {
        transform: scale(1.5);
        box-shadow: 0 0 12px rgba(24, 144, 255, 0.6);
      }
    }
    
    .port-label {
      user-select: none;
    }
  }
  
  &.outputs .port {
    flex-direction: row-reverse;
  }
}

.ai-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  
  &.risk-low {
    background: #52c41a;
  }
  
  &.risk-medium {
    background: #ffa500;
  }
  
  &.risk-high {
    background: #ff4d4f;
  }
}
</style>
