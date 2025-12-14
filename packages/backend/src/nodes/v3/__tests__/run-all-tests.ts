/**
 * 运行所有V3节点测试
 */

import { testRecordsInputNode } from './RecordsInputNode.test';
import { testThreeDocMatchNode } from './ThreeDocMatchNode.test';
import { NodeTestFramework, TestSuiteResult } from './test-framework';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import * as fs from 'fs';
import * as path from 'path';

async function runAllTests() {
  console.log('\n🚀 V3 Nodes Test Suite');
  console.log('═'.repeat(60));
  console.log(`Started at: ${new Date().toLocaleString()}`);
  console.log('═'.repeat(60));

  const suiteResults: TestSuiteResult[] = [];

  try {
    // 运行所有测试套件
    suiteResults.push(await testRecordsInputNode());
    suiteResults.push(await testThreeDocMatchNode());
    // 更多测试套件...

    // 生成测试报告
    const report = NodeTestFramework.generateReport(suiteResults);
    
    // 保存报告
    const reportPath = path.join(__dirname, '../../../../test-report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Test report saved to: ${reportPath}`);

    // 生成性能报告
    const perfReport = PerformanceMonitor.getPerformanceReport();
    console.log('\n📊 Performance Report:');
    console.log(JSON.stringify(perfReport, null, 2));

    const suggestions = PerformanceMonitor.getOptimizationSuggestions();
    if (suggestions.length > 0) {
      console.log('\n💡 Optimization Suggestions:');
      suggestions.forEach(s => console.log(`   ${s}`));
    }

    // 导出性能指标
    const perfMetrics = PerformanceMonitor.exportMetrics();
    const metricsPath = path.join(__dirname, '../../../../performance-metrics.json');
    fs.writeFileSync(metricsPath, perfMetrics);
    console.log(`\n📊 Performance metrics saved to: ${metricsPath}`);

    // 最终统计
    const totalTests = suiteResults.reduce((sum, s) => sum + s.total, 0);
    const totalPassed = suiteResults.reduce((sum, s) => sum + s.passed, 0);
    const totalFailed = suiteResults.reduce((sum, s) => sum + s.failed, 0);

    console.log('\n' + '═'.repeat(60));
    console.log('🎯 Final Results:');
    console.log(`   Total: ${totalTests}`);
    console.log(`   Passed: ${totalPassed} ✅`);
    console.log(`   Failed: ${totalFailed} ❌`);
    console.log(`   Pass Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    console.log('═'.repeat(60));

    // 退出代码
    process.exit(totalFailed > 0 ? 1 : 0);

  } catch (error: any) {
    console.error('\n❌ Test suite failed with error:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runAllTests };
