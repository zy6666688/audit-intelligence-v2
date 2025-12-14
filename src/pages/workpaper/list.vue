<template>
  <view class="page">
    <!-- 头部 -->
    <view class="header">
      <text class="title">审计底稿</text>
      <view class="create-btn" @click="handleCreate">
        <text class="icon">+</text>
        <text>新建底稿</text>
      </view>
    </view>

    <!-- 底稿列表 -->
    <view class="workpaper-list">
      <view 
        v-for="item in workpapers" 
        :key="item.id" 
        class="workpaper-item"
        @click="handleOpenWorkpaper(item.id)"
      >
        <view class="item-header">
          <text class="item-title">{{ item.title }}</text>
          <view :class="['status-tag', item.status]">
            {{ statusLabels[item.status] }}
          </view>
        </view>
        
        <view class="item-meta">
          <text class="meta-item">{{ item.project }}</text>
          <text class="meta-divider">|</text>
          <text class="meta-item">节点数: {{ item.nodeCount }}</text>
          <text class="meta-divider">|</text>
          <text class="meta-item">{{ item.updateTime }}</text>
        </view>

        <view v-if="item.description" class="item-desc">
          {{ item.description }}
        </view>

        <view class="item-footer">
          <view class="tags">
            <text v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</text>
          </view>
          <text class="creator">创建人: {{ item.creator }}</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="workpapers.length === 0" class="empty-state">
      <text class="empty-icon">📋</text>
      <text class="empty-text">暂无底稿</text>
      <text class="empty-hint">点击右上角创建第一个审计底稿</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Workpaper {
  id: string;
  title: string;
  project: string;
  status: 'draft' | 'review' | 'approved';
  nodeCount: number;
  updateTime: string;
  description?: string;
  tags: string[];
  creator: string;
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  review: '复核中',
  approved: '已批准'
};

// 示例数据
const workpapers = ref<Workpaper[]>([
  {
    id: '1',
    title: '房地产预售资金监管审计',
    project: '某房地产集团2024年度审计',
    status: 'draft',
    nodeCount: 8,
    updateTime: '2024-11-29 15:30',
    description: '专项审计：预售资金监管账户合规性检测、资金流向分析、风险热力图生成',
    tags: ['专项审计', '房地产', '资金监管'],
    creator: '张审计'
  },
  {
    id: '2',
    title: '应收账款账龄分析',
    project: '某制造企业年度审计',
    status: 'review',
    nodeCount: 5,
    updateTime: '2024-11-28 10:15',
    description: '应收账款账龄分析、坏账准备计提合理性测试',
    tags: ['往来审计', '账龄分析'],
    creator: '李会计'
  },
  {
    id: '3',
    title: '收入确认测试',
    project: '某科技公司IPO审计',
    status: 'approved',
    nodeCount: 12,
    updateTime: '2024-11-25 16:45',
    description: '收入确认政策合规性检查、截止性测试、收入真实性验证',
    tags: ['收入审计', 'IPO', '舞弊检测'],
    creator: '王经理'
  }
]);

const handleCreate = () => {
  // 生成新ID
  const newId = String(Date.now());
  
  // 跳转到详情页（新建模式）
  uni.navigateTo({
    url: `/pages/workpaper/detail?id=${newId}&mode=create`
  });
};

const handleOpenWorkpaper = (id: string) => {
  // 跳转到详情页
  uni.navigateTo({
    url: `/pages/workpaper/detail?id=${id}`
  });
};
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
}

.header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  padding: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1rpx solid #e4e7ed;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);

  .title {
    font-size: 36rpx;
    font-weight: 600;
    color: #2c3e50;
  }

  .create-btn {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 16rpx 28rpx;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border-radius: 40rpx;
    font-size: 28rpx;
    font-weight: 500;
    box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.4);
    transition: all 0.3s;

    .icon {
      font-size: 32rpx;
      font-weight: 300;
    }

    &:active {
      transform: scale(0.95);
      box-shadow: 0 2rpx 8rpx rgba(102, 126, 234, 0.3);
    }
  }
}

.workpaper-list {
  padding: 30rpx;
}

.workpaper-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  transition: all 0.3s;

  &:active {
    transform: translateY(-4rpx);
    box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.12);
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16rpx;

    .item-title {
      flex: 1;
      font-size: 32rpx;
      font-weight: 600;
      color: #2c3e50;
      line-height: 1.4;
    }

    .status-tag {
      padding: 8rpx 20rpx;
      border-radius: 20rpx;
      font-size: 24rpx;
      white-space: nowrap;
      margin-left: 16rpx;

      &.draft {
        background: #ecf5ff;
        color: #409eff;
      }

      &.review {
        background: #fdf6ec;
        color: #e6a23c;
      }

      &.approved {
        background: #f0f9ff;
        color: #67c23a;
      }
    }
  }

  .item-meta {
    display: flex;
    align-items: center;
    font-size: 24rpx;
    color: #909399;
    margin-bottom: 16rpx;

    .meta-item {
      color: #606266;
    }

    .meta-divider {
      margin: 0 12rpx;
      color: #dcdfe6;
    }
  }

  .item-desc {
    font-size: 26rpx;
    color: #606266;
    line-height: 1.6;
    margin-bottom: 20rpx;
  }

  .item-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 20rpx;
    border-top: 1rpx solid #f0f0f0;

    .tags {
      display: flex;
      gap: 12rpx;
      flex-wrap: wrap;
      flex: 1;

      .tag {
        padding: 6rpx 16rpx;
        background: #f4f4f5;
        color: #606266;
        border-radius: 12rpx;
        font-size: 22rpx;
      }
    }

    .creator {
      font-size: 24rpx;
      color: #909399;
      white-space: nowrap;
      margin-left: 16rpx;
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 60rpx;
  text-align: center;

  .empty-icon {
    font-size: 120rpx;
    margin-bottom: 30rpx;
    opacity: 0.5;
  }

  .empty-text {
    font-size: 32rpx;
    color: #909399;
    margin-bottom: 16rpx;
  }

  .empty-hint {
    font-size: 26rpx;
    color: #c0c4cc;
  }
}
</style>
