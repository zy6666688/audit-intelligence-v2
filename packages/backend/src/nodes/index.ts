/**
 * 节点定义导出
 * Week 1 Day 2 + Week 5 扩展
 */

import { simpleAddNode } from './simple_add';
import { simpleMultiplyNode } from './simple_multiply';
import { echoNode } from './echo';
import { auditNodes } from './AuditNodes';
import { dataNodes } from './DataNodes';
import { businessNodes } from './BusinessNodes';

// 导出所有测试节点
export const testNodes = [
  simpleAddNode,
  simpleMultiplyNode,
  echoNode
];

// 导出审计节点
export { auditNodes } from './AuditNodes';

// 导出数据节点
export { dataNodes } from './DataNodes';

// 导出业务节点
export { businessNodes } from './BusinessNodes';

// 导出所有节点
export const allNodes = [
  ...testNodes,
  ...auditNodes,
  ...dataNodes,
  ...businessNodes
];

// 单独导出
export {
  simpleAddNode,
  simpleMultiplyNode,
  echoNode
};
