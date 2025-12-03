/**
 * NodeLockManager - 节点锁管理器
 * Week 7: 基于内存的节点锁实现（生产环境建议使用Redis）
 * 
 * 功能:
 * 1. 节点锁定/解锁
 * 2. 自动续期
 * 3. 强制释放
 * 4. 锁事件通知
 */

import { EventEmitter } from 'events';

/**
 * 锁信息
 */
export interface NodeLock {
  nodeId: string;
  userId: string;
  userName: string;
  lockedAt: Date;
  expiresAt: Date;
  autoRenew: boolean;
}

/**
 * 锁事件
 */
export interface LockEvent {
  type: 'acquired' | 'released' | 'renewed' | 'expired' | 'force_released';
  nodeId: string;
  userId: string;
  userName?: string;
  timestamp: Date;
}

/**
 * 节点锁管理器
 */
export class NodeLockManager extends EventEmitter {
  private locks: Map<string, NodeLock> = new Map();
  private renewTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // 配置
  private readonly DEFAULT_LOCK_TTL = 30 * 1000; // 30秒
  private readonly AUTO_RENEW_INTERVAL = 20 * 1000; // 20秒自动续期
  
  constructor() {
    super();
    
    // 启动过期检查
    this.startExpirationCheck();
  }
  
  /**
   * 尝试获取锁
   */
  async tryLock(
    nodeId: string,
    userId: string,
    userName: string,
    options?: {
      ttl?: number;
      autoRenew?: boolean;
    }
  ): Promise<{ success: boolean; lock?: NodeLock; error?: string }> {
    const existingLock = this.locks.get(nodeId);
    
    // 检查是否已被其他用户锁定
    if (existingLock) {
      if (existingLock.userId !== userId) {
        return {
          success: false,
          error: `Node is locked by ${existingLock.userName}`,
          lock: existingLock
        };
      }
      
      // 同一用户续期
      return this.renewLock(nodeId, userId);
    }
    
    // 创建新锁
    const ttl = options?.ttl || this.DEFAULT_LOCK_TTL;
    const autoRenew = options?.autoRenew ?? true;
    
    const lock: NodeLock = {
      nodeId,
      userId,
      userName,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + ttl),
      autoRenew
    };
    
    this.locks.set(nodeId, lock);
    
    // 设置自动续期
    if (autoRenew) {
      this.setupAutoRenew(nodeId);
    }
    
    // 触发事件
    this.emitLockEvent({
      type: 'acquired',
      nodeId,
      userId,
      userName,
      timestamp: new Date()
    });
    
    return { success: true, lock };
  }
  
  /**
   * 释放锁
   */
  async releaseLock(
    nodeId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const lock = this.locks.get(nodeId);
    
    if (!lock) {
      return { success: false, error: 'Lock not found' };
    }
    
    if (lock.userId !== userId) {
      return { success: false, error: 'Not lock owner' };
    }
    
    // 清除自动续期
    this.clearAutoRenew(nodeId);
    
    // 删除锁
    this.locks.delete(nodeId);
    
    // 触发事件
    this.emitLockEvent({
      type: 'released',
      nodeId,
      userId,
      userName: lock.userName,
      timestamp: new Date()
    });
    
    return { success: true };
  }
  
  /**
   * 续期锁
   */
  async renewLock(
    nodeId: string,
    userId: string,
    ttl?: number
  ): Promise<{ success: boolean; lock?: NodeLock; error?: string }> {
    const lock = this.locks.get(nodeId);
    
    if (!lock) {
      return { success: false, error: 'Lock not found' };
    }
    
    if (lock.userId !== userId) {
      return { success: false, error: 'Not lock owner' };
    }
    
    // 更新过期时间
    const newTtl = ttl || this.DEFAULT_LOCK_TTL;
    lock.expiresAt = new Date(Date.now() + newTtl);
    
    // 触发事件
    this.emitLockEvent({
      type: 'renewed',
      nodeId,
      userId,
      userName: lock.userName,
      timestamp: new Date()
    });
    
    return { success: true, lock };
  }
  
  /**
   * 强制释放锁（管理员功能）
   */
  async forceRelease(nodeId: string, adminUserId: string): Promise<{ success: boolean }> {
    const lock = this.locks.get(nodeId);
    
    if (!lock) {
      return { success: false };
    }
    
    // 清除自动续期
    this.clearAutoRenew(nodeId);
    
    // 删除锁
    this.locks.delete(nodeId);
    
    // 触发事件
    this.emitLockEvent({
      type: 'force_released',
      nodeId,
      userId: lock.userId,
      userName: lock.userName,
      timestamp: new Date()
    });
    
    console.log(`🔓 Lock force-released by admin: node=${nodeId}, owner=${lock.userName}`);
    
    return { success: true };
  }
  
  /**
   * 检查锁状态
   */
  isLocked(nodeId: string): boolean {
    const lock = this.locks.get(nodeId);
    if (!lock) return false;
    
    // 检查是否过期
    if (lock.expiresAt < new Date()) {
      this.handleExpiredLock(nodeId);
      return false;
    }
    
    return true;
  }
  
  /**
   * 获取锁信息
   */
  getLock(nodeId: string): NodeLock | null {
    return this.locks.get(nodeId) || null;
  }
  
  /**
   * 获取用户的所有锁
   */
  getUserLocks(userId: string): NodeLock[] {
    return Array.from(this.locks.values()).filter(
      lock => lock.userId === userId
    );
  }
  
  /**
   * 释放用户的所有锁
   */
  async releaseUserLocks(userId: string): Promise<void> {
    const userLocks = this.getUserLocks(userId);
    
    for (const lock of userLocks) {
      await this.releaseLock(lock.nodeId, userId);
    }
    
    console.log(`🔓 Released ${userLocks.length} locks for user: ${userId}`);
  }
  
  /**
   * 设置自动续期
   */
  private setupAutoRenew(nodeId: string): void {
    // 清除旧的定时器
    this.clearAutoRenew(nodeId);
    
    // 创建新的定时器
    const timer = setInterval(() => {
      const lock = this.locks.get(nodeId);
      if (lock && lock.autoRenew) {
        this.renewLock(nodeId, lock.userId);
      } else {
        this.clearAutoRenew(nodeId);
      }
    }, this.AUTO_RENEW_INTERVAL);
    
    this.renewTimers.set(nodeId, timer);
  }
  
  /**
   * 清除自动续期
   */
  private clearAutoRenew(nodeId: string): void {
    const timer = this.renewTimers.get(nodeId);
    if (timer) {
      clearInterval(timer);
      this.renewTimers.delete(nodeId);
    }
  }
  
  /**
   * 处理过期的锁
   */
  private handleExpiredLock(nodeId: string): void {
    const lock = this.locks.get(nodeId);
    if (!lock) return;
    
    // 清除自动续期
    this.clearAutoRenew(nodeId);
    
    // 删除锁
    this.locks.delete(nodeId);
    
    // 触发事件
    this.emitLockEvent({
      type: 'expired',
      nodeId,
      userId: lock.userId,
      userName: lock.userName,
      timestamp: new Date()
    });
    
    console.log(`⏰ Lock expired: node=${nodeId}, owner=${lock.userName}`);
  }
  
  /**
   * 启动过期检查
   */
  private startExpirationCheck(): void {
    setInterval(() => {
      const now = new Date();
      
      for (const [nodeId, lock] of this.locks.entries()) {
        if (lock.expiresAt < now) {
          this.handleExpiredLock(nodeId);
        }
      }
    }, 5000); // 每5秒检查一次
  }
  
  /**
   * 触发锁事件
   */
  private emitLockEvent(event: LockEvent): void {
    this.emit('lockEvent', event);
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalLocks: this.locks.size,
      activeAutoRenews: this.renewTimers.size,
      locks: Array.from(this.locks.values()).map(lock => ({
        nodeId: lock.nodeId,
        userId: lock.userId,
        userName: lock.userName,
        lockedAt: lock.lockedAt.toISOString(),
        expiresAt: lock.expiresAt.toISOString(),
        autoRenew: lock.autoRenew
      }))
    };
  }
  
  /**
   * 清理所有锁（用于测试）
   */
  cleanup(): void {
    // 清除所有定时器
    for (const timer of this.renewTimers.values()) {
      clearInterval(timer);
    }
    
    this.locks.clear();
    this.renewTimers.clear();
  }
}

/**
 * 单例实例
 */
export const nodeLockManager = new NodeLockManager();
