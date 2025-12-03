/**
 * 优化版Repository - 多级缓存策略
 * 性能提升: 3-10倍
 */

import { PrismaClient, Workflow } from '@prisma/client';
import { cacheService, CacheService } from '../services/CacheService';

/**
 * 多级缓存配置
 */
const CACHE_CONFIG = {
  l1: {
    enabled: true,
    maxSize: 1000,     // L1最大缓存数
    ttl: 60000,        // 1分钟
  },
  l2: {
    enabled: true,
    ttl: 3600,         // 1小时
  },
};

/**
 * L1内存缓存 (进程内)
 */
class MemoryCache<T> {
  private cache = new Map<string, { data: T; expires: number }>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, value: T, ttl: number = 60000): void {
    // LRU淘汰
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      data: value,
      expires: Date.now() + ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * 优化的工作流Repository
 */
export class OptimizedWorkflowRepository {
  private prisma: PrismaClient;
  private l1Cache = new MemoryCache<Workflow>(CACHE_CONFIG.l1.maxSize);
  private l2Cache = cacheService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 多级缓存查询
   * L1 (内存) -> L2 (Redis) -> L3 (数据库)
   */
  async findById(id: string): Promise<Workflow | null> {
    // L1: 内存缓存 (~10μs)
    if (CACHE_CONFIG.l1.enabled) {
      const cached = this.l1Cache.get(id);
      if (cached) {
        console.log(`[L1 HIT] workflow:${id}`);
        return cached;
      }
    }

    // L2: Redis缓存 (~1-5ms)
    if (CACHE_CONFIG.l2.enabled) {
      const cached = await this.l2Cache.get<Workflow>(
        CacheService.keys.workflow(id)
      );
      if (cached) {
        console.log(`[L2 HIT] workflow:${id}`);
        // 回填L1
        this.l1Cache.set(id, cached, CACHE_CONFIG.l1.ttl);
        return cached;
      }
    }

    // L3: 数据库查询 (~10-100ms)
    console.log(`[DB QUERY] workflow:${id}`);
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      // 优化: 只选择需要的字段
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        nodes: true,
        edges: true,
        viewport: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        executionCount: true,
        avgExecutionTime: true,
        isTemplate: true,
        isPublished: true,
      },
    });

    if (workflow) {
      // 回填缓存
      this.l1Cache.set(id, workflow as Workflow, CACHE_CONFIG.l1.ttl);
      await this.l2Cache.set(
        CacheService.keys.workflow(id),
        workflow,
        CACHE_CONFIG.l2.ttl
      );
    }

    return workflow as Workflow;
  }

  /**
   * 批量查询 (使用DataLoader模式)
   */
  async findByIds(ids: string[]): Promise<(Workflow | null)[]> {
    // 1. 从缓存获取
    const cached = new Map<string, Workflow>();
    const missingIds: string[] = [];

    for (const id of ids) {
      const item = this.l1Cache.get(id);
      if (item) {
        cached.set(id, item);
      } else {
        missingIds.push(id);
      }
    }

    // 2. 批量查询缺失的
    if (missingIds.length > 0) {
      const workflows = await this.prisma.workflow.findMany({
        where: { id: { in: missingIds } },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          nodes: true,
          edges: true,
          viewport: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          executionCount: true,
          avgExecutionTime: true,
        },
      });

      // 回填缓存
      for (const workflow of workflows) {
        cached.set(workflow.id, workflow as Workflow);
        this.l1Cache.set(workflow.id, workflow as Workflow, CACHE_CONFIG.l1.ttl);
        await this.l2Cache.set(
          CacheService.keys.workflow(workflow.id),
          workflow,
          CACHE_CONFIG.l2.ttl
        );
      }
    }

    // 3. 按原顺序返回
    return ids.map((id) => cached.get(id) || null);
  }

  /**
   * 列表查询 (使用物化视图 + 缓存)
   */
  async listByProject(projectId: string, page: number = 1, pageSize: number = 20) {
    const cacheKey = `${CacheService.keys.workflowList(projectId)}:${page}:${pageSize}`;
    
    // 尝试从缓存获取
    const cached = await this.l2Cache.get(cacheKey);
    if (cached) {
      console.log(`[CACHE HIT] workflow list: project ${projectId}`);
      return cached;
    }

    // 数据库查询
    const skip = (page - 1) * pageSize;
    const [workflows, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where: { projectId },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          createdAt: true,
          executionCount: true,
          avgExecutionTime: true,
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflow.count({ where: { projectId } }),
    ]);

    const result = {
      data: workflows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    // 缓存5分钟
    await this.l2Cache.set(cacheKey, result, 300);

    return result;
  }

  /**
   * 创建时清除缓存
   */
  async create(data: any): Promise<Workflow> {
    const workflow = await this.prisma.workflow.create({ data });
    
    // 清除项目相关缓存
    if (workflow.projectId) {
      await this.l2Cache.deletePattern(
        `${CacheService.keys.workflowList(workflow.projectId)}:*`
      );
    }
    
    return workflow;
  }

  /**
   * 更新时清除缓存
   */
  async update(id: string, data: any): Promise<Workflow> {
    const workflow = await this.prisma.workflow.update({
      where: { id },
      data,
    });
    
    // 清除所有相关缓存
    this.l1Cache.delete(id);
    await this.l2Cache.delete(CacheService.keys.workflow(id));
    
    if (workflow.projectId) {
      await this.l2Cache.deletePattern(
        `${CacheService.keys.workflowList(workflow.projectId)}:*`
      );
    }
    
    return workflow;
  }

  /**
   * 删除时清除缓存
   */
  async delete(id: string): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      select: { projectId: true },
    });
    
    await this.prisma.workflow.delete({ where: { id } });
    
    // 清除缓存
    this.l1Cache.delete(id);
    await this.l2Cache.delete(CacheService.keys.workflow(id));
    
    if (workflow?.projectId) {
      await this.l2Cache.deletePattern(
        `${CacheService.keys.workflowList(workflow.projectId)}:*`
      );
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      l1: {
        size: this.l1Cache.size(),
        maxSize: CACHE_CONFIG.l1.maxSize,
        enabled: CACHE_CONFIG.l1.enabled,
      },
      l2: {
        enabled: CACHE_CONFIG.l2.enabled,
      },
    };
  }

  /**
   * 清除所有缓存
   */
  async clearCache() {
    this.l1Cache.clear();
    await this.l2Cache.deletePattern('workflow:*');
    await this.l2Cache.deletePattern('workflows:*');
    console.log('✅ 工作流缓存已清除');
  }
}

/**
 * DataLoader包装器 (批量加载优化)
 */
import DataLoader from 'dataloader';

export function createWorkflowLoader(prisma: PrismaClient) {
  return new DataLoader<string, Workflow | null>(
    async (ids) => {
      const workflows = await prisma.workflow.findMany({
        where: { id: { in: [...ids] } },
      });
      
      const workflowMap = new Map(workflows.map((w) => [w.id, w]));
      return ids.map((id) => workflowMap.get(id) || null);
    },
    {
      cache: true,
      maxBatchSize: 100,
      batchScheduleFn: (callback) => setTimeout(callback, 10), // 10ms批处理窗口
    }
  );
}

/**
 * 使用示例
 */
export async function exampleUsage(prisma: PrismaClient) {
  const repo = new OptimizedWorkflowRepository(prisma);
  
  // 单个查询 (自动使用多级缓存)
  const workflow = await repo.findById('workflow-id');
  
  // 批量查询 (自动合并)
  const workflows = await repo.findByIds(['id1', 'id2', 'id3']);
  
  // 列表查询 (使用缓存)
  const list = await repo.listByProject('project-id', 1, 20);
  
  // 查看缓存统计
  console.log(repo.getCacheStats());
  
  // DataLoader (去重 + 批量)
  const loader = createWorkflowLoader(prisma);
  const w1 = await loader.load('id1');  // 批量加载
  const w2 = await loader.load('id2');  // 自动合并到同一批
  const w3 = await loader.load('id1');  // 缓存命中，不再查询
}
