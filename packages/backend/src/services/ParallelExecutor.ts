/**
 * ParallelExecutor - 并行执行器
 * Week 2 Day 2
 * 
 * 实现按层级并行执行节点，控制最大并发数
 */

import type { NodeId } from '@audit/shared';
import { TaskQueue, type Task } from './TaskQueue';

/**
 * 执行结果
 */
export interface TaskExecutionResult {
  taskId: NodeId;
  success: boolean;
  result?: any;
  error?: Error;
  duration: number;
}

/**
 * 并行执行器配置
 */
export interface ParallelExecutorConfig {
  /** 最大并发数（默认10） */
  maxConcurrency?: number;
  
  /** 是否在遇到错误时停止（默认false） */
  stopOnError?: boolean;
}

/**
 * ParallelExecutor - 并行执行器
 * 
 * 特性:
 * - 控制最大并发数
 * - 按优先级执行任务
 * - 支持错误处理策略
 * - 实时状态跟踪
 */
export class ParallelExecutor {
  private maxConcurrency: number;
  private stopOnError: boolean;
  private runningTasks: Map<NodeId, Promise<TaskExecutionResult>>;
  private results: Map<NodeId, TaskExecutionResult>;
  private taskQueue: TaskQueue;
  private stopped: boolean = false;

  constructor(config: ParallelExecutorConfig = {}) {
    this.maxConcurrency = config.maxConcurrency || 10;
    this.stopOnError = config.stopOnError || false;
    this.runningTasks = new Map();
    this.results = new Map();
    this.taskQueue = new TaskQueue();
  }

  /**
   * 执行一批任务
   */
  async execute(tasks: Task[]): Promise<Map<NodeId, TaskExecutionResult>> {
    // 重置状态
    this.reset();
    
    // 将任务加入队列
    for (const task of tasks) {
      this.taskQueue.enqueue(task);
    }
    
    // 开始执行
    await this.processTasks();
    
    return this.results;
  }

  /**
   * 停止执行
   */
  stop(): void {
    this.stopped = true;
  }

  /**
   * 设置最大并发数
   */
  setMaxConcurrency(max: number): void {
    if (max < 1) {
      throw new Error('Max concurrency must be at least 1');
    }
    this.maxConcurrency = max;
  }

  /**
   * 获取当前运行中的任务数
   */
  getRunningCount(): number {
    return this.runningTasks.size;
  }

  /**
   * 获取运行中的任务ID列表
   */
  getRunningTaskIds(): NodeId[] {
    return Array.from(this.runningTasks.keys());
  }

  /**
   * 获取已完成的任务数
   */
  getCompletedCount(): number {
    return this.results.size;
  }

  /**
   * 获取执行结果
   */
  getResults(): Map<NodeId, TaskExecutionResult> {
    return new Map(this.results);
  }

  /**
   * 获取某个任务的结果
   */
  getResult(taskId: NodeId): TaskExecutionResult | undefined {
    return this.results.get(taskId);
  }

  /**
   * 等待所有任务完成
   */
  async waitAll(): Promise<void> {
    await Promise.all(this.runningTasks.values());
  }

  /**
   * 处理任务队列
   */
  private async processTasks(): Promise<void> {
    while (!this.taskQueue.isEmpty() || this.runningTasks.size > 0) {
      // 检查是否被停止
      if (this.stopped) {
        break;
      }
      
      // 启动新任务（在并发限制内）
      while (
        !this.taskQueue.isEmpty() && 
        this.runningTasks.size < this.maxConcurrency
      ) {
        const task = this.taskQueue.dequeue();
        if (task) {
          this.startTask(task);
        }
      }
      
      // 等待至少一个任务完成
      if (this.runningTasks.size > 0) {
        await Promise.race(this.runningTasks.values());
      }
    }
  }

  /**
   * 启动任务执行
   */
  private startTask(task: Task): void {
    const promise = this.executeTask(task);
    this.runningTasks.set(task.id, promise);
    
    // 任务完成后清理
    promise.finally(() => {
      this.runningTasks.delete(task.id);
    });
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: Task): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    
    try {
      const result = await task.execute();
      const duration = Date.now() - startTime;
      
      const executionResult: TaskExecutionResult = {
        taskId: task.id,
        success: true,
        result,
        duration
      };
      
      this.results.set(task.id, executionResult);
      return executionResult;
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      const executionResult: TaskExecutionResult = {
        taskId: task.id,
        success: false,
        error,
        duration
      };
      
      this.results.set(task.id, executionResult);
      
      // 如果配置为遇错停止，则停止执行
      if (this.stopOnError) {
        this.stop();
      }
      
      return executionResult;
    }
  }

  /**
   * 重置执行器状态
   */
  private reset(): void {
    this.stopped = false;
    this.runningTasks.clear();
    this.results.clear();
    this.taskQueue.clear();
  }

  /**
   * 获取执行统计
   */
  getStats(): {
    totalTasks: number;
    completedTasks: number;
    successTasks: number;
    failedTasks: number;
    runningTasks: number;
    averageDuration: number;
  } {
    const results = Array.from(this.results.values());
    const successTasks = results.filter(r => r.success).length;
    const failedTasks = results.filter(r => !r.success).length;
    
    const averageDuration = results.length > 0
      ? results.reduce((sum, r) => sum + r.duration, 0) / results.length
      : 0;
    
    return {
      totalTasks: this.taskQueue.size() + this.runningTasks.size + this.results.size,
      completedTasks: this.results.size,
      successTasks,
      failedTasks,
      runningTasks: this.runningTasks.size,
      averageDuration
    };
  }
}
