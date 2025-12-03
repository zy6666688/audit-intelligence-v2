<template>
  <view class="page">
    <!-- 导航栏 -->
    <view class="navbar">
      <view class="navbar-left" @click="goBack">
        <text class="icon-back">←</text>
      </view>
      <text class="navbar-title">{{ isCreate ? '创建项目' : '项目详情' }}</text>
      <view class="navbar-right">
        <text class="save-btn" @click="handleSave" v-if="isEdit || isCreate">保存</text>
        <text class="edit-btn" @click="isEdit = true" v-else>编辑</text>
      </view>
    </view>

    <!-- 内容区域 -->
    <view class="content" v-if="!loading">
      <!-- 创建/编辑模式 -->
      <view class="form" v-if="isCreate || isEdit">
        <view class="form-item">
          <text class="label">项目名称 *</text>
          <input 
            v-model="form.name" 
            placeholder="请输入项目名称"
            class="input"
          />
        </view>

        <view class="form-item">
          <text class="label">项目描述</text>
          <textarea 
            v-model="form.description" 
            placeholder="请输入项目描述"
            class="textarea"
            :maxlength="500"
          />
        </view>

        <view class="form-item" v-if="!isCreate">
          <text class="label">项目状态</text>
          <picker 
            :range="statusOptions" 
            range-key="label"
            :value="statusIndex"
            @change="onStatusChange"
          >
            <view class="picker">
              {{ statusOptions[statusIndex].label }}
            </view>
          </picker>
        </view>
      </view>

      <!-- 查看模式 -->
      <view class="detail" v-else>
        <view class="detail-section">
          <text class="section-title">基本信息</text>
          <view class="info-item">
            <text class="info-label">项目名称</text>
            <text class="info-value">{{ project.name }}</text>
          </view>
          <view class="info-item" v-if="project.description">
            <text class="info-label">项目描述</text>
            <text class="info-value">{{ project.description }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">项目状态</text>
            <view class="status-badge" :class="'status-' + project.status">
              {{ getStatusText(project.status) }}
            </view>
          </view>
          <view class="info-item">
            <text class="info-label">创建人</text>
            <text class="info-value">{{ project.owner?.displayName || project.owner?.username }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">创建时间</text>
            <text class="info-value">{{ formatDate(project.createdAt) }}</text>
          </view>
        </view>

        <!-- 统计信息 -->
        <view class="detail-section" v-if="stats">
          <text class="section-title">统计数据</text>
          <view class="stats-grid">
            <view class="stat-item">
              <text class="stat-value">{{ stats.memberCount || 0 }}</text>
              <text class="stat-label">成员数</text>
            </view>
            <view class="stat-item">
              <text class="stat-value">{{ project._count?.workflows || 0 }}</text>
              <text class="stat-label">工作流</text>
            </view>
            <view class="stat-item">
              <text class="stat-value">{{ getTotalExecutions() }}</text>
              <text class="stat-label">执行次数</text>
            </view>
          </view>
        </view>

        <!-- 工作流列表 -->
        <view class="detail-section">
          <view class="section-header">
            <text class="section-title">项目工作流</text>
            <text class="section-action" @click="createWorkflow">+ 新建</text>
          </view>
          <view class="workflow-list" v-if="workflows.length > 0">
            <view 
              class="workflow-item" 
              v-for="workflow in workflows" 
              :key="workflow.id"
              @click="goWorkflow(workflow.id)"
            >
              <text class="workflow-name">{{ workflow.name }}</text>
              <text class="workflow-arrow">→</text>
            </view>
          </view>
          <view class="empty-tip" v-else>
            <text>暂无工作流</text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view class="actions">
          <button class="action-btn danger" @click="handleDelete">删除项目</button>
        </view>
      </view>
    </view>

    <!-- 加载状态 -->
    <view class="loading-wrapper" v-else>
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { PlatformAdapter } from '@/utils/platform';
import { 
  getProjectDetail, 
  createProject, 
  updateProject, 
  deleteProject,
  getProjectStats,
  getProjectWorkflows
} from '@/api/project-new';

// 页面参数
const id = ref('');
const action = ref('');

// 状态
const loading = ref(false);
const project = ref<any>({});
const stats = ref<any>(null);
const workflows = ref<any[]>([]);
const isEdit = ref(false);

// 表单数据
const form = ref({
  name: '',
  description: '',
  status: 'active'
});

// 状态选项
const statusOptions = [
  { value: 'active', label: '进行中' },
  { value: 'archived', label: '已归档' }
];

const statusIndex = computed(() => {
  return statusOptions.findIndex(opt => opt.value === form.value.status);
});

// 是否为创建模式
const isCreate = computed(() => action.value === 'create');

onMounted(() => {
  // 获取页面参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as any;
  const options = currentPage.options || {};
  
  id.value = options.id || '';
  action.value = options.action || '';

  if (isCreate.value) {
    // 创建模式
    isEdit.value = true;
  } else if (id.value) {
    // 详情模式
    loadProjectDetail();
    loadProjectStats();
    loadWorkflows();
  }
});

// 加载项目详情
async function loadProjectDetail() {
  try {
    loading.value = true;
    const res = await getProjectDetail(id.value);
    project.value = res;
    
    // 填充表单
    form.value = {
      name: res.name,
      description: res.description || '',
      status: res.status
    };
    
    console.log('项目详情:', res);
  } catch (error: any) {
    console.error('加载项目详情失败:', error);
    PlatformAdapter.showToast(error.message || '加载失败', 'none');
  } finally {
    loading.value = false;
  }
}

// 加载项目统计
async function loadProjectStats() {
  try {
    const res = await getProjectStats(id.value);
    stats.value = res;
  } catch (error: any) {
    console.error('加载统计失败:', error);
  }
}

// 加载工作流列表
async function loadWorkflows() {
  try {
    const res = await getProjectWorkflows(id.value, { page: 1, limit: 10 });
    workflows.value = res.items;
  } catch (error: any) {
    console.error('加载工作流失败:', error);
  }
}

// 保存
async function handleSave() {
  if (!form.value.name.trim()) {
    PlatformAdapter.showToast('请输入项目名称', 'none');
    return;
  }

  try {
    loading.value = true;
    
    if (isCreate.value) {
      // 创建项目
      const res = await createProject({
        name: form.value.name,
        description: form.value.description
      });
      
      PlatformAdapter.showToast('创建成功', 'success');
      
      // 跳转到详情页
      setTimeout(() => {
        uni.redirectTo({ 
          url: `/pages/project/detail?id=${res.id}` 
        });
      }, 1500);
    } else {
      // 更新项目
      await updateProject(id.value, {
        name: form.value.name,
        description: form.value.description,
        status: form.value.status
      });
      
      PlatformAdapter.showToast('保存成功', 'success');
      isEdit.value = false;
      
      // 重新加载
      loadProjectDetail();
    }
  } catch (error: any) {
    console.error('保存失败:', error);
    PlatformAdapter.showToast(error.message || '保存失败', 'none');
  } finally {
    loading.value = false;
  }
}

// 删除项目
async function handleDelete() {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复，确定要删除吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteProject(id.value);
          PlatformAdapter.showToast('删除成功', 'success');
          
          setTimeout(() => {
            uni.navigateBack();
          }, 1500);
        } catch (error: any) {
          console.error('删除失败:', error);
          PlatformAdapter.showToast(error.message || '删除失败', 'none');
        }
      }
    }
  });
}

// 状态改变
function onStatusChange(e: any) {
  form.value.status = statusOptions[e.detail.value].value;
}

// 获取状态文本
function getStatusText(status: string): string {
  const map: Record<string, string> = {
    active: '进行中',
    archived: '已归档',
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

// 获取总执行次数
function getTotalExecutions(): number {
  if (!stats.value?.executions) return 0;
  const values = Object.values(stats.value.executions) as any[];
  return values.reduce((sum: number, count: any) => sum + Number(count), 0);
}

// 返回
function goBack() {
  uni.navigateBack();
}

// 创建工作流
function createWorkflow() {
  uni.navigateTo({ 
    url: `/pages/workflow/editor?projectId=${id.value}&action=create` 
  });
}

// 跳转工作流
function goWorkflow(workflowId: string) {
  uni.navigateTo({ 
    url: `/pages/workflow/detail?id=${workflowId}` 
  });
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f8f8f8;
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 30rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;

  .navbar-left {
    width: 100rpx;
    
    .icon-back {
      font-size: 40rpx;
      color: #333;
    }
  }

  .navbar-title {
    flex: 1;
    text-align: center;
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
  }

  .navbar-right {
    width: 100rpx;
    text-align: right;

    .save-btn,
    .edit-btn {
      font-size: 28rpx;
      color: #1890ff;
    }
  }
}

.content {
  padding: 20rpx 30rpx;
}

.form {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;

  .form-item {
    margin-bottom: 30rpx;

    &:last-child {
      margin-bottom: 0;
    }

    .label {
      display: block;
      font-size: 28rpx;
      color: #333;
      margin-bottom: 15rpx;
    }

    .input {
      width: 100%;
      height: 80rpx;
      padding: 0 20rpx;
      background: #f5f5f5;
      border-radius: 8rpx;
      font-size: 28rpx;
    }

    .textarea {
      width: 100%;
      min-height: 200rpx;
      padding: 20rpx;
      background: #f5f5f5;
      border-radius: 8rpx;
      font-size: 28rpx;
    }

    .picker {
      height: 80rpx;
      line-height: 80rpx;
      padding: 0 20rpx;
      background: #f5f5f5;
      border-radius: 8rpx;
      font-size: 28rpx;
    }
  }
}

.detail {
  .detail-section {
    background: #fff;
    border-radius: 16rpx;
    padding: 30rpx;
    margin-bottom: 20rpx;

    .section-title {
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
      margin-bottom: 20rpx;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20rpx;

      .section-action {
        font-size: 28rpx;
        color: #1890ff;
      }
    }

    .info-item {
      display: flex;
      padding: 20rpx 0;
      border-bottom: 1rpx solid #f0f0f0;

      &:last-child {
        border-bottom: none;
      }

      .info-label {
        width: 150rpx;
        font-size: 28rpx;
        color: #666;
      }

      .info-value {
        flex: 1;
        font-size: 28rpx;
        color: #333;
      }

      .status-badge {
        padding: 6rpx 16rpx;
        border-radius: 16rpx;
        font-size: 22rpx;

        &.status-active {
          background: #e6f7ff;
          color: #1890ff;
        }

        &.status-archived {
          background: #f0f0f0;
          color: #999;
        }
      }
    }
  }

  .stats-grid {
    display: flex;
    justify-content: space-around;

    .stat-item {
      text-align: center;

      .stat-value {
        display: block;
        font-size: 48rpx;
        font-weight: bold;
        color: #1890ff;
        margin-bottom: 10rpx;
      }

      .stat-label {
        font-size: 24rpx;
        color: #999;
      }
    }
  }

  .workflow-list {
    .workflow-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20rpx;
      margin-bottom: 15rpx;
      background: #f8f8f8;
      border-radius: 8rpx;

      &:last-child {
        margin-bottom: 0;
      }

      .workflow-name {
        font-size: 28rpx;
        color: #333;
      }

      .workflow-arrow {
        font-size: 28rpx;
        color: #999;
      }
    }
  }

  .empty-tip {
    text-align: center;
    padding: 60rpx 0;
    font-size: 28rpx;
    color: #999;
  }

  .actions {
    margin-top: 40rpx;

    .action-btn {
      width: 100%;
      height: 88rpx;
      border-radius: 44rpx;
      font-size: 32rpx;

      &.danger {
        background: #fff;
        color: #ff4d4f;
        border: 1rpx solid #ff4d4f;
      }
    }
  }
}

.loading-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  font-size: 28rpx;
  color: #999;
}
</style>
