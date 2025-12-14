/**
 * Performance Monitor - 性能监控工具
 * 
 * 监控节点执行性能，提供优化建议
 */

export class PerformanceMonitor {
  private static metrics: Map<string, NodeMetrics> = new Map();

  /**
   * 记录节点执行指标
   */
  static recordExecution(
    nodeType: string,
    duration: number,
    inputSize: number,
    outputSize: number,
    cached: boolean
  ): void {
    if (!this.metrics.has(nodeType)) {
      this.metrics.set(nodeType, {
        nodeType,
        totalExecutions: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        avgDuration: 0,
        cacheHits: 0,
        cacheMisses: 0,
        avgInputSize: 0,
        avgOutputSize: 0
      });
    }

    const metrics = this.metrics.get(nodeType)!;
    
    metrics.totalExecutions++;
    metrics.totalDuration += duration;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    metrics.avgDuration = metrics.totalDuration / metrics.totalExecutions;
    
    if (cached) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }

    // 移动平均
    metrics.avgInputSize = (metrics.avgInputSize * (metrics.totalExecutions - 1) + inputSize) / metrics.totalExecutions;
    metrics.avgOutputSize = (metrics.avgOutputSize * (metrics.totalExecutions - 1) + outputSize) / metrics.totalExecutions;
  }

  /**
   * 获取节点指标
   */
  static getMetrics(nodeType: string): NodeMetrics | undefined {
    return this.metrics.get(nodeType);
  }

  /**
   * 获取所有指标
   */
  static getAllMetrics(): NodeMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * 获取性能报告
   */
  static getPerformanceReport(): PerformanceReport {
    const allMetrics = this.getAllMetrics();
    
    const totalExecutions = allMetrics.reduce((sum, m) => sum + m.totalExecutions, 0);
    const totalDuration = allMetrics.reduce((sum, m) => sum + m.totalDuration, 0);
    const avgDuration = totalExecutions > 0 ? totalDuration / totalExecutions : 0;

    const slowestNodes = [...allMetrics]
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);

    const mostUsed = [...allMetrics]
      .sort((a, b) => b.totalExecutions - a.totalExecutions)
      .slice(0, 5);

    const cacheEfficiency = allMetrics.map(m => ({
      nodeType: m.nodeType,
      hitRate: m.totalExecutions > 0 
        ? (m.cacheHits / m.totalExecutions * 100).toFixed(1) + '%'
        : 'N/A'
    }));

    return {
      summary: {
        totalExecutions,
        totalDuration,
        avgDuration: avgDuration.toFixed(2) + 'ms'
      },
      slowestNodes: slowestNodes.map(m => ({
        nodeType: m.nodeType,
        avgDuration: m.avgDuration.toFixed(2) + 'ms',
        maxDuration: m.maxDuration.toFixed(2) + 'ms'
      })),
      mostUsed: mostUsed.map(m => ({
        nodeType: m.nodeType,
        executions: m.totalExecutions
      })),
      cacheEfficiency
    };
  }

  /**
   * 获取优化建议
   */
  static getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const allMetrics = this.getAllMetrics();

    for (const metrics of allMetrics) {
      // 检查慢节点
      if (metrics.avgDuration > 5000) {
        suggestions.push(
          `⚠️  ${metrics.nodeType}: Average duration ${metrics.avgDuration.toFixed(0)}ms is high. Consider optimization or caching.`
        );
      }

      // 检查缓存命中率
      const totalCache = metrics.cacheHits + metrics.cacheMisses;
      if (totalCache > 10) {
        const hitRate = metrics.cacheHits / totalCache;
        if (hitRate < 0.3) {
          suggestions.push(
            `📊 ${metrics.nodeType}: Cache hit rate ${(hitRate * 100).toFixed(1)}% is low. Review cache strategy.`
          );
        }
      }

      // 检查数据量
      if (metrics.avgInputSize > 10000) {
        suggestions.push(
          `💾 ${metrics.nodeType}: Average input size ${metrics.avgInputSize.toFixed(0)} is large. Consider batch processing or streaming.`
        );
      }
    }

    return suggestions;
  }

  /**
   * 清空指标
   */
  static reset(): void {
    this.metrics.clear();
  }

  /**
   * 导出指标为JSON
   */
  static exportMetrics(): string {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: Array.from(this.metrics.values()),
      report: this.getPerformanceReport(),
      suggestions: this.getOptimizationSuggestions()
    };

    return JSON.stringify(report, null, 2);
  }
}

export interface NodeMetrics {
  nodeType: string;
  totalExecutions: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  cacheHits: number;
  cacheMisses: number;
  avgInputSize: number;
  avgOutputSize: number;
}

export interface PerformanceReport {
  summary: {
    totalExecutions: number;
    totalDuration: number;
    avgDuration: string;
  };
  slowestNodes: Array<{
    nodeType: string;
    avgDuration: string;
    maxDuration: string;
  }>;
  mostUsed: Array<{
    nodeType: string;
    executions: number;
  }>;
  cacheEfficiency: Array<{
    nodeType: string;
    hitRate: string;
  }>;
}
