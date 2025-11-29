<!--
  历史版本管理组件
  显示和恢复历史版本
-->
<template>
  <view class="version-history-modal" v-if="visible">
    <view class="modal-mask" @click="handleClose"></view>
    <view class="modal-content">
      <!-- 头部 -->
      <view class="modal-header">
        <text class="modal-title">📜 历史版本</text>
        <view class="action-btn close" @click="handleClose">
          <text>✕</text>
        </view>
      </view>

      <!-- 版本列表 -->
      <view class="modal-body">
        <view v-if="versions.length === 0" class="empty-state">
          <text class="empty-icon">📭</text>
          <text class="empty-text">暂无历史版本</text>
        </view>

        <view v-else class="version-list">
          <view 
            class="version-item"
            v-for="(version, index) in versions"
            :key="version.id"
            :class="{ current: index === 0 }"
          >
            <view class="version-header">
              <view class="version-info">
                <text class="version-number">版本 #{{ versions.length - index }}</text>
                <text class="version-badge" v-if="index === 0">当前版本</text>
                <text class="version-badge auto" v-if="version.autoSaved">自动保存</text>
              </view>
              <text class="version-time">{{ formatTime(version.timestamp) }}</text>
            </view>

            <view class="version-details">
              <view class="detail-item">
                <text class="detail-label">节点数:</text>
                <text class="detail-value">{{ version.data?.nodes?.length || 0 }}个</text>
              </view>
              <view class="detail-item">
                <text class="detail-label">连线数:</text>
                <text class="detail-value">{{ version.data?.connections?.length || 0 }}个</text>
              </view>
              <view class="detail-item" v-if="version.data?.metadata?.lastModified">
                <text class="detail-label">修改时间:</text>
                <text class="detail-value">{{ formatDateTime(version.data.metadata.lastModified) }}</text>
              </view>
            </view>

            <view class="version-actions" v-if="index !== 0">
              <view class="action-button preview" @click="handlePreview(version)">
                <text>👁️ 预览</text>
              </view>
              <view class="action-button restore" @click="handleRestore(version)">
                <text>🔄 恢复此版本</text>
              </view>
              <view class="action-button delete" @click="handleDelete(version)">
                <text>🗑️ 删除</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部操作 -->
      <view class="modal-footer">
        <view class="footer-info">
          <text class="info-text">共 {{ versions.length }} 个版本</text>
          <text class="info-text">|</text>
          <text class="info-text">最多保存 50 个版本</text>
        </view>
        <view class="footer-actions">
          <view class="footer-btn danger" @click="handleClearAll">
            <text>清空所有历史</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { autoSaveManager } from '@/utils/autoSave';

interface Props {
  visible: boolean;
  workpaperId: string;
}

const props = defineProps<Props>();
const emit = defineEmits(['close', 'restore']);

// 版本列表
const versions = ref<any[]>([]);

// 监听显示状态，加载版本
watch(() => props.visible, (newVal) => {
  if (newVal && props.workpaperId) {
    loadVersions();
  }
});

// 加载版本列表
const loadVersions = async () => {
  try {
    const versionList = await autoSaveManager.getVersions(props.workpaperId);
    versions.value = versionList.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('加载版本失败:', error);
    versions.value = [];
  }
};

// 格式化时间（相对时间）
const formatTime = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  
  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`;
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`;
  } else if (diff < 7 * day) {
    return `${Math.floor(diff / day)}天前`;
  } else {
    return formatDateTime(timestamp);
  }
};

// 格式化日期时间
const formatDateTime = (timestamp: number | string) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// 预览版本
const handlePreview = (version: any) => {
  uni.showModal({
    title: '版本预览',
    content: `节点数: ${version.data?.nodes?.length || 0}\n连线数: ${version.data?.connections?.length || 0}\n保存时间: ${formatDateTime(version.timestamp)}`,
    showCancel: false
  });
};

// 恢复版本
const handleRestore = (version: any) => {
  uni.showModal({
    title: '确认恢复',
    content: `确定要恢复到此版本吗？当前未保存的更改将会丢失。`,
    confirmColor: '#1890ff',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '正在恢复...' });
          
          // 恢复版本
          await autoSaveManager.restoreVersion(props.workpaperId, version.id);
          
          uni.hideLoading();
          uni.showToast({
            title: '版本已恢复',
            icon: 'success'
          });
          
          // 通知父组件
          emit('restore', version.data);
          emit('close');
        } catch (error) {
          uni.hideLoading();
          console.error('恢复版本失败:', error);
          uni.showToast({
            title: '恢复失败',
            icon: 'error'
          });
        }
      }
    }
  });
};

// 删除版本
const handleDelete = (version: any) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除此版本吗？此操作不可恢复。',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        // 从列表中移除
        const index = versions.value.findIndex(v => v.id === version.id);
        if (index > -1) {
          versions.value.splice(index, 1);
          
          // TODO: 从存储中删除
          
          uni.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    }
  });
};

// 清空所有历史
const handleClearAll = () => {
  uni.showModal({
    title: '确认清空',
    content: '确定要清空所有历史版本吗？此操作不可恢复。',
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (res.confirm) {
        try {
          // 清除所有版本（保留当前版本）
          await autoSaveManager.clearAllVersions(props.workpaperId);
          
          // 重新加载
          await loadVersions();
          
          uni.showToast({
            title: '已清空',
            icon: 'success'
          });
        } catch (error) {
          console.error('清空失败:', error);
          uni.showToast({
            title: '清空失败',
            icon: 'error'
          });
        }
      }
    }
  });
};

// 关闭
const handleClose = () => {
  emit('close');
};
</script>

<style lang="scss" scoped>
.version-history-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 800px;
  height: 80vh;
  background: #2a2a2a;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #3d3d3d;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0e0e0;
}

.action-btn {
  padding: 8px 12px;
  background: #ff4d4f;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }

  text {
    color: white;
    font-size: 18px;
  }
}

.modal-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 15px;
}

.empty-icon {
  font-size: 64px;
}

.empty-text {
  color: #999;
  font-size: 14px;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.version-item {
  background: #1e1e1e;
  border: 1px solid #3d3d3d;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.2s;

  &.current {
    border-color: #1890ff;
    background: rgba(24, 144, 255, 0.1);
  }

  &:hover {
    border-color: #4d4d4d;
  }
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.version-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.version-number {
  color: #e0e0e0;
  font-size: 16px;
  font-weight: 600;
}

.version-badge {
  padding: 2px 8px;
  background: #1890ff;
  border-radius: 4px;
  color: white;
  font-size: 12px;

  &.auto {
    background: #52c41a;
  }
}

.version-time {
  color: #999;
  font-size: 12px;
}

.version-details {
  display: flex;
  gap: 20px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #3d3d3d;
}

.detail-item {
  display: flex;
  gap: 5px;
}

.detail-label {
  color: #999;
  font-size: 12px;
}

.detail-value {
  color: #e0e0e0;
  font-size: 12px;
}

.version-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.action-button {
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;

  &.preview {
    background: #3d3d3d;
    color: #e0e0e0;

    &:hover {
      background: #4d4d4d;
    }
  }

  &.restore {
    background: #1890ff;
    color: white;

    &:hover {
      background: #40a9ff;
    }
  }

  &.delete {
    background: transparent;
    border: 1px solid #ff4d4f;
    color: #ff4d4f;

    &:hover {
      background: rgba(255, 77, 79, 0.1);
    }
  }

  text {
    font-size: 12px;
  }
}

.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid #3d3d3d;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-info {
  display: flex;
  gap: 10px;
}

.info-text {
  color: #999;
  font-size: 12px;
}

.footer-actions {
  display: flex;
  gap: 10px;
}

.footer-btn {
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &.danger {
    background: transparent;
    border: 1px solid #ff4d4f;

    &:hover {
      background: #ff4d4f;
    }

    text {
      color: #ff4d4f;
      font-size: 14px;
    }

    &:hover text {
      color: white;
    }
  }
}
</style>
