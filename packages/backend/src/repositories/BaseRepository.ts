/**
 * 基础Repository类
 * 提供通用的CRUD操作模板
 */

import { PrismaClient } from '@prisma/client';

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export abstract class BaseRepository<T> {
  constructor(protected prisma: PrismaClient) {}

  /**
   * 根据ID查找单个记录
   */
  abstract findById(id: string): Promise<T | null>;

  /**
   * 创建记录
   */
  abstract create(data: any): Promise<T>;

  /**
   * 更新记录
   */
  abstract update(id: string, data: any): Promise<T>;

  /**
   * 删除记录
   */
  abstract delete(id: string): Promise<void>;

  /**
   * 分页辅助方法
   */
  protected getPaginationParams(options?: PaginationOptions) {
    const page = options?.page || 1;
    const pageSize = Math.min(
      options?.pageSize || 20,
      parseInt(process.env.MAX_PAGE_SIZE || '100')
    );
    const skip = (page - 1) * pageSize;

    return {
      page,
      pageSize,
      skip,
      take: pageSize,
    };
  }

  /**
   * 构建分页结果
   */
  protected buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number
  ): PaginatedResult<T> {
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
