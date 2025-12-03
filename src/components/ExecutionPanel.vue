<template>
  <view class="execution-panel">
    <!-- 头部 -->
    <view class="panel-header">
      <text class="panel-title">执行面板</text>
      <view class="status-badge" :class="`status-${statusClass}`">
        {{ statusText }}
      </view>
    </view>

    <!-- 进度条 -->
    <view class="progress-section" v-if="executionStore.totalNodes > 0">
      <view class="progress-bar">
        <view 
          class="progress-fill" 
          :style="{ width: `${executionStore.progress}%` }"
        ></view>
      </view>
      <view class="progress-text">
        <text>{{ executionStore.completedNodes }} / {{ executionStore.totalNodes }}</text>
        <text class="progress-percent">{{ executionStore.progress }}%</text>
      </view>
    </view>

    <!-- 统计信息 -->
    <view class="stats-section" v-if="executionStore.totalNodes > 0">
      <view class="stat-item">
        <text class="stat-label">成功</text>
        <text class="stat-value success">{{ executionStore.successCount }}</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">失败</text>
        <text class="stat-value error">{{ executionStore.errorCount }}</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">耗时</text>
        <text class="stat-value">{{ formattedDuration }}</text>
      </view>
    </view>

    <!-- 节点列表 -->
    <view class="nodes-section" v-if="executionStore.executionOrder.length > 0">
      <text class="section-title">执行顺序</text>
      <scroll-view scroll-y class="nodes-list">
        <view 
          v-for="nodeId in executionStore.executionOrder" 
          :key="nodeId"
          class="node-item"
          :class="getNodeClass(nodeId)"
        >
          <view class="node-icon">{{ getNodeIcon(nodeId) }}</view>
          <text class="node-name">{{ nodeId }}</text>
          <text class="node-status">{{ getNodeStatusText(nodeId) }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 日志区域 -->
    <view class="logs-section" v-if="showLogs && executionStore.logs.length > 0">
      <view class="logs-header">
        <text class="section-title">执行日志</text>
        <button 
          class="clear-btn" 
          size="mini" 
          @click="executionStore.clearLogs"
        >
          清空
        </button>
      </view>
      <scroll-view scroll-y class="logs-list">
        <view 
          v-for="log in executionStore.logs" 
          :key="log.id"
          class="log-item"
          :class="`log-${log.level}`"
        >
          <text class="log-time">{{ formatTime(log.timestamp) }}</text>
          <text class="log-message">{{ log.message }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 控制按钮 -->
    <view class="controls-section">
      <button 
        class="control-btn" 
        type="default"
        @click="toggleLogs"
      >
        {{ showLogs ? '隐藏日志' : '显示日志' }}
      </button>
      
      <button 
        class="control-btn" 
        type="warn"
        :disabled="!executionStore.isExecuting"
        @click="executionStore.pauseExecution"
        v-if="!executionStore.isPaused"
      >
        暂停
      </button>
      
      <button 
        class="control-btn" 
        type="primary"
        :disabled="!executionStore.isPaused"
        @click="executionStore.resumeExecution"
        v-else
      >
        继续
      </button>
      
      <button 
        class="control-btn" 
        type="warn"
        :disabled="!executionStore.isExecuting"
        @click="executionStore.stopExecution"
      >
        停止
      </button>
      
      <button 
        class="control-btn" 
        type="default"
        :disabled="executionStore.isExecuting"
        @click="executionStore.reset"
      >
        重置
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useExecutionStore, NodeExecutionStatus } from '@/stores/execution';

const executionStore = useExecutionStore();
const showLogs = ref(false);

// 状态类名
const statusClass = computed(() => {
  if (executionStore.isExecuting && !executionStore.isPaused) return 'running';
  if (executionStore.isPaused) return 'paused';
  if (executionStore.isSuccess) return 'success';
  if (executionStore.isError) return 'error';
  return 'idle';
});

// 状态文本
const statusText = computed(() => {
  if (executionStore.isExecuting && !executionStore.isPaused) return '● 运行中';
  if (executionStore.isPaused) return '⏸ 已暂停';
  if (executionStore.isSuccess) return '✓ 成功';
  if (executionStore.isError) return '✗ 失败';
  return '○ 空闲';
});

// 格式化持续时间
const formattedDuration = computed(() => {
  const ms = executionStore.duration;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
});

// 获取节点类名
function getNodeClass(nodeId: string) {
  const state = executionStore.getNodeState(nodeId);
  if (!state) return '';
  return `node-${state.status}`;
}

// 获取节点图标
function getNodeIcon(nodeId: string) {
  const state = executionStore.getNodeState(nodeId);
  if (!state) return '○';
  
  switch (state.status) {
    case NodeExecutionStatus.PENDING: return '○';
    case NodeExecutionStatus.RUNNING: return '◐';
    case NodeExecutionStatus.SUCCESS: return '✓';
    case NodeExecutionStatus.ERROR: return '✗';
    case NodeExecutionStatus.SKIPPED: return '⊘';
    default: return '○';
  }
}

// 获取节点状态文本
function getNodeStatusText(nodeId: string) {
  const state = executionStore.getNodeState(nodeId);
  if (!state) return '';
  
  switch (state.status) {
    case NodeExecutionStatus.PENDING: return '等待中';
    case NodeExecutionStatus.RUNNING: return '执行中';
    case NodeExecutionStatus.SUCCESS: return '成功';
    case NodeExecutionStatus.ERROR: return '失败';
    case NodeExecutionStatus.SKIPPED: return '跳过';
    default: return '';
  }
}

// 格式化时间
function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// 切换日志显示
function toggleLogs() {
  showLogs.value = !showLogs.value;
}
</script>

<style scoped>
.execution-panel {
  display: flex;
  flex-direction: column;
  padding: 20rpx;
  background-color: #f5f5f5;
  border-radius: 12rpx;
  gap: 16rpx;
}

/* 头部 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx;
  background-color: white;
  border-radius: 8rpx;
}

.panel-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.status-badge {
  padding: 8rpx 16rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
  font-weight: 500;
}

.status-idle {
  background-color: #e0e0e0;
  color: #666;
}

.status-running {
  background-color: #e3f2fd;
  color: #1976d2;
  animation: pulse 1.5s ease-in-out infinite;
}

.status-paused {
  background-color: #fff3e0;
  color: #f57c00;
}

.status-success {
  background-color: #e8f5e9;
  color: #388e3c;
}

.status-error {
  background-color: #ffebee;
  color: #d32f2f;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 进度条 */
.progress-section {
  padding: 16rpx;
  background-color: white;
  border-radius: 8rpx;
}

.progress-bar {
  width: 100%;
  height: 16rpx;
  background-color: #e0e0e0;
  border-radius: 8rpx;
  overflow: hidden;
  margin-bottom: 12rpx;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #42a5f5, #1976d2);
  transition: width 0.3s ease;
  border-radius: 8rpx;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  color: #666;
}

.progress-percent {
  font-weight: bold;
  color: #1976d2;
}

/* 统计信息 */
.stats-section {
  display: flex;
  gap: 16rpx;
  padding: 16rpx;
  background-color: white;
  border-radius: 8rpx;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
}

.stat-value {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.stat-value.success {
  color: #388e3c;
}

.stat-value.error {
  color: #d32f2f;
}

/* 节点列表 */
.nodes-section {
  background-color: white;
  border-radius: 8rpx;
  padding: 16rpx;
  max-height: 400rpx;
  overflow: hidden;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
  display: block;
}

.nodes-list {
  max-height: 320rpx;
}

.node-item {
  display: flex;
  align-items: center;
  padding: 12rpx 16rpx;
  margin-bottom: 8rpx;
  background-color: #f5f5f5;
  border-radius: 6rpx;
  border-left: 4rpx solid #e0e0e0;
}

.node-pending {
  border-left-color: #9e9e9e;
}

.node-running {
  border-left-color: #1976d2;
  background-color: #e3f2fd;
}

.node-success {
  border-left-color: #388e3c;
  background-color: #e8f5e9;
}

.node-error {
  border-left-color: #d32f2f;
  background-color: #ffebee;
}

.node-skipped {
  border-left-color: #757575;
  opacity: 0.6;
}

.node-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
  width: 40rpx;
  text-align: center;
}

.node-name {
  flex: 1;
  font-size: 26rpx;
  color: #333;
  font-family: monospace;
}

.node-status {
  font-size: 22rpx;
  color: #666;
}

/* 日志区域 */
.logs-section {
  background-color: white;
  border-radius: 8rpx;
  padding: 16rpx;
  max-height: 400rpx;
  overflow: hidden;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.clear-btn {
  padding: 0 16rpx;
  font-size: 22rpx;
}

.logs-list {
  max-height: 320rpx;
  font-family: monospace;
}

.log-item {
  display: flex;
  padding: 8rpx 12rpx;
  margin-bottom: 4rpx;
  border-radius: 4rpx;
  font-size: 22rpx;
  line-height: 1.4;
}

.log-info {
  background-color: #f5f5f5;
}

.log-warn {
  background-color: #fff8e1;
}

.log-error {
  background-color: #ffebee;
  color: #c62828;
}

.log-time {
  color: #999;
  margin-right: 12rpx;
  flex-shrink: 0;
}

.log-message {
  flex: 1;
  word-break: break-word;
}

/* 控制按钮 */
.controls-section {
  display: flex;
  gap: 12rpx;
  padding: 16rpx;
  background-color: white;
  border-radius: 8rpx;
}

.control-btn {
  flex: 1;
  font-size: 26rpx;
}
</style>
