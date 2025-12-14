/**
 * Run All Phase B Tests - 运行所有Phase B节点测试
 */

import { testVoucherInputNode } from './VoucherInputNode.test';
import { testContractInputNode } from './ContractInputNode.test';
import { testBankFlowInputNode } from './BankFlowInputNode.test';
import { testInvoiceInputNode } from './InvoiceInputNode.test';
import { testOCRExtractNode } from './OCRExtractNode.test';
import { testFieldMapperNode } from './FieldMapperNode.test';
import { testNormalizeDataNode } from './NormalizeDataNode.test';
import { testDeduplicateNode } from './DeduplicateNode.test';
import { NodeTestFramework, TestSuiteResult } from './test-framework';
import * as fs from 'fs';
import * as path from 'path';

async function runAllPhaseBTests() {
  console.log('🚀 Running All Phase B Node Tests');
  console.log('═'.repeat(80));
  console.log('');

  const suiteResults: TestSuiteResult[] = [];

  try {
    // 输入节点测试（4个）
    console.log('\n📥 INPUT NODES\n');
    suiteResults.push(await testVoucherInputNode());
    suiteResults.push(await testContractInputNode());
    suiteResults.push(await testBankFlowInputNode());
    suiteResults.push(await testInvoiceInputNode());

    // 预处理节点测试（4个）
    console.log('\n🔧 PREPROCESS NODES\n');
    suiteResults.push(await testOCRExtractNode());
    suiteResults.push(await testFieldMapperNode());
    suiteResults.push(await testNormalizeDataNode());
    suiteResults.push(await testDeduplicateNode());

  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }

  // 生成报告
  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 FINAL RESULTS\n');

  const totalTests = suiteResults.reduce((sum, s) => sum + s.total, 0);
  const totalPassed = suiteResults.reduce((sum, s) => sum + s.passed, 0);
  const totalFailed = suiteResults.reduce((sum, s) => sum + s.failed, 0);
  const totalDuration = suiteResults.reduce((sum, s) => sum + s.duration, 0);

  console.log(`Total Suites: ${suiteResults.length}`);
  console.log(`Total Tests:  ${totalTests}`);
  console.log(`Passed:       ${totalPassed} ✅`);
  console.log(`Failed:       ${totalFailed} ❌`);
  console.log(`Duration:     ${totalDuration}ms`);
  console.log(`Success Rate: ${((totalPassed / totalTests) * 100).toFixed(2)}%`);

  // 生成Markdown报告
  const report = NodeTestFramework.generateReport(suiteResults);
  const reportPath = path.join(__dirname, '..', '..', '..', '..', '..', 'Phase_B_测试报告.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // 生成性能指标JSON
  const performance = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSuites: suiteResults.length,
      totalTests,
      totalPassed,
      totalFailed,
      totalDuration,
      successRate: ((totalPassed / totalTests) * 100).toFixed(2) + '%'
    },
    suites: suiteResults.map(suite => ({
      name: suite.suiteName,
      total: suite.total,
      passed: suite.passed,
      failed: suite.failed,
      duration: suite.duration,
      tests: suite.results
    })),
    recommendations: generateRecommendations(suiteResults)
  };

  const perfPath = path.join(__dirname, '..', '..', '..', '..', '..', 'Phase_B_性能指标.json');
  fs.writeFileSync(perfPath, JSON.stringify(performance, null, 2), 'utf-8');
  console.log(`📊 Performance metrics saved to: ${perfPath}`);

  console.log('\n' + '═'.repeat(80));

  // 如果有失败的测试，退出码为1
  if (totalFailed > 0) {
    console.log('\n⚠️  Some tests failed. Please review the report.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  }
}

function generateRecommendations(suiteResults: TestSuiteResult[]): string[] {
  const recommendations: string[] = [];

  // 检查性能问题
  const slowSuites = suiteResults.filter(s => s.duration > 5000);
  if (slowSuites.length > 0) {
    recommendations.push(
      `Performance: ${slowSuites.length} test suite(s) took >5s. Consider optimization: ${slowSuites.map(s => s.suiteName).join(', ')}`
    );
  }

  // 检查失败率
  for (const suite of suiteResults) {
    if (suite.failed > 0) {
      const failureRate = (suite.failed / suite.total) * 100;
      if (failureRate > 20) {
        recommendations.push(
          `High failure rate in ${suite.suiteName}: ${failureRate.toFixed(1)}% (${suite.failed}/${suite.total})`
        );
      }
    }
  }

  // 通用建议
  if (recommendations.length === 0) {
    recommendations.push('All tests passed with good performance. Great job!');
    recommendations.push('Consider adding more edge case tests for better coverage.');
  }

  return recommendations;
}

// 运行测试
if (require.main === module) {
  runAllPhaseBTests();
}

export { runAllPhaseBTests };
