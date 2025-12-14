/**
 * DataBlock测试
 * Week 2 Day 4
 */

import { describe, it, expect } from 'vitest';
import { DataBlock } from './DataBlock';

describe('DataBlock', () => {
  describe('基本操作', () => {
    it('应该创建DataBlock', () => {
      const block = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id', 'name'],
        chunkSize: 100
      });

      const metadata = block.getMetadata();
      expect(metadata.nodeId).toBe('node1');
      expect(metadata.columnNames).toEqual(['id', 'name']);
      expect(metadata.totalRows).toBe(0);
    });

    it('应该添加数据行', () => {
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

      expect(block.getTotalRows()).toBe(2);
    });
  });

  describe('异步迭代', () => {
    it('应该支持for await...of', async () => {
      const block = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id', 'name'],
        chunkSize: 2
      });

      block.addRows([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
      block.addRows([{ id: 3, name: 'Charlie' }]);

      const chunks: any[][] = [];
      for await (const chunk of block.iterate()) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(2);
      expect(chunks[1]).toHaveLength(1);
    });
  });

  describe('转换操作', () => {
    it('应该支持map', async () => {
      const block = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['value'],
        chunkSize: 100
      });

      block.addRows([{ value: 1 }, { value: 2 }, { value: 3 }]);

      const results: any[] = [];
      for await (const row of block.map(r => ({ value: r.value * 2 }))) {
        results.push(row);
      }

      expect(results).toEqual([
        { value: 2 },
        { value: 4 },
        { value: 6 }
      ]);
    });

    it('应该支持filter', async () => {
      const block = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['value'],
        chunkSize: 100
      });

      block.addRows([
        { value: 1 },
        { value: 2 },
        { value: 3 },
        { value: 4 }
      ]);

      const results: any[] = [];
      for await (const row of block.filter(r => r.value % 2 === 0)) {
        results.push(row);
      }

      expect(results).toEqual([
        { value: 2 },
        { value: 4 }
      ]);
    });

    it('应该支持collect', async () => {
      const block = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['id'],
        chunkSize: 2
      });

      block.addRows([{ id: 1 }, { id: 2 }]);
      block.addRows([{ id: 3 }]);

      const result = await block.collect();
      expect(result).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ]);
    });
  });

  describe('大数据处理', () => {
    it('应该高效处理大量数据', async () => {
      const block = new DataBlock({
        nodeId: 'node1',
        totalRows: 0,
        columnNames: ['index'],
        chunkSize: 1000
      });

      // 添加10000行数据
      const rowsPerChunk = 1000;
      for (let i = 0; i < 10; i++) {
        const chunk = Array.from({ length: rowsPerChunk }, (_, j) => ({
          index: i * rowsPerChunk + j
        }));
        block.addRows(chunk);
      }

      expect(block.getTotalRows()).toBe(10000);

      let count = 0;
      for await (const chunk of block.iterate()) {
        count += chunk.length;
      }

      expect(count).toBe(10000);
    });
  });
});
