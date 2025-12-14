/**
 * Test Framework - V3节点测试框架
 * 
 * 提供统一的节点测试工具
 */

import type { NodeExecutionContext } from '../BaseNode';
import type { AuditDataType } from '../../../types/AuditDataTypes';

export class NodeTestFramework {
  /**
   * 创建测试用的DataMetadata
   */
  static createTestMetadata(source: string = 'test'): any {
    return {
      source,
      timestamp: new Date(),
      version: '1.0.0',
      traceId: 'test-trace-id',
      nodeId: 'test-node-id',
      executionId: 'test-exec-id'
    };
  }

  /**
   * 创建测试上下文
   */
  static createTestContext(overrides?: Partial<NodeExecutionContext>): NodeExecutionContext {
    return {
      executionId: `test-exec-${Date.now()}`,
      nodeId: 'test-node',
      graphId: 'test-graph',
      userId: 'test-user',
      logger: console,
      ...overrides
    };
  }

  /**
   * 创建模拟Records数据
   */
  static createMockRecords(rowCount: number = 10): any {
    const data = [];
    for (let i = 0; i < rowCount; i++) {
      data.push({
        id: `ID${i + 1}`,
        name: `Item ${i + 1}`,
        amount: (i + 1) * 100,
        date: new Date(2025, 0, i + 1).toISOString()
      });
    }

    return {
      type: 'Records',
      schema: [
        { name: 'id', type: 'string', required: true, description: 'ID' },
        { name: 'name', type: 'string', required: true, description: 'Name' },
        { name: 'amount', type: 'number', required: true, description: 'Amount' },
        { name: 'date', type: 'date', required: true, description: 'Date' }
      ],
      data,
      metadata: {
        source: 'test',
        timestamp: new Date(),
        version: '1.0.0',
        traceId: 'test-trace',
        nodeId: 'test-node',
        executionId: 'test-exec'
      },
      rowCount: data.length,
      columnCount: 4
    };
  }

  /**
   * 断言节点执行成功
   */
  static assertSuccess(result: any): void {
    if (!result.success) {
      throw new Error(`Node execution failed: ${result.error?.message || 'Unknown error'}`);
    }
  }

  /**
   * 断言节点执行失败
   */
  static assertFailure(result: any, expectedErrorCode?: string): void {
    if (result.success) {
      throw new Error('Expected node execution to fail, but it succeeded');
    }
    if (expectedErrorCode && result.error?.code !== expectedErrorCode) {
      throw new Error(`Expected error code ${expectedErrorCode}, got ${result.error?.code}`);
    }
  }

  /**
   * 断言输出包含特定字段
   */
  static assertOutputHasField(result: any, outputName: string): void {
    if (!result.outputs || !result.outputs[outputName]) {
      throw new Error(`Expected output '${outputName}' not found`);
    }
  }

  /**
   * 断言性能在预期范围内
   */
  static assertPerformance(result: any, maxDuration: number): void {
    if (result.metadata?.duration > maxDuration) {
      throw new Error(`Performance issue: ${result.metadata.duration}ms > ${maxDuration}ms`);
    }
  }

  /**
   * 运行测试套件
   */
  static async runTestSuite(
    suiteName: string,
    tests: Array<{ name: string; fn: () => Promise<void> }>
  ): Promise<TestSuiteResult> {
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    console.log(`\n🧪 Running test suite: ${suiteName}`);
    console.log('═'.repeat(60));

    for (const test of tests) {
      const startTime = Date.now();
      try {
        await test.fn();
        const duration = Date.now() - startTime;
        console.log(`✅ ${test.name} (${duration}ms)`);
        results.push({ name: test.name, passed: true, duration });
        passed++;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        console.log(`❌ ${test.name} (${duration}ms)`);
        console.log(`   Error: ${error.message}`);
        results.push({ 
          name: test.name, 
          passed: false, 
          duration, 
          error: error.message 
        });
        failed++;
      }
    }

    console.log('═'.repeat(60));
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed (${tests.length} total)`);

    return {
      suiteName,
      total: tests.length,
      passed,
      failed,
      results,
      duration: results.reduce((sum, r) => sum + r.duration, 0)
    };
  }

  /**
   * 生成测试报告
   */
  static generateReport(suiteResults: TestSuiteResult[]): string {
    const totalTests = suiteResults.reduce((sum, s) => sum + s.total, 0);
    const totalPassed = suiteResults.reduce((sum, s) => sum + s.passed, 0);
    const totalFailed = suiteResults.reduce((sum, s) => sum + s.failed, 0);
    const totalDuration = suiteResults.reduce((sum, s) => sum + s.duration, 0);

    const lines = [
      '# V3 Nodes Test Report',
      '',
      `**Generated**: ${new Date().toLocaleString()}`,
      `**Total Tests**: ${totalTests}`,
      `**Passed**: ${totalPassed} ✅`,
      `**Failed**: ${totalFailed} ❌`,
      `**Duration**: ${totalDuration}ms`,
      '',
      '---',
      ''
    ];

    for (const suite of suiteResults) {
      lines.push(`## ${suite.suiteName}`);
      lines.push('');
      lines.push(`- Total: ${suite.total}`);
      lines.push(`- Passed: ${suite.passed}`);
      lines.push(`- Failed: ${suite.failed}`);
      lines.push(`- Duration: ${suite.duration}ms`);
      lines.push('');

      if (suite.failed > 0) {
        lines.push('### Failed Tests:');
        lines.push('');
        for (const result of suite.results.filter(r => !r.passed)) {
          lines.push(`- ❌ **${result.name}**: ${result.error}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

export interface TestSuiteResult {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
  duration: number;
}
