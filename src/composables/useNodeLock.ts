/**
 * useNodeLock - 节点锁Hook
 * Week 7: 前端节点锁管理
 * 
 * 功能:
 * 1. 尝试锁定节点
 * 2. 释放节点锁
 * 3. 监听锁状态变化
 * 4. 自动释放
 */

import { ref, computed, onUnmounted, watch } from 'vue';
import type { Ref } from 'vue';

/**
 * 节点锁信息
 */
export interface NodeLockInfo {
  nodeId: string;
  userId: string;
  userName: string;
  lockedAt: string;
  expiresAt: string;
}

/**
 * 锁状态
 */
export interface LockState {
  isLocked: boolean;
  isLockedByMe: boolean;
  lockedBy?: {
    userId: string;
    userName: string;
  };
  lockInfo?: NodeLockInfo;
}

/**
 * useNodeLock Hook
 */
export function useNodeLock(nodeId: Ref<string> | string) {
  const nodeIdRef = ref(nodeId);
  const lockState = ref<LockState>({
    isLocked: false,
    isLockedByMe: false
  });
  
  // 当前用户信息（从store获取）
  const currentUserId = ref('user_' + Math.random().toString(36).substr(2, 9));
  const currentUserName = ref('测试用户');
  
  /**
   * 尝试获取锁
   */
  const tryLock = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // 调用后端API
      const response = await fetch('/api/locks/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: nodeIdRef.value,
          userId: currentUserId.value,
          userName: currentUserName.value
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        lockState.value = {
          isLocked: true,
          isLockedByMe: true,
          lockedBy: {
            userId: currentUserId.value,
            userName: currentUserName.value
          },
          lockInfo: result.lock
        };
      } else {
        lockState.value = {
          isLocked: true,
          isLockedByMe: false,
          lockedBy: result.lock ? {
            userId: result.lock.userId,
            userName: result.lock.userName
          } : undefined,
          lockInfo: result.lock
        };
      }
      
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };
  
  /**
   * 释放锁
   */
  const releaseLock = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/locks/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: nodeIdRef.value,
          userId: currentUserId.value
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        lockState.value = {
          isLocked: false,
          isLockedByMe: false
        };
      }
      
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };
  
  /**
   * 检查锁状态
   */
  const checkLockStatus = async (): Promise<void> => {
    try {
      const response = await fetch(`/api/locks/status/${nodeIdRef.value}`);
      const result = await response.json();
      
      if (result.isLocked) {
        lockState.value = {
          isLocked: true,
          isLockedByMe: result.lock.userId === currentUserId.value,
          lockedBy: {
            userId: result.lock.userId,
            userName: result.lock.userName
          },
          lockInfo: result.lock
        };
      } else {
        lockState.value = {
          isLocked: false,
          isLockedByMe: false
        };
      }
    } catch (error) {
      console.error('Failed to check lock status:', error);
    }
  };
  
  // 计算属性
  const isLocked = computed(() => lockState.value.isLocked);
  const isLockedByMe = computed(() => lockState.value.isLockedByMe);
  const lockedBy = computed(() => lockState.value.lockedBy);
  const canEdit = computed(() => !isLocked.value || isLockedByMe.value);
  
  // 监听nodeId变化
  watch(nodeIdRef, () => {
    checkLockStatus();
  }, { immediate: true });
  
  // 组件卸载时自动释放锁
  onUnmounted(() => {
    if (isLockedByMe.value) {
      releaseLock();
    }
  });
  
  return {
    // 状态
    isLocked,
    isLockedByMe,
    lockedBy,
    canEdit,
    lockInfo: computed(() => lockState.value.lockInfo),
    
    // 方法
    tryLock,
    releaseLock,
    checkLockStatus
  };
}

/**
 * useMultiNodeLock - 多节点锁管理
 */
export function useMultiNodeLock(nodeIds: Ref<string[]>) {
  const locks = ref<Map<string, LockState>>(new Map());
  
  const tryLockAll = async () => {
    const results = await Promise.all(
      nodeIds.value.map(nodeId => {
        const { tryLock } = useNodeLock(nodeId);
        return tryLock();
      })
    );
    
    return results.every(r => r.success);
  };
  
  const releaseAll = async () => {
    await Promise.all(
      nodeIds.value.map(nodeId => {
        const { releaseLock } = useNodeLock(nodeId);
        return releaseLock();
      })
    );
  };
  
  return {
    locks,
    tryLockAll,
    releaseAll
  };
}
