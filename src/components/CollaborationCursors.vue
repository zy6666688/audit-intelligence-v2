<template>
  <div class="collaboration-cursors">
    <!-- 其他用户的光标 -->
    <div
      v-for="cursor in otherCursors"
      :key="cursor.userId"
      class="cursor"
      :style="{
        left: cursor.x + 'px',
        top: cursor.y + 'px',
        borderColor: getUserColor(cursor.userId)
      }"
    >
      <div 
        class="cursor-label"
        :style="{ backgroundColor: getUserColor(cursor.userId) }"
      >
        {{ getUserName(cursor.userId) }}
      </div>
    </div>

    <!-- 在线用户列表 -->
    <div class="user-list" v-if="showUserList">
      <div class="user-list-header">
        <text>在线用户 ({{ otherUsers.length + 1 }})</text>
      </div>
      <div class="user-item" v-for="user in allUsers" :key="user.id">
        <div 
          class="user-color" 
          :style="{ backgroundColor: user.color }"
        ></div>
        <text class="user-name">{{ user.name }}</text>
        <text v-if="user.id === currentUserId" class="user-tag">(我)</text>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCollaborationStore } from '../stores/collaboration';

const props = defineProps<{
  showUserList?: boolean;
}>();

const collabStore = useCollaborationStore();

const otherCursors = computed(() => collabStore.otherCursors);
const otherUsers = computed(() => collabStore.otherUsers);
const currentUserId = computed(() => collabStore.currentUserId);
const currentUser = computed(() => collabStore.currentUser);

const allUsers = computed(() => {
  const users = [...collabStore.otherUsers];
  if (currentUser.value) {
    users.unshift(currentUser.value);
  }
  return users;
});

function getUserColor(userId: string): string {
  const user = collabStore.users.get(userId);
  return user?.color || '#999';
}

function getUserName(userId: string): string {
  const user = collabStore.users.get(userId);
  return user?.name || 'Unknown';
}
</script>

<style scoped>
.collaboration-cursors {
  position: fixed;
  pointer-events: none;
  z-index: 1000;
}

.cursor {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: all 0.1s ease;
}

.cursor-label {
  position: absolute;
  left: 25px;
  top: -5px;
  padding: 2px 8px;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
}

.user-list {
  position: fixed;
  top: 60px;
  right: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  padding: 12px;
  min-width: 150px;
  pointer-events: auto;
}

.user-list-header {
  font-weight: bold;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 6px 0;
}

.user-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
}

.user-name {
  flex: 1;
  font-size: 14px;
}

.user-tag {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}
</style>
