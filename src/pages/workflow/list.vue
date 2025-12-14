<template>
  <view class="page">
    <!-- 搜索和筛选栏 -->
    <view class="search-bar">
      <input 
        v-model="searchKeyword" 
        placeholder="搜索工作流" 
        @confirm="handleSearch" 
        class="search-input"
      />
      <button class="search-btn" @click="handleSearch" size="mini">搜索</button>
    </view>

    <!-- 筛选标签 -->
    <view class="filter-tabs">
      <view 
        class="tab-item" 
        :class="{ active: currentFilter === 'all' }"
        @click="changeFilter('all')"
      >
        全部
      </view>
      <view 
        class="tab-item" 
        :class="{ active: currentFilter === 'my' }"
        @click="changeFilter('my')"
      >
        我的
      </view>
      <view 
        class="tab-item" 
        :class="{ active: currentFilter === 'template' }"
        @click="changeFilter('template')"
      >
        模板
      </view>
    </view>

    <!-- 工作流列表 -->
    <view class="workflow-list" v-if="!loading || workflows.length > 0">
      <view 
        class="workflow-item" 
        v-for="workflow in workflows" 
        :key="workflow.id"
        @click="goDetail(workflow.id)"
      >
        <view class="workflow-header">
          <text class="workflow-name">{{ workflow.name }}</text>
          <view class="workflow-badge template" v-if="workflow.isTemplate">
            模板
          </view>
          <view class="workflow-badge" :class="'status-' + workflow.status" v-else>
            {{ getStatusText(workflow.status) }}
          </view>
        </view>
        
        <text class="workflow-desc" v-if="workflow.description">
          {{ workflow.description }}
        </text>
        
        <view class="workflow-meta">
          <text class="meta-item" v-if="workflow.category">
            {{ workflow.category }}
          </text>
          <text class="meta-item">
            执行: {{ workflow.executionCount || 0 }}次
          </text>
        </view>
        
        <view class="workflow-footer">
          <text class="time">{{ formatDate(workflow.createdAt) }}</text>
          <view class="actions">
            <text class="action-btn" @click.stop="cloneWorkflow(workflow.id)" v-if="workflow.isTemplate">
              克隆
            </text>
            <text class="action-btn execute" @click.stop="executeWorkflow(workflow.id)">
              执行
            </text>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view class="empty" v-if="!loading && workflows.length === 0">
        <text class="empty-text">暂无工作流</text>
        <button class="empty-btn" @click="createWorkflow">创建第一个工作流</button>
      </view>
    </view>

    <!-- 加载状态 -->
    <view class="loading" v-if="loading && workflows.length === 0">
      <text>加载中...</text>
    </view>

    <!-- 浮动操作按钮 -->
    <view class="fab" @click="createWorkflow">
      <text>+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { PlatformAdapter } from '@/utils/platform';
import { getWorkflows, getWorkflowTemplates, cloneWorkflow as apiCloneWorkflow } from '@/api/workflow-new';

const searchKeyword = ref('');
const workflows = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const currentFilter = ref('all'); // all, my, template

onMounted(() => {
  loadWorkflows();
});

// 加载工作流列表
async function loadWorkflows() {
  try {
    loading.value = true;
    
    let res;
    if (currentFilter.value === 'template') {
      // 加载模板
      res = await getWorkflowTemplates({
        page: page.value,
        limit: pageSize.value
      });
    } else {
      // 加载普通工作流
      res = await getWorkflows({
        page: page.value,
        limit: pageSize.value,
        search: searchKeyword.value || undefined,
        isTemplate: false
      });
    }
    
    workflows.value = res.items;
    total.value = res.pagination?.total || 0;
    
    console.log('工作流列表加载成功:', res);
  } catch (error: any) {
    console.error('加载工作流列表失败:', error);
    PlatformAdapter.showToast(error.message || '加载失败', 'none');
  } finally {
    loading.value = false;
  }
}

// 搜索
function handleSearch() {
  page.value = 1;
  loadWorkflows();
}

// 切换筛选
function changeFilter(filter: string) {
  currentFilter.value = filter;
  page.value = 1;
  loadWorkflows();
}

// 获取状态文本
function getStatusText(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    active: '活跃',
    archived: '归档',
    deleted: '已删除'
  };
  return map[status] || status;
}

// 格式化日期
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 跳转详情
function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/workflow/detail?id=${id}` });
}

// 创建工作流
function createWorkflow() {
  uni.navigateTo({ url: `/pages/workflow/detail?action=create` });
}

// 克隆工作流
async function cloneWorkflow(id: string) {
  try {
    uni.showModal({
      title: '克隆工作流',
      content: '是否克隆此模板？',
      success: async (res) => {
        if (res.confirm) {
          const result = await apiCloneWorkflow(id, {});
          PlatformAdapter.showToast('克隆成功', 'success');
          
          // 跳转到新工作流
          setTimeout(() => {
            uni.navigateTo({ url: `/pages/workflow/detail?id=${result.id}` });
          }, 1500);
        }
      }
    });
  } catch (error: any) {
    console.error('克隆失败:', error);
    PlatformAdapter.showToast(error.message || '克隆失败', 'none');
  }
}

// 执行工作流
function executeWorkflow(id: string) {
  uni.navigateTo({ url: `/pages/workflow/execute?id=${id}` });
}

// 下拉刷新
async function onPullDownRefresh() {
  page.value = 1;
  await loadWorkflows();
  uni.stopPullDownRefresh();
}

// 上拉加载更多
async function onReachBottom() {
  if (workflows.value.length >= total.value) return;
  page.value++;
  
  try {
    const res = currentFilter.value === 'template'
      ? await getWorkflowTemplates({ page: page.value, limit: pageSize.value })
      : await getWorkflows({ page: page.value, limit: pageSize.value });
    workflows.value = [...workflows.value, ...res.items];
  } catch (error: any) {
    console.error('加载更多失败:', error);
  }
}

defineExpose({
  onPullDownRefresh,
  onReachBottom
});
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f8f8f8;
  padding-bottom: 100rpx;
}

.search-bar {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  background: #fff;
  gap: 20rpx;

  .search-input {
    flex: 1;
    height: 70rpx;
    padding: 0 30rpx;
    background: #f5f5f5;
    border-radius: 35rpx;
    font-size: 28rpx;
  }

  .search-btn {
    padding: 0 30rpx;
    height: 70rpx;
    line-height: 70rpx;
    background: #1890ff;
    color: #fff;
    border-radius: 35rpx;
    font-size: 28rpx;
    border: none;
  }
}

.filter-tabs {
  display: flex;
  padding: 20rpx 30rpx;
  background: #fff;
  margin-bottom: 20rpx;
  gap: 20rpx;

  .tab-item {
    padding: 10rpx 30rpx;
    border-radius: 30rpx;
    font-size: 28rpx;
    color: #666;
    background: #f5f5f5;

    &.active {
      background: #1890ff;
      color: #fff;
    }
  }
}

.workflow-list {
  padding: 0 30rpx;

  .workflow-item {
    padding: 30rpx;
    margin-bottom: 20rpx;
    background: #fff;
    border-radius: 16rpx;

    .workflow-header {
      display: flex;
      align-items: center;
      gap: 15rpx;
      margin-bottom: 15rpx;

      .workflow-name {
        flex: 1;
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
      }

      .workflow-badge {
        padding: 6rpx 16rpx;
        border-radius: 16rpx;
        font-size: 22rpx;

        &.template {
          background: #f0f5ff;
          color: #1890ff;
        }

        &.status-draft {
          background: #f0f0f0;
          color: #999;
        }

        &.status-active {
          background: #e6f7ff;
          color: #1890ff;
        }

        &.status-archived {
          background: #fff7e6;
          color: #faad14;
        }
      }
    }

    .workflow-desc {
      display: block;
      font-size: 26rpx;
      color: #666;
      margin-bottom: 15rpx;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .workflow-meta {
      display: flex;
      gap: 30rpx;
      margin-bottom: 15rpx;

      .meta-item {
        font-size: 24rpx;
        color: #999;
      }
    }

    .workflow-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .time {
        font-size: 24rpx;
        color: #999;
      }

      .actions {
        display: flex;
        gap: 20rpx;

        .action-btn {
          padding: 8rpx 20rpx;
          border-radius: 20rpx;
          font-size: 24rpx;
          border: 1rpx solid #d9d9d9;
          color: #666;

          &.execute {
            background: #1890ff;
            color: #fff;
            border-color: #1890ff;
          }
        }
      }
    }
  }
}

.empty {
  text-align: center;
  padding: 120rpx 0;

  .empty-text {
    display: block;
    font-size: 28rpx;
    color: #999;
    margin-bottom: 40rpx;
  }

  .empty-btn {
    display: inline-block;
    padding: 20rpx 60rpx;
    background: #1890ff;
    color: #fff;
    border-radius: 40rpx;
    font-size: 28rpx;
  }
}

.loading {
  display: flex;
  justify-content: center;
  padding: 120rpx 0;
  font-size: 28rpx;
  color: #999;
}

.fab {
  position: fixed;
  right: 30rpx;
  bottom: 120rpx;
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #1890ff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  box-shadow: 0 4rpx 12rpx rgba(24, 144, 255, 0.4);
}
</style>
