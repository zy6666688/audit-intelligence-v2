/**
 * DataBlockStorage - DataBlock持久化存储
 * Week 2 Day 4
 * 
 * 支持内存、文件系统存储
 */

import type { NodeId } from '@audit/shared';
import { DataBlock, DataBlockMetadata } from './DataBlock';

/**
 * 存储适配器接口
 */
export interface StorageAdapter {
  save(id: string, data: any): Promise<void>;
  load(id: string): Promise<any>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  list(): Promise<string[]>;
}

/**
 * 内存存储适配器
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private storage: Map<string, any> = new Map();

  async save(id: string, data: any): Promise<void> {
    this.storage.set(id, JSON.parse(JSON.stringify(data))); // 深拷贝
  }

  async load(id: string): Promise<any> {
    const data = this.storage.get(id);
    if (!data) {
      throw new Error(`Data block ${id} not found`);
    }
    return JSON.parse(JSON.stringify(data));
  }

  async delete(id: string): Promise<void> {
    this.storage.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.storage.has(id);
  }

  async list(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  clear(): void {
    this.storage.clear();
  }

  getSize(): number {
    return this.storage.size;
  }
}

/**
 * DataBlock存储管理器
 */
export class DataBlockStorage {
  private adapter: StorageAdapter;
  private cache: Map<string, DataBlock> = new Map();
  private maxCacheSize: number;

  constructor(adapter?: StorageAdapter, maxCacheSize: number = 100) {
    this.adapter = adapter || new MemoryStorageAdapter();
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * 保存DataBlock
   */
  async save(block: DataBlock): Promise<string> {
    const metadata = block.getMetadata();
    const data = {
      metadata,
      rows: block.toArray()
    };

    await this.adapter.save(metadata.id, data);
    
    // 更新缓存
    this.cache.set(metadata.id, block);
    this.evictCacheIfNeeded();

    return metadata.id;
  }

  /**
   * 加载DataBlock
   */
  async load(id: string): Promise<DataBlock> {
    // 先检查缓存
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // 从存储加载
    const data = await this.adapter.load(id);
    const block = new DataBlock({
      nodeId: data.metadata.nodeId,
      totalRows: 0,
      columnNames: data.metadata.columnNames,
      chunkSize: data.metadata.chunkSize
    });

    // 重建数据
    if (data.rows && data.rows.length > 0) {
      block.addRows(data.rows);
    }

    // 加入缓存
    this.cache.set(id, block);
    this.evictCacheIfNeeded();

    return block;
  }

  /**
   * 删除DataBlock
   */
  async delete(id: string): Promise<void> {
    await this.adapter.delete(id);
    this.cache.delete(id);
  }

  /**
   * 检查是否存在
   */
  async exists(id: string): Promise<boolean> {
    return this.adapter.exists(id);
  }

  /**
   * 列出所有DataBlock ID
   */
  async list(): Promise<string[]> {
    return this.adapter.list();
  }

  /**
   * 按节点ID查找
   */
  async findByNodeId(nodeId: NodeId): Promise<string[]> {
    const allIds = await this.list();
    const result: string[] = [];

    for (const id of allIds) {
      const block = await this.load(id);
      const metadata = block.getMetadata();
      if (metadata.nodeId === nodeId) {
        result.push(id);
      }
    }

    return result;
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    const ids = await this.list();
    for (const id of ids) {
      await this.delete(id);
    }
    this.cache.clear();
  }

  /**
   * 获取存储统计
   */
  async getStats(): Promise<{
    totalBlocks: number;
    cachedBlocks: number;
    totalRows: number;
  }> {
    const ids = await this.list();
    const cachedCount = this.cache.size;
    let totalRows = 0;

    for (const id of ids) {
      const block = await this.load(id);
      totalRows += block.getTotalRows();
    }

    return {
      totalBlocks: ids.length,
      cachedBlocks: cachedCount,
      totalRows
    };
  }

  /**
   * 缓存淘汰（LRU简化版）
   */
  private evictCacheIfNeeded(): void {
    if (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}
