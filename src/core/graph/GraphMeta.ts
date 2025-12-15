/**
 * 端口定义 (Metadata)
 * 描述节点的一个输入或输出端口的静态属性
 */
export interface PortDefinition {
  name: string;           // 端口唯一标识符 (key)
  type: string;           // 数据类型 (例如 'string', 'number', 'image', 'file')
  label?: string;         // 显示名称 (UI)
  required?: boolean;     // 是否必须连接 (仅输入有效)
  defaultValue?: any;     // 默认值 (仅输入有效)
  multi?: boolean;        // 是否允许多个连接 (默认为 false)
}

/**
 * 节点元数据 (Metadata)
 * 描述图中的一个节点实例 (可序列化)
 */
export interface NodeMeta {
  id: string;
  type: string;                   // 引用 NodeRegistry 中的 type
  position: { x: number; y: number };
  size?: { width: number; height: number };
  data: Record<string, any>;      // 节点的配置数据 (用户在属性面板填写的参数)
  // 注意：连线关系不在这里存储，而是在 links 列表中
}

/**
 * 连接元数据 (Metadata)
 * 描述两个节点端口之间的连接 (可序列化)
 */
export interface LinkMeta {
  id: string;
  sourceNodeId: string;
  sourcePort: string; // 输出端口名称
  targetNodeId: string;
  targetPort: string; // 输入端口名称
}

/**
 * 图元数据 (Metadata)
 * 完整的图描述 (可序列化为 JSON)
 */
export interface GraphMeta {
  id: string;
  name?: string;
  version: number;
  nodes: NodeMeta[];
  links: LinkMeta[];
  viewport?: { x: number; y: number; scale: number }; // 编辑器视口状态
}
