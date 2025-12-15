import { Node } from '@/types/graph';

export interface NodePropertyDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'file' | 'code';
  defaultValue?: any;
  options?: string[]; // For select type
  placeholder?: string;
  description?: string; // 属性说明文档
}

export interface NodeDefinition {
  type: string;
  title: string;
  titleEn?: string; // 英文标题
  category?: string;
  inputs?: { name: string; nameEn?: string; nameZh?: string; type: string }[];
  outputs?: { name: string; nameEn?: string; nameZh?: string; type: string }[];
  properties?: NodePropertyDefinition[]; // 新增属性定义
  widgets?: any[]; // 暂时用 any，后续定义 Widget 类型
  description?: string; // 节点说明文档
}

class NodeRegistry {
  private nodeDefinitions: Map<string, NodeDefinition> = new Map();

  /**
   * 注册一个新的节点类型
   * @param def 节点定义
   */
  registerNode(def: NodeDefinition) {
    if (this.nodeDefinitions.has(def.type)) {
      console.warn(`Node type ${def.type} already registered. Overwriting.`);
    }
    this.nodeDefinitions.set(def.type, def);
    console.log(`[Registry] Registered node: ${def.type}`);
  }

  /**
   * 获取节点定义
   * @param type 节点类型字符串
   */
  getNodeDefinition(type: string): NodeDefinition | undefined {
    return this.nodeDefinitions.get(type);
  }

  /**
   * 获取所有注册的节点定义 (用于菜单显示)
   */
  getAllDefinitions(): NodeDefinition[] {
    return Array.from(this.nodeDefinitions.values());
  }

  /**
   * 创建一个节点实例
   * @param type 节点类型
   */
  createNodeInstance(type: string): Partial<Node> | null {
    const def = this.getNodeDefinition(type);
    if (!def) return null;

    return {
      type: def.type,
      data: {},
      inputs: def.inputs?.map(i => ({ ...i, link: null })) || [],
      outputs: def.outputs?.map(o => ({ ...o, links: [] })) || [],
      size: { width: 140, height: 60 } // 默认尺寸，后续根据内容计算
    };
  }

  deregisterNode(type: string) {
    this.nodeDefinitions.delete(type);
  }
}

export const nodeRegistry = new NodeRegistry();
export default nodeRegistry;
