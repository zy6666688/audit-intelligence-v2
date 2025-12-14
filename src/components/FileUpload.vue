<template>
  <view class="file-upload">
    <!-- 上传区域 -->
    <view class="upload-area" @click="chooseFile" v-if="!uploading">
      <view class="upload-icon">📤</view>
      <text class="upload-text">点击上传文件</text>
      <text class="upload-hint">支持{{ acceptText }}，单个文件最大{{ maxSizeMB }}MB</text>
    </view>

    <!-- 上传进度 -->
    <view class="upload-progress" v-if="uploading">
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view>
      </view>
      <text class="progress-text">上传中 {{ uploadProgress }}%</text>
    </view>

    <!-- 文件列表 -->
    <view class="file-list" v-if="fileList.length > 0">
      <view 
        v-for="(file, index) in fileList" 
        :key="file.id || index"
        class="file-item"
      >
        <view class="file-info">
          <text class="file-icon">{{ getFileIcon(file) }}</text>
          <view class="file-details">
            <text class="file-name">{{ file.originalName || file.name }}</text>
            <text class="file-size">{{ formatSize(file.size) }}</text>
          </view>
        </view>
        <view class="file-actions">
          <button 
            class="btn-download" 
            @click="downloadFile(file)" 
            size="mini"
            v-if="file.id"
          >
            下载
          </button>
          <button 
            class="btn-delete" 
            @click="removeFile(index)" 
            size="mini"
          >
            删除
          </button>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-if="fileList.length === 0 && !uploading">
      <text class="empty-icon">📁</text>
      <text class="empty-text">暂无文件</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { uploadFile, deleteFile as deleteFileApi, downloadFile as getDownloadUrl } from '@/api/file-new';

// Props
interface Props {
  projectId?: string;
  workflowId?: string;
  category?: string;
  maxSize?: number; // 单位: MB
  accept?: string[];
  multiple?: boolean;
  modelValue?: any[];
}

const props = withDefaults(defineProps<Props>(), {
  maxSize: 50,
  accept: () => ['*'],
  multiple: false,
  modelValue: () => []
});

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', files: any[]): void;
  (e: 'upload-success', file: any): void;
  (e: 'upload-error', error: any): void;
}>();

// 状态
const uploading = ref(false);
const uploadProgress = ref(0);
const fileList = ref<any[]>(props.modelValue || []);

// 计算属性
const maxSizeMB = computed(() => props.maxSize);
const maxSizeBytes = computed(() => props.maxSize * 1024 * 1024);

const acceptText = computed(() => {
  if (props.accept.includes('*')) return '所有文件';
  return props.accept.join(', ');
});

// 选择文件
function chooseFile() {
  uni.chooseFile({
    count: props.multiple ? 9 : 1,
    extension: props.accept.includes('*') ? undefined : props.accept,
    success: (res) => {
      const files = Array.isArray(res.tempFiles) ? res.tempFiles : [res.tempFiles];
      handleFiles(files as any[]);
    },
    fail: (error) => {
      console.error('选择文件失败:', error);
      uni.showToast({
        title: '选择文件失败',
        icon: 'none'
      });
    }
  });
}

// 处理文件
async function handleFiles(files: any[]) {
  for (const file of files) {
    // 验证文件大小
    if (file.size > maxSizeBytes.value) {
      uni.showToast({
        title: `文件 ${file.name} 超过${maxSizeMB.value}MB`,
        icon: 'none'
      });
      continue;
    }

    // 上传文件
    await uploadSingleFile(file);
  }
}

// 上传单个文件
async function uploadSingleFile(file: any) {
  uploading.value = true;
  uploadProgress.value = 0;

  try {
    // 创建进度模拟
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 10;
      }
    }, 200);

    const result = await uploadFile({
      file: file.path || file.tempFilePath,
      projectId: props.projectId,
      workflowId: props.workflowId,
      category: props.category
    }) as any;

    clearInterval(progressInterval);
    uploadProgress.value = 100;

    // 添加到文件列表
    fileList.value.push(result);
    emit('update:modelValue', fileList.value);
    emit('upload-success', result);

    uni.showToast({
      title: '上传成功',
      icon: 'success',
      duration: 1500
    });

    // 重置状态
    setTimeout(() => {
      uploading.value = false;
      uploadProgress.value = 0;
    }, 500);
  } catch (error: any) {
    uploading.value = false;
    uploadProgress.value = 0;
    
    emit('upload-error', error);
    uni.showToast({
      title: error.message || '上传失败',
      icon: 'none'
    });
  }
}

// 删除文件
function removeFile(index: number) {
  const file = fileList.value[index];
  
  uni.showModal({
    title: '确认删除',
    content: `确定要删除文件"${file.originalName || file.name}"吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          // 如果是已上传的文件，调用API删除
          if (file.id) {
            await deleteFileApi(file.id);
          }
          
          fileList.value.splice(index, 1);
          emit('update:modelValue', fileList.value);
          
          uni.showToast({
            title: '删除成功',
            icon: 'success'
          });
        } catch (error: any) {
          uni.showToast({
            title: '删除失败',
            icon: 'none'
          });
        }
      }
    }
  });
}

// 下载文件
function downloadFile(file: any) {
  if (!file.id) return;
  
  const url = getDownloadUrl(file.id);
  
  uni.showLoading({ title: '下载中...' });
  
  uni.downloadFile({
    url,
    success: (res) => {
      if (res.statusCode === 200) {
        uni.hideLoading();
        uni.showToast({
          title: '下载成功',
          icon: 'success'
        });
        
        // 打开文件
        uni.openDocument({
          filePath: res.tempFilePath,
          showMenu: true
        });
      }
    },
    fail: () => {
      uni.hideLoading();
      uni.showToast({
        title: '下载失败',
        icon: 'none'
      });
    }
  });
}

// 获取文件图标
function getFileIcon(file: any) {
  const mimeType = file.mimeType || file.type || '';
  const fileName = file.originalName || file.name || '';
  
  if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName)) {
    return '🖼️';
  }
  if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) {
    return '📕';
  }
  if (mimeType.includes('word') || /\.(doc|docx)$/i.test(fileName)) {
    return '📘';
  }
  if (mimeType.includes('excel') || /\.(xls|xlsx)$/i.test(fileName)) {
    return '📗';
  }
  if (mimeType.includes('zip') || mimeType.includes('rar') || /\.(zip|rar|7z)$/i.test(fileName)) {
    return '📦';
  }
  return '📄';
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

// 导出方法供父组件调用
defineExpose({
  chooseFile,
  fileList
});
</script>

<style scoped>
.file-upload {
  width: 100%;
}

/* 上传区域 */
.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-area:hover {
  border-color: #1890ff;
  background: #e6f7ff;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.upload-text {
  font-size: 16px;
  color: #333;
  margin-bottom: 5px;
}

.upload-hint {
  font-size: 12px;
  color: #999;
}

/* 上传进度 */
.upload-progress {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1890ff, #40a9ff);
  transition: width 0.3s;
  border-radius: 4px;
}

.progress-text {
  display: block;
  text-align: center;
  font-size: 13px;
  color: #666;
}

/* 文件列表 */
.file-list {
  margin-top: 15px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: all 0.2s;
}

.file-item:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}

.file-info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.file-icon {
  font-size: 28px;
  margin-right: 12px;
  flex-shrink: 0;
}

.file-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.file-name {
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: #999;
}

.file-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 10px;
}

.btn-download,
.btn-delete {
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 4px;
}

.btn-download {
  background: #1890ff;
  color: #fff;
  border: none;
}

.btn-delete {
  background: #fff;
  color: #ff4d4f;
  border: 1px solid #ff4d4f;
}

/* 空状态 */
.empty-state {
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
</style>
