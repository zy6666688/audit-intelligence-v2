<template>
  <view class="execute-page">
    <!-- 工作流信息 -->
    <view class="workflow-info">
      <text class="workflow-name">{{ workflow?.name }}</text>
      <text class="workflow-desc">{{ workflow?.description }}</text>
    </view>

    <!-- 执行进度 -->
    <view class="progress-section">
      <view class="progress-header">
        <text class="progress-title">执行进度</text>
        <text class="progress-percent">{{ progress }}%</text>
      </view>
      
      <!-- 进度条 -->
      <view class="progress-bar-container">
        <view 
          class="progress-bar" 
          :style="{ width: progress + '%' }"
        ></view>
      </view>
      
      <!-- 状态文本 -->
      <view class="status-text">
        <text v-if="status === 'running'" class="status-running">
          🔄 正在执行...
        </text>
        <text v-else-if="status === 'completed'" class="status-completed">
          ✅ 执行完成
        </text>
        <text v-else-if="status === 'failed'" class="status-failed">
          ❌ 执行失败
        </text>
        <text v-else class="status-pending">⏳ 准备中...</text>
      </view>
    </view>

    <!-- 节点执行列表 -->
    <scroll-view scroll-y class="nodes-list">
      <view 
        v-for="(node, index) in nodes" 
        :key="node.id"
        class="node-execute-item"
      >
        <view class="node-index">{{ index + 1 }}</view>
        
        <view class="node-content">
          <view class="node-header">
            <text class="node-icon">{{ getNodeIcon(node.type) }}</text>
            <text class="node-title">{{ node.data?.title }}</text>
          </view>
          
          <!-- 节点状态 -->
          <view class="node-status">
            <view 
              v-if="getNodeStatus(node.id) === 'completed'"
              class="status-badge completed"
            >
              <text class="status-icon">✅</text>
              <text>已完成</text>
              <text class="duration">{{ getNodeDuration(node.id) }}ms</text>
            </view>
            
            <view 
              v-else-if="getNodeStatus(node.id) === 'running'"
              class="status-badge running"
            >
              <text class="status-icon spinning">🔄</text>
              <text>执行中</text>
            </view>
            
            <view 
              v-else-if="getNodeStatus(node.id) === 'failed'"
              class="status-badge failed"
            >
              <text class="status-icon">❌</text>
              <text>失败</text>
            </view>
            
            <view v-else class="status-badge pending">
              <text class="status-icon">⏳</text>
              <text>等待中</text>
            </view>
          </view>
          
          <!-- 错误信息 -->
          <view 
            v-if="getNodeError(node.id)" 
            class="node-error"
          >
            <text class="error-label">错误:</text>
            <text class="error-text">{{ getNodeError(node.id) }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 底部操作 -->
    <view class="bottom-actions">
      <button 
        v-if="status === 'running'"
        class="btn-cancel"
        @tap="cancelExecution"
      >
        ⏸️ 取消执行
      </button>
      
      <button 
        v-if="status === 'completed'"
        class="btn-view-result"
        @tap="viewResult"
      >
        📊 查看结果
      </button>
      
      <button 
        v-if="status === 'failed'"
        class="btn-retry"
        @tap="retryExecution"
      >
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
import { onLoad, onUnload } from '@dcloudio/uni-app';

interface Node {
  id: string;
  type: string;
  data: { title: string };
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
}

interface TaskStatus {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  nodeResults: Record<string, any>;
  error?: string;
}

// 状态
const workflow = ref<Workflow | null>(null);
const taskStatus = ref<TaskStatus | null>(null);
const pollingTimer = ref<number | null>(null);

// 计算属性
const nodes = computed(() => workflow.value?.nodes || []);
const status = computed(() => taskStatus.value?.status || 'pending');
const progress = computed(() => taskStatus.value?.progress || 0);

// 页面参数
let workflowId = '';
let taskId = '';

onLoad((options: any) => {
  workflowId = options.workflowId || '';
  taskId = options.taskId || '';
  
  loadWorkflow();
  startPolling();
});

onUnload(() => {
  stopPolling();
});

// 加载工作流
async function loadWorkflow() {
  try {
    const res = await uni.request({
      url: `http://localhost:3000/api/workflows/${workflowId}`,
      method: 'GET'
    });
    
    const data = res.data as any;
    if (data.code === 200) {
      workflow.value = data.data;
    }
  } catch (error: any) {
    console.error('Load workflow failed:', error);
  }
}

// 开始轮询
function startPolling() {
  if (pollingTimer.value) return;
  
  pollTaskStatus();
  pollingTimer.value = setInterval(() => {
    pollTaskStatus();
  }, 1000) as unknown as number;
}

// 停止轮询
function stopPolling() {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value);
    pollingTimer.value = null;
  }
}

// 轮询任务状态
async function pollTaskStatus() {
  try {
    const res = await uni.request({
      url: `http://localhost:3000/api/engine/tasks/${taskId}`,
      method: 'GET'
    });
    
    const data = res.data as any;
    if (data.code === 200) {
      taskStatus.value = data.data;
      
      // 如果完成或失败，停止轮询
      if (data.data.status === 'completed' || 
          data.data.status === 'failed') {
        stopPolling();
      }
    }
  } catch (error: any) {
    console.error('Poll task failed:', error);
  }
}

// 取消执行
async function cancelExecution() {
  try {
    uni.showLoading({ title: '取消中...' });
    
    await uni.request({
      url: `http://localhost:3000/api/engine/tasks/${taskId}/cancel`,
      method: 'POST'
    });
    
    uni.showToast({
      title: '已取消',
      icon: 'success'
    });
    
    stopPolling();
    
    setTimeout(() => {
      uni.navigateBack();
    }, 1000);
  } catch (error: any) {
    uni.showToast({
      title: '取消失败',
      icon: 'none'
    });
  } finally {
    uni.hideLoading();
  }
}

// 查看结果
function viewResult() {
  uni.navigateTo({
    url: `/pages-miniapp/workflow/result?taskId=${taskId}`
  });
}

// 重新执行
async function retryExecution() {
  try {
    uni.showLoading({ title: '提交中...' });
    
    const res = await uni.request({
      url: `http://localhost:3000/api/execute/workflow/${workflowId}`,
      method: 'POST',
      data: { inputs: {}, config: {} }
    });
    
    const data = res.data as any;
    if (data.code === 200) {
      taskId = data.data.taskId;
      taskStatus.value = null;
      startPolling();
      
      uni.showToast({
        title: '已提交',
        icon: 'success'
      });
    }
  } catch (error: any) {
    uni.showToast({
      title: '提交失败',
      icon: 'none'
    });
  } finally {
    uni.hideLoading();
  }
}

// 返回
function goBack() {
  stopPolling();
  uni.navigateBack();
}

// 辅助函数
function getNodeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    'audit.voucher_analysis': '📝',
    'audit.risk_assessment': '⚠️',
    'audit.invoice_validation': '🧾',
    'simple_add': '➕'
  };
  return iconMap[type] || '📦';
}

function getNodeStatus(nodeId: string): string {
  if (!taskStatus.value) return 'pending';
  return taskStatus.value.nodeResults?.[nodeId]?.status || 'pending';
}

function getNodeDuration(nodeId: string): number {
  if (!taskStatus.value) return 0;
  return taskStatus.value.nodeResults?.[nodeId]?.duration || 0;
}

function getNodeError(nodeId: string): string | null {
  if (!taskStatus.value) return null;
  return taskStatus.value.nodeResults?.[nodeId]?.error || null;
}
</script>

<style lang="scss" scoped>
.execute-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 160rpx;
}

.workflow-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx 32rpx;
  color: white;
}

.workflow-name {
  font-size: 36rpx;
  font-weight: bold;
  display: block;
  margin-bottom: 12rpx;
}

.workflow-desc {
  font-size: 26rpx;
  opacity: 0.9;
  display: block;
}

.progress-section {
  background: white;
  padding: 32rpx;
  margin: 24rpx 32rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.progress-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}

.progress-percent {
  font-size: 32rpx;
  font-weight: bold;
  color: #667eea;
}

.progress-bar-container {
  height: 16rpx;
  background: #e0e0e0;
  border-radius: 8rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s;
}

.status-text {
  text-align: center;
  font-size: 26rpx;
}

.status-running {
  color: #ffc107;
}

.status-completed {
  color: #4caf50;
}

.status-failed {
  color: #f44336;
}

.status-pending {
  color: #999;
}

.nodes-list {
  height: calc(100vh - 540rpx);
  padding: 0 32rpx;
}

.node-execute-item {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  gap: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.node-index {
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
  flex-shrink: 0;
}

.node-content {
  flex: 1;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.node-icon {
  font-size: 32rpx;
}

.node-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}

.node-status {
  margin-top: 12rpx;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  
  &.completed {
    background: rgba(76, 175, 80, 0.1);
    color: #4caf50;
  }
  
  &.running {
    background: rgba(255, 193, 7, 0.1);
    color: #ffc107;
  }
  
  &.failed {
    background: rgba(244, 67, 54, 0.1);
    color: #f44336;
  }
  
  &.pending {
    background: rgba(158, 158, 158, 0.1);
    color: #999;
  }
}

.status-icon {
  font-size: 24rpx;
  
  &.spinning {
    animation: rotate 1s linear infinite;
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.duration {
  font-size: 20rpx;
  opacity: 0.8;
}

.node-error {
  margin-top: 12rpx;
  padding: 12rpx;
  background: rgba(244, 67, 54, 0.05);
  border-left: 4rpx solid #f44336;
  border-radius: 4rpx;
}

.error-label {
  font-size: 22rpx;
  color: #f44336;
  font-weight: 500;
  display: block;
  margin-bottom: 8rpx;
}

.error-text {
  font-size: 22rpx;
  color: #666;
  display: block;
  word-break: break-all;
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
  
  &.btn-cancel {
    background: #f44336;
    color: white;
  }
  
  &.btn-view-result {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  
  &.btn-retry {
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
