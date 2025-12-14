<template>
  <view class="result-page">
    <!-- 执行结果头部 -->
    <view class="result-header" :class="`status-${status}`">
      <view class="result-icon-container">
        <text class="result-icon">{{ statusIcon }}</text>
      </view>
      <text class="result-title">{{ statusTitle }}</text>
      <text class="result-subtitle">{{ statusSubtitle }}</text>
    </view>

    <!-- 统计信息 -->
    <view class="stats-section">
      <view class="stat-card">
        <text class="stat-value">{{ totalDuration }}s</text>
        <text class="stat-label">执行时长</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ completedNodes }}</text>
        <text class="stat-label">完成节点</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ failedNodes }}</text>
        <text class="stat-label">失败节点</text>
      </view>
    </view>

    <!-- 节点结果列表 -->
    <view class="section-header">
      <text class="section-title">节点执行详情</text>
    </view>
    
    <scroll-view scroll-y class="results-list">
      <view 
        v-for="(node, index) in nodes" 
        :key="node.id"
        class="result-item"
        @tap="toggleNodeDetail(node.id)"
      >
        <view class="result-item-header">
          <view class="node-info">
            <text class="node-number">{{ index + 1 }}</text>
            <text class="node-icon">{{ getNodeIcon(node.type) }}</text>
            <view class="node-text">
              <text class="node-title">{{ node.data?.title }}</text>
              <text class="node-type">{{ node.type }}</text>
            </view>
          </view>
          
          <view class="node-status-badge" :class="`status-${getNodeStatus(node.id)}`">
            <text>{{ getStatusText(getNodeStatus(node.id)) }}</text>
          </view>
        </view>
        
        <!-- 执行信息 -->
        <view class="node-meta">
          <text class="meta-item">⏱️ {{ getNodeDuration(node.id) }}ms</text>
          <text v-if="getNodeStatus(node.id) === 'failed'" class="meta-item error">
            ❌ {{ getNodeError(node.id) }}
          </text>
        </view>
        
        <!-- 展开的详细结果 -->
        <view 
          v-if="expandedNodes.includes(node.id) && getNodeOutput(node.id)" 
          class="node-output"
        >
          <text class="output-label">输出结果:</text>
          <text class="output-content">
            {{ JSON.stringify(getNodeOutput(node.id), null, 2) }}
          </text>
        </view>
      </view>
      
      <!-- 空状态 -->
      <view v-if="nodes.length === 0" class="empty-state">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无执行结果</text>
      </view>
    </scroll-view>

    <!-- 最终输出结果 -->
    <view v-if="finalOutput" class="final-output-section">
      <view class="section-header">
        <text class="section-title">最终输出</text>
      </view>
      <view class="final-output-card">
        <text class="output-content">
          {{ JSON.stringify(finalOutput, null, 2) }}
        </text>
      </view>
    </view>

    <!-- 底部操作 -->
    <view class="bottom-actions">
      <button class="btn-export" @tap="exportResult">
        📤 导出结果
      </button>
      <button class="btn-rerun" @tap="rerun">
        🔄 重新执行
      </button>
      <button class="btn-back" @tap="goBack">
        返回
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from '@vue/reactivity';
import { onLoad } from '@dcloudio/uni-app';

interface Node {
  id: string;
  type: string;
  data: { title: string };
}

interface TaskResult {
  taskId: string;
  workflowId: string;
  status: 'completed' | 'failed';
  progress: number;
  startTime: number;
  endTime: number;
  nodeResults: Record<string, any>;
  result?: any;
  error?: string;
}

// 状态
const taskResult = ref<TaskResult | null>(null);
const expandedNodes = ref<string[]>([]);

// 计算属性
const status = computed(() => taskResult.value?.status || 'pending');
const nodes = computed(() => {
  if (!taskResult.value) return [];
  return Object.keys(taskResult.value.nodeResults || {}).map(nodeId => ({
    id: nodeId,
    type: taskResult.value!.nodeResults[nodeId].type || '',
    data: { title: taskResult.value!.nodeResults[nodeId].title || nodeId }
  }));
});

const statusIcon = computed(() => {
  return status.value === 'completed' ? '✅' : '❌';
});

const statusTitle = computed(() => {
  return status.value === 'completed' ? '执行成功' : '执行失败';
});

const statusSubtitle = computed(() => {
  if (!taskResult.value) return '';
  const duration = ((taskResult.value.endTime - taskResult.value.startTime) / 1000).toFixed(2);
  return status.value === 'completed' 
    ? `所有节点执行完成，耗时 ${duration}s`
    : `执行过程中出现错误`;
});

const totalDuration = computed(() => {
  if (!taskResult.value) return '0';
  return ((taskResult.value.endTime - taskResult.value.startTime) / 1000).toFixed(2);
});

const completedNodes = computed(() => {
  if (!taskResult.value) return 0;
  return Object.values(taskResult.value.nodeResults).filter(
    (result: any) => result.status === 'completed'
  ).length;
});

const failedNodes = computed(() => {
  if (!taskResult.value) return 0;
  return Object.values(taskResult.value.nodeResults).filter(
    (result: any) => result.status === 'failed'
  ).length;
});

const finalOutput = computed(() => taskResult.value?.result);

// 页面参数
let taskId = '';

onLoad((options: any) => {
  taskId = options.taskId || '';
  loadResult();
});

// 加载结果
async function loadResult() {
  try {
    uni.showLoading({ title: '加载中...' });
    
    const res = await uni.request({
      url: `http://localhost:3000/api/engine/tasks/${taskId}`,
      method: 'GET'
    });
    
    const data = res.data as any;
    if (data.code === 200) {
      taskResult.value = data.data;
    }
  } catch (error: any) {
    uni.showToast({
      title: '加载失败',
      icon: 'none'
    });
  } finally {
    uni.hideLoading();
  }
}

// 切换节点详情
function toggleNodeDetail(nodeId: string) {
  const index = expandedNodes.value.indexOf(nodeId);
  if (index > -1) {
    expandedNodes.value.splice(index, 1);
  } else {
    expandedNodes.value.push(nodeId);
  }
}

// 导出结果
function exportResult() {
  uni.showToast({
    title: '导出功能开发中',
    icon: 'none'
  });
}

// 重新执行
function rerun() {
  if (!taskResult.value) return;
  
  uni.navigateTo({
    url: `/pages-miniapp/workflow/detail?id=${taskResult.value.workflowId}`
  });
}

// 返回
function goBack() {
  uni.navigateBack();
}

// 辅助函数
function getNodeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    'audit.voucher_analysis': '📝',
    'audit.risk_assessment': '⚠️',
    'simple_add': '➕'
  };
  return iconMap[type] || '📦';
}

function getNodeStatus(nodeId: string): string {
  if (!taskResult.value) return 'pending';
  return taskResult.value.nodeResults?.[nodeId]?.status || 'pending';
}

function getNodeDuration(nodeId: string): number {
  if (!taskResult.value) return 0;
  return taskResult.value.nodeResults?.[nodeId]?.duration || 0;
}

function getNodeError(nodeId: string): string {
  if (!taskResult.value) return '';
  return taskResult.value.nodeResults?.[nodeId]?.error || '';
}

function getNodeOutput(nodeId: string): any {
  if (!taskResult.value) return null;
  return taskResult.value.nodeResults?.[nodeId]?.output;
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    completed: '完成',
    failed: '失败',
    running: '运行中',
    pending: '等待中'
  };
  return map[status] || status;
}
</script>

<style lang="scss" scoped>
.result-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 160rpx;
}

.result-header {
  padding: 60rpx 32rpx;
  text-align: center;
  
  &.status-completed {
    background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
  }
  
  &.status-failed {
    background: linear-gradient(135deg, #f44336 0%, #c62828 100%);
  }
}

.result-icon-container {
  margin-bottom: 20rpx;
}

.result-icon {
  font-size: 120rpx;
}

.result-title {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: white;
  margin-bottom: 12rpx;
}

.result-subtitle {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.9);
}

.stats-section {
  display: flex;
  gap: 20rpx;
  padding: 32rpx;
}

.stat-card {
  flex: 1;
  background: white;
  border-radius: 16rpx;
  padding: 28rpx 20rpx;
  text-align: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.06);
}

.stat-value {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 8rpx;
}

.stat-label {
  display: block;
  font-size: 24rpx;
  color: #999;
}

.section-header {
  padding: 20rpx 32rpx 16rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}

.results-list {
  height: calc(100vh - 680rpx);
  padding: 0 32rpx;
}

.result-item {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.result-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.node-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex: 1;
}

.node-number {
  width: 48rpx;
  height: 48rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
}

.node-icon {
  font-size: 40rpx;
}

.node-text {
  flex: 1;
}

.node-title {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 4rpx;
}

.node-type {
  display: block;
  font-size: 22rpx;
  color: #999;
}

.node-status-badge {
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  
  &.status-completed {
    background: rgba(76, 175, 80, 0.1);
    color: #4caf50;
  }
  
  &.status-failed {
    background: rgba(244, 67, 54, 0.1);
    color: #f44336;
  }
}

.node-meta {
  display: flex;
  gap: 24rpx;
  padding-top: 16rpx;
  border-top: 2rpx solid #f5f5f5;
}

.meta-item {
  font-size: 22rpx;
  color: #666;
  
  &.error {
    color: #f44336;
  }
}

.node-output {
  margin-top: 16rpx;
  padding: 16rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
}

.output-label {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-bottom: 8rpx;
}

.output-content {
  display: block;
  font-family: monospace;
  font-size: 22rpx;
  color: #333;
  white-space: pre-wrap;
  word-break: break-all;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 120rpx;
  opacity: 0.3;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.final-output-section {
  padding: 0 32rpx 32rpx;
}

.final-output-card {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.06);
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: white;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
  display: flex;
  gap: 16rpx;
}

button {
  flex: 1;
  height: 88rpx;
  border-radius: 12rpx;
  border: none;
  font-size: 28rpx;
  
  &.btn-export {
    background: #667eea;
    color: white;
  }
  
  &.btn-rerun {
    background: #ffc107;
    color: white;
  }
  
  &.btn-back {
    background: white;
    color: #666;
    border: 2rpx solid #e0e0e0;
  }
}
</style>
