/**
 * 审计工作流示例
 * 演示如何使用审计底稿引擎完成一个完整的审计流程
 */

import { NodeRegistryV2 } from '../services/NodeRegistryV2';
import { ExecutionEngineV2 } from '../services/ExecutionEngineV2';
import { DependencyGraph } from '../services/DependencyGraph';
import { allNodes } from '../nodes';
import type { NodeInstance, EdgeBinding, NodeGraph } from '@audit/shared';

/**
 * 示例1: 简单的数据对比审计流程
 * 
 * 流程:
 * 1. 读取两个CSV文件
 * 2. 对比数据差异
 * 3. 对差异数据进行金额统计
 */
export async function exampleDataCompareAudit() {
  console.log('=== 示例1: 数据对比审计流程 ===\n');

  // 1. 创建节点注册表
  const registry = new NodeRegistryV2();
  
  // 2. 注册所有节点
  allNodes.forEach(nodeDef => {
    registry.register(nodeDef);
  });

  console.log(`✅ 已注册 ${registry.list().length} 个节点类型\n`);

  // 3. 构建工作流图
  const nodes: NodeInstance[] = [
    // CSV读取节点1 - 读取账面数据
    {
      id: 'csv_reader_1',
      type: 'data.csv_reader',
      position: { x: 100, y: 100 },
      config: {
        filePath: './data/account_data.csv',
        delimiter: ',',
        hasHeader: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // CSV读取节点2 - 读取实际数据
    {
      id: 'csv_reader_2',
      type: 'data.csv_reader',
      position: { x: 100, y: 300 },
      config: {
        filePath: './data/actual_data.csv',
        delimiter: ',',
        hasHeader: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // 数据对比节点
    {
      id: 'data_compare',
      type: 'audit.data_compare',
      position: { x: 400, y: 200 },
      config: {
        compareFields: ['amount', 'description'],
        ignoreCase: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // 金额计算节点 - 计算差异金额
    {
      id: 'amount_calc',
      type: 'audit.amount_calculate',
      position: { x: 700, y: 200 },
      config: {
        precision: 2
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // 4. 定义连线
  const edges: EdgeBinding[] = [
    {
      id: 'edge1',
      from: { nodeId: 'csv_reader_1', portName: 'data' },
      to: { nodeId: 'data_compare', portName: 'source1' },
      createdAt: new Date().toISOString()
    },
    {
      id: 'edge2',
      from: { nodeId: 'csv_reader_2', portName: 'data' },
      to: { nodeId: 'data_compare', portName: 'source2' },
      createdAt: new Date().toISOString()
    },
    {
      id: 'edge3',
      from: { nodeId: 'data_compare', portName: 'differences' },
      to: { nodeId: 'amount_calc', portName: 'data' },
      createdAt: new Date().toISOString()
    }
  ];

  // 5. 构建图对象
  const graph: NodeGraph = {
    id: 'audit_workflow_1',
    name: '数据对比审计',
    nodes: new Map(nodes.map(n => [n.id, n])),
    edges: new Map(edges.map(e => [e.id, e])),
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  };

  console.log('📊 工作流图构建完成:');
  console.log(`  - 节点数: ${nodes.length}`);
  console.log(`  - 连线数: ${edges.length}\n`);

  // 6. 执行工作流
  console.log('🚀 开始执行工作流...\n');
  
  const engine = new ExecutionEngineV2(registry);
  
  try {
    const result = await engine.executeGraph(graph);
    
    console.log('✅ 工作流执行成功!\n');
    console.log('📈 执行结果:');
    console.log('\n⏱️  执行统计:');
    console.log(`  - 总耗时: ${result.duration}ms`);
    console.log(`  - 执行ID: ${result.executionId}`);
    console.log(`  - 节点状态:`);
    for (const [nodeId, state] of result.nodeStates) {
      console.log(`    - ${nodeId}: ${state.status}`);
    }
    
  } catch (error) {
    console.error('❌ 工作流执行失败:', error);
    throw error;
  }
}

/**
 * 示例2: 数据过滤和聚合流程
 * 
 * 流程:
 * 1. 读取CSV数据
 * 2. 过滤大于1000的金额
 * 3. 按部门分组聚合
 * 4. 抽样选择
 */
export async function exampleFilterAndAggregateAudit() {
  console.log('\n=== 示例2: 数据过滤和聚合流程 ===\n');

  const registry = new NodeRegistryV2();
  allNodes.forEach(nodeDef => registry.register(nodeDef));

  const nodes: NodeInstance[] = [
    // CSV读取
    {
      id: 'csv_reader',
      type: 'data.csv_reader',
      position: { x: 100, y: 200 },
      config: {
        filePath: './data/transactions.csv'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // 数据过滤 - 只保留金额>1000的记录
    {
      id: 'filter',
      type: 'data.filter',
      position: { x: 300, y: 200 },
      config: {
        field: 'amount',
        operator: 'greaterThan',
        value: 1000
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // 数据聚合 - 按部门统计
    {
      id: 'aggregate',
      type: 'data.aggregate',
      position: { x: 500, y: 200 },
      config: {
        groupBy: ['department'],
        aggregations: {
          totalAmount: {
            function: 'sum',
            sourceField: 'amount'
          },
          avgAmount: {
            function: 'avg',
            sourceField: 'amount'
          },
          count: {
            function: 'count',
            sourceField: 'amount'
          }
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // 审计抽样
    {
      id: 'sampling',
      type: 'audit.sampling',
      position: { x: 700, y: 200 },
      config: {
        method: 'top',
        sampleSize: 5,
        sortField: 'totalAmount'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const edges: EdgeBinding[] = [
    {
      id: 'edge1',
      from: { nodeId: 'csv_reader', portName: 'data' },
      to: { nodeId: 'filter', portName: 'data' },
      createdAt: new Date().toISOString()
    },
    {
      id: 'edge2',
      from: { nodeId: 'filter', portName: 'filtered' },
      to: { nodeId: 'aggregate', portName: 'data' },
      createdAt: new Date().toISOString()
    },
    {
      id: 'edge3',
      from: { nodeId: 'aggregate', portName: 'aggregated' },
      to: { nodeId: 'sampling', portName: 'data' },
      createdAt: new Date().toISOString()
    }
  ];

  const graph: NodeGraph = {
    id: 'audit_workflow_2',
    name: '过滤和聚合审计',
    nodes: new Map(nodes.map(n => [n.id, n])),
    edges: new Map(edges.map(e => [e.id, e])),
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  };

  console.log('📊 工作流图构建完成\n');
  console.log('🚀 开始执行工作流...\n');

  const engine = new ExecutionEngineV2(registry);
  
  try {
    const result = await engine.executeGraph(graph);
    console.log('✅ 工作流执行成功!\n');
    console.log('📈 执行完成:');
    console.log(`  - 耗时: ${result.duration}ms`);
    console.log(`  - 节点数: ${result.nodeStates.size}`);
  } catch (error) {
    console.error('❌ 工作流执行失败:', error);
    throw error;
  }
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   审计底稿引擎 - 工作流示例演示   ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // await exampleDataCompareAudit();
    // await exampleFilterAndAggregateAudit();
    
    console.log('\n✅ 所有示例执行完成!\n');
  } catch (error) {
    console.error('\n❌ 示例执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runAllExamples();
}
