<template>
  <view class="execution-monitor">
    <!-- 顶部导航 -->
    <view class="header">
      <view class="header-left" @click="goBack">
        <text class="icon-back">←</text>
        <text class="title">执行监控</text>
      </view>
      <view class="header-right">
        <button class="btn-refresh" @click="refreshData" size="mini" :disabled="refreshing">
          <text class="icon">{{ refreshing ? '⟳' : '↻' }}</text> 刷新
        </button>
      </view>
    </view>

    <!-- 任务信息卡片 -->
    <view class="task-card" v-if="taskInfo">
      <view class="card-header">
        <view class="task-title">
          <text class="task-icon">📋</text>
          <text class="task-name">{{ taskInfo.workflowName }}</text>
        </view>
        <view class="status-badge" :class="statusClass">
          {{ statusText }}
        </view>
      </view>

      <view class="task-meta">
        <view class="meta-item">
          <text class="meta-label">任务ID:</text>
          <text class="meta-value">{{ taskInfo.taskId }}</text>
        </view>
        <view class="meta-item">
          <text class="meta-label">开始时间:</text>
          <text class="meta-value">{{ formatTime(taskInfo.startTime) }}</text>
        </view>
        <view class="meta-item" v-if="taskInfo.endTime">
          <text class="meta-label">结束时间:</text>
          <text class="meta-value">{{ formatTime(taskInfo.endTime) }}</text>
        </view>
        <view class="meta-item" v-if="taskInfo.duration">
          <text class="meta-label">执行时长:</text>
          <text class="meta-value">{{ formatDuration(taskInfo.duration) }}</text>
        </view>
      </view>

      <!-- 进度条 -->
      <view class="progress-section" v-if="taskInfo.status === 'running'">
        <view class="progress-header">
          <text class="progress-label">执行进度</text>
          <text class="progress-percent">{{ taskInfo.progress || 0 }}%</text>
        </view>
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: (taskInfo.progress || 0) + '%' }"></view>
        </view>
        <text class="progress-tip">{{ taskInfo.currentStep || '正在执行...' }}</text>
      </view>
    </view>

    <!-- 执行日志 -->
    <view class="logs-section">
      <view class="section-header">
        <text class="section-title">📝 执行日志</text>
        <view class="log-controls">
          <button 
            class="btn-filter" 
            :class="{ active: logLevel === 'all' }"
            @click="filterLogs('all')"
            size="mini"
          >
            全部
          </button>
          <button 
            class="btn-filter" 
            :class="{ active: logLevel === 'info' }"
            @click="filterLogs('info')"
            size="mini"
          >
            信息
          </button>
          <button 
            class="btn-filter" 
            :class="{ active: logLevel === 'warning' }"
            @click="filterLogs('warning')"
            size="mini"
          >
            警告
          </button>
          <button 
            class="btn-filter" 
            :class="{ active: logLevel === 'error' }"
            @click="filterLogs('error')"
            size="mini"
          >
            错误
          </button>
        </view>
      </view>

      <scroll-view class="logs-container" scroll-y :scroll-into-view="scrollToLog">
        <view 
          v-for="(log, index) in filteredLogs" 
          :key="index"
          :id="'log-' + index"
          class="log-item"
          :class="'log-' + log.level"
        >
          <view class="log-header">
            <text class="log-icon">{{ getLogIcon(log.level) }}</text>
            <text class="log-time">{{ formatLogTime(log.timestamp) }}</text>
            <text class="log-level">{{ log.level.toUpperCase() }}</text>
          </view>
          <text class="log-message">{{ log.message }}</text>
          <view class="log-detail" v-if="log.details">
            <text class="log-detail-text">{{ JSON.stringify(log.details, null, 2) }}</text>
          </view>
        </view>

        <!-- 空状态 -->
        <view class="empty-logs" v-if="filteredLogs.length === 0">
          <text class="empty-icon">📭</text>
          <text class="empty-text">暂无日志</text>
        </view>
      </scroll-view>
    </view>

    <!-- 执行结果 -->
    <view class="result-section" v-if="taskInfo && taskInfo.result">
      <view class="section-header">
        <text class="section-title">📊 执行结果</text>
      </view>
      <view class="result-content">
        <view v-if="taskInfo.status === 'completed'" class="result-success">
          <text class="result-icon">✅</text>
          <text class="result-text">执行成功</text>
        </view>
        <view v-else-if="taskInfo.status === 'failed'" class="result-error">
          <text class="result-icon">❌</text>
          <text class="result-text">执行失败</text>
          <text class="error-message">{{ taskInfo.error || '未知错误' }}</text>
        </view>
        
        <!-- 结果数据 -->
        <view class="result-data" v-if="taskInfo.result.data">
          <text class="data-label">输出数据:</text>
          <scroll-view class="data-scroll" scroll-y>
            <text class="data-content">{{ formatResult(taskInfo.result.data) }}</text>
          </scroll-view>
        </view>

        <!-- 统计信息 -->
        <view class="result-stats" v-if="taskInfo.result.stats">
          <view class="stat-item" v-for="(value, key) in taskInfo.result.stats" :key="key">
            <text class="stat-label">{{ key }}:</text>
            <text class="stat-value">{{ value }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="action-buttons" v-if="taskInfo">
      <button 
        class="btn-action btn-stop" 
        v-if="taskInfo.status === 'running'"
        @click="stopExecution"
        :disabled="stopping"
      >
        <text class="icon">⏹</text> {{ stopping ? '停止中...' : '停止执行' }}
      </button>
      <button 
        class="btn-action btn-retry" 
        v-if="taskInfo.status === 'failed'"
        @click="retryExecution"
        :disabled="retrying"
      >
        <text class="icon">🔄</text> {{ retrying ? '重试中...' : '重新执行' }}
      </button>
      <button 
        class="btn-action btn-download" 
        v-if="taskInfo.status === 'completed' && taskInfo.result"
        @click="downloadResult"
      >
        <text class="icon">📥</text> 下载结果
      </button>
    </view>

    <!-- 加载状态 -->
    <view class="loading-overlay" v-if="loading">
      <view class="loading-spinner">
        <text class="spinner-icon">⟳</text>
        <text class="loading-text">加载中...</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

// 路由参数
const taskId = ref('');
const workflowId = ref('');

// 状态
const loading = ref(true);
const refreshing = ref(false);
const stopping = ref(false);
const retrying = ref(false);

// 数据
const taskInfo = ref<any>(null);
const logs = ref<any[]>([]);
const logLevel = ref('all');
const scrollToLog = ref('');

// 定时刷新
let refreshTimer: any = null;

// 计算属性
const statusClass = computed(() => {
  if (!taskInfo.value) return '';
  const status = taskInfo.value.status;
  return {
    'status-pending': status === 'pending',
    'status-running': status === 'running',
    'status-completed': status === 'completed',
    'status-failed': status === 'failed'
  };
});

const statusText = computed(() => {
  if (!taskInfo.value) return '';
  const statusMap: Record<string, string> = {
    pending: '等待中',
    running: '执行中',
    completed: '已完成',
    failed: '失败'
  };
  return statusMap[taskInfo.value.status] || taskInfo.value.status;
});

const filteredLogs = computed(() => {
  if (logLevel.value === 'all') {
    return logs.value;
  }
  return logs.value.filter(log => log.level === logLevel.value);
});

// 页面加载
onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as any;
  const options = (currentPage.options || currentPage.$page?.options || {}) as any;
  
  taskId.value = options.taskId || '';
  workflowId.value = options.workflowId || '';
  
  if (taskId.value) {
    loadTaskInfo();
    startAutoRefresh();
  } else {
    loading.value = false;
    uni.showToast({
      title: '缺少任务ID',
      icon: 'none'
    });
  }
});

// 页面卸载
onUnmounted(() => {
  stopAutoRefresh();
});

// 加载任务信息
async function loadTaskInfo() {
  loading.value = true;
  
  try {
    // 模拟API调用 - 实际应该调用后端API
    // const result = await getExecutionDetail(taskId.value);
    
    // 模拟数据
    taskInfo.value = {
      taskId: taskId.value,
      workflowId: workflowId.value,
      workflowName: '数据分析工作流',
      status: 'running',
      progress: 65,
      currentStep: '正在执行数据转换节点...',
      startTime: new Date(Date.now() - 120000).toISOString(),
      duration: 120000
    };
    
    // 模拟日志
    logs.value = [
      {
        timestamp: new Date(Date.now() - 120000).toISOString(),
        level: 'info',
        message: '工作流开始执行'
      },
      {
        timestamp: new Date(Date.now() - 110000).toISOString(),
        level: 'info',
        message: '数据输入节点执行成功',
        details: { records: 1000 }
      },
      {
        timestamp: new Date(Date.now() - 90000).toISOString(),
        level: 'info',
        message: '数据筛选节点执行成功',
        details: { filtered: 850 }
      },
      {
        timestamp: new Date(Date.now() - 60000).toISOString(),
        level: 'warning',
        message: '检测到部分数据格式异常',
        details: { count: 15 }
      },
      {
        timestamp: new Date(Date.now() - 30000).toISOString(),
        level: 'info',
        message: '正在执行数据转换...'
      }
    ];
  } catch (error: any) {
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none'
    });
  } finally {
    loading.value = false;
  }
}

// 刷新数据
async function refreshData() {
  if (refreshing.value) return;
  
  refreshing.value = true;
  await loadTaskInfo();
  
  setTimeout(() => {
    refreshing.value = false;
  }, 500);
}

// 启动自动刷新
function startAutoRefresh() {
  refreshTimer = setInterval(() => {
    if (taskInfo.value && (taskInfo.value.status === 'running' || taskInfo.value.status === 'pending')) {
      loadTaskInfo();
    }
  }, 3000); // 每3秒刷新一次
}

// 停止自动刷新
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 停止执行
async function stopExecution() {
  uni.showModal({
    title: '确认停止',
    content: '确定要停止当前执行吗？',
    success: async (res) => {
      if (res.confirm) {
        stopping.value = true;
        try {
          // await stopExecutionAPI(taskId.value);
          uni.showToast({
            title: '已停止',
            icon: 'success'
          });
          await loadTaskInfo();
        } catch (error: any) {
          uni.showToast({
            title: error.message || '停止失败',
            icon: 'none'
          });
        } finally {
          stopping.value = false;
        }
      }
    }
  });
}

// 重试执行
async function retryExecution() {
  retrying.value = true;
  try {
    // await retryExecutionAPI(taskId.value);
    uni.showToast({
      title: '重新执行中',
      icon: 'success'
    });
    await loadTaskInfo();
    startAutoRefresh();
  } catch (error: any) {
    uni.showToast({
      title: error.message || '重试失败',
      icon: 'none'
    });
  } finally {
    retrying.value = false;
  }
}

// 下载结果
function downloadResult() {
  if (!taskInfo.value?.result) return;
  
  uni.showLoading({ title: '准备下载...' });
  
  // 模拟下载
  setTimeout(() => {
    uni.hideLoading();
    uni.showToast({
      title: '下载完成',
      icon: 'success'
    });
  }, 1000);
}

// 过滤日志
function filterLogs(level: string) {
  logLevel.value = level;
}

// 返回
function goBack() {
  uni.navigateBack();
}

// 工具函数
function formatTime(time: string) {
  if (!time) return '-';
  const date = new Date(time);
  return date.toLocaleString('zh-CN');
}

function formatLogTime(time: string) {
  if (!time) return '';
  const date = new Date(time);
  return date.toLocaleTimeString('zh-CN');
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分${seconds % 60}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

function getLogIcon(level: string) {
  const icons: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✅'
  };
  return icons[level] || '📝';
}

function formatResult(data: any) {
  return JSON.stringify(data, null, 2);
}
</script>

<style scoped>
.execution-monitor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

/* 头部 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-back {
  font-size: 24px;
  color: #333;
}

.title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.btn-refresh {
  background: #fff;
  border: 1px solid #d9d9d9;
  color: #333;
}

.icon {
  margin-right: 4px;
}

/* 任务卡片 */
.task-card {
  margin: 15px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.task-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-icon {
  font-size: 24px;
}

.task-name {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending {
  background: #e6f7ff;
  color: #1890ff;
}

.status-running {
  background: #fff7e6;
  color: #fa8c16;
}

.status-completed {
  background: #f6ffed;
  color: #52c41a;
}

.status-failed {
  background: #fff1f0;
  color: #f5222d;
}

.task-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.meta-item {
  display: flex;
  gap: 10px;
}

.meta-label {
  font-size: 13px;
  color: #999;
  min-width: 70px;
}

.meta-value {
  font-size: 13px;
  color: #333;
  flex: 1;
}

/* 进度 */
.progress-section {
  padding-top: 15px;
  border-top: 1px solid #f0f0f0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 13px;
  color: #666;
}

.progress-percent {
  font-size: 14px;
  font-weight: bold;
  color: #1890ff;
}

.progress-bar {
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1890ff, #40a9ff);
  transition: width 0.3s;
  border-radius: 4px;
}

.progress-tip {
  font-size: 12px;
  color: #999;
}

/* 日志区域 */
.logs-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin: 0 15px 15px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #f0f0f0;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.log-controls {
  display: flex;
  gap: 5px;
}

.btn-filter {
  padding: 4px 10px;
  background: #fff;
  border: 1px solid #d9d9d9;
  font-size: 12px;
  color: #666;
}

.btn-filter.active {
  background: #1890ff;
  border-color: #1890ff;
  color: #fff;
}

.logs-container {
  flex: 1;
  padding: 10px 15px;
}

.log-item {
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: #fafafa;
  border-left: 3px solid #d9d9d9;
}

.log-info {
  border-left-color: #1890ff;
}

.log-warning {
  border-left-color: #fa8c16;
  background: #fff7e6;
}

.log-error {
  border-left-color: #f5222d;
  background: #fff1f0;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.log-icon {
  font-size: 14px;
}

.log-time {
  font-size: 11px;
  color: #999;
}

.log-level {
  font-size: 11px;
  color: #666;
  font-weight: 500;
}

.log-message {
  font-size: 13px;
  color: #333;
  line-height: 1.5;
}

.log-detail {
  margin-top: 8px;
  padding: 8px;
  background: #fff;
  border-radius: 4px;
}

.log-detail-text {
  font-size: 11px;
  font-family: monospace;
  color: #666;
  white-space: pre-wrap;
  word-break: break-all;
}

.empty-logs {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 10px;
  opacity: 0.3;
}

.empty-text {
  font-size: 14px;
  color: #999;
}

/* 结果区域 */
.result-section {
  margin: 0 15px 15px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.result-content {
  padding: 15px;
}

.result-success,
.result-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 15px;
}

.result-success {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}

.result-error {
  background: #fff1f0;
  border: 1px solid #ffa39e;
}

.result-icon {
  font-size: 24px;
}

.result-text {
  font-size: 16px;
  font-weight: bold;
}

.error-message {
  font-size: 13px;
  color: #f5222d;
  margin-top: 5px;
}

.result-data {
  margin-top: 15px;
}

.data-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  display: block;
}

.data-scroll {
  max-height: 200px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
}

.data-content {
  font-size: 12px;
  font-family: monospace;
  color: #333;
  white-space: pre-wrap;
  word-break: break-all;
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 15px;
}

.stat-item {
  padding: 10px;
  background: #f5f5f5;
  border-radius: 6px;
}

.stat-label {
  font-size: 12px;
  color: #999;
  display: block;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 10px;
  padding: 15px;
  background: #fff;
  border-top: 1px solid #e8e8e8;
}

.btn-action {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  border: none;
}

.btn-stop {
  background: #ff4d4f;
  color: #fff;
}

.btn-retry {
  background: #1890ff;
  color: #fff;
}

.btn-download {
  background: #52c41a;
  color: #fff;
}

/* 加载状态 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.spinner-icon {
  font-size: 48px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 14px;
  color: #666;
}
</style>
