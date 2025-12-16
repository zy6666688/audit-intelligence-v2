import { BaseNode } from '@/nodes/BaseNode';
import { nodeRegistry } from '@/core/registry/NodeRegistry';

// CustomScript 节点
export class CustomScriptNode extends BaseNode {
  constructor() {
    super('CustomScript');
  }
}

nodeRegistry.registerNode({
  type: 'CustomScript',
  title: '自定义脚本 (JS)',
  category: '高级功能',
  inputs: [
    { name: 'input', type: 'any' }
  ],
  outputs: [
    { name: 'output', type: 'any' }
  ],
  properties: [
    { 
      name: 'script', 
      label: '脚本代码 (return value)', 
      type: 'code', 
      defaultValue: 'return inputs.input;',
      placeholder: 'async (inputs, context) => { ... }'
    }
  ]
});
