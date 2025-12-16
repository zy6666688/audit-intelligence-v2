import { Graph, Link } from '@/types/graph';
import { BaseNode } from '@/nodes/BaseNode';
import { nodeRegistry } from '@/core/registry/NodeRegistry';

// 定义 Store 中的状态接口
interface GraphState {
  graph: Graph;
  selectedNodeId: string | null;
  transform: { x: number; y: number; scale: number };
  currentProjectId: string | null; // 当前打开的项目 ID
  lastRunId: string | null;        // 最后一次执行的 Run ID
}

import { defineStore } from 'pinia';

export const useGraphStore = defineStore('graph', {
  state: (): GraphState => ({
    graph: {
      nodes: [],
      links: [],
      // nextLinkId 这种计数器通常在 graph 内部维护
      version: 0.1
    },
    selectedNodeId: null,
    transform: { x: 0, y: 0, scale: 1 },
    currentProjectId: null,
    lastRunId: null
  }),

  getters: {
    selectedNode: (state) => state.graph.nodes.find(n => n.id === state.selectedNodeId) as unknown as BaseNode | undefined
  },

  actions: {
    // === 项目/运行上下文 ===
    setProjectContext(projectId: string | null) {
      this.currentProjectId = projectId;
    },

    setRunContext(runId: string | null) {
      this.lastRunId = runId;
    },
    // === 节点操作 ===
    addNode(node: BaseNode) {
      this.graph.nodes.push(node);
    },

    removeNode(nodeId: string) {
      // 1. 删除与该节点相关的所有连线
      this.graph.links = this.graph.links.filter(
        l => l.sourceNodeId !== nodeId && l.targetNodeId !== nodeId
      );
      
      // 2. 删除节点
      this.graph.nodes = this.graph.nodes.filter(n => n.id !== nodeId);

      if (this.selectedNodeId === nodeId) {
        this.selectedNodeId = null;
      }
    },

    selectNode(nodeId: string | null) {
      this.selectedNodeId = nodeId;
    },

    // === 连线操作 (参考 ComfyUI/LiteGraph) ===
    addLink(sourceNodeId: string, sourceSlot: number, targetNodeId: string, targetSlot: number, id?: string) {
      // 1. 检查是否存在重复连线
      const exists = this.graph.links.some(l => 
        l.sourceNodeId === sourceNodeId && l.sourceSlot === sourceSlot &&
        l.targetNodeId === targetNodeId && l.targetSlot === targetSlot
      );
      if (exists) return;

      // 2. 检查输入端口是否只允许单连接 (ComfyUI 中通常输入只能连一个，输出可以连多个)
      // 如果目标输入已经有连线，先断开旧的
      this.graph.links = this.graph.links.filter(l => 
        !(l.targetNodeId === targetNodeId && l.targetSlot === targetSlot)
      );

      // 3. 创建新连线
      // 查找数据类型并进行类型验证
      const sourceNode = this.graph.nodes.find(n => n.id === sourceNodeId);
      const targetNode = this.graph.nodes.find(n => n.id === targetNodeId);
      
      if (!sourceNode || !targetNode) {
        console.warn('Cannot create link: source or target node not found');
        return;
      }
      
      // 4. 类型验证 - 从nodeRegistry获取节点定义
      const sourceDef = nodeRegistry.getNodeDefinition(sourceNode.type);
      const targetDef = nodeRegistry.getNodeDefinition(targetNode.type);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGraphStore.ts:92',message:'Type validation start',data:{source_type:sourceNode.type,target_type:targetNode.type,source_slot:sourceSlot,target_slot:targetSlot,source_def_exists:!!sourceDef,target_def_exists:!!targetDef},timestamp:Date.now(),sessionId:'debug-session',runId:'link-creation',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      if (!sourceDef || !targetDef) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGraphStore.ts:96',message:'Node definitions not found',data:{source_type:sourceNode.type,target_type:targetNode.type,source_def_exists:!!sourceDef,target_def_exists:!!targetDef},timestamp:Date.now(),sessionId:'debug-session',runId:'link-creation',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.warn('Cannot create link: node definitions not found');
        return;
      }
      
      // 检查输出slot索引
      if (!sourceDef.outputs || sourceSlot >= sourceDef.outputs.length) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGraphStore.ts:101',message:'Source slot out of range',data:{source_type:sourceNode.type,source_slot:sourceSlot,outputs_count:sourceDef.outputs?.length||0,outputs:sourceDef.outputs},timestamp:Date.now(),sessionId:'debug-session',runId:'link-creation',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.warn(`Cannot create link: source output slot ${sourceSlot} out of range (${sourceDef.outputs?.length || 0} outputs)`);
        return;
      }
      
      // 检查输入slot索引
      if (!targetDef.inputs || targetSlot >= targetDef.inputs.length) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGraphStore.ts:107',message:'Target slot out of range',data:{target_type:targetNode.type,target_slot:targetSlot,inputs_count:targetDef.inputs?.length||0,inputs:targetDef.inputs},timestamp:Date.now(),sessionId:'debug-session',runId:'link-creation',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.warn(`Cannot create link: target input slot ${targetSlot} out of range (${targetDef.inputs?.length || 0} inputs)`);
        return;
      }
      
      // 获取类型
      const sourceOutput = sourceDef.outputs[sourceSlot];
      const targetInput = targetDef.inputs[targetSlot];
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGraphStore.ts:113',message:'Type comparison',data:{source_output:sourceOutput,target_input:targetInput,types_match:sourceOutput.type===targetInput.type},timestamp:Date.now(),sessionId:'debug-session',runId:'link-creation',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // 类型匹配检查
      if (sourceOutput.type !== targetInput.type) {
        // DATAFRAME只能连接到DATAFRAME
        if (sourceOutput.type === 'DATAFRAME' && targetInput.type !== 'DATAFRAME') {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGraphStore.ts:119',message:'Type mismatch - DATAFRAME to non-DATAFRAME',data:{source_output:sourceOutput,target_input:targetInput},timestamp:Date.now(),sessionId:'debug-session',runId:'link-creation',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          console.error(`Type mismatch: Cannot connect DATAFRAME to ${targetInput.type}`);
          alert(`类型不匹配：无法将 ${sourceOutput.name} (${sourceOutput.type}) 连接到 ${targetInput.name} (${targetInput.type})`);
          return;
        }
        if (targetInput.type === 'DATAFRAME' && sourceOutput.type !== 'DATAFRAME') {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGraphStore.ts:125',message:'Type mismatch - non-DATAFRAME to DATAFRAME',data:{source_output:sourceOutput,target_input:targetInput},timestamp:Date.now(),sessionId:'debug-session',runId:'link-creation',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          console.error(`Type mismatch: Cannot connect ${sourceOutput.type} to DATAFRAME`);
          alert(`类型不匹配：无法将 ${sourceOutput.name} (${sourceOutput.type}) 连接到 ${targetInput.name} (${targetInput.type})`);
          return;
        }
        // 其他类型不匹配
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGraphStore.ts:130',message:'Type mismatch - allowing connection',data:{source_output:sourceOutput,target_input:targetInput},timestamp:Date.now(),sessionId:'debug-session',runId:'link-creation',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.warn(`Type mismatch: ${sourceOutput.type} -> ${targetInput.type}, but allowing connection`);
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGraphStore.ts:133',message:'Link created successfully',data:{source_output:sourceOutput,target_input:targetInput},timestamp:Date.now(),sessionId:'debug-session',runId:'link-creation',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // 简单的类型生成
      const linkType = sourceOutput.type || 'default'; 

      const newLink: Link = {
        id: id || crypto.randomUUID(), // 生成唯一 ID 或使用传入的 ID
        sourceNodeId,
        sourceSlot,
        targetNodeId,
        targetSlot,
        type: linkType
      };

      this.graph.links.push(newLink);
      console.log('Link added:', newLink);
    },

    removeLink(linkId: string) {
      this.graph.links = this.graph.links.filter(l => l.id !== linkId);
    },

    // === 视口操作 ===
    updateTransform(x: number, y: number, scale: number) {
      this.transform = { x, y, scale };
    }
  }
});
