export interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data: Record<string, any>; // 节点内部数据 (widgets values)
  inputs: Input[];
  outputs: Output[];
  flags?: Record<string, any>; // 如 collapsed 等状态
}

export interface Link {
  id: string;
  sourceNodeId: string;
  sourceSlot: number; // 0-indexed output index
  targetNodeId: string;
  targetSlot: number; // 0-indexed input index
  type: string; // 数据类型
}

export interface Input {
  name: string;
  type: string;
  link: string | null; // 连接的 Link ID
}

export interface Output {
  name: string;
  type: string;
  links: string[]; // 连接的 Link ID 数组 (一个输出可以连多个输入)
}

export interface Graph {
  nodes: Node[];
  links: Link[];
  groups?: any[]; // 可选：分组
  version?: number;
}
