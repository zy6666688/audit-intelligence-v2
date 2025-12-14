<template>
  <view class="page">
    <view class="search-bar">
      <input v-model="searchKeyword" placeholder="搜索项目" @confirm="handleSearch" />
      <button class="search-btn" @click="handleSearch" size="mini">搜索</button>
    </view>

    <view class="project-list" v-if="!loading || projects.length > 0">
      <view 
        class="project-item" 
        v-for="project in filteredProjects" 
        :key="project.id"
        @click="goDetail(project.id)"
      >
        <view class="project-header">
          <text class="project-name">{{ project.name }}</text>
          <view class="project-status" :class="'status-' + project.status">
            {{ getStatusText(project.status) }}
          </view>
        </view>
        <text class="project-desc" v-if="project.description">{{ project.description }}</text>
        <view class="project-meta">
          <text class="meta-item">创建人: {{ project.owner?.displayName || project.owner?.username }}</text>
          <text class="meta-item" v-if="project._count">工作流: {{ project._count.workflows }}</text>
        </view>
        <view class="project-footer">
          <text class="time">{{ new Date(project.createdAt).toLocaleDateString() }}</text>
          <text class="members" v-if="project._count">成员: {{ project._count.members }}</text>
        </view>
      </view>

      <!-- 空状态 -->
      <view class="empty" v-if="!loading && projects.length === 0">
        <text class="empty-text">暂无项目</text>
        <button class="empty-btn" @click="createProject">创建第一个项目</button>
      </view>
    </view>

    <!-- 加载状态 -->
    <view class="loading" v-if="loading && projects.length === 0">
      <text>加载中...</text>
    </view>

    <view class="fab" @click="createProject">
      <text>+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { PlatformAdapter } from '@/utils/platform';
import { getProjects, type Project } from '@/api/project-new';

const searchKeyword = ref('');
const projects = ref<Project[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const filteredProjects = computed(() => {
  return projects.value;
});

onMounted(() => {
  loadProjects();
});

async function loadProjects() {
  try {
    loading.value = true;
    const res = await getProjects({
      page: page.value,
      limit: pageSize.value,
      search: searchKeyword.value || undefined
    });
    
    projects.value = res.items;
    total.value = res.pagination?.total || 0;
    
    console.log('项目列表加载成功:', res);
  } catch (error: any) {
    console.error('加载项目列表失败:', error);
    PlatformAdapter.showToast(error.message || '加载失败', 'none');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1; // 重置页码
  loadProjects();
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    active: '进行中',
    archived: '已归档',
    deleted: '已删除'
  };
  return map[status] || status;
}

function goDetail(id: string) {
  PlatformAdapter.navigateTo(`/pages/project/detail?id=${id}`);
}

function createProject() {
  PlatformAdapter.navigateTo('/pages/project/detail?action=create');
}

// 下拉刷新
async function onPullDownRefresh() {
  page.value = 1;
  await loadProjects();
  uni.stopPullDownRefresh();
}

// 上拉加载更多
async function onReachBottom() {
  if (projects.value.length >= total.value) {
    return;
  }
  page.value++;
  
  try {
    const res = await getProjects({
      page: page.value,
      limit: pageSize.value,
      search: searchKeyword.value || undefined
    });
    projects.value = [...projects.value, ...res.items];
  } catch (error: any) {
    console.error('加载更多失败:', error);
  }
}

// 暴露生命周期钩子
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
  padding: 20rpx 30rpx;
  background: #fff;

  input {
    height: 70rpx;
    padding: 0 30rpx;
    background: #f5f5f5;
    border-radius: 35rpx;
    font-size: 28rpx;
  }
}

.project-list {
  padding: 20rpx 30rpx;

  .project-item {
    padding: 30rpx;
    margin-bottom: 20rpx;
    background: #fff;
    border-radius: 16rpx;

    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15rpx;

      .project-name {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
        flex: 1;
      }

      .project-status {
        padding: 6rpx 16rpx;
        border-radius: 16rpx;
        font-size: 22rpx;

        &.status-in_progress {
          background: #e6f7ff;
          color: #1890ff;
        }

        &.status-review {
          background: #fff7e6;
          color: #faad14;
        }
      }
    }

    .project-client {
      font-size: 26rpx;
      color: #666;
      margin-bottom: 20rpx;
    }

    .project-footer {
      display: flex;
      justify-content: space-between;
      font-size: 24rpx;
      color: #999;
    }
  }
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
