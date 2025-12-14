<template>
  <view class="workflow-detail-page">
    <!-- 顶部工作流信息 -->
    <view class="workflow-header">
      <view class="header-content">
        <text class="workflow-name">{{ workflow?.name || '加载中...' }}</text>
        <text class="workflow-desc">{{ workflow?.description }}</text>
        <view class="workflow-meta">
          <view class="meta-item">
            <text class="meta-icon">📦</text>
            <text class="meta-text">{{ nodeCount }} 个节点</text>
          </view>
          <view class="meta-item">
            <text class="meta-icon">⏱️</text>
            <text class="meta-text">{{ avgTime }}s</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 节点流程列表（无Canvas） -->
    <scroll-view scroll-y class="nodes-container">
      <view 
        v-for="(node, index) in nodes" 
        :key="node.id"
        class="node-wrapper"
      >
        <!-- 节点卡片 -->
        <view 
          class="node-card"
          :class="getNodeClass(node)"
          @tap="onNodeTap(node)"
        >
          <!-- 左侧序号和图标 -->
          <view class="node-left">
            <view class="node-number">{{ index + 1 }}</view>
            <text class="node-icon">{{ getNodeIcon(node.type) }}</text>
          </view>
          
          <!-- 中间内容 -->
          <view class="node-content">
            <text class="node-title">{{ node.data?.title || node.type }}</text>
            <text class="node-type-text">{{ getNodeTypeName(node.type) }}</text>
            
            <!-- 执行状态 -->
            <view v-if="taskStatus" class="node-execution-status">
              <view 
                v-if="getNodeStatus(node.id) === 'completed'"
                class="status-badge status-completed"
              >
                <text class="status-icon">✅</text>
                <text class="status-text">已完成</text>
                <text class="status-time">{{ getNodeDuration(node.id) }}ms</text>
              </view>
              
              <view 
                v-else-if="getNodeStatus(node.id) === 'running'"
                class="status-badge status-running"
              >
                <text class="status-icon">🔄</text>
                <text class="status-text">运行中</text>
              </view>
              
              <view 
                v-else-if="getNodeStatus(node.id) === 'failed'"
                class="status-badge status-failed"
              >
                <text class="status-icon">❌</text>
                <text class="status-text">失败</text>
              </view>
              
              <view v-else class="status-badge status-pending">
                <text class="status-icon">⏳</text>
                <text class="status-text">等待中</text>
              </view>
            </view>
          </view>
          
          <!-- 右侧箭头 -->
          <view class="node-right">
            <text class="icon-arrow">›</text>
          </view>
        </view>
        
        <!-- 连接线（简化视觉效果，无Canvas） -->
        <view v-if="index < nodes.length - 1" class="connection-wrapper">
          <view class="connection-line"></view>
          <text class="connection-arrow">▼</text>
          <view class="connection-line"></view>
        </view>
      </view>
      
      <!-- 空状态 -->
      <view v-if="!nodes || nodes.length === 0" class="empty-state">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无节点</text>
      </view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="bottom-actions">
      <button 
        class="btn-primary" 
        :disabled="isExecuting"
        @tap="executeWorkflow"
      >
        <text v-if="!isExecuting">▶️ 执行工作流</text>
        <text v-else>
          <text class="loading-icon">⏸️</text>
          执行中 {{ progress }}%
        </text>
      </button>
      <button class="btn-secondary" @tap="showConfig">
        ⚙️ 配置
      </button>
    </view>

    <!-- 节点详情弹窗 -->
    <view v-if="showNodeDetail" class="node-detail-modal" @tap="showNodeDetail = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">{{ selectedNode?.data?.title }}</text>
          <text class="modal-close" @tap="showNodeDetail = false">✕</text>
        </view>
        <scroll-view scroll-y class="modal-body">
          <view class="detail-section">
            <text class="section-title">节点类型</text>
            <text class="section-value">{{ selectedNode?.type }}</text>
          </view>
          <view class="detail-section">
            <text class="section-title">节点ID</text>
            <text class="section-value">{{ selectedNode?.id }}</text>
          </view>
          <view v-if="taskStatus && getNodeResult(selectedNode?.id)" class="detail-section">
            <text class="section-title">执行结果</text>
            <text class="section-value result-json">
              {{ JSON.stringify(getNodeResult(selectedNode?.id), null, 2) }}
            </text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from '@vue/reactivity';
import { onLoad } from '@dcloudio/uni-app';

interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    title: string;
    [key: string]: any;
  };
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  connections: any[];
  avgExecutionTime?: number;
}

interface TaskStatus {
  taskId: string;
  status: string;
  progress: number;
  nodeResults: Record<string, any>;
}

// 状态
const workflow = ref<Workflow | null>(null);
const taskStatus = ref<TaskStatus | null>(null);
const isExecuting = ref(false);
const showNodeDetail = ref(false);
const selectedNode = ref<Node | null>(null);

// 计算属性
const nodes = computed(() => workflow.value?.nodes || []);
const nodeCount = computed(() => nodes.value.length);
const avgTime = computed(() => workflow.value?.avgExecutionTime || 0);
const progress = computed(() => taskStatus.value?.progress || 0);

// 页面加载
let workflowId = '';

onLoad((options: any) => {
  workflowId = options.id || '';
  loadWorkflow();
});

// 加载工作流
async function loadWorkflow() {
  try {
    uni.showLoading({ title: '加载中...' });
    
    const res = await uni.request({
      url: `http://localhost:3000/api/workflows/${workflowId}`,
      method: 'GET'
    });
    
    const data = res.data as any;
    if (data.code === 200) {
      workflow.value = data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error: any) {
    uni.showToast({
      title: '加载失败: ' + error.message,
      icon: 'none'
    });
  } finally {
    uni.hideLoading();
  }
}

// 执行工作流
async function executeWorkflow() {
  if (!workflow.value) return;
  
  try {
    isExecuting.value = true;
    
    // 提交任务
    const res = await uni.request({
      url: `http://localhost:3000/api/execute/workflow/${workflow.value.id}`,
      method: 'POST',
      data: {
        inputs: {},
        config: {}
      }
    });
    
    const data = res.data as any;
    if (data.code === 200) {
      const taskId = data.data.taskId;
      
      // 轮询任务状态
      await pollTaskStatus(taskId);
    }
  } catch (error: any) {
    uni.showToast({
      title: '执行失败: ' + error.message,
      icon: 'none'
    });
  } finally {
    isExecuting.value = false;
  }
}

// 轮询任务状态
async function pollTaskStatus(taskId: string) {
  const maxRetries = 60;
  let retries = 0;
  
  const poll = async () => {
    try {
      const res = await uni.request({
        url: `http://localhost:3000/api/engine/tasks/${taskId}`,
        method: 'GET'
      });
      
      const data = res.data as any;
      if (data.code === 200) {
        taskStatus.value = data.data;
        
        if (data.data.status === 'completed') {
          uni.showToast({
            title: '执行完成',
            icon: 'success'
          });
          return;
        }
        
        if (data.data.status === 'failed') {
          uni.showToast({
            title: '执行失败',
            icon: 'none'
          });
          return;
        }
        
        // 继续轮询
        if (retries < maxRetries) {
          retries++;
          setTimeout(poll, 1000);
        }
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
  };
  
  poll();
}

// 节点操作
function onNodeTap(node: Node) {
  selectedNode.value = node;
  showNodeDetail.value = true;
}

function showConfig() {
  uni.showToast({
    title: '配置功能开发中',
    icon: 'none'
  });
}

// 辅助函数
function getNodeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    'audit.voucher_analysis': '📝',
    'audit.risk_assessment': '⚠️',
    'audit.invoice_validation': '🧾',
    'data.csv_reader': '📄',
    'data.filter': '🔍',
    'simple_add': '➕',
    'simple_multiply': '✖️'
  };
  return iconMap[type] || '📦';
}

function getNodeTypeName(type: string): string {
  const nameMap: Record<string, string> = {
    'audit.voucher_analysis': '凭证分析',
    'audit.risk_assessment': '风险评估',
    'audit.invoice_validation': '发票验证',
    'data.csv_reader': 'CSV读取',
    'data.filter': '数据过滤',
    'simple_add': '加法运算',
    'simple_multiply': '乘法运算'
  };
  return nameMap[type] || type;
}

function getNodeClass(node: Node): string {
  const status = getNodeStatus(node.id);
  return status ? `node-status-${status}` : '';
}

function getNodeStatus(nodeId: string): string | null {
  if (!taskStatus.value) return null;
  return taskStatus.value.nodeResults?.[nodeId]?.status || 'pending';
}

function getNodeDuration(nodeId: string): number {
  if (!taskStatus.value) return 0;
  return taskStatus.value.nodeResults?.[nodeId]?.duration || 0;
}

function getNodeResult(nodeId: string | undefined): any {
  if (!nodeId || !taskStatus.value) return null;
  return taskStatus.value.nodeResults?.[nodeId]?.output;
}
</script>

<style lang="scss" scoped>
.workflow-detail-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 180rpx;
}

.workflow-header {
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
  margin-bottom: 20rpx;
}

.workflow-meta {
  display: flex;
  gap: 32rpx;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.meta-icon {
  font-size: 28rpx;
}

.meta-text {
  font-size: 24rpx;
  opacity: 0.9;
}

.nodes-container {
  height: calc(100vh - 380rpx);
  padding: 32rpx;
}

.node-wrapper {
  margin-bottom: 24rpx;
}

.node-card {
  background: white;
  border-radius: 16rpx;
  padding: 28rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  transition: all 0.3s;
  
  &:active {
    transform: scale(0.98);
  }
  
  &.node-status-running {
    border-left: 8rpx solid #ffc107;
  }
  
  &.node-status-completed {
    border-left: 8rpx solid #4caf50;
  }
  
  &.node-status-failed {
    border-left: 8rpx solid #f44336;
  }
}

.node-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 24rpx;
}

.node-number {
  width: 56rpx;
  height: 56rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
  margin-bottom: 12rpx;
}

.node-icon {
  font-size: 48rpx;
}

.node-content {
  flex: 1;
}

.node-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.node-type-text {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-bottom: 16rpx;
}

.node-execution-status {
  margin-top: 8rpx;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  
  &.status-completed {
    background: rgba(76, 175, 80, 0.1);
    color: #4caf50;
  }
  
  &.status-running {
    background: rgba(255, 193, 7, 0.1);
    color: #ffc107;
  }
  
  &.status-failed {
    background: rgba(244, 67, 54, 0.1);
    color: #f44336;
  }
  
  &.status-pending {
    background: rgba(158, 158, 158, 0.1);
    color: #999;
  }
}

.status-icon {
  font-size: 24rpx;
}

.node-right {
  margin-left: 16rpx;
}

.icon-arrow {
  font-size: 48rpx;
  color: #ccc;
}

.connection-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 0;
}

.connection-line {
  width: 4rpx;
  height: 20rpx;
  background: linear-gradient(180deg, #e0e0e0 0%, #ccc 100%);
}

.connection-arrow {
  font-size: 36rpx;
  color: #999;
  margin: 4rpx 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
  opacity: 0.3;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
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
  gap: 20rpx;
}

.btn-primary {
  flex: 2;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 16rpx;
  height: 96rpx;
  font-size: 30rpx;
  font-weight: 500;
  
  &:disabled {
    opacity: 0.6;
  }
}

.btn-secondary {
  flex: 1;
  background: white;
  color: #667eea;
  border: 2rpx solid #667eea;
  border-radius: 16rpx;
  height: 96rpx;
  font-size: 30rpx;
}

.loading-icon {
  display: inline-block;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.node-detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.modal-content {
  width: 100%;
  max-height: 80vh;
  background: white;
  border-radius: 32rpx 32rpx 0 0;
  overflow: hidden;
}

.modal-header {
  padding: 32rpx;
  border-bottom: 2rpx solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
}

.modal-close {
  font-size: 48rpx;
  color: #999;
}

.modal-body {
  max-height: 60vh;
  padding: 32rpx;
}

.detail-section {
  margin-bottom: 32rpx;
}

.section-title {
  font-size: 26rpx;
  color: #999;
  display: block;
  margin-bottom: 12rpx;
}

.section-value {
  font-size: 28rpx;
  color: #333;
  display: block;
  
  &.result-json {
    font-family: monospace;
    background: #f5f5f5;
    padding: 16rpx;
    border-radius: 8rpx;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
