/**
 * CacheManager测试
 * Week 2 Day 3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheManager } from './CacheManager';

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager(5, 1000); // 最大5条，1秒TTL
  });

  describe('基本操作', () => {
    it('应该缓存和获取数据', () => {
      cache.set('node1', { result: 42 });
      const output = cache.get('node1');
      
      expect(output).toEqual({ result: 42 });
    });

    it('不存在的缓存应该返回null', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('应该检查缓存存在性', () => {
      cache.set('node1', { data: 'test' });
      
      expect(cache.has('node1')).toBe(true);
      expect(cache.has('node2')).toBe(false);
    });

    it('应该失效缓存', () => {
      cache.set('node1', { data: 'test' });
      expect(cache.has('node1')).toBe(true);
      
      cache.invalidate('node1');
      expect(cache.has('node1')).toBe(false);
    });
  });

  describe('批量操作', () => {
    it('应该批量失效缓存', () => {
      cache.set('node1', { data: 1 });
      cache.set('node2', { data: 2 });
      cache.set('node3', { data: 3 });
      
      const count = cache.invalidateBatch(['node1', 'node3']);
      
      expect(count).toBe(2);
      expect(cache.has('node1')).toBe(false);
      expect(cache.has('node2')).toBe(true);
      expect(cache.has('node3')).toBe(false);
    });

    it('应该清空所有缓存', () => {
      cache.set('node1', { data: 1 });
      cache.set('node2', { data: 2 });
      
      cache.clear();
      
      expect(cache.getStats().totalEntries).toBe(0);
    });
  });

  describe('LRU淘汰', () => {
    it('达到最大容量时应该淘汰LRU条目', () => {
      // 设置最大5条
      cache.set('node1', { data: 1 });
      cache.set('node2', { data: 2 });
      cache.set('node3', { data: 3 });
      cache.set('node4', { data: 4 });
      cache.set('node5', { data: 5 });
      
      // 访问node2和node3，使它们成为最近使用
      cache.get('node2');
      cache.get('node3');
      
      // 添加第6条，应该淘汰node1（最少最近使用）
      cache.set('node6', { data: 6 });
      
      expect(cache.has('node1')).toBe(false);
      expect(cache.has('node2')).toBe(true);
      expect(cache.has('node6')).toBe(true);
    });

    it('应该记录淘汰次数', () => {
      for (let i = 1; i <= 10; i++) {
        cache.set(`node${i}`, { data: i });
      }
      
      const stats = cache.getStats();
      expect(stats.evictions).toBe(5); // 淘汰了5条
    });
  });

  describe('TTL过期', () => {
    it('过期的缓存应该返回null', async () => {
      cache = new CacheManager(10, 50); // 50ms TTL
      cache.set('node1', { data: 'test' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(cache.get('node1')).toBeNull();
    });

    it('应该清理过期缓存', async () => {
      cache = new CacheManager(10, 50);
      cache.set('node1', { data: 1 });
      cache.set('node2', { data: 2 });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const removed = cache.cleanupExpired();
      expect(removed).toBe(2);
    });
  });

  describe('统计信息', () => {
    it('应该统计命中和未命中', () => {
      cache.set('node1', { data: 1 });
      
      cache.get('node1'); // hit
      cache.get('node1'); // hit
      cache.get('node2'); // miss
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('应该估算缓存大小', () => {
      cache.set('node1', { data: 'small' });
      cache.set('node2', { data: 'x'.repeat(1000) });
      
      const stats = cache.getStats();
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('应该重置统计信息', () => {
      cache.set('node1', { data: 1 });
      cache.get('node1');
      cache.get('node2');
      
      cache.resetStats();
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('配置', () => {
    it('应该设置最大大小', () => {
      cache.setMaxSize(3);
      
      cache.set('node1', { data: 1 });
      cache.set('node2', { data: 2 });
      cache.set('node3', { data: 3 });
      cache.set('node4', { data: 4 });
      
      expect(cache.getStats().totalEntries).toBe(3);
    });
  });

  describe('热门条目', () => {
    it('应该返回访问最多的条目', () => {
      cache.set('node1', { data: 1 });
      cache.set('node2', { data: 2 });
      cache.set('node3', { data: 3 });
      
      cache.get('node1');
      cache.get('node1');
      cache.get('node1');
      cache.get('node2');
      
      const top = cache.getTopEntries(2);
      
      expect(top[0].nodeId).toBe('node1');
      expect(top[0].accessCount).toBe(3);
      expect(top[1].nodeId).toBe('node2');
      expect(top[1].accessCount).toBe(1);
    });
  });
});
