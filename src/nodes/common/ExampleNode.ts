import { BaseNode } from '@/nodes/BaseNode';
import { nodeRegistry } from '@/core/registry/NodeRegistry';

export class ExampleNode extends BaseNode {
  constructor() {
    super('ExampleNode');
  }
}

nodeRegistry.registerNode({
  type: 'ExampleNode',
  title: '示例节点',
  titleEn: 'Example Node',
  category: '通用',
  inputs: [
    { name: '输入 A', nameEn: 'Input A', type: 'String' },
    { name: '输入 B', nameEn: 'Input B', type: 'Number' }
  ],
  outputs: [
    { name: '输出 X', nameEn: 'Output X', type: 'String' },
    { name: '输出 Y', nameEn: 'Output Y', type: 'Boolean' }
  ]
});
