<template>
  <view class="workflow-list-page">
    <!-- 顶部搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrapper">
        <text class="search-icon">🔍</text>
        <input 
          class="search-input" 
          placeholder="搜索工作流..."
          v-model="searchKeyword"
          @input="onSearch"
        />
      </view>
    </view>

    <!-- 分类标签 -->
    <scroll-view scroll-x class="category-tabs">
      <view 
        v-for="category in categories"
        :key="category.id"
        class="category-tab"
        :class="{ active: currentCategory === category.id }"
        @tap="selectCategory(category.id)"
      >
        <text class="category-icon">{{ category.icon }}</text>
        <text class="category-name">{{ category.name }}</text>
      </view>
    </scroll-view>

    <!-- 工作流列表 -->
    <scroll-view 
      scroll-y 
      class="workflow-list"
      @scrolltolower="loadMore"
    >
      <view 
        v-for="workflow in filteredWorkflows"
        :key="workflow.id"
        class="workflow-card"
        @tap="gotoDetail(workflow.id)"
      >
        <!-- 卡片头部 -->
        <view class="card-header">
          <view class="workflow-icon">
            {{ getCategoryIcon(workflow.category) }}
          </view>
          <view class="workflow-info">
            <text class="workflow-name">{{ workflow.name }}</text>
            <text class="workflow-category">{{ workflow.category }}</text>
          </view>
          <view v-if="workflow.isPublic" class="public-badge">
            <text>公开</text>
          </view>
        </view>

        <!-- 描述 -->
        <text class="workflow-desc">{{ workflow.description }}</text>

        <!-- 统计信息 -->
        <view class="workflow-stats">
          <view class="stat-item">
            <text class="stat-icon">📦</text>
            <text class="stat-value">{{ workflow.nodeCount }} 节点</text>
          </view>
          <view class="stat-item">
            <text class="stat-icon">⚡</text>
            <text class="stat-value">{{ workflow.executionCount }} 次</text>
          </view>
          <view class="stat-item">
            <text class="stat-icon">⏱️</text>
            <text class="stat-value">{{ workflow.avgExecutionTime }}s</text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view class="card-actions">
          <button 
            class="btn-action btn-execute"
            @tap.stop="quickExecute(workflow.id)"
          >
            <text>▶️ 执行</text>
          </button>
          <button 
            class="btn-action btn-detail"
            @tap.stop="gotoDetail(workflow.id)"
          >
            <text>详情 ›</text>
          </button>
        </view>

        <!-- 标签 -->
        <view v-if="workflow.tags && workflow.tags.length" class="workflow-tags">
          <text 
            v-for="tag in workflow.tags.slice(0, 3)"
            :key="tag"
            class="tag"
          >
            #{{ tag }}
          </text>
        </view>
      </view>

      <!-- 加载更多 -->
      <view v-if="loading" class="loading-more">
        <text>加载中...</text>
      </view>

      <!-- 空状态 -->
      <view v-if="!loading && filteredWorkflows.length === 0" class="empty-state">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无工作流</text>
        <button class="btn-create" @tap="gotoTemplates">
          从模板创建
        </button>
      </view>
    </scroll-view>

    <!-- 悬浮按钮 -->
    <view class="fab-container">
      <view class="fab" @tap="showCreateMenu">
        <text class="fab-icon">+</text>
      </view>
    </view>

    <!-- 创建菜单 -->
    <view v-if="showMenu" class="create-menu-overlay" @tap="showMenu = false">
      <view class="create-menu" @tap.stop>
        <view class="menu-item" @tap="gotoTemplates">
          <text class="menu-icon">📑</text>
          <text class="menu-text">从模板创建</text>
        </view>
        <view class="menu-item" @tap="gotoH5Editor">
          <text class="menu-icon">🖥️</text>
          <text class="menu-text">在H5端编辑</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from '@vue/reactivity';
import { onLoad } from '@dcloudio/uni-app';

interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  nodeCount: number;
  executionCount: number;
  avgExecutionTime: number;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

// 状态
const workflows = ref<Workflow[]>([]);
const searchKeyword = ref('');
const currentCategory = ref('all');
const loading = ref(false);
const showMenu = ref(false);

// 分类
const categories: Category[] = [
  { id: 'all', name: '全部', icon: '📚' },
  { id: 'audit', name: '审计', icon: '📝' },
  { id: 'finance', name: '财务', icon: '💰' },
  { id: 'risk', name: '风险', icon: '⚠️' },
  { id: 'custom', name: '自定义', icon: '⚙️' }
];

// 计算属性
const filteredWorkflows = computed(() => {
  let result = workflows.value;
  
  // 按分类过滤
  if (currentCategory.value !== 'all') {
    result = result.filter(wf => wf.category === currentCategory.value);
  }
  
  // 按关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(wf => 
      wf.name.toLowerCase().includes(keyword) ||
      wf.description.toLowerCase().includes(keyword) ||
      wf.tags.some(tag => tag.toLowerCase().includes(keyword))
    );
  }
  
  return result;
});

// 生命周期
onLoad(() => {
  loadWorkflows();
});

// 加载工作流列表
async function loadWorkflows() {
  try {
    loading.value = true;
    
    const res = await uni.request({
      url: 'http://localhost:3000/api/workflows',
      method: 'GET'
    });
    
    const data = res.data as any;
    if (data.code === 200) {
      workflows.value = data.data.map((wf: any) => ({
        ...wf,
        nodeCount: wf.nodes?.length || 0,
        executionCount: wf.executionCount || 0,
        avgExecutionTime: wf.avgExecutionTime || 0,
        tags: wf.tags || []
      }));
    }
  } catch (error: any) {
    uni.showToast({
      title: '加载失败: ' + error.message,
      icon: 'none'
    });
  } finally {
    loading.value = false;
  }
}

// 搜索
function onSearch() {
  // 搜索逻辑在计算属性中处理
}

// 选择分类
function selectCategory(categoryId: string) {
  currentCategory.value = categoryId;
}

// 跳转详情
function gotoDetail(workflowId: string) {
  uni.navigateTo({
    url: `/pages-miniapp/workflow/detail?id=${workflowId}`
  });
}

// 快速执行
async function quickExecute(workflowId: string) {
  try {
    uni.showLoading({ title: '提交任务...' });
    
    const res = await uni.request({
      url: `http://localhost:3000/api/execute/workflow/${workflowId}`,
      method: 'POST',
      data: { inputs: {}, config: {} }
    });
    
    const data = res.data as { code: number; data: { taskId: string } };
    if (data.code === 200) {
      const taskId = data.data.taskId;
      
      uni.showToast({
        title: '任务已提交',
        icon: 'success'
      });
      
      // 跳转到详情页查看执行进度
      setTimeout(() => {
        gotoDetail(workflowId);
      }, 1000);
    }
  } catch (error: any) {
    uni.showToast({
      title: '执行失败: ' + error.message,
      icon: 'none'
    });
  } finally {
    uni.hideLoading();
  }
}

// 跳转模板市场
function gotoTemplates() {
  uni.showToast({
    title: '模板市场开发中',
    icon: 'none'
  });
  showMenu.value = false;
}

// 跳转H5编辑器
function gotoH5Editor() {
  uni.showToast({
    title: '请在电脑浏览器中打开 http://localhost:8080',
    icon: 'none',
    duration: 3000
  });
  showMenu.value = false;
}

// 显示创建菜单
function showCreateMenu() {
  showMenu.value = true;
}

// 加载更多
function loadMore() {
  // 分页加载逻辑
}

// 辅助函数
function getCategoryIcon(category: string): string {
  const iconMap: Record<string, string> = {
    audit: '📝',
    finance: '💰',
    risk: '⚠️',
    custom: '⚙️'
  };
  return iconMap[category] || '📦';
}
</script>

<style lang="scss" scoped>
.workflow-list-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}

.search-bar {
  padding: 24rpx 32rpx;
  background: white;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 48rpx;
  padding: 0 24rpx;
  height: 80rpx;
}

.search-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
}

.category-tabs {
  white-space: nowrap;
  padding: 20rpx 0;
  background: white;
  border-bottom: 2rpx solid #f0f0f0;
}

.category-tab {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 24rpx;
  margin: 0 8rpx;
  border-radius: 48rpx;
  background: #f5f5f5;
  font-size: 26rpx;
  color: #666;
  transition: all 0.3s;
  
  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  
  &:first-child {
    margin-left: 32rpx;
  }
  
  &:last-child {
    margin-right: 32rpx;
  }
}

.category-icon {
  font-size: 28rpx;
}

.workflow-list {
  height: calc(100vh - 280rpx);
  padding: 24rpx 32rpx;
}

.workflow-card {
  background: white;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  
  &:active {
    transform: scale(0.98);
    transition: transform 0.2s;
  }
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.workflow-icon {
  width: 80rpx;
  height: 80rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  margin-right: 20rpx;
}

.workflow-info {
  flex: 1;
}

.workflow-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.workflow-category {
  font-size: 24rpx;
  color: #999;
}

.public-badge {
  padding: 8rpx 16rpx;
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.workflow-desc {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
  display: block;
  margin-bottom: 20rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.workflow-stats {
  display: flex;
  gap: 32rpx;
  margin-bottom: 20rpx;
  padding: 16rpx 0;
  border-top: 2rpx solid #f5f5f5;
  border-bottom: 2rpx solid #f5f5f5;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.stat-icon {
  font-size: 24rpx;
}

.stat-value {
  font-size: 24rpx;
  color: #666;
}

.card-actions {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.btn-action {
  flex: 1;
  height: 72rpx;
  border-radius: 12rpx;
  font-size: 26rpx;
  border: none;
  
  &.btn-execute {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  
  &.btn-detail {
    background: white;
    color: #667eea;
    border: 2rpx solid #667eea;
  }
}

.workflow-tags {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.tag {
  padding: 6rpx 16rpx;
  background: #f5f5f5;
  color: #666;
  border-radius: 8rpx;
  font-size: 22rpx;
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
  margin-bottom: 32rpx;
}

.btn-create {
  padding: 20rpx 48rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 48rpx;
  border: none;
  font-size: 28rpx;
}

.loading-more {
  text-align: center;
  padding: 32rpx;
  color: #999;
  font-size: 26rpx;
}

.fab-container {
  position: fixed;
  right: 40rpx;
  bottom: 160rpx;
  z-index: 100;
}

.fab {
  width: 112rpx;
  height: 112rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.4);
  
  &:active {
    transform: scale(0.95);
  }
}

.fab-icon {
  font-size: 64rpx;
  color: white;
  font-weight: 300;
}

.create-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.create-menu {
  position: fixed;
  right: 40rpx;
  bottom: 300rpx;
  background: white;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 32rpx;
  border-bottom: 2rpx solid #f5f5f5;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:active {
    background: #f5f5f5;
  }
}

.menu-icon {
  font-size: 40rpx;
}

.menu-text {
  font-size: 28rpx;
  color: #333;
}
</style>
