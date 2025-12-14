<template>
  <view class="page">
    <view class="header">
      <view class="welcome">
        <text class="greeting">你好，{{ userInfo.name || '审计师' }}</text>
        <text class="desc">欢迎使用审计数智析</text>
      </view>
      <view class="avatar" @click="goProfile">
        <image :src="userInfo.avatar || '/static/default-avatar.png'" mode="aspectFill"></image>
      </view>
    </view>

    <!-- 快捷功能 -->
    <view class="quick-actions">
      <view class="action-item" v-for="item in quickActions" :key="item.id" @click="handleAction(item)">
        <view class="icon" :style="{ backgroundColor: item.color }">
          <text>{{ item.icon }}</text>
        </view>
        <text class="title">{{ item.title }}</text>
      </view>
    </view>

    <!-- 数据统计 -->
    <view class="stats">
      <view class="stat-item" v-for="stat in stats" :key="stat.label" @click="handleStatClick(stat)">
        <text class="value">{{ stat.value }}</text>
        <text class="label">{{ stat.label }}</text>
      </view>
    </view>

    <!-- 最近项目 -->
    <view class="section">
      <view class="section-header">
        <text class="title">最近项目</text>
        <text class="more" @click="goProjectList">查看全部</text>
      </view>
      <view class="project-list">
        <view class="project-item" v-for="project in recentProjects" :key="project.id" @click="goProjectDetail(project.id)">
          <view class="project-info">
            <text class="project-name">{{ project.name }}</text>
            <text class="project-client">{{ project.client }}</text>
          </view>
          <view class="project-status" :class="'status-' + project.status">
            {{ getStatusText(project.status) }}
          </view>
        </view>
      </view>
    </view>

    <!-- 同步状态 -->
    <view class="sync-status" v-if="syncQueue.total > 0">
      <text class="sync-text">{{ getSyncStatusText() }}</text>
      <view class="sync-progress" :style="{ width: syncProgress + '%' }"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { PlatformAdapter } from '@/utils/platform';
import { SyncManager } from '@/utils/sync-manager';

// 用户信息
const userInfo = ref({
  name: '',
  avatar: ''
});

// 快捷操作
const quickActions = ref([
  { id: 'workpaper', title: '审计底稿', icon: '📋', color: '#1890ff' },
  { id: 'new-project', title: '新建项目', icon: '📁', color: '#52c41a' },
  { id: 'upload-evidence', title: '上传证据', icon: '📤', color: '#faad14' },
  { id: 'ai-analysis', title: 'AI分析', icon: '🤖', color: '#722ed1' }
]);

// 数据统计
const stats = ref([
  { label: '进行中项目', value: 0 },
  { label: '待审核底稿', value: 0 },
  { label: '本月证据', value: 0 }
]);

// 最近项目
const recentProjects = ref<any[]>([]);

// 同步队列状态
const syncQueue = ref({
  total: 0,
  pending: 0,
  syncing: 0,
  failed: 0
});

// 同步进度
const syncProgress = computed(() => {
  if (syncQueue.value.total === 0) return 0;
  const synced = syncQueue.value.total - syncQueue.value.pending - syncQueue.value.syncing;
  return (synced / syncQueue.value.total) * 100;
});

// 页面加载
onMounted(async () => {
  await loadUserInfo();
  await loadStats();
  await loadRecentProjects();
  await checkSyncStatus();
});

// 加载用户信息
async function loadUserInfo() {
  try {
    const user = await PlatformAdapter.getStorage('userInfo');
    if (user) {
      userInfo.value = user;
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
  }
}

// 加载统计数据
async function loadStats() {
  // TODO: 调用API获取统计数据
  stats.value = [
    { label: '进行中项目', value: 5 },
    { label: '待审核底稿', value: 12 },
    { label: '本月证据', value: 156 }
  ];
}

// 加载最近项目
async function loadRecentProjects() {
  // TODO: 调用API获取最近项目
  recentProjects.value = [
    {
      id: '1',
      name: 'ABC公司2024年审',
      client: 'ABC科技有限公司',
      status: 'in_progress'
    },
    {
      id: '2',
      name: 'XYZ集团专项审计',
      client: 'XYZ集团股份有限公司',
      status: 'review'
    }
  ];
}

// 检查同步状态
async function checkSyncStatus() {
  const status = SyncManager.getQueueStatus();
  syncQueue.value = status;
}

// 获取状态文本
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'draft': '草稿',
    'in_progress': '进行中',
    'review': '待审核',
    'approved': '已批准',
    'completed': '已完成'
  };
  return statusMap[status] || '未知';
}

// 获取同步状态文本
function getSyncStatusText(): string {
  if (syncQueue.value.syncing > 0) {
    return `正在同步 (${syncQueue.value.syncing}/${syncQueue.value.total})...`;
  }
  if (syncQueue.value.pending > 0) {
    return `待同步 ${syncQueue.value.pending} 项`;
  }
  if (syncQueue.value.failed > 0) {
    return `同步失败 ${syncQueue.value.failed} 项`;
  }
  return '同步完成';
}

// 快捷操作处理
async function handleAction(item: any) {
  switch (item.id) {
    case 'workpaper':
      PlatformAdapter.navigateTo('/pages/workpaper/list');
      break;
    case 'new-project':
      PlatformAdapter.navigateTo('/pages/project/detail?action=create');
      break;
    case 'upload-evidence':
      PlatformAdapter.navigateTo('/pages/evidence/upload');
      break;
    case 'ai-analysis':
      // TODO: 实现AI分析功能
      PlatformAdapter.showToast('AI分析功能开发中', 'none');
      break;
  }
}

// 统计数据点击处理
function handleStatClick(stat: any) {
  if (stat.label === '待审核底稿' || stat.label === '本月底稿') {
    PlatformAdapter.navigateTo('/pages/workpaper/list');
  }
}

// 跳转到项目列表
function goProjectList() {
  uni.switchTab({ url: '/pages/project/list' });
}

// 跳转到项目详情
function goProjectDetail(id: string) {
  PlatformAdapter.navigateTo(`/pages/project/detail?id=${id}`);
}

// 跳转到个人中心
function goProfile() {
  uni.switchTab({ url: '/pages/profile/index' });
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f8f8f8;
  padding-bottom: 100rpx;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40rpx 30rpx;
  background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  color: #fff;

  .welcome {
    display: flex;
    flex-direction: column;

    .greeting {
      font-size: 40rpx;
      font-weight: bold;
      margin-bottom: 10rpx;
    }

    .desc {
      font-size: 24rpx;
      opacity: 0.9;
    }
  }

  .avatar {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    overflow: hidden;
    border: 4rpx solid rgba(255, 255, 255, 0.3);

    image {
      width: 100%;
      height: 100%;
    }
  }
}

.quick-actions {
  display: flex;
  justify-content: space-around;
  padding: 30rpx;
  margin: -40rpx 30rpx 30rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);

  .action-item {
    display: flex;
    flex-direction: column;
    align-items: center;

    .icon {
      width: 100rpx;
      height: 100rpx;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48rpx;
      margin-bottom: 10rpx;
    }

    .title {
      font-size: 24rpx;
      color: #666;
    }
  }
}

.stats {
  display: flex;
  justify-content: space-around;
  padding: 30rpx;
  margin: 0 30rpx 30rpx;
  background: #fff;
  border-radius: 16rpx;

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;

    .value {
      font-size: 48rpx;
      font-weight: bold;
      color: #1890ff;
      margin-bottom: 10rpx;
    }

    .label {
      font-size: 24rpx;
      color: #999;
    }
  }
}

.section {
  margin: 0 30rpx 30rpx;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;

    .title {
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
    }

    .more {
      font-size: 24rpx;
      color: #1890ff;
    }
  }

  .project-list {
    .project-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 30rpx;
      margin-bottom: 20rpx;
      background: #fff;
      border-radius: 16rpx;

      .project-info {
        display: flex;
        flex-direction: column;
        flex: 1;

        .project-name {
          font-size: 28rpx;
          font-weight: bold;
          color: #333;
          margin-bottom: 10rpx;
        }

        .project-client {
          font-size: 24rpx;
          color: #999;
        }
      }

      .project-status {
        padding: 8rpx 20rpx;
        border-radius: 20rpx;
        font-size: 22rpx;

        &.status-in_progress {
          background: #e6f7ff;
          color: #1890ff;
        }

        &.status-review {
          background: #fff7e6;
          color: #faad14;
        }

        &.status-completed {
          background: #f6ffed;
          color: #52c41a;
        }
      }
    }
  }
}

.sync-status {
  position: fixed;
  bottom: 100rpx;
  left: 30rpx;
  right: 30rpx;
  padding: 20rpx 30rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);

  .sync-text {
    font-size: 24rpx;
    color: #666;
  }

  .sync-progress {
    height: 6rpx;
    margin-top: 10rpx;
    background: #1890ff;
    border-radius: 3rpx;
    transition: width 0.3s;
  }
}
</style>
