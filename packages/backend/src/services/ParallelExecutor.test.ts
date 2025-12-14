/**
 * ParallelExecutor测试
 * Week 2 Day 2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParallelExecutor } from './ParallelExecutor';
import type { Task } from './TaskQueue';

// 辅助函数：创建延迟任务
function createDelayTask(id: string, priority: number, delay: number, shouldFail = false): Task {
  return {
    id,
    priority,
    createdAt: Date.now(),
    execute: async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      if (shouldFail) {
        throw new Error(`Task ${id} failed`);
      }
      return { id, completed: true };
    }
  };
}

describe('ParallelExecutor', () => {
  let executor: ParallelExecutor;

  beforeEach(() => {
    executor = new ParallelExecutor({ maxConcurrency: 3 });
  });

  describe('基本执行', () => {
    it('应该成功执行单个任务', async () => {
      const task = createDelayTask('task1', 1, 10);
      
      const results = await executor.execute([task]);
      
      expect(results.size).toBe(1);
      expect(results.get('task1')?.success).toBe(true);
      expect(results.get('task1')?.result).toEqual({ id: 'task1', completed: true });
    });

    it('应该成功执行多个任务', async () => {
      const tasks = [
        createDelayTask('task1', 1, 10),
        createDelayTask('task2', 1, 10),
        createDelayTask('task3', 1, 10)
      ];
      
      const results = await executor.execute(tasks);
      
      expect(results.size).toBe(3);
      expect(results.get('task1')?.success).toBe(true);
      expect(results.get('task2')?.success).toBe(true);
      expect(results.get('task3')?.success).toBe(true);
    });

    it('应该记录任务执行时间', async () => {
      const task = createDelayTask('task1', 1, 50);
      
      const results = await executor.execute([task]);
      const result = results.get('task1');
      
      expect(result?.duration).toBeGreaterThanOrEqual(50);
      expect(result?.duration).toBeLessThan(150); // 允许一定误差
    });
  });

  describe('并发控制', () => {
    it('应该限制最大并发数', async () => {
      executor.setMaxConcurrency(2);
      
      let runningCount = 0;
      let maxRunning = 0;
      
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        id: `task${i}`,
        priority: 1,
        createdAt: Date.now(),
        execute: async () => {
          runningCount++;
          maxRunning = Math.max(maxRunning, runningCount);
          await new Promise(resolve => setTimeout(resolve, 50));
          runningCount--;
          return { done: true };
        }
      }));
      
      await executor.execute(tasks);
      
      expect(maxRunning).toBeLessThanOrEqual(2);
    });

    it('应该能动态设置并发数', () => {
      executor.setMaxConcurrency(5);
      expect(() => executor.setMaxConcurrency(0)).toThrow();
    });

    it('应该正确报告运行中的任务数', async () => {
      executor.setMaxConcurrency(2);
      
      const tasks = [
        createDelayTask('task1', 1, 100),
        createDelayTask('task2', 1, 100),
        createDelayTask('task3', 1, 100)
      ];
      
      const promise = executor.execute(tasks);
      
      // 等待任务开始
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(executor.getRunningCount()).toBeLessThanOrEqual(2);
      
      await promise;
      expect(executor.getRunningCount()).toBe(0);
    });
  });

  describe('优先级执行', () => {
    it('应该按优先级执行任务', async () => {
      executor.setMaxConcurrency(1); // 串行执行
      
      const executionOrder: string[] = [];
      
      const tasks = [
        {
          id: 'low',
          priority: 3,
          createdAt: Date.now(),
          execute: async () => {
            executionOrder.push('low');
            return {};
          }
        },
        {
          id: 'high',
          priority: 1,
          createdAt: Date.now(),
          execute: async () => {
            executionOrder.push('high');
            return {};
          }
        },
        {
          id: 'medium',
          priority: 2,
          createdAt: Date.now(),
          execute: async () => {
            executionOrder.push('medium');
            return {};
          }
        }
      ];
      
      await executor.execute(tasks);
      
      expect(executionOrder).toEqual(['high', 'medium', 'low']);
    });
  });

  describe('错误处理', () => {
    it('应该捕获任务错误', async () => {
      const tasks = [
        createDelayTask('task1', 1, 10),
        createDelayTask('task2', 1, 10, true), // 失败的任务
        createDelayTask('task3', 1, 10)
      ];
      
      const results = await executor.execute(tasks);
      
      expect(results.get('task1')?.success).toBe(true);
      expect(results.get('task2')?.success).toBe(false);
      expect(results.get('task2')?.error?.message).toContain('failed');
      expect(results.get('task3')?.success).toBe(true);
    });

    it('stopOnError=true时应该停止执行', async () => {
      executor = new ParallelExecutor({ maxConcurrency: 1, stopOnError: true });
      
      const tasks = [
        createDelayTask('task1', 1, 10),
        createDelayTask('task2', 1, 10, true), // 失败的任务
        createDelayTask('task3', 1, 10)
      ];
      
      const results = await executor.execute(tasks);
      
      // task2失败后，task3不应该执行
      expect(results.has('task1')).toBe(true);
      expect(results.has('task2')).toBe(true);
      expect(results.has('task3')).toBe(false);
    });
  });

  describe('状态查询', () => {
    it('应该正确报告完成数', async () => {
      const tasks = [
        createDelayTask('task1', 1, 10),
        createDelayTask('task2', 1, 10),
        createDelayTask('task3', 1, 10)
      ];
      
      await executor.execute(tasks);
      
      expect(executor.getCompletedCount()).toBe(3);
    });

    it('应该正确返回统计信息', async () => {
      const tasks = [
        createDelayTask('task1', 1, 10),
        createDelayTask('task2', 1, 10, true),
        createDelayTask('task3', 1, 10)
      ];
      
      await executor.execute(tasks);
      const stats = executor.getStats();
      
      expect(stats.completedTasks).toBe(3);
      expect(stats.successTasks).toBe(2);
      expect(stats.failedTasks).toBe(1);
      expect(stats.runningTasks).toBe(0);
      expect(stats.averageDuration).toBeGreaterThan(0);
    });
  });

  describe('停止执行', () => {
    it('应该能手动停止执行', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => 
        createDelayTask(`task${i}`, 1, 100)
      );
      
      const promise = executor.execute(tasks);
      
      // 等待一些任务开始
      await new Promise(resolve => setTimeout(resolve, 50));
      
      executor.stop();
      
      await promise;
      
      // 应该有一些任务未执行
      expect(executor.getCompletedCount()).toBeLessThan(10);
    });
  });
});
