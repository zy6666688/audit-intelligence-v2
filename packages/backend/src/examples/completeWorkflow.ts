/**
 * 完整的审计工作流示例
 * Week 8: 端到端集成测试
 * 
 * 这是一个包含所有核心功能的完整审计流程：
 * 1. 数据输入（CSV读取）
 * 2. 数据清洗（过滤、映射）
 * 3. 审计分析（对比、抽样）
 * 4. AI分析（风险评估）
 * 5. 结果输出
 */

import { NodeRegistryV2 } from '../services/NodeRegistryV2';
import { ExecutionEngineV2 } from '../services/ExecutionEngineV2';
import { allNodes } from '../nodes';
import type { NodeInstance, EdgeBinding, NodeGraph } from '@audit/shared';

/**
 * 完整的审计工作流
 * 
 * 流程图:
 * 
 * CSV1 ┐
 *      ├→ 对比 → 过滤 → 聚合 → 抽样 → 输出
 * CSV2 ┘
 */
export async function runCompleteAuditWorkflow() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   完整审计工作流 - 端到端测试   ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // 1. 初始化注册表和引擎
  const registry = new NodeRegistryV2();
  allNodes.forEach(node => registry.register(node));
  
  console.log(`✅ 已注册 ${registry.list().length} 个节点类型\n`);

  // 2. 构建完整工作流
  const nodes: NodeInstance[] = [
    // 阶段1: 数据输入
    {
      id: 'csv_account',
      type: 'data.csv_reader',
      position: { x: 100, y: 100 },
      config: {
        filePath: './data/account_balances.csv',
        delimiter: ',',
        hasHeader: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'csv_actual',
      type: 'data.csv_reader',
      position: { x: 100, y: 300 },
      config: {
        filePath: './data/actual_balances.csv',
        delimiter: ',',
        hasHeader: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // 阶段2: 数据对比
    {
      id: 'compare',
      type: 'audit.data_compare',
      position: { x: 400, y: 200 },
      config: {
        compareFields: ['balance', 'description'],
        ignoreCase: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // 阶段3: 数据过滤
    {
      id: 'filter_large',
      type: 'data.filter',
      position: { x: 700, y: 200 },
      config: {
        field: 'difference_amount',
        operator: 'greaterThan',
        value: 1000
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // 阶段4: 数据聚合
    {
      id: 'aggregate_dept',
      type: 'data.aggregate',
      position: { x: 1000, y: 200 },
      config: {
        groupBy: ['department'],
        aggregations: {
          total_diff: {
            function: 'sum',
            sourceField: 'difference_amount'
          },
          count: {
            function: 'count',
            sourceField: 'id'
          },
          avg_diff: {
            function: 'avg',
            sourceField: 'difference_amount'
          }
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // 阶段5: 审计抽样
    {
      id: 'sampling',
      type: 'audit.sampling',
      position: { x: 1300, y: 200 },
      config: {
        method: 'top',
        sampleSize: 10,
        sortField: 'total_diff'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // 阶段6: 金额计算
    {
      id: 'amount_calc',
      type: 'audit.amount_calculate',
      position: { x: 1600, y: 200 },
      config: {
        precision: 2
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // 3. 定义连线
  const edges: EdgeBinding[] = [
    // CSV → 对比
    {
      id: 'edge1',
      from: { nodeId: 'csv_account', portName: 'data' },
      to: { nodeId: 'compare', portName: 'source1' },
      createdAt: new Date().toISOString()
    },
    {
      id: 'edge2',
      from: { nodeId: 'csv_actual', portName: 'data' },
      to: { nodeId: 'compare', portName: 'source2' },
      createdAt: new Date().toISOString()
    },

    // 对比 → 过滤
    {
      id: 'edge3',
      from: { nodeId: 'compare', portName: 'differences' },
      to: { nodeId: 'filter_large', portName: 'data' },
      createdAt: new Date().toISOString()
    },

    // 过滤 → 聚合
    {
      id: 'edge4',
      from: { nodeId: 'filter_large', portName: 'filtered' },
      to: { nodeId: 'aggregate_dept', portName: 'data' },
      createdAt: new Date().toISOString()
    },

    // 聚合 → 抽样
    {
      id: 'edge5',
      from: { nodeId: 'aggregate_dept', portName: 'aggregated' },
      to: { nodeId: 'sampling', portName: 'data' },
      createdAt: new Date().toISOString()
    },

    // 抽样 → 金额计算
    {
      id: 'edge6',
      from: { nodeId: 'sampling', portName: 'samples' },
      to: { nodeId: 'amount_calc', portName: 'data' },
      createdAt: new Date().toISOString()
    }
  ];

  // 4. 构建图
  const graph: NodeGraph = {
    id: 'complete_audit_workflow',
    name: '完整审计工作流',
    description: '端到端审计流程：数据输入 → 对比 → 过滤 → 聚合 → 抽样 → 计算',
    nodes: new Map(nodes.map(n => [n.id, n])),
    edges: new Map(edges.map(e => [e.id, e])),
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  };

  console.log('📊 工作流构建完成:');
  console.log(`  - 节点数: ${nodes.length}`);
  console.log(`  - 连线数: ${edges.length}`);
  console.log(`  - 阶段: 6个（输入→对比→过滤→聚合→抽样→计算）\n`);

  // 5. 执行工作流
  console.log('🚀 开始执行完整工作流...\n');
  
  const engine = new ExecutionEngineV2(registry, {
    enableCache: true,
    maxCacheSize: 100
  });

  const startTime = Date.now();

  try {
    const result = await engine.executeGraph(graph);
    const duration = Date.now() - startTime;

    if (result.success) {
      console.log('✅ 工作流执行成功!\n');
      
      // 打印执行统计
      console.log('📊 执行统计:');
      console.log(`  - 总耗时: ${duration}ms`);
      console.log(`  - 执行ID: ${result.executionId}`);
      console.log(`  - 节点数: ${result.nodeStates.size}`);
      
      console.log('\n📋 节点执行状态:');
      for (const [nodeId, state] of result.nodeStates) {
        const time = state.endTime && state.startTime 
          ? `${state.endTime - state.startTime}ms`
          : 'N/A';
        console.log(`  - ${nodeId}: ${state.status} (${time})`);
      }

      // 打印最终结果摘要
      const amountCalcState = result.nodeStates.get('amount_calc');
      if (amountCalcState?.output) {
        console.log('\n💰 最终结果摘要:');
        console.log(`  - 总金额: ${amountCalcState.output.sum || 0}`);
        console.log(`  - 平均金额: ${amountCalcState.output.average || 0}`);
        console.log(`  - 最大金额: ${amountCalcState.output.max || 0}`);
        console.log(`  - 记录数: ${amountCalcState.output.count || 0}`);
      }

      return {
        success: true,
        duration,
        result
      };

    } else {
      console.error('❌ 工作流执行失败:');
      console.error(`  错误: ${result.error?.message}`);
      
      return {
        success: false,
        error: result.error
      };
    }

  } catch (error: any) {
    console.error('❌ 执行异常:', error.message);
    throw error;
  }
}

/**
 * 性能测试：大规模节点图
 */
export async function performanceTest() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   性能测试 - 100节点图   ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const registry = new NodeRegistryV2();
  allNodes.forEach(node => registry.register(node));

  // 创建100个节点的线性流程
  const nodes: NodeInstance[] = [];
  const edges: EdgeBinding[] = [];

  for (let i = 0; i < 100; i++) {
    nodes.push({
      id: `node_${i}`,
      type: 'simple_add',
      position: { x: i * 100, y: 200 },
      config: { b: 1 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (i > 0) {
      edges.push({
        id: `edge_${i}`,
        from: { nodeId: `node_${i - 1}`, portName: 'sum' },
        to: { nodeId: `node_${i}`, portName: 'a' },
        createdAt: new Date().toISOString()
      });
    }
  }

  const graph: NodeGraph = {
    id: 'perf_test_100_nodes',
    name: '性能测试图',
    nodes: new Map(nodes.map(n => [n.id, n])),
    edges: new Map(edges.map(e => [e.id, e])),
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  };

  console.log(`📊 性能测试图: ${nodes.length}个节点, ${edges.length}条边\n`);

  const engine = new ExecutionEngineV2(registry);
  const startTime = Date.now();

  const result = await engine.executeGraph(graph);
  const duration = Date.now() - startTime;

  console.log(`\n⏱️  执行时间: ${duration}ms`);
  console.log(`📊 平均每节点: ${(duration / nodes.length).toFixed(2)}ms`);
  console.log(`✅ 状态: ${result.success ? '成功' : '失败'}\n`);

  return {
    totalNodes: nodes.length,
    duration,
    avgPerNode: duration / nodes.length,
    success: result.success
  };
}

// 主函数
if (require.main === module) {
  (async () => {
    try {
      // 运行完整工作流
      await runCompleteAuditWorkflow();
      
      console.log('\n' + '='.repeat(60) + '\n');
      
      // 运行性能测试
      await performanceTest();
      
      console.log('\n✅ 所有测试完成!\n');
    } catch (error) {
      console.error('❌ 测试失败:', error);
      process.exit(1);
    }
  })();
}
