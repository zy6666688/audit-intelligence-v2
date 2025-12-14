<template>
  <view class="property-panel">
    <view class="panel-header">
      <text class="title">属性面板</text>
    </view>

    <view class="panel-content">
      <!-- 未选中状态 -->
      <view v-if="!selectedNode" class="empty-state">
        <text class="empty-icon">📋</text>
        <text class="empty-text">选择节点查看属性</text>
      </view>

      <!-- 已选中节点 -->
      <view v-else class="node-properties">
        <!-- 基本信息 -->
        <view class="section">
          <text class="section-title">基本信息</text>
          <view class="property-item">
            <text class="property-label">节点ID</text>
            <text class="property-value mono">{{ selectedNode.id }}</text>
          </view>
          <view class="property-item">
            <text class="property-label">节点类型</text>
            <text class="property-value">{{ selectedNode.type }}</text>
          </view>
          <view class="property-item">
            <text class="property-label">位置</text>
            <text class="property-value mono">
              ({{ selectedNode.position.x }}, {{ selectedNode.position.y }})
            </text>
          </view>
        </view>

        <!-- 配置项 -->
        <view class="section">
          <text class="section-title">配置</text>
          <view 
            v-for="(value, key) in selectedNode.config"
            :key="key"
            class="property-item"
          >
            <text class="property-label">{{ key }}</text>
            <input
              class="property-input"
              :value="value"
              @input="updateConfig(key, $event)"
            />
          </view>
          
          <view v-if="Object.keys(selectedNode.config || {}).length === 0" class="empty-hint">
            <text>暂无配置项</text>
          </view>
        </view>

        <!-- 输入端口 -->
        <view class="section">
          <text class="section-title">输入端口</text>
          <view 
            v-for="port in inputPorts"
            :key="port.name"
            class="port-item"
          >
            <view class="port-dot input-port"></view>
            <text class="port-name">{{ port.name }}</text>
            <text class="port-type">{{ port.type }}</text>
          </view>
          
          <view v-if="inputPorts.length === 0" class="empty-hint">
            <text>无输入端口</text>
          </view>
        </view>

        <!-- 输出端口 -->
        <view class="section">
          <text class="section-title">输出端口</text>
          <view 
            v-for="port in outputPorts"
            :key="port.name"
            class="port-item"
          >
            <view class="port-dot output-port"></view>
            <text class="port-name">{{ port.name }}</text>
            <text class="port-type">{{ port.type }}</text>
          </view>
          
          <view v-if="outputPorts.length === 0" class="empty-hint">
            <text>无输出端口</text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view class="section actions">
          <button 
            class="action-btn delete-btn"
            size="mini"
            @click="handleDelete"
          >
            删除节点
          </button>
          <button 
            class="action-btn"
            size="mini"
            @click="handleDuplicate"
          >
            复制节点
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStoreV2 } from '@/stores/graphV2';
import type { NodeInstance } from '@audit/shared';

const graphStore = useGraphStoreV2();

// 选中的节点
const selectedNode = computed<NodeInstance | undefined>(() => {
  const selectedIds = Array.from(graphStore.selectedNodes);
  if (selectedIds.length !== 1) return undefined;
  
  const nodeId = selectedIds[0];
  return graphStore.nodes.get(nodeId);
});

// 输入端口
const inputPorts = computed(() => {
  if (!selectedNode.value) return [];
  
  // TODO: 从NodeManifest获取端口定义
  return [
    { name: 'input', type: 'any' }
  ];
});

// 输出端口
const outputPorts = computed(() => {
  if (!selectedNode.value) return [];
  
  // TODO: 从NodeManifest获取端口定义
  return [
    { name: 'output', type: 'any' }
  ];
});

// 更新配置
function updateConfig(key: string, event: any) {
  if (!selectedNode.value) return;
  
  const value = event.detail.value || event.target.value;
  graphStore.updateNodeConfig(selectedNode.value.id, {
    ...selectedNode.value.config,
    [key]: value
  });
}

// 删除节点
function handleDelete() {
  if (!selectedNode.value) return;
  
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这个节点吗？',
    success: (res) => {
      if (res.confirm && selectedNode.value) {
        graphStore.removeNode(selectedNode.value.id);
      }
    }
  });
}

// 复制节点
function handleDuplicate() {
  if (!selectedNode.value) return;
  
  const newNode: NodeInstance = {
    ...selectedNode.value,
    id: graphStore.generateId('node'),
    position: {
      x: selectedNode.value.position.x + 20,
      y: selectedNode.value.position.y + 20
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  graphStore.addNode(newNode);
  
  uni.showToast({
    title: '节点已复制',
    icon: 'success'
  });
}
</script>

<style scoped>
.property-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-left: 1px solid #e0e0e0;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.title {
  font-size: 16px;
  font-weight: bold;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 14px;
  color: #999;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

.property-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.property-label {
  width: 80px;
  font-size: 13px;
  color: #666;
}

.property-value {
  flex: 1;
  font-size: 13px;
  color: #333;
}

.property-value.mono {
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.property-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.port-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  padding: 6px;
  background: #f9f9f9;
  border-radius: 4px;
}

.port-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
}

.port-dot.input-port {
  background: #52c41a;
}

.port-dot.output-port {
  background: #1890ff;
}

.port-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
}

.port-type {
  font-size: 11px;
  color: #999;
}

.empty-hint {
  padding: 12px;
  text-align: center;
  color: #999;
  font-size: 12px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
}

.delete-btn {
  color: #ff4d4f;
  border-color: #ff4d4f;
}
</style>
