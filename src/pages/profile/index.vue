<template>
  <view class="page">
    <view class="header">
      <image class="avatar" :src="userInfo.avatar || '/static/default-avatar.png'" mode="aspectFill"></image>
      <text class="name">{{ userInfo.name || '未登录' }}</text>
      <text class="role">{{ userInfo.role || '审计师' }}</text>
    </view>

    <view class="menu-list">
      <view class="menu-item" v-for="item in menuList" :key="item.id" @click="handleMenuClick(item)">
        <view class="left">
          <text class="icon">{{ item.icon }}</text>
          <text class="title">{{ item.title }}</text>
        </view>
        <text class="arrow">›</text>
      </view>
    </view>

    <button class="logout-btn" @click="handleLogout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { PlatformAdapter } from '@/utils/platform';

const userInfo = ref({
  name: '',
  avatar: '',
  role: ''
});

const menuList = ref([
  { id: 'settings', title: '设置', icon: '⚙️' },
  { id: 'about', title: '关于', icon: 'ℹ️' },
  { id: 'help', title: '帮助', icon: '❓' }
]);

onMounted(async () => {
  const user = await PlatformAdapter.getStorage('userInfo');
  if (user) {
    userInfo.value = user;
  }
});

function handleMenuClick(item: any) {
  PlatformAdapter.showToast({ title: `${item.title}功能开发中`, icon: 'none' });
}

async function handleLogout() {
  const confirmed = await PlatformAdapter.showConfirm({
    title: '提示',
    content: '确定要退出登录吗？'
  });

  if (confirmed) {
    await PlatformAdapter.removeStorage('token');
    await PlatformAdapter.removeStorage('userInfo');
    PlatformAdapter.showToast({ title: '已退出登录', icon: 'success' });
    
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' });
    }, 1500);
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f8f8f8;
  padding-bottom: 100rpx;
}

.header {
  padding: 60rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;

  .avatar {
    width: 150rpx;
    height: 150rpx;
    border-radius: 50%;
    border: 4rpx solid rgba(255, 255, 255, 0.3);
    margin-bottom: 20rpx;
  }

  .name {
    font-size: 36rpx;
    font-weight: bold;
    margin-bottom: 10rpx;
  }

  .role {
    font-size: 24rpx;
    opacity: 0.8;
  }
}

.menu-list {
  margin: 30rpx 30rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;

  .menu-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 30rpx;
    border-bottom: 1rpx solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    .left {
      display: flex;
      align-items: center;

      .icon {
        font-size: 40rpx;
        margin-right: 20rpx;
      }

      .title {
        font-size: 28rpx;
        color: #333;
      }
    }

    .arrow {
      font-size: 48rpx;
      color: #ccc;
    }
  }
}

.logout-btn {
  margin: 30rpx 30rpx;
  height: 90rpx;
  line-height: 90rpx;
  background: #fff;
  color: #f5222d;
  font-size: 32rpx;
  border-radius: 16rpx;
  border: none;

  &::after {
    border: none;
  }
}
</style>
