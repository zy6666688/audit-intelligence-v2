/**
 * DataBlock - 流式数据块
 * Week 2 Day 4
 * 
 * 支持大数据集的流式处理
 */

import type { NodeId } from '@audit/shared';

/**
 * DataBlock元数据
 */
export interface DataBlockMetadata {
  id: string;
  nodeId: NodeId;
  totalRows: number;
  columnNames: string[];
  createdAt: number;
  chunkSize: number;
}

/**
 * DataBlock - 流式数据块
 * 
 * 特性:
 * - AsyncIterator支持
 * - 分块读写
 * - 内存高效
 */
export class DataBlock {
  private metadata: DataBlockMetadata;
  private chunks: any[][] = [];
  private chunkSize: number;

  constructor(metadata: Omit<DataBlockMetadata, 'id' | 'createdAt'>) {
    this.metadata = {
      ...metadata,
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    };
    this.chunkSize = metadata.chunkSize || 1000;
  }

  /**
   * 添加数据行
   */
  addRows(rows: any[]): void {
    this.chunks.push(rows);
    this.metadata.totalRows += rows.length;
  }

  /**
   * 异步迭代器
   */
  async *iterate(): AsyncIterableIterator<any[]> {
    for (const chunk of this.chunks) {
      yield chunk;
    }
  }

  /**
   * 获取元数据
   */
  getMetadata(): DataBlockMetadata {
    return { ...this.metadata };
  }

  /**
   * 获取总行数
   */
  getTotalRows(): number {
    return this.metadata.totalRows;
  }

  /**
   * 转换为数组（谨慎使用，可能内存占用大）
   */
  toArray(): any[] {
    return this.chunks.flat();
  }

  /**
   * 映射转换
   */
  async *map(fn: (row: any) => any): AsyncIterableIterator<any> {
    for await (const chunk of this.iterate()) {
      for (const row of chunk) {
        yield fn(row);
      }
    }
  }

  /**
   * 过滤
   */
  async *filter(predicate: (row: any) => boolean): AsyncIterableIterator<any> {
    for await (const chunk of this.iterate()) {
      for (const row of chunk) {
        if (predicate(row)) {
          yield row;
        }
      }
    }
  }

  /**
   * 收集到数组
   */
  async collect(): Promise<any[]> {
    const result: any[] = [];
    for await (const chunk of this.iterate()) {
      result.push(...chunk);
    }
    return result;
  }
}
