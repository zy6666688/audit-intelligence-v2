/**
 * CollaborationStore - 协作状态管理
 * Week 4
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface CollabUser {
  id: string;
  name: string;
  color: string;
}

export interface CollabCursor {
  userId: string;
  x: number;
  y: number;
}

export const useCollaborationStore = defineStore('collaboration', () => {
  const users = ref<Map<string, CollabUser>>(new Map());
  const cursors = ref<Map<string, CollabCursor>>(new Map());
  const currentUserId = ref<string>('');

  // 当前用户
  const currentUser = computed(() => {
    return users.value.get(currentUserId.value);
  });

  // 其他用户
  const otherUsers = computed(() => {
    return Array.from(users.value.values())
      .filter(u => u.id !== currentUserId.value);
  });

  // 其他用户的光标
  const otherCursors = computed(() => {
    return Array.from(cursors.value.values())
      .filter(c => c.userId !== currentUserId.value);
  });

  /**
   * 初始化当前用户
   */
  function initUser(userId: string, userName: string) {
    currentUserId.value = userId;
    const color = generateUserColor(userId);
    
    users.value.set(userId, {
      id: userId,
      name: userName,
      color
    });
  }

  /**
   * 添加远程用户
   */
  function addUser(user: CollabUser) {
    users.value.set(user.id, user);
  }

  /**
   * 移除用户
   */
  function removeUser(userId: string) {
    users.value.delete(userId);
    cursors.value.delete(userId);
  }

  /**
   * 更新光标
   */
  function updateCursor(userId: string, x: number, y: number) {
    cursors.value.set(userId, { userId, x, y });
  }

  /**
   * 广播自己的光标
   */
  function broadcastCursor(x: number, y: number) {
    if (!currentUserId.value) return;
    
    // TODO: 通过WebSocket发送
    updateCursor(currentUserId.value, x, y);
  }

  /**
   * 清空所有状态
   */
  function reset() {
    users.value.clear();
    cursors.value.clear();
    currentUserId.value = '';
  }

  /**
   * 生成用户颜色
   */
  function generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    
    const hash = userId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  }

  return {
    users,
    cursors,
    currentUserId,
    currentUser,
    otherUsers,
    otherCursors,
    initUser,
    addUser,
    removeUser,
    updateCursor,
    broadcastCursor,
    reset
  };
});
