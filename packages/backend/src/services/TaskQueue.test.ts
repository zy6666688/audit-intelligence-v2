/**
 * TaskQueue测试
 * Week 2 Day 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskQueue, type Task } from './TaskQueue';

describe('TaskQueue', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  describe('基本操作', () => {
    it('应该正确入队和出队', () => {
      const task1: Task = {
        id: 'task1',
        priority: 1,
        execute: async () => {},
        createdAt: Date.now()
      };

      queue.enqueue(task1);
      expect(queue.size()).toBe(1);

      const dequeued = queue.dequeue();
      expect(dequeued).toEqual(task1);
      expect(queue.size()).toBe(0);
    });

    it('应该在空队列时返回null', () => {
      expect(queue.dequeue()).toBeNull();
      expect(queue.peek()).toBeNull();
    });

    it('应该正确peek而不移除', () => {
      const task: Task = {
        id: 'task1',
        priority: 1,
        execute: async () => {},
        createdAt: Date.now()
      };

      queue.enqueue(task);
      expect(queue.peek()).toEqual(task);
      expect(queue.size()).toBe(1);
    });

    it('应该正确清空队列', () => {
      queue.enqueue({ id: 'task1', priority: 1, execute: async () => {}, createdAt: Date.now() });
      queue.enqueue({ id: 'task2', priority: 2, execute: async () => {}, createdAt: Date.now() });
      
      queue.clear();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('优先级排序', () => {
    it('应该按优先级出队（数字越小优先级越高）', () => {
      const task1: Task = { id: 'task1', priority: 3, execute: async () => {}, createdAt: Date.now() };
      const task2: Task = { id: 'task2', priority: 1, execute: async () => {}, createdAt: Date.now() };
      const task3: Task = { id: 'task3', priority: 2, execute: async () => {}, createdAt: Date.now() };

      queue.enqueue(task1);
      queue.enqueue(task2);
      queue.enqueue(task3);

      expect(queue.dequeue()?.id).toBe('task2'); // priority 1
      expect(queue.dequeue()?.id).toBe('task3'); // priority 2
      expect(queue.dequeue()?.id).toBe('task1'); // priority 3
    });

    it('应该正确处理相同优先级（FIFO）', () => {
      const task1: Task = { id: 'task1', priority: 1, execute: async () => {}, createdAt: Date.now() };
      const task2: Task = { id: 'task2', priority: 1, execute: async () => {}, createdAt: Date.now() };
      const task3: Task = { id: 'task3', priority: 1, execute: async () => {}, createdAt: Date.now() };

      queue.enqueue(task1);
      queue.enqueue(task2);
      queue.enqueue(task3);

      expect(queue.dequeue()?.id).toBe('task1');
      expect(queue.dequeue()?.id).toBe('task2');
      expect(queue.dequeue()?.id).toBe('task3');
    });

    it('应该正确处理混合优先级', () => {
      const tasks: Task[] = [
        { id: 'A', priority: 2, execute: async () => {}, createdAt: Date.now() },
        { id: 'B', priority: 1, execute: async () => {}, createdAt: Date.now() },
        { id: 'C', priority: 3, execute: async () => {}, createdAt: Date.now() },
        { id: 'D', priority: 1, execute: async () => {}, createdAt: Date.now() },
        { id: 'E', priority: 2, execute: async () => {}, createdAt: Date.now() }
      ];

      tasks.forEach(task => queue.enqueue(task));

      const result: string[] = [];
      while (!queue.isEmpty()) {
        result.push(queue.dequeue()!.id);
      }

      // 预期: B, D (priority 1, FIFO), A, E (priority 2, FIFO), C (priority 3)
      expect(result).toEqual(['B', 'D', 'A', 'E', 'C']);
    });
  });

  describe('toArray方法', () => {
    it('应该返回按优先级排序的数组', () => {
      queue.enqueue({ id: 'task3', priority: 3, execute: async () => {}, createdAt: Date.now() });
      queue.enqueue({ id: 'task1', priority: 1, execute: async () => {}, createdAt: Date.now() });
      queue.enqueue({ id: 'task2', priority: 2, execute: async () => {}, createdAt: Date.now() });

      const array = queue.toArray();
      expect(array.map(t => t.id)).toEqual(['task1', 'task2', 'task3']);
      expect(queue.size()).toBe(3); // toArray不应该修改队列
    });

    it('toArray后队列应该保持不变', () => {
      queue.enqueue({ id: 'task1', priority: 1, execute: async () => {}, createdAt: Date.now() });
      queue.enqueue({ id: 'task2', priority: 2, execute: async () => {}, createdAt: Date.now() });

      const before = queue.size();
      queue.toArray();
      const after = queue.size();

      expect(before).toBe(after);
    });
  });

  describe('统计信息', () => {
    it('应该返回正确的统计信息', () => {
      queue.enqueue({ id: 'task1', priority: 1, execute: async () => {}, createdAt: Date.now() });
      queue.enqueue({ id: 'task2', priority: 2, execute: async () => {}, createdAt: Date.now() });
      queue.enqueue({ id: 'task3', priority: 1, execute: async () => {}, createdAt: Date.now() });
      queue.enqueue({ id: 'task4', priority: 3, execute: async () => {}, createdAt: Date.now() });

      const stats = queue.getStats();

      expect(stats.size).toBe(4);
      expect(stats.minPriority).toBe(1);
      expect(stats.maxPriority).toBe(3);
      expect(stats.priorities.get(1)).toBe(2);
      expect(stats.priorities.get(2)).toBe(1);
      expect(stats.priorities.get(3)).toBe(1);
    });

    it('空队列应该返回null统计', () => {
      const stats = queue.getStats();

      expect(stats.size).toBe(0);
      expect(stats.minPriority).toBeNull();
      expect(stats.maxPriority).toBeNull();
      expect(stats.priorities.size).toBe(0);
    });
  });

  describe('性能测试', () => {
    it('应该高效处理大量任务', () => {
      const taskCount = 1000;
      const startTime = Date.now();

      // 入队
      for (let i = 0; i < taskCount; i++) {
        queue.enqueue({
          id: `task${i}`,
          priority: Math.floor(Math.random() * 10),
          execute: async () => {},
          createdAt: Date.now()
        });
      }

      // 出队
      while (!queue.isEmpty()) {
        queue.dequeue();
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // 应该在100ms内完成
    });
  });
});
