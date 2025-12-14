/**
 * CollaborationManager - 协作管理器
 * Week 4
 */

import type { GraphId, NodeId } from '@audit/shared';

export interface User {
  id: string;
  name: string;
  color: string;
}

export interface Cursor {
  userId: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface Selection {
  userId: string;
  nodeIds: NodeId[];
  timestamp: number;
}

export interface GraphLock {
  graphId: GraphId;
  userId: string;
  lockedAt: number;
  expiresAt: number;
}

/**
 * 协作管理器
 */
export class CollaborationManager {
  private users: Map<string, User> = new Map();
  private cursors: Map<string, Cursor> = new Map();
  private selections: Map<string, Selection> = new Map();
  private locks: Map<GraphId, GraphLock> = new Map();

  /**
   * 用户加入
   */
  joinUser(user: User): void {
    this.users.set(user.id, user);
  }

  /**
   * 用户离开
   */
  leaveUser(userId: string): void {
    this.users.delete(userId);
    this.cursors.delete(userId);
    this.selections.delete(userId);
  }

  /**
   * 更新光标位置
   */
  updateCursor(userId: string, x: number, y: number): void {
    this.cursors.set(userId, {
      userId,
      x,
      y,
      timestamp: Date.now()
    });
  }

  /**
   * 更新选择
   */
  updateSelection(userId: string, nodeIds: NodeId[]): void {
    this.selections.set(userId, {
      userId,
      nodeIds,
      timestamp: Date.now()
    });
  }

  /**
   * 获取所有用户
   */
  getUsers(): User[] {
    return Array.from(this.users.values());
  }

  /**
   * 获取所有光标
   */
  getCursors(): Cursor[] {
    return Array.from(this.cursors.values());
  }

  /**
   * 获取所有选择
   */
  getSelections(): Selection[] {
    return Array.from(this.selections.values());
  }

  /**
   * 尝试锁定图
   */
  tryLock(graphId: GraphId, userId: string, durationMs: number = 30000): boolean {
    const existing = this.locks.get(graphId);
    const now = Date.now();

    // 检查现有锁是否过期
    if (existing && existing.expiresAt > now) {
      return false;
    }

    // 创建新锁
    this.locks.set(graphId, {
      graphId,
      userId,
      lockedAt: now,
      expiresAt: now + durationMs
    });

    return true;
  }

  /**
   * 释放锁
   */
  unlock(graphId: GraphId, userId: string): boolean {
    const lock = this.locks.get(graphId);
    if (lock && lock.userId === userId) {
      this.locks.delete(graphId);
      return true;
    }
    return false;
  }

  /**
   * 检查是否锁定
   */
  isLocked(graphId: GraphId): boolean {
    const lock = this.locks.get(graphId);
    if (!lock) return false;
    return lock.expiresAt > Date.now();
  }

  /**
   * 清理过期数据
   */
  cleanup(): void {
    const now = Date.now();
    const timeout = 60000; // 60秒

    // 清理过期光标
    for (const [userId, cursor] of this.cursors) {
      if (now - cursor.timestamp > timeout) {
        this.cursors.delete(userId);
      }
    }

    // 清理过期选择
    for (const [userId, selection] of this.selections) {
      if (now - selection.timestamp > timeout) {
        this.selections.delete(userId);
      }
    }

    // 清理过期锁
    for (const [graphId, lock] of this.locks) {
      if (lock.expiresAt <= now) {
        this.locks.delete(graphId);
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      userCount: this.users.size,
      activeCursors: this.cursors.size,
      activeSelections: this.selections.size,
      activeLocks: this.locks.size
    };
  }
}
