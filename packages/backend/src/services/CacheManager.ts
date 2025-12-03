/**
 * CacheManager - 节点输出缓存管理器
 * Week 2 Day 3
 * 
 * 实现LRU缓存策略，优化执行性能
 */

import type { NodeId } from '@audit/shared';

/**
 * 缓存条目
 */
interface CacheEntry {
  nodeId: NodeId;
  output: any;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  size?: number; // 估算的内存大小（字节）
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  totalSize: number; // 总内存使用（字节）
}

/**
 * CacheManager - 节点输出缓存管理器
 * 
 * 特性:
 * - LRU淘汰策略
 * - 缓存命中率统计
 * - 内存使用监控
 * - TTL支持
 */
export class CacheManager {
  private cache: Map<NodeId, CacheEntry> = new Map();
  private maxSize: number; // 最大缓存条目数
  private defaultTTL: number; // 默认过期时间(ms)
  
  // 统计信息
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(maxSize: number = 1000, defaultTTL: number = 3600000) { // 默认1小时
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * 缓存节点输出
   */
  set(nodeId: NodeId, output: any, ttl?: number): void {
    const now = Date.now();
    
    // 估算输出大小
    const size = this.estimateSize(output);
    
    const entry: CacheEntry = {
      nodeId,
      output,
      timestamp: now,
      accessCount: 0,
      lastAccess: now,
      size
    };
    
    // 如果达到最大容量，执行LRU淘汰
    if (this.cache.size >= this.maxSize && !this.cache.has(nodeId)) {
      this.evictLRU();
    }
    
    this.cache.set(nodeId, entry);
  }

  /**
   * 获取缓存的输出
   */
  get(nodeId: NodeId): any | null {
    const entry = this.cache.get(nodeId);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // 检查是否过期
    const now = Date.now();
    if (now - entry.timestamp > this.defaultTTL) {
      this.cache.delete(nodeId);
      this.misses++;
      return null;
    }
    
    // 更新访问信息
    entry.accessCount++;
    entry.lastAccess = now;
    this.hits++;
    
    return entry.output;
  }

  /**
   * 检查是否有缓存
   */
  has(nodeId: NodeId): boolean {
    const entry = this.cache.get(nodeId);
    
    if (!entry) {
      return false;
    }
    
    // 检查是否过期
    const now = Date.now();
    if (now - entry.timestamp > this.defaultTTL) {
      this.cache.delete(nodeId);
      return false;
    }
    
    return true;
  }

  /**
   * 使缓存失效
   */
  invalidate(nodeId: NodeId): boolean {
    return this.cache.delete(nodeId);
  }

  /**
   * 批量失效
   */
  invalidateBatch(nodeIds: NodeId[]): number {
    let count = 0;
    for (const nodeId of nodeIds) {
      if (this.cache.delete(nodeId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size || 0;
    }
    
    return {
      totalEntries: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      evictions: this.evictions,
      totalSize
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * 设置最大缓存大小
   */
  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize;
    
    // 如果当前大小超过新限制，执行淘汰
    while (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * 设置默认TTL
   */
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }

  /**
   * 清理过期缓存
   */
  cleanupExpired(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [nodeId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.cache.delete(nodeId);
        removed++;
      }
    }
    
    return removed;
  }

  /**
   * LRU淘汰策略：移除最少最近使用的条目
   */
  private evictLRU(): void {
    let lruNodeId: NodeId | null = null;
    let lruTime = Infinity;
    
    for (const [nodeId, entry] of this.cache.entries()) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruNodeId = nodeId;
      }
    }
    
    if (lruNodeId) {
      this.cache.delete(lruNodeId);
      this.evictions++;
    }
  }

  /**
   * 估算对象大小（粗略估算）
   */
  private estimateSize(obj: any): number {
    try {
      const str = JSON.stringify(obj);
      return str.length * 2; // UTF-16编码，每字符2字节
    } catch {
      return 0; // 无法序列化的对象
    }
  }

  /**
   * 获取热门缓存条目（按访问次数）
   */
  getTopEntries(limit: number = 10): Array<{ nodeId: NodeId; accessCount: number }> {
    const entries = Array.from(this.cache.entries()).map(([nodeId, entry]) => ({
      nodeId,
      accessCount: entry.accessCount
    }));
    
    entries.sort((a, b) => b.accessCount - a.accessCount);
    return entries.slice(0, limit);
  }
}
