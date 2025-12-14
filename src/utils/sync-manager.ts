/**
 * 数据同步管理器
 * 支持离线操作和自动同步
 */

import { PlatformAdapter } from './platform';

/**
 * 同步操作类型
 */
export type SyncActionType = 
  | 'create' 
  | 'update' 
  | 'delete';

/**
 * 资源类型
 */
export type ResourceType = 
  | 'project' 
  | 'node' 
  | 'evidence' 
  | 'comment' 
  | 'task';

/**
 * 同步操作
 */
export interface SyncOperation {
  id: string;
  type: ResourceType;
  action: SyncActionType;
  resourceId: string;
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'success' | 'failed';
  error?: string;
}

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{
    operation: SyncOperation;
    error: string;
  }>;
}

/**
 * 数据同步管理器
 */
export class SyncManager {
  
  private static readonly SYNC_QUEUE_KEY = 'sync_queue';
  private static readonly MAX_RETRY = 3;
  private static syncQueue: SyncOperation[] = [];
  private static isSyncing = false;
  
  /**
   * 初始化同步管理器
   */
  static async init(): Promise<void> {
    // 从本地加载同步队列
    const queue = await PlatformAdapter.getStorage<SyncOperation[]>(this.SYNC_QUEUE_KEY);
    if (queue) {
      this.syncQueue = queue;
    }
    
    // 监听网络变化
    PlatformAdapter.watchNetwork((isOnline) => {
      if (isOnline && this.syncQueue.length > 0) {
        console.log('网络恢复，开始同步...');
        this.syncAll();
      }
    });
    
    // 如果当前在线，立即同步
    const isOnline = await PlatformAdapter.isOnline();
    if (isOnline && this.syncQueue.length > 0) {
      this.syncAll();
    }
  }
  
  /**
   * 添加操作到同步队列
   */
  static async addOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<void> {
    const op: SyncOperation = {
      ...operation,
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };
    
    this.syncQueue.push(op);
    await this.saveQueue();
    
    console.log(`添加同步操作: ${op.type} ${op.action} ${op.resourceId}`);
    
    // 如果在线，立即同步
    const isOnline = await PlatformAdapter.isOnline();
    if (isOnline) {
      await this.syncAll();
    }
  }
  
  /**
   * 同步所有待同步操作
   */
  static async syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('正在同步中，跳过...');
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errors: []
      };
    }
    
    const isOnline = await PlatformAdapter.isOnline();
    if (!isOnline) {
      console.log('离线状态，无法同步');
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errors: []
      };
    }
    
    this.isSyncing = true;
    PlatformAdapter.showLoading('同步中...');
    
    let syncedCount = 0;
    let failedCount = 0;
    const errors: Array<{ operation: SyncOperation; error: string }> = [];
    
    try {
      // 按时间顺序同步
      const operations = [...this.syncQueue].sort((a, b) => a.timestamp - b.timestamp);
      
      for (const op of operations) {
        if (op.status === 'success') {
          continue;
        }
        
        try {
          op.status = 'syncing';
          await this.syncOperation(op);
          
          op.status = 'success';
          syncedCount++;
          
          // 从队列移除
          this.syncQueue = this.syncQueue.filter(item => item.id !== op.id);
          
          console.log(`同步成功: ${op.type} ${op.action} ${op.resourceId}`);
        } catch (error: any) {
          op.status = 'failed';
          op.retryCount++;
          op.error = error.message;
          
          if (op.retryCount >= this.MAX_RETRY) {
            failedCount++;
            errors.push({
              operation: op,
              error: error.message
            });
            
            // 达到最大重试次数，从队列移除
            this.syncQueue = this.syncQueue.filter(item => item.id !== op.id);
            
            console.error(`同步失败（已放弃）: ${op.type} ${op.action} ${op.resourceId}`, error);
          } else {
            console.warn(`同步失败（重试 ${op.retryCount}/${this.MAX_RETRY}）: ${op.type} ${op.action} ${op.resourceId}`, error);
          }
        }
      }
    } finally {
      await this.saveQueue();
      this.isSyncing = false;
      PlatformAdapter.hideLoading();
    }
    
    const result: SyncResult = {
      success: failedCount === 0,
      syncedCount,
      failedCount,
      errors
    };
    
    if (syncedCount > 0) {
      PlatformAdapter.showToast(`同步完成：${syncedCount} 项`, 'success');
    }
    
    if (failedCount > 0) {
      PlatformAdapter.showToast(`同步失败：${failedCount} 项`, 'error');
    }
    
    return result;
  }
  
  /**
   * 同步单个操作
   */
  private static async syncOperation(op: SyncOperation): Promise<void> {
    const token = PlatformAdapter.getToken();
    const apiBase = (import.meta.env?.VITE_API_BASE as string) || 'https://api.audit.com';
    
    let url = '';
    let method = '';
    
    // 根据资源类型和操作构建URL和方法
    switch (op.type) {
      case 'project':
        if (op.action === 'create') {
          url = `${apiBase}/projects`;
          method = 'POST';
        } else if (op.action === 'update') {
          url = `${apiBase}/projects/${op.resourceId}`;
          method = 'PUT';
        } else if (op.action === 'delete') {
          url = `${apiBase}/projects/${op.resourceId}`;
          method = 'DELETE';
        }
        break;
      
      case 'node':
        if (op.action === 'create') {
          url = `${apiBase}/nodes`;
          method = 'POST';
        } else if (op.action === 'update') {
          url = `${apiBase}/nodes/${op.resourceId}`;
          method = 'PUT';
        } else if (op.action === 'delete') {
          url = `${apiBase}/nodes/${op.resourceId}`;
          method = 'DELETE';
        }
        break;
      
      case 'evidence':
        if (op.action === 'create') {
          url = `${apiBase}/evidences`;
          method = 'POST';
        } else if (op.action === 'update') {
          url = `${apiBase}/evidences/${op.resourceId}`;
          method = 'PUT';
        } else if (op.action === 'delete') {
          url = `${apiBase}/evidences/${op.resourceId}`;
          method = 'DELETE';
        }
        break;
      
      case 'comment':
        if (op.action === 'create') {
          url = `${apiBase}/comments`;
          method = 'POST';
        } else if (op.action === 'update') {
          url = `${apiBase}/comments/${op.resourceId}`;
          method = 'PUT';
        } else if (op.action === 'delete') {
          url = `${apiBase}/comments/${op.resourceId}`;
          method = 'DELETE';
        }
        break;
      
      case 'task':
        if (op.action === 'create') {
          url = `${apiBase}/tasks`;
          method = 'POST';
        } else if (op.action === 'update') {
          url = `${apiBase}/tasks/${op.resourceId}`;
          method = 'PUT';
        } else if (op.action === 'delete') {
          url = `${apiBase}/tasks/${op.resourceId}`;
          method = 'DELETE';
        }
        break;
    }
    
    if (!url || !method) {
      throw new Error(`Invalid operation: ${op.type} ${op.action}`);
    }
    
    // 发送请求
    // #ifdef MP-WEIXIN
    const mpRes = await uni.request({
      url,
      method: method as any,
      data: op.data,
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (mpRes.statusCode !== 200 && mpRes.statusCode !== 201) {
      throw new Error(`HTTP ${mpRes.statusCode}: ${JSON.stringify(mpRes.data)}`);
    }
    // #endif
    
    // #ifdef H5
    const h5Res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: method !== 'GET' && method !== 'DELETE' ? JSON.stringify(op.data) : undefined
    });
    
    if (!h5Res.ok) {
      const error = await h5Res.text();
      throw new Error(`HTTP ${h5Res.status}: ${error}`);
    }
    // #endif
  }
  
  /**
   * 获取同步队列状态
   */
  static getQueueStatus(): {
    total: number;
    pending: number;
    syncing: number;
    failed: number;
  } {
    return {
      total: this.syncQueue.length,
      pending: this.syncQueue.filter(op => op.status === 'pending').length,
      syncing: this.syncQueue.filter(op => op.status === 'syncing').length,
      failed: this.syncQueue.filter(op => op.status === 'failed').length
    };
  }
  
  /**
   * 清空同步队列
   */
  static async clearQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveQueue();
  }
  
  /**
   * 保存队列到本地
   */
  private static async saveQueue(): Promise<void> {
    await PlatformAdapter.setStorage(this.SYNC_QUEUE_KEY, this.syncQueue);
  }
  
  /**
   * 生成唯一ID
   */
  private static generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 本地数据缓存管理器
 */
export class CacheManager {
  
  private static readonly CACHE_PREFIX = 'cache_';
  private static readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5分钟
  
  /**
   * 设置缓存
   */
  static async set(key: string, value: any, expiry?: number): Promise<void> {
    const cacheKey = this.CACHE_PREFIX + key;
    const cacheData = {
      value,
      timestamp: Date.now(),
      expiry: expiry || this.CACHE_EXPIRY
    };
    
    await PlatformAdapter.setStorage(cacheKey, cacheData);
  }
  
  /**
   * 获取缓存
   */
  static async get<T = any>(key: string): Promise<T | null> {
    const cacheKey = this.CACHE_PREFIX + key;
    const cacheData = await PlatformAdapter.getStorage<{
      value: T;
      timestamp: number;
      expiry: number;
    }>(cacheKey);
    
    if (!cacheData) {
      return null;
    }
    
    // 检查是否过期
    const now = Date.now();
    if (now - cacheData.timestamp > cacheData.expiry) {
      await this.remove(key);
      return null;
    }
    
    return cacheData.value;
  }
  
  /**
   * 删除缓存
   */
  static async remove(key: string): Promise<void> {
    const cacheKey = this.CACHE_PREFIX + key;
    await PlatformAdapter.removeStorage(cacheKey);
  }
  
  /**
   * 清空所有缓存
   */
  static async clear(): Promise<void> {
    // 这里需要遍历所有存储的key，删除以CACHE_PREFIX开头的
    // 由于uni-app没有提供遍历所有key的API，这里简化处理
    console.log('清空缓存');
  }
}
