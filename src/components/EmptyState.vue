<template>
  <view class="empty-state">
    <text class="empty-icon">{{ icon }}</text>
    <text class="empty-title">{{ title }}</text>
    <text class="empty-desc" v-if="description">{{ description }}</text>
    <button class="btn-action" v-if="actionText" @click="handleAction" size="mini">
      {{ actionText }}
    </button>
  </view>
</template>

<script setup lang="ts">
interface Props {
  icon?: string;
  title?: string;
  description?: string;
  actionText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  icon: '📭',
  title: '暂无数据',
  description: '',
  actionText: ''
});

const emit = defineEmits<{
  (e: 'action'): void;
}>();

function handleAction() {
  emit('action');
}
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 15px;
  opacity: 0.3;
}

.empty-title {
  font-size: 16px;
  color: #999;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 13px;
  color: #bbb;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 20px;
}

.btn-action {
  padding: 8px 24px;
  background: #1890ff;
  color: #fff;
  border: none;
  border-radius: 16px;
  font-size: 14px;
}
</style>
