/**
 * Node V3 Registry - 节点注册中心
 * 
 * 统一导出所有V3节点并注册到nodeRegistryV3
 */

import { nodeRegistryV3 } from './NodeRegistryV3';

// 导入所有节点
import { RecordsInputNode } from './input/RecordsInputNode';
import { VoucherInputNode } from './input/VoucherInputNode';
import { ContractInputNode } from './input/ContractInputNode';
import { BankFlowInputNode } from './input/BankFlowInputNode';
import { InvoiceInputNode } from './input/InvoiceInputNode';
import { OCRExtractNode } from './preprocess/OCRExtractNode';
import { FieldMapperNode } from './preprocess/FieldMapperNode';
import { NormalizeDataNode } from './preprocess/NormalizeDataNode';
import { DeduplicateNode } from './preprocess/DeduplicateNode';
import { ThreeDocMatchNode } from './audit/ThreeDocMatchNode';
import { FundLoopDetectNode } from './audit/FundLoopDetectNode';
import { AIFraudScorerNode } from './ai/AIFraudScorerNode';
import { WorkpaperGeneratorNode } from './output/WorkpaperGeneratorNode';

// 导出注册中心
export { nodeRegistryV3 } from './NodeRegistryV3';
export { BaseNodeV3 } from './BaseNode';
export type { NodeManifest, NodeExecutionResult, NodeExecutionContext } from './BaseNode';

// 节点列表
const allV3Nodes = [
  // Phase A - MVP节点（5个核心节点）
  new RecordsInputNode(),
  new ThreeDocMatchNode(),
  new FundLoopDetectNode(),
  new AIFraudScorerNode(),
  new WorkpaperGeneratorNode(),
  
  // Phase B - 输入节点
  new VoucherInputNode(),
  new ContractInputNode(),
  new BankFlowInputNode(),
  new InvoiceInputNode(),
  
  // Phase B - 预处理节点
  new OCRExtractNode(),
  new FieldMapperNode()
];

/**
 * 初始化所有V3节点
 */
export function initializeV3Nodes() {
  console.log('🚀 Initializing V3 Nodes...');
  
  nodeRegistryV3.registerAll(allV3Nodes);
  
  const stats = nodeRegistryV3.getStats();
  console.log(`✅ V3 Nodes initialized: ${stats.totalNodes} nodes registered`);
  console.log(`   Categories:`, stats.categories);
  console.log(`   Capabilities:`, stats.byCapability);
  
  return nodeRegistryV3;
}

/**
 * 获取所有V3节点的清单
 */
export function getAllV3Manifests() {
  return nodeRegistryV3.listManifests();
}

/**
 * 按分类获取节点
 */
export function getV3NodesByCategory(category: string) {
  return nodeRegistryV3.getNodesByCategory(category);
}

/**
 * 搜索节点
 */
export function searchV3Nodes(query: string) {
  return nodeRegistryV3.searchNodes(query);
}

/**
 * 推荐节点
 */
export function recommendNextV3Nodes(outputType: string) {
  return nodeRegistryV3.recommendNextNodes(outputType as any);
}
