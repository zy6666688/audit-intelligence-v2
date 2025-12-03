/**
 * ExecutionStats测试
 * Week 2 Day 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionStats } from './ExecutionStats';

describe('ExecutionStats', () => {
  let stats: ExecutionStats;

  beforeEach(() => {
    stats = new ExecutionStats();
  });

  describe('基本功能', () => {
    it('应该记录节点开始和完成', () => {
      stats.recordStart('node1');
      stats.recordComplete('node1');
      
      const metrics = stats.getMetrics();
      expect(metrics.totalNodes).toBe(1);
      expect(metrics.completedNodes).toBe(1);
      expect(metrics.successNodes).toBe(1);
    });

    it('应该记录节点失败', () => {
      stats.recordStart('node1');
      stats.recordFailure('node1', new Error('test error'));
      
      const metrics = stats.getMetrics();
      expect(metrics.failedNodes).toBe(1);
      expect(metrics.successNodes).toBe(0);
    });

    it('应该跟踪并发数', () => {
      stats.recordStart('node1');
      stats.recordStart('node2');
      stats.recordStart('node3');
      
      const metrics = stats.getMetrics();
      expect(metrics.currentConcurrency).toBe(3);
      expect(metrics.maxConcurrency).toBe(3);
      
      stats.recordComplete('node1');
      const metrics2 = stats.getMetrics();
      expect(metrics2.currentConcurrency).toBe(2);
      expect(metrics2.maxConcurrency).toBe(3);
    });
  });

  describe('执行时间', () => {
    it('应该计算执行持续时间', async () => {
      stats.recordStart('node1');
      await new Promise(resolve => setTimeout(resolve, 10));
      stats.recordComplete('node1');
      
      const record = stats.getRecord('node1');
      expect(record?.duration).toBeGreaterThanOrEqual(10);
    });

    it('应该计算平均执行时间', async () => {
      stats.recordStart('node1');
      await new Promise(resolve => setTimeout(resolve, 10));
      stats.recordComplete('node1');
      
      stats.recordStart('node2');
      await new Promise(resolve => setTimeout(resolve, 10));
      stats.recordComplete('node2');
      
      const metrics = stats.getMetrics();
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
    });

    it('应该记录总执行时间', async () => {
      stats.startExecution();
      await new Promise(resolve => setTimeout(resolve, 50));
      stats.endExecution();
      
      const metrics = stats.getMetrics();
      expect(metrics.totalExecutionTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('统计报告', () => {
    it('应该生成文本报告', () => {
      stats.recordStart('node1');
      stats.recordComplete('node1');
      
      const report = stats.generateReport();
      expect(report).toContain('总节点数: 1');
      expect(report).toContain('成功:     1');
    });
  });

  describe('重置', () => {
    it('应该清空所有统计数据', () => {
      stats.recordStart('node1');
      stats.recordComplete('node1');
      
      stats.reset();
      
      const metrics = stats.getMetrics();
      expect(metrics.totalNodes).toBe(0);
      expect(metrics.maxConcurrency).toBe(0);
    });
  });
});
