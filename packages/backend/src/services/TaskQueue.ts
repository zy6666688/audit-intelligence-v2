/**
 * TaskQueue - 优先级任务队列
 * Week 2 Day 2
 * 
 * 实现一个基于优先级的任务队列，用于并行执行调度
 */

import type { NodeId } from '@audit/shared';

/**
 * 任务接口
 */
export interface Task {
  /** 任务ID（通常是节点ID） */
  id: NodeId;
  
  /** 优先级（数字越小优先级越高） */
  priority: number;
  
  /** 任务执行函数 */
  execute: () => Promise<any>;
  
  /** 任务元数据 */
  metadata?: Record<string, any>;
  
  /** 创建时间 */
  createdAt: number;
}

/**
 * 优先级队列节点
 */
interface QueueNode {
  task: Task;
  insertOrder: number;
}

/**
 * TaskQueue - 优先级任务队列
 * 
 * 特性:
 * - 按优先级排序（数字越小优先级越高）
 * - 相同优先级按FIFO顺序
 * - O(log n)插入，O(1)取出
 */
export class TaskQueue {
  private heap: QueueNode[] = [];
  private insertCounter = 0;

  /**
   * 添加任务到队列
   */
  enqueue(task: Task): void {
    const node: QueueNode = {
      task,
      insertOrder: this.insertCounter++
    };
    
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * 取出优先级最高的任务
   */
  dequeue(): Task | null {
    if (this.heap.length === 0) {
      return null;
    }
    
    if (this.heap.length === 1) {
      return this.heap.pop()!.task;
    }
    
    const top = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    
    return top.task;
  }

  /**
   * 查看队列顶部任务（不移除）
   */
  peek(): Task | null {
    return this.heap.length > 0 ? this.heap[0].task : null;
  }

  /**
   * 获取队列大小
   */
  size(): number {
    return this.heap.length;
  }

  /**
   * 检查队列是否为空
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.heap = [];
    this.insertCounter = 0;
  }

  /**
   * 获取所有任务（不移除，按优先级排序）
   */
  toArray(): Task[] {
    // 复制堆并逐个取出，保证不修改原堆
    const tempHeap = [...this.heap];
    const result: Task[] = [];
    
    while (tempHeap.length > 0) {
      if (tempHeap.length === 1) {
        result.push(tempHeap.pop()!.task);
      } else {
        result.push(tempHeap[0].task);
        tempHeap[0] = tempHeap.pop()!;
        this.bubbleDownTemp(tempHeap, 0);
      }
    }
    
    return result;
  }

  /**
   * 向上冒泡
   */
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      
      if (this.compare(this.heap[index], this.heap[parentIndex]) >= 0) {
        break;
      }
      
      // 交换
      [this.heap[index], this.heap[parentIndex]] = 
        [this.heap[parentIndex], this.heap[index]];
      
      index = parentIndex;
    }
  }

  /**
   * 向下冒泡
   */
  private bubbleDown(index: number): void {
    const lastIndex = this.heap.length - 1;
    
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let minIndex = index;
      
      if (leftChild <= lastIndex && 
          this.compare(this.heap[leftChild], this.heap[minIndex]) < 0) {
        minIndex = leftChild;
      }
      
      if (rightChild <= lastIndex && 
          this.compare(this.heap[rightChild], this.heap[minIndex]) < 0) {
        minIndex = rightChild;
      }
      
      if (minIndex === index) {
        break;
      }
      
      // 交换
      [this.heap[index], this.heap[minIndex]] = 
        [this.heap[minIndex], this.heap[index]];
      
      index = minIndex;
    }
  }

  /**
   * 向下冒泡（临时堆，用于toArray）
   */
  private bubbleDownTemp(heap: QueueNode[], index: number): void {
    const lastIndex = heap.length - 1;
    
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let minIndex = index;
      
      if (leftChild <= lastIndex && 
          this.compare(heap[leftChild], heap[minIndex]) < 0) {
        minIndex = leftChild;
      }
      
      if (rightChild <= lastIndex && 
          this.compare(heap[rightChild], heap[minIndex]) < 0) {
        minIndex = rightChild;
      }
      
      if (minIndex === index) {
        break;
      }
      
      // 交换
      [heap[index], heap[minIndex]] = [heap[minIndex], heap[index]];
      
      index = minIndex;
    }
  }

  /**
   * 比较两个节点
   * 返回值:
   *  < 0: a的优先级高于b
   *  = 0: 优先级相同
   *  > 0: b的优先级高于a
   */
  private compare(a: QueueNode, b: QueueNode): number {
    // 首先比较优先级（数字越小优先级越高）
    if (a.task.priority !== b.task.priority) {
      return a.task.priority - b.task.priority;
    }
    
    // 优先级相同，比较插入顺序（FIFO）
    return a.insertOrder - b.insertOrder;
  }

  /**
   * 获取队列统计信息
   */
  getStats(): {
    size: number;
    minPriority: number | null;
    maxPriority: number | null;
    priorities: Map<number, number>;
  } {
    if (this.heap.length === 0) {
      return {
        size: 0,
        minPriority: null,
        maxPriority: null,
        priorities: new Map()
      };
    }
    
    const priorities = new Map<number, number>();
    let minPriority = Infinity;
    let maxPriority = -Infinity;
    
    for (const node of this.heap) {
      const priority = node.task.priority;
      priorities.set(priority, (priorities.get(priority) || 0) + 1);
      minPriority = Math.min(minPriority, priority);
      maxPriority = Math.max(maxPriority, priority);
    }
    
    return {
      size: this.heap.length,
      minPriority,
      maxPriority,
      priorities
    };
  }
}
