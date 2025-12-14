/**
 * 缓存服务
 * 使用Redis进行数据缓存
 */

import Redis from 'ioredis';

export class CacheService {
  private redis: Redis;
  private defaultTTL: number = 3600; // 1小时

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis连接成功');
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis连接错误:', error);
    });
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const expireTime = ttl || this.defaultTTL;
      await this.redis.setex(key, expireTime, serialized);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * 批量删除（通过模式匹配）
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.redis.expire(key, seconds);
    } catch (error) {
      console.error('Cache expire error:', error);
    }
  }

  /**
   * 缓存键命名规范
   */
  static keys = {
    workflow: (id: string) => `workflow:${id}`,
    workflowList: (projectId: string) => `workflows:project:${projectId}`,
    workflowTemplates: () => `workflows:templates`,
    user: (id: string) => `user:${id}`,
    project: (id: string) => `project:${id}`,
    projectList: (userId: string) => `projects:user:${userId}`,
    executionStatus: (taskId: string) => `execution:${taskId}:status`,
    executionHistory: (workflowId: string) => `executions:workflow:${workflowId}`,
    nodeLibrary: () => `node:library`,
  };

  /**
   * 关闭连接
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// 单例实例
export const cacheService = new CacheService();
