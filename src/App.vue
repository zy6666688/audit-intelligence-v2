<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';
import { SyncManager } from '@/utils/sync-manager';

onLaunch(() => {
  console.log('App Launch');
  
  // 初始化数据同步管理器
  SyncManager.init().catch(err => {
    console.error('同步管理器初始化失败:', err);
  });
  
  // 检查更新（仅小程序）
  // #ifdef MP-WEIXIN
  const updateManager = uni.getUpdateManager();
  updateManager.onCheckForUpdate((res) => {
    console.log('是否有新版本:', res.hasUpdate);
  });
  
  updateManager.onUpdateReady(() => {
    uni.showModal({
      title: '更新提示',
      content: '新版本已经准备好，是否重启应用？',
      success: (res) => {
        if (res.confirm) {
          updateManager.applyUpdate();
        }
      }
    });
  });
  
  updateManager.onUpdateFailed(() => {
    uni.showModal({
      title: '更新失败',
      content: '新版本下载失败，请删除当前小程序，重新搜索打开',
      showCancel: false
    });
  });
  // #endif
});

onShow(() => {
  console.log('App Show');
  
  // 检查网络状态
  uni.getNetworkType({
    success: (res) => {
      console.log('当前网络类型:', res.networkType);
      if (res.networkType === 'none') {
        uni.showToast({
          title: '当前无网络连接',
          icon: 'none'
        });
      }
    }
  });
});

onHide(() => {
  console.log('App Hide');
});
</script>

<style lang="scss">
/* 全局样式 */
@import './styles/global.scss';

page {
  background-color: #f8f8f8;
  font-size: 28rpx;
  line-height: 1.6;
}

/* 重置样式 */
view, scroll-view, swiper, swiper-item, cover-view, cover-image, icon, text, rich-text, progress, button, checkbox, form, input, label, picker, picker-view, radio, slider, switch, textarea, navigator, audio, camera, image, video {
  box-sizing: border-box;
}

/* 通用工具类 */
.container {
  width: 100%;
  padding: 0 30rpx;
}

.flex {
  display: flex;
}

.flex-column {
  display: flex;
  flex-direction: column;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ellipsis-2 {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 颜色变量 */
.text-primary {
  color: #1890ff;
}

.text-success {
  color: #52c41a;
}

.text-warning {
  color: #faad14;
}

.text-danger {
  color: #f5222d;
}

.text-info {
  color: #909399;
}

.bg-primary {
  background-color: #1890ff;
}

.bg-success {
  background-color: #52c41a;
}

.bg-warning {
  background-color: #faad14;
}

.bg-danger {
  background-color: #f5222d;
}
</style>
