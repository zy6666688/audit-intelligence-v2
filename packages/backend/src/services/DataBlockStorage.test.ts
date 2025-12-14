/**
 * DataBlockStorage测试
 * Week 2 Day 4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DataBlockStorage, MemoryStorageAdapter } from './DataBlockStorage';
import { DataBlock } from './DataBlock';

describe('DataBlockStorage', () => {
  let storage: DataBlockStorage;

  beforeEach(() => {
    storage = new DataBlockStorage(new MemoryStorageAdapter());
  });

  describe('基本操作', () => {
    it('应该保存和加载DataBlock', async () => {
      const block = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id', 'name'],
        chunkSize: 100
      });

      block.addRows([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]);

      const id = await storage.save(block);
      const loaded = await storage.load(id);

      expect(loaded.getTotalRows()).toBe(2);
      const data = loaded.toArray();
      expect(data).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]);
    });

    it('应该删除DataBlock', async () => {
      const block = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });

      const id = await storage.save(block);
      expect(await storage.exists(id)).toBe(true);

      await storage.delete(id);
      expect(await storage.exists(id)).toBe(false);
    });
  });

  describe('查询操作', () => {
    it('应该列出所有DataBlock', async () => {
      const block1 = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });

      const block2 = new DataBlock({
        nodeId: 'node2',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });

      await storage.save(block1);
      await storage.save(block2);

      const ids = await storage.list();
      expect(ids).toHaveLength(2);
    });

    it('应该按节点ID查找', async () => {
      const block1 = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });

      const block2 = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });

      const block3 = new DataBlock({
        nodeId: 'node2',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });

      await storage.save(block1);
      await storage.save(block2);
      await storage.save(block3);

      const node1Blocks = await storage.findByNodeId('node1');
      expect(node1Blocks).toHaveLength(2);
    });
  });

  describe('统计信息', () => {
    it('应该返回正确的统计', async () => {
      const block1 = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });
      block1.addRows([{ id: 1 }, { id: 2 }]);

      const block2 = new DataBlock({
        nodeId: 'node2',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });
      block2.addRows([{ id: 3 }, { id: 4 }, { id: 5 }]);

      await storage.save(block1);
      await storage.save(block2);

      const stats = await storage.getStats();
      expect(stats.totalBlocks).toBe(2);
      expect(stats.totalRows).toBe(5);
    });
  });

  describe('缓存管理', () => {
    it('应该缓存加载的DataBlock', async () => {
      const block = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });

      const id = await storage.save(block);

      // 第一次加载
      await storage.load(id);
      
      // 第二次应该从缓存读取
      const loaded = await storage.load(id);
      expect(loaded).toBeDefined();
    });

    it('应该清空缓存', async () => {
      const block = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });

      await storage.save(block);
      storage.clearCache();

      const stats = await storage.getStats();
      expect(stats.cachedBlocks).toBe(0);
    });
  });

  describe('清空操作', () => {
    it('应该清空所有数据', async () => {
      const block1 = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });

      const block2 = new DataBlock({
        nodeId: 'node2',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 100
      });

      await storage.save(block1);
      await storage.save(block2);

      await storage.clear();

      const ids = await storage.list();
      expect(ids).toHaveLength(0);
    });
  });
});
