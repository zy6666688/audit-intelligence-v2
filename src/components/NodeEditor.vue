<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { CanvasEngine } from '@/engine/CanvasEngine';
import { useGraphStore } from '@/store/useGraphStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import PropertiesPanel from '@/components/panels/PropertiesPanel.vue';
import ProjectFilePanel from '@/components/panels/ProjectFilePanel.vue';
import ContextMenu from '@/components/common/ContextMenu.vue';
import NodeLibrary, { DraggedNodeData } from '@/components/panels/NodeLibrary.vue';
import DataPanel from '@/components/DataPanel.vue';
import NodeDocModal from '@/components/common/NodeDocModal.vue';
import apiClient from '@/api/axios-config';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

// 引入已注册的审计节点
import '@/nodes/audit/TestAuditNode';
import '@/nodes/common/ExampleNode';
import '@/nodes/audit/BusinessNodes'; // 引入业务流程节点
import '@/nodes/invoice/InvoiceNodes'; // 引入票据处理节点
import '@/nodes/data/DataNodes'; // 引入数据清洗和可视化节点
import { BaseNode } from '@/nodes/BaseNode';
import { comfyApi } from '@/api/comfyApi';
import { nodeRegistry } from '@/core/registry/NodeRegistry';

import { workflowPresets, getPresetById, getAllPresets, saveCustomPreset } from '@/core/workflows/WorkflowPresets';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const libraryRef = ref<InstanceType<typeof NodeLibrary> | null>(null);
let engine: CanvasEngine | null = null;
const store = useGraphStore();
const authStore = useAuthStore();
const languageStore = useLanguageStore();

// 右键菜单状态
const contextMenu = ref({
  visible: false,
  position: { x: 0, y: 0 },
  worldPos: { x: 0, y: 0 }
});

// 数据预览面板状态
const dataPanelVisible = ref(false);
const dataPanelProps = ref({
  promptId: undefined as string | undefined,
  nodeId: undefined as string | undefined,
  outputIndex: 0,
  projectId: undefined as string | undefined,
  runId: undefined as string | undefined
});

// 节点说明书状态
const docModal = ref({
  visible: false,
  nodeType: ''
});

// 属性面板显示/隐藏状态
const propertiesPanelVisible = ref(true);

// 预设工作流面板显示状态
const presetPanelVisible = ref(false);
const presetList = ref(workflowPresets);

// 切换属性面板显示/隐藏
const togglePropertiesPanel = () => {
  propertiesPanelVisible.value = !propertiesPanelVisible.value;
};

// 切换语言
const toggleLanguage = () => {
  languageStore.toggleLanguage();
  // 强制重新渲染画布
  if (engine) {
    engine.forceRender();
  }
  // 刷新节点库
  if (libraryRef.value) {
    libraryRef.value.refresh();
  }
};

// 通用：从对象数据加载工作流（用于示例与预设工作流）
async function loadWorkflowFromData(workflowData: any) {
  try {
    // 清空当前工作流（先删除所有节点，这会自动删除相关连线）
    const nodesToRemove = [...store.graph.nodes];
    for (const node of nodesToRemove) {
      store.removeNode(node.id);
    }
    
    // 转换节点
    const nodeMap = new Map<string, BaseNode>();
    
    for (const nodeDef of workflowData.nodes || []) {
      const node = new BaseNode(nodeDef.type);
      node.id = nodeDef.id;
      node.position = nodeDef.position || { x: 0, y: 0 };
      
      // 设置节点数据（参数）
      if (nodeDef.params) {
        Object.assign(node.data, nodeDef.params);
      }
      
      // 设置节点名称（如果有）
      if (nodeDef.name) {
        node.data.name = nodeDef.name;
      }
      
      // 从nodeRegistry获取节点定义，初始化inputs和outputs
      const nodeDefinition = nodeRegistry.getNodeDefinition(nodeDef.type);
      if (nodeDefinition) {
        node.inputs = nodeDefinition.inputs?.map(i => ({ ...i, link: null })) || [];
        node.outputs = nodeDefinition.outputs?.map(o => ({ ...o, links: [] })) || [];
      }
      
      store.addNode(node);
      nodeMap.set(nodeDef.id, node);
    }
    
    // 转换连线
    for (const edge of workflowData.edges || []) {
      const sourceNode = nodeMap.get(edge.from);
      const targetNode = nodeMap.get(edge.to);
      
      if (sourceNode && targetNode) {
        const fromSlot = edge.from_slot || 0;
        const toSlot = edge.to_slot || 0;
        
        // #region agent log
        const sourceDef = nodeRegistry.getNodeDefinition(sourceNode.type);
        const targetDef = nodeRegistry.getNodeDefinition(targetNode.type);
        const sourceOutput = sourceDef?.outputs?.[fromSlot];
        const targetInput = targetDef?.inputs?.[toSlot];
        fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NodeEditor.vue:120',message:'Loading workflow edge',data:{from:edge.from,to:edge.to,from_slot:fromSlot,to_slot:toSlot,source_type:sourceNode.type,target_type:targetNode.type,source_output:sourceOutput,target_input:targetInput,source_outputs:sourceDef?.outputs?.map((o:any,i:number)=>({index:i,name:o.name,type:o.type})),target_inputs:targetDef?.inputs?.map((i:any,idx:number)=>({index:idx,name:i.name,type:i.type}))},timestamp:Date.now(),sessionId:'debug-session',runId:'workflow-load',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        store.addLink(sourceNode.id, fromSlot, targetNode.id, toSlot);
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NodeEditor.vue:115',message:'Edge skipped - node not found',data:{from:edge.from,to:edge.to,source_found:!!sourceNode,target_found:!!targetNode},timestamp:Date.now(),sessionId:'debug-session',runId:'workflow-load',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
    }
    
    console.log('[NodeEditor] Loaded example workflow:', workflowData.name || 'audit_mock_workflow');
    
    // 验证所有连接
    const validationErrors: string[] = [];
    for (const link of store.graph.links) {
      const sourceNode = store.graph.nodes.find(n => n.id === link.sourceNodeId);
      const targetNode = store.graph.nodes.find(n => n.id === link.targetNodeId);
      
      if (!sourceNode || !targetNode) {
        validationErrors.push(`Link ${link.id}: Node not found`);
        continue;
      }
      
      const sourceDef = nodeRegistry.getNodeDefinition(sourceNode.type);
      const targetDef = nodeRegistry.getNodeDefinition(targetNode.type);
      
      if (!sourceDef || !targetDef) {
        validationErrors.push(`Link ${link.id}: Node definition not found (${sourceNode.type} -> ${targetNode.type})`);
        continue;
      }
      
      if (!sourceDef.outputs || link.sourceSlot >= sourceDef.outputs.length) {
        validationErrors.push(`Link ${link.id}: Source slot ${link.sourceSlot} out of range (${sourceNode.type} has ${sourceDef.outputs?.length || 0} outputs)`);
        continue;
      }
      
      if (!targetDef.inputs || link.targetSlot >= targetDef.inputs.length) {
        validationErrors.push(`Link ${link.id}: Target slot ${link.targetSlot} out of range (${targetNode.type} has ${targetDef.inputs?.length || 0} inputs)`);
        continue;
      }
      
      const sourceOutput = sourceDef.outputs[link.sourceSlot];
      const targetInput = targetDef.inputs[link.targetSlot];
      
      if (sourceOutput.type !== targetInput.type) {
        // DATAFRAME只能连接到DATAFRAME
        if (sourceOutput.type === 'DATAFRAME' && targetInput.type !== 'DATAFRAME') {
          validationErrors.push(`Link ${link.id}: Type mismatch - ${sourceOutput.name} (${sourceOutput.type}) cannot connect to ${targetInput.name} (${targetInput.type})`);
        } else if (targetInput.type === 'DATAFRAME' && sourceOutput.type !== 'DATAFRAME') {
          validationErrors.push(`Link ${link.id}: Type mismatch - ${sourceOutput.name} (${sourceOutput.type}) cannot connect to ${targetInput.name} (${targetInput.type})`);
        }
      }
    }
    
    if (validationErrors.length > 0) {
      console.error('[NodeEditor] Workflow validation errors:', validationErrors);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NodeEditor.vue:121',message:'Workflow validation errors',data:{errors:validationErrors,links:store.graph.links.map(l=>({id:l.id,from:l.sourceNodeId,to:l.targetNodeId,from_slot:l.sourceSlot,to_slot:l.targetSlot}))},timestamp:Date.now(),sessionId:'debug-session',runId:'workflow-load',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      alert(`工作流验证失败，发现 ${validationErrors.length} 个错误。请查看控制台了解详情。`);
    } else {
      console.log('[NodeEditor] Workflow validation passed');
    }
    
    // 重新加载图形到引擎并强制渲染
    if (engine) {
      engine.loadGraph(store.graph);
      engine.forceRender();
    }
  } catch (error) {
    console.warn('[NodeEditor] Failed to load workflow from data, keeping current canvas:', error);
  }
}

// 加载示例工作流（从 public JSON）
async function loadExampleWorkflow() {
  try {
    // 确保节点定义已加载（前端节点定义在import时注册，后端节点在loadBackendNodes中注册）
    // 验证关键节点定义是否存在
    const criticalNodes = ['FileUploadNode', 'ExcelLoader', 'ColumnMapperNode', 'NullValueCleanerNode', 'ExcelColumnValidator', 'DataFrameToTableNode', 'QuickPlotNode']; // AuditCheckNode已从示例工作流中移除（孤立节点）
    const missingNodes = criticalNodes.filter(nodeType => !nodeRegistry.getNodeDefinition(nodeType));
    
    if (missingNodes.length > 0) {
      console.warn('[NodeEditor] Missing node definitions:', missingNodes);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NodeEditor.vue:65',message:'Missing node definitions',data:{missing_nodes:missingNodes},timestamp:Date.now(),sessionId:'debug-session',runId:'workflow-load',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    }
    
    // 尝试从public目录加载mock工作流
    const response = await fetch('/workflows/audit_mock_workflow.json');
    if (!response.ok) {
      throw new Error('Failed to load workflow file');
    }
    
    const workflowData = await response.json();
    await loadWorkflowFromData(workflowData);
  } catch (error) {
    console.warn('[NodeEditor] Failed to load example workflow, using empty canvas:', error);
    // 如果加载失败，保持空画布
  }
}

// 应用预设工作流
async function applyWorkflowPresetById(presetId: string) {
  const preset = getPresetById(presetId);
  if (!preset) {
    alert('未找到预设工作流配置：' + presetId);
    return;
  }
  await loadWorkflowFromData(preset.data);
}

function handlePresetDragStart(event: DragEvent, presetId: string) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/workflow-preset', presetId);
    event.dataTransfer.effectAllowed = 'copy';
  }
}

async function handleApplyPresetClick(presetId: string) {
  const ok = confirm('此操作将清空当前画布并加载预设工作流，当前画布中的节点和连线将被覆盖，是否继续？');
  if (!ok) return;
  await applyWorkflowPresetById(presetId);
  presetPanelVisible.value = false;
}

// 添加WebSocket连接状态监听
const wsStatusInterval = ref<any>(null);

const checkBackendStatus = async () => {
  try {
    // 简单的健康检查
    const response = await apiClient.get('/health/ready', { timeout: 3000 });
    if (response.status === 200) {
    backendStatus.value = 'connected';
    backendError.value = '';
    } else {
      backendStatus.value = 'error';
      backendError.value = `Backend returned status ${response.status}`;
    }
  } catch (e: any) {
    backendStatus.value = 'error';
    if (e.code === 'ECONNREFUSED' || e.message?.includes('Network Error') || !e.response) {
      backendError.value = 'Backend offline - Please start the backend server at http://localhost:8000';
    } else {
      backendError.value = e.message || 'Backend connection failed';
    }
    console.warn('[Backend] Connection lost:', e);
  }
};

const loadBackendNodes = async () => {
  try {
    const info = await comfyApi.getObjectInfo();
    if (import.meta.env.DEV) {
      console.log('[NodeEditor] Loaded backend nodes:', Object.keys(info).length);
    }
    
    for (const [_, meta] of Object.entries(info)) {
      // 转换 ComfyUI metadata 为前端 NodeDefinition
      // ComfyUI: inputs: { required: { name: [TYPE, opts] } }
      // Frontend: inputs: [{ name, type }]
      
      const inputs: { name: string; type: string }[] = [];
      // 严格按照ComfyUI格式：required在前，optional在后
      if (meta.input) {
        // 先添加required输入
        if (meta.input.required) {
        for (const [pName, pConfig] of Object.entries(meta.input.required)) {
           // pConfig[0] is type string like "FLOAT", "STRING"
           inputs.push({ name: pName, type: (pConfig as any)[0] });
          }
        }
        // 再添加optional输入
        if (meta.input.optional) {
          for (const [pName, pConfig] of Object.entries(meta.input.optional)) {
             inputs.push({ name: pName, type: (pConfig as any)[0] });
          }
        }
      }

      const outputs: { name: string; type: string }[] = [];
      if (meta.output && meta.output_name) {
        meta.output.forEach((type, idx) => {
          outputs.push({ name: meta.output_name[idx], type });
        });
      }

      nodeRegistry.registerNode({
        type: meta.name,
        title: meta.display_name,
        category: meta.category,
        inputs,
        outputs,
        description: meta.description || '' // 传递节点说明
      });
    }

    // 刷新左侧列表
    if (libraryRef.value) {
      libraryRef.value.refresh();
    }
    
    backendStatus.value = 'connected';
  } catch (e) {
    console.warn('Backend seems offline, skipping remote nodes load.', e);
    backendStatus.value = 'error';
    backendError.value = (e as any).message || 'Connection failed';
  }
};

const backendStatus = ref<'connecting' | 'connected' | 'error'>('connecting');
const backendError = ref('');

onMounted(async () => {
  // 尝试加载后端节点
  await loadBackendNodes();
  
  // 定期检查后端连接状态
  wsStatusInterval.value = setInterval(checkBackendStatus, 5000);

  if (canvasRef.value) {
    engine = new CanvasEngine(canvasRef.value);
    
    engine.onNodeSelected = (nodeId) => {
      store.selectNode(nodeId);
      contextMenu.value.visible = false;
    };

    engine.onConnectionCreated = (sourceId, sourceSlot, targetId, targetSlot, linkId) => {
      if (import.meta.env.DEV) {
        console.log('Connection Created:', sourceId, sourceSlot, '->', targetId, targetSlot, linkId);
      }
      store.addLink(sourceId, sourceSlot, targetId, targetSlot, linkId);
      // 强制重绘以立即显示连线
      engine!.forceRender();
    };
    
    // 新增：处理连线断开回调
    engine.onLinkRemoved = (linkId) => {
      if (import.meta.env.DEV) console.log('Link Removed:', linkId);
      store.removeLink(linkId);
      engine!.forceRender();
    };

    engine.onNodeDeleted = (nodeId) => {
      if (import.meta.env.DEV) console.log('Node Deleted:', nodeId);
      store.removeNode(nodeId);
      engine!.forceRender();
    };

    engine.onContextMenu = (x, y) => {
      contextMenu.value = {
        visible: true,
        position: { x, y },
        worldPos: {
          x: (x - canvasRef.value!.getBoundingClientRect().left - engine!.getViewport().x) / engine!.getViewport().scale,
          y: (y - canvasRef.value!.getBoundingClientRect().top - engine!.getViewport().y) / engine!.getViewport().scale
        }
      };
    };

    engine.onNodeDocRequested = (nodeType) => {
      console.log('Doc requested for:', nodeType);
      docModal.value = {
        visible: true,
        nodeType
      };
    };

    // 先加载图形到引擎（即使是空的）
    engine.loadGraph(store.graph);
    
    // 如果当前没有节点，加载示例工作流
    if (store.graph.nodes.length === 0) {
      await loadExampleWorkflow();
    }
    
    // 挂载到 window 以便调试
    (window as any).engine = engine;
    
    console.log('Canvas Engine Initialized');
  }
});

onUnmounted(() => {
  // 清理定时器
  if (wsStatusInterval.value) {
    clearInterval(wsStatusInterval.value);
  }
});

const isRunning = ref(false);

// 打开数据预览面板
function showDataPreview(nodeId: string, promptId?: string, outputIndex: number = 0) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NodeEditor.vue:367',message:'showDataPreview called',data:{node_id:nodeId,prompt_id:promptId,output_index:outputIndex,last_run_id:store.lastRunId,current_project_id:store.currentProjectId},timestamp:Date.now(),sessionId:'debug-session',runId:'preview',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // 优先使用传入的 promptId (如果是临时运行)
  // 否则尝试使用 Store 中的运行上下文 (如果是项目运行)
  const effectiveRunId = promptId || store.lastRunId || undefined;
  const effectiveProjectId = store.currentProjectId || undefined;

  dataPanelProps.value = {
    promptId: !effectiveProjectId ? effectiveRunId : undefined, // 临时模式使用 promptId
    nodeId,
    outputIndex,
    projectId: effectiveProjectId,
    runId: effectiveProjectId ? effectiveRunId : undefined // 项目模式使用 runId
  };
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NodeEditor.vue:382',message:'DataPanel props set',data:{prompt_id:dataPanelProps.value.promptId,node_id:dataPanelProps.value.nodeId,project_id:dataPanelProps.value.projectId,run_id:dataPanelProps.value.runId},timestamp:Date.now(),sessionId:'debug-session',runId:'preview',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  dataPanelVisible.value = true;
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NodeEditor.vue:386',message:'DataPanel visible set to true',data:{visible:dataPanelVisible.value},timestamp:Date.now(),sessionId:'debug-session',runId:'preview',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
}

// 暴露给 window 以便 CanvasEngine 调用
(window as any).showDataPreview = showDataPreview;

async function handleRunAudit() {
  if (engine && !isRunning.value) {
    // 检查用户是否已登录
    if (!authStore.isAuthenticated) {
      alert('请先登录后再执行工作流！');
      router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } });
      return;
    }
    
    try {
      isRunning.value = true;
      console.log('Starting audit execution (Hybrid/Remote)...');
      console.log('Auth token:', authStore.token ? 'Present' : 'Missing');
      
      // Phase 2: Switch to remote execution by default
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NodeEditor.vue:401',message:'Before calling runGraph',data:{node_count:store.graph.nodes.length},timestamp:Date.now(),sessionId:'debug-session',runId:'workflow-exec',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const runId = await engine.runGraph(); 
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NodeEditor.vue:405',message:'After calling runGraph',data:{run_id:runId},timestamp:Date.now(),sessionId:'debug-session',runId:'workflow-exec',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // 更新 Store 状态
      store.setRunContext(runId);
      
      alert('审计流程任务已提交！请观察节点状态变化。');
    } catch (e: any) {
      console.error('Execution error:', e);
      
      // 处理401认证错误
      if (e.response?.status === 401) {
        alert('认证失败，请重新登录！');
        authStore.clearAuth();
        router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } });
      } else {
        const errorMessage = e.response?.data?.detail || e.message || String(e);
        alert('执行失败: ' + errorMessage);
      }
    } finally {
      isRunning.value = false;
    }
  }
}

// 1. 保存工作流 (保存到 LocalStorage)
function handleSaveWorkflow() {
  if (!engine) return;
  const json = engine.exportWorkflowJSON();
  localStorage.setItem('saved_audit_workflow', json);
  alert('工作流已保存到浏览器缓存 (LocalStorage)！');
}

// 3. 保存为预设工作流（存入本地 custom presets）
function handleSaveAsPreset() {
  if (!engine) return;
  const name = prompt('请输入预设名称：', '自定义预设');
  if (!name) return;
  const description = prompt('请输入预设描述：', '自定义工作流');
  const id = prompt('请输入预设ID（唯一标识，只能使用字母数字和下划线）：', `custom_${Date.now()}`);
  if (!id) return;
  const idValid = /^[A-Za-z0-9_\-]+$/.test(id);
  if (!idValid) {
    alert('ID 仅支持字母、数字、下划线或连字符');
    return;
  }

  try {
    const json = engine.exportWorkflowJSON();
    const data = JSON.parse(json);
    saveCustomPreset({
      id,
      name,
      description: description || '',
      data
    });
    presetList.value = getAllPresets();
    alert('已保存到本地预设库，可在“预设工作流”中使用');
  } catch (e: any) {
    console.error('Save preset failed:', e);
    alert('保存预设失败：' + (e.message || e));
  }
}

// 2. 导出工作流 (下载 JSON 文件)
function handleExportWorkflowJSON() {
  if (!engine) return;
  const json = engine.exportWorkflowJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit_workflow_${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// 3. 导出底稿 (业务结果导出)
function handleExportAudit() {
  alert('功能开发中：导出审计底稿 (Excel/PDF) - 即将上线');
}

function handleAddNode(type: string) {
  const newNode = new BaseNode(type);
  newNode.position = { ...contextMenu.value.worldPos };
  store.addNode(newNode);
  
  // 协同：广播添加节点事件
  comfyApi.sendWSMessage({
    type: "GRAPH_NODE_ADD",
    id: newNode.id,
    nodeType: newNode.type,
    x: newNode.position.x,
    y: newNode.position.y
  });

  contextMenu.value.visible = false;
}

function handleCloseMenu() {
  contextMenu.value.visible = false;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  if (!engine || !canvasRef.value) return;

  // 1. 检查是否拖入预设工作流
  const presetId = event.dataTransfer?.getData('application/workflow-preset');
  if (presetId) {
    const ok = confirm('此操作将清空当前画布并加载预设工作流，当前画布中的节点和连线将被覆盖，是否继续？');
    if (ok) {
      applyWorkflowPresetById(presetId);
    }
    return;
  }

  const rect = canvasRef.value.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  // 2. 检查是否拖入文件并放置在 FileUpload 节点上
  if (event.dataTransfer?.files?.length) {
    const targetNode = engine.getNodeAtScreenPos(mouseX, mouseY);
    if (targetNode && targetNode.type === 'FileUpload') {
      const file = event.dataTransfer.files[0];
      targetNode.data['file'] = file;
      // 触发重绘以更新节点外观
      engine.forceRender();
      console.log(`[NodeEditor] Dropped file '${file.name}' onto node ${targetNode.id}`);
      return;
    }
  }

  // 3. 检查是否从节点库拖入新节点
  const json = event.dataTransfer?.getData('application/json');
  if (json) {
    const data = JSON.parse(json) as DraggedNodeData;
    const viewport = engine.getViewport();
    
    const x = (mouseX - viewport.x) / viewport.scale;
    const y = (mouseY - viewport.y) / viewport.scale;

    const newNode = new BaseNode(data.type);
    newNode.position = { x, y };
    store.addNode(newNode);

    // 协同：广播添加节点事件
    comfyApi.sendWSMessage({
      type: "GRAPH_NODE_ADD",
      id: newNode.id,
      nodeType: newNode.type,
      x: newNode.position.x,
      y: newNode.position.y
    });
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
}
</script>

<template>
  <div class="node-editor-container">
    <div class="toolbar">
      <span>审计数智析 v2 - 工作流编辑器</span>
      
      <!-- 后端状态指示器 -->
      <div class="status-indicator" :class="backendStatus" :title="backendError">
        <span class="dot"></span>
        <span v-if="backendStatus === 'connected'">Backend Online</span>
        <span v-else-if="backendStatus === 'connecting'">Connecting...</span>
        <span v-else>Backend Offline</span>
      </div>

      <div class="actions">
        <button 
          @click="presetPanelVisible = !presetPanelVisible"
          title="预设工作流库（点击或拖拽应用）"
          class="preset-workflow-btn"
        >
          预设工作流
        </button>
        <button 
          @click="handleSaveAsPreset"
          title="保存当前画布为预设（本地）"
          class="preset-workflow-btn"
        >
          保存为预设
        </button>
        <div v-if="presetPanelVisible" class="preset-panel">
          <div
            v-for="preset in presetList"
            :key="preset.id"
            class="preset-item"
            draggable="true"
            @dragstart="(e) => handlePresetDragStart(e, preset.id)"
            @click="() => handleApplyPresetClick(preset.id)"
          >
            <div class="preset-title">{{ preset.name }}</div>
            <div class="preset-desc">{{ preset.description }}</div>
          </div>
          <div class="preset-tip">提示：可以点击直接应用，或拖拽到画布中，当前画布会被覆盖。</div>
        </div>
        <button 
          @click="toggleLanguage" 
          title="切换中英文"
          class="language-toggle-btn"
        >
          {{ languageStore.language === 'zh' ? 'EN' : '中文' }}
        </button>
        <button 
          @click="togglePropertiesPanel" 
          :class="{ active: propertiesPanelVisible }"
          title="切换属性面板"
          class="toggle-panel-btn"
        >
          {{ propertiesPanelVisible ? '隐藏属性' : '显示属性' }}
        </button>
        <button @click="handleRunAudit" :disabled="isRunning" :class="{ disabled: isRunning }">
          {{ isRunning ? '执行中...' : '运行审计' }}
        </button>
        <button @click="handleSaveWorkflow" title="暂存到浏览器缓存">保存工作流</button>
        <button @click="handleExportWorkflowJSON" title="导出为 JSON 文件">导出工作流</button>
        <button @click="handleExportAudit" title="导出业务底稿">导出底稿</button>
      </div>
    </div>
    
    <div class="main-content">
      <!-- 左侧节点库 -->
      <NodeLibrary ref="libraryRef" @drag-start="() => {}" />

      <div 
        class="canvas-wrapper"
        @drop="handleDrop"
        @dragover="handleDragOver"
      >
        <canvas ref="canvasRef"></canvas>
        
        <!-- 右键菜单 -->
        <ContextMenu 
          :visible="contextMenu.visible"
          :position="contextMenu.position"
          @close="handleCloseMenu"
          @add-node="handleAddNode"
        />
      </div>
      
      <!-- 右侧属性面板 + 项目文件区 -->
      <div class="right-side-panels">
      <PropertiesPanel 
        v-show="propertiesPanelVisible"
        :backend-status="backendStatus"
        :on-close="togglePropertiesPanel"
        class="properties-panel-wrapper"
      />
        <ProjectFilePanel
          v-if="store.currentProjectId"
          :project-id="store.currentProjectId"
          class="project-file-panel-wrapper"
        />
      </div>
    </div>
    
    <!-- 数据预览面板 (底部) -->
    <DataPanel 
      v-if="dataPanelVisible"
      :prompt-id="dataPanelProps.promptId"
      :node-id="dataPanelProps.nodeId"
      :output-index="dataPanelProps.outputIndex"
      :project-id="dataPanelProps.projectId"
      :run-id="dataPanelProps.runId"
      @close="dataPanelVisible = false"
    />

    <!-- 节点文档模态框 -->
    <NodeDocModal 
      :visible="docModal.visible"
      :node-type="docModal.nodeType"
      @close="docModal.visible = false"
    />
  </div>
</template>

<style scoped lang="scss">
.node-editor-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #1e1e1e;
  overflow: hidden;

  .toolbar {
    height: 48px;
    background-color: #2a2a2a;
    border-bottom: 1px solid #111;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 16px;
    color: #eee;
    font-size: 14px;
    font-weight: 500;
    flex-shrink: 0;

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.2);
      
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #7f8c8d;
      }
      
      &.connected {
        color: #2ecc71;
        .dot { background-color: #2ecc71; box-shadow: 0 0 5px #2ecc71; }
      }
      
      &.connecting {
        color: #f1c40f;
        .dot { background-color: #f1c40f; animation: pulse 1s infinite; }
      }
      
      &.error {
        color: #e74c3c;
        background: rgba(231, 76, 60, 0.1);
        cursor: help;
        .dot { background-color: #e74c3c; }
      }
    }

    .actions {
      display: flex;
      gap: 12px;
      
      button {
        padding: 6px 16px;
        background: #3498db;
        border: none;
        color: #fff;
        cursor: pointer;
        border-radius: 4px;
        font-size: 12px;
        transition: background 0.2s;
        
        &:hover {
          background: #2980b9;
        }
        
        &.disabled {
          background: #7f8c8d;
          cursor: not-allowed;
        }
      }
      
      .toggle-panel-btn {
        background: #555;
        border: 1px solid #666;
        font-weight: 500;
        
        &:hover {
          background: #666;
          border-color: #777;
        }
        
        &.active {
          background: #3498db;
          border-color: #2980b9;
          color: #fff;
        }
      }

      .language-toggle-btn {
        background: #555;
        border: 1px solid #666;
        font-weight: 500;
        min-width: 50px;
        
        &:hover {
          background: #666;
          border-color: #777;
        }
      }

      .preset-workflow-btn {
        background: #555;
        border: 1px solid #666;
        font-weight: 500;
        
        &:hover {
          background: #666;
          border-color: #777;
        }
      }

      .preset-panel {
        position: absolute;
        top: 40px;
        right: 0;
        width: 320px;
        max-height: 320px;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
        padding: 8px 10px;
        overflow-y: auto;
        z-index: 20;

        .preset-item {
          padding: 6px 8px;
          margin-bottom: 6px;
          border-radius: 4px;
          border: 1px solid #444;
          background: #333;
          cursor: grab;
          transition: all 0.15s;

          &:hover {
            background: #3a3a3a;
            border-color: #666;
            transform: translateY(-1px);
          }

          .preset-title {
            font-size: 13px;
            font-weight: 600;
            color: #f0f0f0;
            margin-bottom: 2px;
          }

          .preset-desc {
            font-size: 12px;
            color: #bbb;
          }
        }

        .preset-tip {
          margin-top: 4px;
          font-size: 11px;
          color: #888;
        }
      }
    }
  }

  .main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;

    .canvas-wrapper {
      flex: 1;
      position: relative;
      background: #111; 
      overflow: hidden;
      
      canvas {
        width: 100%;
        height: 100%;
        display: block;
        outline: none;
        position: absolute;
        top: 0;
        left: 0;
      }
    }
    
    .right-side-panels {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    
    .properties-panel-wrapper {
      flex-shrink: 0;
      transition: transform 0.3s ease;
      }

      .project-file-panel-wrapper {
        flex-shrink: 0;
        border-top: 1px solid #333;
        height: 40%;
      }
    }
  }
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
</style>
