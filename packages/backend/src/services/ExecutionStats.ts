/**
 * ExecutionStats - 执行统计
 * Week 2 Day 2
 * 
 * 收集和统计节点执行信息
 */

import type { NodeId } from '@audit/shared';

/**
 * 执行指标
 */
export interface ExecutionMetrics {
  /** 总节点数 */
  totalNodes: number;
  
  /** 已完成节点数 */
  completedNodes: number;
  
  /** 成功节点数 */
  successNodes: number;
  
  /** 失败节点数 */
  failedNodes: number;
  
  /** 跳过节点数 */
  skippedNodes: number;
  
  /** 平均执行时间(ms) */
  averageExecutionTime: number;
  
  /** 总执行时间(ms) */
  totalExecutionTime: number;
  
  /** 最大并发数 */
  maxConcurrency: number;
  
  /** 当前并发数 */
  currentConcurrency: number;
  
  /** 最长执行时间(ms) */
  longestExecutionTime: number;
  
  /** 最短执行时间(ms) */
  shortestExecutionTime: number;
  
  /** 执行开始时间 */
  startTime: number | null;
  
  /** 执行结束时间 */
  endTime: number | null;
}

/**
 * 节点执行记录
 */
interface NodeExecutionRecord {
  nodeId: NodeId;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: Error;
}

/**
 * ExecutionStats - 执行统计收集器
 */
export class ExecutionStats {
  private records: Map<NodeId, NodeExecutionRecord> = new Map();
  private currentConcurrency: number = 0;
  private maxConcurrency: number = 0;
  private executionStartTime: number | null = null;
  private executionEndTime: number | null = null;

  /**
   * 开始整体执行
   */
  startExecution(): void {
    this.executionStartTime = Date.now();
    this.executionEndTime = null;
  }

  /**
   * 结束整体执行
   */
  endExecution(): void {
    this.executionEndTime = Date.now();
  }

  /**
   * 记录节点开始执行
   */
  recordStart(nodeId: NodeId): void {
    this.records.set(nodeId, {
      nodeId,
      startTime: Date.now()
    });
    
    this.currentConcurrency++;
    this.maxConcurrency = Math.max(this.maxConcurrency, this.currentConcurrency);
  }

  /**
   * 记录节点执行完成
   */
  recordComplete(nodeId: NodeId, success: boolean = true): void {
    const record = this.records.get(nodeId);
    if (!record) {
      console.warn(`No start record found for node ${nodeId}`);
      return;
    }
    
    const endTime = Date.now();
    record.endTime = endTime;
    record.duration = endTime - record.startTime;
    record.success = success;
    
    this.currentConcurrency = Math.max(0, this.currentConcurrency - 1);
  }

  /**
   * 记录节点执行失败
   */
  recordFailure(nodeId: NodeId, error: Error): void {
    const record = this.records.get(nodeId);
    if (!record) {
      console.warn(`No start record found for node ${nodeId}`);
      return;
    }
    
    const endTime = Date.now();
    record.endTime = endTime;
    record.duration = endTime - record.startTime;
    record.success = false;
    record.error = error;
    
    this.currentConcurrency = Math.max(0, this.currentConcurrency - 1);
  }

  /**
   * 获取执行指标
   */
  getMetrics(): ExecutionMetrics {
    const records = Array.from(this.records.values());
    const completedRecords = records.filter(r => r.endTime !== undefined);
    const successRecords = completedRecords.filter(r => r.success === true);
    const failedRecords = completedRecords.filter(r => r.success === false);
    
    const durations = completedRecords
      .map(r => r.duration!)
      .filter(d => d !== undefined);
    
    const averageExecutionTime = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;
    
    const longestExecutionTime = durations.length > 0
      ? Math.max(...durations)
      : 0;
    
    const shortestExecutionTime = durations.length > 0
      ? Math.min(...durations)
      : 0;
    
    let totalExecutionTime = 0;
    if (this.executionStartTime) {
      const endTime = this.executionEndTime || Date.now();
      totalExecutionTime = endTime - this.executionStartTime;
    }
    
    return {
      totalNodes: records.length,
      completedNodes: completedRecords.length,
      successNodes: successRecords.length,
      failedNodes: failedRecords.length,
      skippedNodes: records.length - completedRecords.length,
      averageExecutionTime,
      totalExecutionTime,
      maxConcurrency: this.maxConcurrency,
      currentConcurrency: this.currentConcurrency,
      longestExecutionTime,
      shortestExecutionTime,
      startTime: this.executionStartTime,
      endTime: this.executionEndTime
    };
  }

  /**
   * 获取节点执行记录
   */
  getRecord(nodeId: NodeId): NodeExecutionRecord | undefined {
    return this.records.get(nodeId);
  }

  /**
   * 获取所有记录
   */
  getAllRecords(): NodeExecutionRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * 重置所有统计数据
   */
  reset(): void {
    this.records.clear();
    this.currentConcurrency = 0;
    this.maxConcurrency = 0;
    this.executionStartTime = null;
    this.executionEndTime = null;
  }

  /**
   * 生成统计报告（文本格式）
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    
    return `
执行统计报告
============
总节点数: ${metrics.totalNodes}
已完成:   ${metrics.completedNodes}
成功:     ${metrics.successNodes}
失败:     ${metrics.failedNodes}
跳过:     ${metrics.skippedNodes}

执行时间
--------
总时间:   ${metrics.totalExecutionTime}ms
平均时间: ${metrics.averageExecutionTime.toFixed(2)}ms
最长时间: ${metrics.longestExecutionTime}ms
最短时间: ${metrics.shortestExecutionTime}ms

并发统计
--------
最大并发: ${metrics.maxConcurrency}
当前并发: ${metrics.currentConcurrency}
`.trim();
  }
}
