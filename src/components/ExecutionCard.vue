<template>
  <view class="execution-card" @click="goToDetail">
    <view class="card-header">
      <view class="execution-info">
        <text class="execution-id">任务 #{{ execution.taskId?.substring(0, 8) }}</text>
        <text class="execution-time">{{ formatTime(execution.startTime) }}</text>
      </view>
      <view class="status-badge" :class="statusClass">
        <text class="status-dot"></text>
        <text class="status-text">{{ statusText }}</text>
      </view>
    </view>

    <view class="card-body">
      <view class="workflow-name">
        <text class="workflow-icon">📋</text>
        <text class="workflow-text">{{ execution.workflowName || '未命名工作流' }}</text>
      </view>

      <!-- 进度条 (执行中) -->
      <view class="progress-section" v-if="execution.status === 'running'">
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: (execution.progress || 0) + '%' }"></view>
        </view>
        <text class="progress-text">{{ execution.progress || 0 }}%</text>
      </view>

      <!-- 执行信息 -->
      <view class="execution-meta">
        <view class="meta-item">
          <text class="meta-icon">👤</text>
          <text class="meta-text">{{ execution.userName || '系统' }}</text>
        </view>
        <view class="meta-item" v-if="execution.duration">
          <text class="meta-icon">⏱</text>
          <text class="meta-text">{{ formatDuration(execution.duration) }}</text>
        </view>
        <view class="meta-item" v-if="execution.nodeCount">
          <text class="meta-icon">🔷</text>
          <text class="meta-text">{{ execution.nodeCount }} 个节点</text>
        </view>
      </view>
    </view>

    <view class="card-footer" v-if="showActions">
      <button 
        class="btn-action" 
        @click.stop="viewDetails" 
        size="mini"
      >
        查看详情
      </button>
      <button 
        class="btn-action" 
        v-if="execution.status === 'running'"
        @click.stop="stopExecution" 
        size="mini"
      >
        停止
      </button>
      <button 
        class="btn-action" 
        v-if="execution.status === 'failed'"
        @click.stop="retryExecution" 
        size="mini"
      >
        重试
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  execution: any;
  showActions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true
});

const emit = defineEmits<{
  (e: 'view', execution: any): void;
  (e: 'stop', execution: any): void;
  (e: 'retry', execution: any): void;
}>();

// 计算属性
const statusClass = computed(() => {
  const status = props.execution.status;
  return {
    'status-pending': status === 'pending',
    'status-running': status === 'running',
    'status-completed': status === 'completed',
    'status-failed': status === 'failed'
  };
});

const statusText = computed(() => {
  const statusMap: Record<string, string> = {
    pending: '等待中',
    running: '执行中',
    completed: '已完成',
    failed: '失败'
  };
  return statusMap[props.execution.status] || props.execution.status;
});

// 事件处理
function goToDetail() {
  uni.navigateTo({
    url: `/pages/execution/monitor?taskId=${props.execution.taskId}&workflowId=${props.execution.workflowId}`
  });
}

function viewDetails() {
  emit('view', props.execution);
  goToDetail();
}

function stopExecution() {
  emit('stop', props.execution);
}

function retryExecution() {
  emit('retry', props.execution);
}

// 工具函数
function formatTime(time: string) {
  if (!time) return '-';
  const date = new Date(time);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
</script>

<style scoped>
.execution-card {
  background: #fff;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: all 0.2s;
}

.execution-card:active {
  transform: scale(0.98);
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}

/* 卡片头部 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.execution-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.execution-id {
  font-size: 13px;
  font-weight: 500;
  color: #666;
  font-family: monospace;
}

.execution-time {
  font-size: 12px;
  color: #999;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pending {
  background: #e6f7ff;
  color: #1890ff;
}

.status-pending .status-dot {
  background: #1890ff;
}

.status-running {
  background: #fff7e6;
  color: #fa8c16;
}

.status-running .status-dot {
  background: #fa8c16;
  animation: pulse 1.5s ease-in-out infinite;
}

.status-completed {
  background: #f6ffed;
  color: #52c41a;
}

.status-completed .status-dot {
  background: #52c41a;
}

.status-failed {
  background: #fff1f0;
  color: #f5222d;
}

.status-failed .status-dot {
  background: #f5222d;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 卡片主体 */
.card-body {
  margin-bottom: 12px;
}

.workflow-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.workflow-icon {
  font-size: 18px;
}

.workflow-text {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  flex: 1;
}

/* 进度条 */
.progress-section {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1890ff, #40a9ff);
  transition: width 0.3s;
  border-radius: 3px;
}

.progress-text {
  font-size: 12px;
  color: #666;
  font-weight: 500;
  min-width: 35px;
  text-align: right;
}

/* 元数据 */
.execution-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-icon {
  font-size: 14px;
}

.meta-text {
  font-size: 12px;
  color: #666;
}

/* 卡片底部 */
.card-footer {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.btn-action {
  flex: 1;
  padding: 6px 12px;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 12px;
  color: #333;
}

.btn-action:active {
  background: #e6e6e6;
}
</style>
