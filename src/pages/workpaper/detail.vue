<template>
  <view class="workpaper-detail">
    <!-- 顶部工具栏 -->
    <view class="toolbar">
      <view class="toolbar-left">
        <view class="back-btn" @click="handleBack">
          <text>←</text>
        </view>
        <view class="title-info">
          <text class="title">{{ workpaper.title || '底稿编辑器' }}</text>
          <text class="status" :class="'status-' + workpaper.status">
            {{ statusText[workpaper.status] }}
          </text>
        </view>
      </view>
      
      <view class="toolbar-right">
        <view class="tool-btn lang-switch" @click="toggleLanguage">
          <text>{{ t('toolbar.langSwitch') }}</text>
        </view>
        <view class="tool-btn" @click="handleAddNode">
          <text>{{ t('toolbar.addNode') }}</text>
        </view>
        <view class="tool-btn" @click="handleAutoLayout">
          <text>{{ t('toolbar.autoLayout') }}</text>
        </view>
        <view class="tool-btn" @click="handleAIAnalyze">
          <text>{{ t('toolbar.aiAnalyze') }}</text>
        </view>
        <view class="tool-btn success" @click="handleRunWorkflow">
          <text>{{ t('toolbar.run') }}</text>
        </view>
        <view class="tool-btn" @click="showVersionHistory = true">
          <text>{{ t('toolbar.history') }}</text>
        </view>
        <view class="tool-btn primary" @click="handleSave">
          <text>{{ t('toolbar.save') }}</text>
        </view>
      </view>
    </view>

    <!-- 未保存更改警告栏 -->
    <view v-if="hasUnsavedChanges && unsavedNodes.length > 0" class="unsaved-warning">
      <view class="warning-content">
        <text class="warning-icon">⚠️</text>
        <text class="warning-text">
          有 {{ unsavedNodes.length }} 个节点未保存：{{ unsavedNodes.map(n => n.title).join('、') }}
        </text>
        <view class="warning-actions">
          <view class="warning-btn save" @click="handleSave">
            <text>💾 立即保存</text>
          </view>
          <view class="warning-btn close" @click="clearUnsavedChanges">
            <text>✕</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 主工作区 -->
    <view class="main-workspace">
      <!-- 左侧节点面板 -->
      <view class="node-panel" :class="{ collapsed: !showNodePanel }">
        <view class="panel-header">
          <text class="panel-title">节点库</text>
          <view class="toggle-btn" @click="showNodePanel = !showNodePanel">
            <text>{{ showNodePanel ? '◀' : '▶' }}</text>
          </view>
        </view>
        
        <scroll-view v-if="showNodePanel" scroll-y class="panel-content">
          <view class="node-category" v-for="category in nodeCategories" :key="category.name">
            <view class="category-title">{{ category.label }}</view>
            <view 
              class="node-item"
              v-for="nodeType in category.nodes"
              :key="nodeType.type"
              @click="addNodeToCanvas(nodeType)"
            >
              <text class="node-icon">{{ nodeType.icon }}</text>
              <text class="node-name">{{ getNodeLabel(nodeType.type) }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 中间画布区域 -->
      <view class="canvas-container" ref="canvasContainer">
        <NodeCanvas
          :nodes="nodes"
          :connections="connections"
          :selectedNodeId="selectedNodeId"
          :runningNodes="runningNodes"
          :zoom="canvasZoom"
          :lang="nodeLang"
          @node-select="handleNodeSelect"
          @node-move="handleNodeMove"
          @node-delete="handleNodeDelete"
          @connection-create="handleConnectionCreate"
          @connection-delete="handleConnectionDelete"
          @canvas-click="handleCanvasClick"
        />
        
        <!-- 缩放和视图控制 -->
        <view class="zoom-controls">
          <view class="control-group">
            <view class="zoom-btn" @click="handleZoomIn">
              <text>+</text>
            </view>
            <view class="zoom-display">
              <text>{{ Math.round(canvasZoom * 100) }}%</text>
            </view>
            <view class="zoom-btn" @click="handleZoomOut">
              <text>-</text>
            </view>
          </view>
          <view class="control-divider"></view>
          <view class="control-group">
            <view class="zoom-btn" @click="handleZoomReset" :title="'重置缩放'">
              <text>⊙</text>
            </view>
            <view class="zoom-btn" @click="handleResetView" :title="'重置视图'">
              <text>🎯</text>
            </view>
          </view>
        </view>
        
        <!-- 操作提示 -->
        <view class="canvas-hint">
          <text>📷 中键 或 Shift+左键 移动画布 | 🎯 拖动节点 | 🖱️ 右键菜单</text>
        </view>
      </view>

      <!-- 右侧属性面板 -->
      <view class="property-panel" :class="{ collapsed: !showPropertyPanel }">
        <view class="panel-header">
          <view class="toggle-btn" @click="showPropertyPanel = !showPropertyPanel">
            <text>{{ showPropertyPanel ? '▶' : '◀' }}</text>
          </view>
          <text class="panel-title">属性</text>
        </view>
        
        <scroll-view v-if="showPropertyPanel" scroll-y class="panel-content">
          <view v-if="selectedNode" class="property-content">
            <!-- 节点基本信息 -->
            <view class="property-section">
              <view class="section-title">基本信息</view>
              <view class="property-item">
                <text class="label">节点标题</text>
                <input 
                  class="input"
                  v-model="selectedNode.data.title"
                  placeholder="输入标题"
                  @input="() => markNodeAsModified(selectedNode.id, selectedNode.data.title)"
                />
              </view>
              <view class="property-item">
                <text class="label">节点类型</text>
                <text class="value">{{ getNodeLabel(selectedNode.type) }}</text>
              </view>
              <view class="property-item">
                <text class="label">节点描述</text>
                <text class="value description">{{ getNodeDesc(selectedNode.type) }}</text>
              </view>
            </view>

            <!-- 节点内容编辑 -->
            <view class="property-section">
              <view class="section-title">节点内容</view>
              <view class="property-item full">
                <textarea 
                  class="textarea"
                  v-model="selectedNode.data.content"
                  placeholder="输入节点内容..."
                  :maxlength="-1"
                  @input="() => markNodeAsModified(selectedNode.id, selectedNode.data.title || getNodeLabel(selectedNode.type))"
                />
              </view>
            </view>

            <!-- AI分析结果 -->
            <view v-if="selectedNode.aiAnalysis" class="property-section">
              <view class="section-title">AI分析结果</view>
              <view class="ai-result">
                <view class="risk-level" :class="'risk-' + selectedNode.aiAnalysis.riskLevel">
                  <text>风险等级: {{ selectedNode.aiAnalysis.riskLevel }}</text>
                </view>
                <view class="findings">
                  <view 
                    class="finding-item"
                    v-for="(finding, idx) in selectedNode.aiAnalysis.findings"
                    :key="idx"
                  >
                    <text class="finding-title">{{ finding.title }}</text>
                    <text class="finding-desc">{{ finding.description }}</text>
                  </view>
                </view>
              </view>
            </view>

            <!-- 操作按钮 -->
            <view class="property-actions">
              <view class="action-btn primary" @click="showNodeEditor = true">
                <text>✏️ 高级编辑</text>
              </view>
              <view class="action-btn" @click="handleNodeAIAnalyze">
                <text>🤖 AI分析</text>
              </view>
              <view class="action-btn danger" @click="handleNodeDelete">
                <text>🗑️ 删除节点</text>
              </view>
            </view>
          </view>
          
          <view v-else class="empty-state">
            <text class="empty-icon">📝</text>
            <text class="empty-text">选择节点查看属性</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 添加节点弹窗 -->
    <view v-if="showAddNodeModal" class="modal-overlay" @click="showAddNodeModal = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">添加节点</text>
          <view class="close-btn" @click="showAddNodeModal = false">
            <text>✕</text>
          </view>
        </view>
        <scroll-view scroll-y class="modal-body">
          <view 
            class="node-type-card"
            v-for="nodeType in allNodeTypes"
            :key="nodeType.type"
            @click="addNodeToCanvas(nodeType)"
          >
            <text class="card-icon">{{ nodeType.icon }}</text>
            <view class="card-info">
              <text class="card-title">{{ nodeType.label }}</text>
              <text class="card-desc">{{ nodeType.description }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 节点编辑器弹窗 -->
    <NodeEditor
      :visible="showNodeEditor"
      :nodeData="selectedNode"
      @close="showNodeEditor = false"
      @save="handleNodeEditorSave"
    />

    <!-- 历史版本管理 -->
    <VersionHistory
      :visible="showVersionHistory"
      :workpaperId="workpaperId"
      @close="showVersionHistory = false"
      @restore="handleVersionRestore"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import NodeCanvas from '@/components/workpaper/NodeCanvas.vue';
import NodeEditor from '@/components/workpaper/NodeEditor.vue';
import VersionHistory from '@/components/workpaper/VersionHistory.vue';
import { autoSaveManager } from '@/utils/autoSave';
import { aiService } from '@/services/ai';
import { hierarchicalLayout } from '@/utils/autoLayout';
import { updateWorkpaper } from '@/api/workpaper';
import { NODE_REGISTRY, getNodeDefinition, getNodeLabel, getNodeDesc, setNodeLang, getNodeLang, type NodeDefinition } from '@/utils/nodeRegistry';
import { t, getLanguage, setLanguage } from '@/utils/i18n';
import { FlowEngine } from '@/utils/flowEngine';
import { useUnsavedChanges } from '@/composables/useUnsavedChanges';

// 页面参数
const workpaperId = ref('');

// 底稿数据
const workpaper = ref({
  id: '',
  title: '',
  status: 'draft',
  projectId: ''
});

// 节点数据
const nodes = ref<any[]>([]);
const connections = ref<any[]>([]);
const selectedNodeId = ref('');
const runningNodes = ref<Set<string>>(new Set()); // 追踪正在运行的节点

// UI状态
const showNodePanel = ref(true);
const showPropertyPanel = ref(true);
const showAddNodeModal = ref(false);
const showNodeEditor = ref(false);
const showVersionHistory = ref(false);
const canvasZoom = ref(1);
const nodeLang = ref<'zh' | 'en'>(getNodeLang());

// 未保存更改系统
const {
  hasUnsavedChanges,
  unsavedNodes,
  markNodeAsModified,
  clearUnsavedChanges,
  showStrongWarning,
  restoreUnsavedNodes,
  clearStoredUnsavedNodes
} = useUnsavedChanges();

// 状态文本映射
const statusText: Record<string, string> = {
  draft: '草稿',
  locked: '已锁定',
  reviewed: '已复核',
  approved: '已批准'
};

// 节点分类（从Registry生成）
const nodeCategories = computed(() => {
  const categories: Record<string, NodeDefinition[]> = {
    input: [],
    audit: [],
    special: [],
    analysis: [],
    output: []
  };
  
  Object.values(NODE_REGISTRY).forEach(node => {
    if (categories[node.category]) {
      categories[node.category].push(node);
    }
  });
  
  return [
    { name: 'input', label: '输入节点', nodes: categories.input },
    { name: 'audit', label: '审计节点', nodes: categories.audit },
    { name: 'special', label: '专项审计', nodes: categories.special },
    { name: 'analysis', label: '分析节点', nodes: categories.analysis },
    { name: 'output', label: '输出节点', nodes: categories.output }
  ];
});

const allNodeTypes = computed(() => {
  return Object.values(NODE_REGISTRY);
});

const selectedNode = computed(() => {
  return nodes.value.find(n => n.id === selectedNodeId.value);
});

// 生命周期
onLoad((options: any) => {
  if (options.id) {
    workpaperId.value = options.id;
    loadWorkpaper();
  } else {
    // 新建底稿，初始化示例节点
    initDemoNodes();
  }
});

// 加载底稿数据
const loadWorkpaper = async () => {
  try {
    // 临时使用示例数据
    workpaper.value = {
      id: workpaperId.value,
      title: '房地产预售资金监管审计', // 更新标题
      status: 'draft',
      projectId: 'project-RE-001'
    };
    
    // 尝试从本地加载缓存
    const cachedData = await autoSaveManager.loadFromLocal(workpaperId.value);
    if (cachedData) {
      nodes.value = cachedData.nodes || [];
      connections.value = cachedData.connections || [];
    } else {
      initDemoNodes();
    }
    
    // 检查是否有未保存的节点
    const restored = restoreUnsavedNodes();
    if (restored.length > 0) {
      // 显示强提示
      setTimeout(async () => {
        const shouldSave = await showStrongWarning();
        if (shouldSave) {
          // 用户选择立即保存
          await handleSave();
        } else {
          // 高亮未保存的节点
          highlightUnsavedNodes();
        }
      }, 500);
    }
  } catch (error) {
    console.error('加载底稿失败:', error);
    uni.showToast({ title: t('messages.loadFailed') || '加载失败', icon: 'none' });
  }
};

// 初始化示例节点 - 房地产预售资金监管审计
const initDemoNodes = () => {
  nodes.value = [
    // 1. 输入层
    {
      id: 'node-contract',
      type: 'contract_import',
      position: { x: 100, y: 100 },
      data: { title: '预售合同导入', content: '导入2023年御景湾项目预售合同台账' }
    },
    {
      id: 'node-flow',
      type: 'bankflow_import',
      position: { x: 100, y: 300 },
      data: { title: '监管户流水', content: '导入工行监管账户(6222...)全年流水' }
    },
    
    // 2. 专项审计层
    {
      id: 'node-presale-check',
      type: 'real_estate_presale_fund',
      position: { x: 500, y: 200 },
      data: { title: '资金监管检测', content: '检测重点：1.资金未入监管户 2.违规大额支取' }
    },
    
    // 3. 辅助分析层
    {
      id: 'node-ai-risk',
      type: 'ai_contract_risk',
      position: { x: 500, y: 50 }, // 并行分支
      data: { title: '合同条款审查', content: '识别霸王条款和延期交付风险' }
    },

    // 4. 输出层
    {
      id: 'node-heatmap',
      type: 'risk_heatmap',
      position: { x: 900, y: 200 },
      data: { title: '风险热力图', content: '生成项目风险分布可视化' }
    }
  ];
  
  connections.value = [
    // 合同 -> 资金监管检测
    { id: 'c1', from: 'node-contract', fromPort: 'contract', to: 'node-presale-check', toPort: 'contract' },
    // 流水 -> 资金监管检测
    { id: 'c2', from: 'node-flow', fromPort: 'flow', to: 'node-presale-check', toPort: 'flow' },
    
    // 合同 -> AI条款审查 (并行分支)
    { id: 'c3', from: 'node-contract', fromPort: 'contract', to: 'node-ai-risk', toPort: 'contract' },
    
    // 资金监管检测风险 -> 热力图
    { id: 'c4', from: 'node-presale-check', fromPort: 'risk', to: 'node-heatmap', toPort: 'risks' },
    // AI条款风险 -> 热力图
    { id: 'c5', from: 'node-ai-risk', fromPort: 'risk', to: 'node-heatmap', toPort: 'risks' }
  ];
};

// 工具栏操作
const handleBack = () => {
  uni.navigateBack();
};

const handleAddNode = () => {
  showAddNodeModal.value = true;
};

const handleAutoLayout = () => {
  try {
    // 使用层次布局算法
    const layoutNodes = hierarchicalLayout(nodes.value, connections.value);
    
    // 更新节点位置
    nodes.value = layoutNodes;
    
    uni.showToast({ title: t('messages.autoLayoutSuccess'), icon: 'success' });
  } catch (error) {
    console.error('自动布局失败:', error);
    uni.showToast({ title: t('messages.autoLayoutFailed'), icon: 'error' });
  }
};

const handleAIAnalyze = async () => {
  try {
    uni.showLoading({ title: 'AI分析中...' });
    
    // 分析整个工作流
    const result = await aiService.analyzeWorkflow(
      workpaperId.value,
      nodes.value,
      connections.value
    );
    
    uni.hideLoading();
    
    // 显示分析结果
    uni.showModal({
      title: '工作流分析完成',
      content: `整体风险: ${result.overallRisk}\n评分: ${result.overallScore}\n${result.summary}`,
      showCancel: false
    });
  } catch (error) {
    uni.hideLoading();
    console.error('AI分析失败:', error);
    uni.showToast({ 
      title: 'AI分析失败，请稍后重试', 
      icon: 'none' 
    });
  }
};

const handleRunWorkflow = async () => {
  try {
    uni.showLoading({ title: t('messages.executingWorkflow') });
    runningNodes.value.clear();
    
    // 构建并执行工作流
    const engine = new FlowEngine(nodes.value, connections.value);
    const result = await engine.execute({
      onNodeStart: (nodeId) => {
        runningNodes.value.add(nodeId);
      },
      onNodeEnd: (nodeId) => {
        runningNodes.value.delete(nodeId);
      }
    });
    
    uni.hideLoading();
    
    // 格式化执行结果
    const executedNodes = Object.keys(result).length;
    const resultSummary = t('messages.executeSummary', executedNodes);
    
    // 将结果保存到节点数据中
    nodes.value.forEach(node => {
      if (result[node.id]) {
        node.executionResult = result[node.id];
      }
    });
    
    uni.showModal({
      title: t('messages.executeSuccess'),
      content: resultSummary,
      showCancel: false,
      confirmText: t('common.confirm')
    });
  } catch (error: any) {
    uni.hideLoading();
    console.error('工作流执行异常:', error);
    uni.showModal({
      title: t('messages.executeFailed'),
      content: error.message || t('messages.executionError'),
      showCancel: false,
      confirmText: t('common.confirm')
    });
  }
};

const handleSave = async () => {
  try {
    const saveData = {
      nodes: nodes.value,
      connections: connections.value,
      metadata: {
        version: Date.now(),
        lastModified: new Date().toISOString(),
        autoSaved: false
      }
    };
    
    await autoSaveManager.debounceSave(
      workpaperId.value,
      saveData,
      async (id, data) => {
        await updateWorkpaper(id, data);
      },
      { immediate: true, showToast: true }
    );
    
    // 清除未保存标记
    clearUnsavedChanges();
    clearStoredUnsavedNodes();
    
    uni.showToast({ 
      title: '✅ 保存成功', 
      icon: 'success',
      duration: 2000
    });
  } catch (error) {
    console.error('保存失败:', error);
    uni.showToast({ title: '保存失败', icon: 'error' });
  }
};

// 节点操作
const addNodeToCanvas = (nodeType: NodeDefinition) => {
  const newNode = {
    id: `node-${Date.now()}`,
    type: nodeType.type,
    position: { x: 200, y: 200 },
    data: {
      title: getNodeLabel(nodeType.type), // 使用当前语言的标签
      content: ''
    },
    // 端口信息现在由Registry提供
  };
  
  nodes.value.push(newNode);
  selectedNodeId.value = newNode.id;
  showAddNodeModal.value = false;
};

const handleNodeSelect = (nodeId: string) => {
  selectedNodeId.value = nodeId;
};

const handleNodeMove = (payload: { nodeId: string; position: { x: number; y: number } }) => {
  const node = nodes.value.find(n => n.id === payload.nodeId);
  if (node) {
    node.position = payload.position;
    // 标记节点已修改
    markNodeAsModified(node.id, node.data.title || getNodeLabel(node.type));
  }
};

// 高亮未保存的节点
const highlightUnsavedNodes = () => {
  unsavedNodes.value.forEach(unsavedNode => {
    const node = nodes.value.find(n => n.id === unsavedNode.id);
    if (node) {
      // 选中第一个未保存的节点
      if (!selectedNodeId.value) {
        selectedNodeId.value = node.id;
      }
    }
  });
  
  // 显示提示
  uni.showToast({
    title: `有 ${unsavedNodes.value.length} 个节点未保存`,
    icon: 'none',
    duration: 3000
  });
};

const handleNodeDelete = () => {
  if (!selectedNodeId.value) return;
  
  const index = nodes.value.findIndex(n => n.id === selectedNodeId.value);
  if (index > -1) {
    nodes.value.splice(index, 1);
    // 删除相关连接
    connections.value = connections.value.filter(
      conn => conn.from !== selectedNodeId.value && conn.to !== selectedNodeId.value
    );
    selectedNodeId.value = '';
  }
};

const handleConnectionCreate = (payload: any) => {
  // 检查是否已存在相同连接
  const exists = connections.value.some(
    conn => conn.from === payload.from && conn.fromPort === payload.fromPort &&
            conn.to === payload.to && conn.toPort === payload.toPort
  );
  
  if (!exists) {
    connections.value.push({
      id: `conn-${Date.now()}`,
      ...payload
    });
  }
};

const handleConnectionDelete = (connectionId: string) => {
  const index = connections.value.findIndex(c => c.id === connectionId);
  if (index > -1) {
    connections.value.splice(index, 1);
  }
};

const handleCanvasClick = () => {
  selectedNodeId.value = '';
};

const handleNodeAIAnalyze = async () => {
  if (!selectedNode.value) return;
  
  try {
    uni.showLoading({ title: 'AI分析中...' });
    
    // 构建分析上下文
    const context = {
      nodeType: selectedNode.value.type,
      nodeTitle: selectedNode.value.data.title,
      content: selectedNode.value.data.content,
      relatedNodes: getRelatedNodes(selectedNode.value.id),
      projectInfo: {
        name: workpaper.value.title,
        industry: '通用',
        auditType: '内部审计'
      }
    };
    
    // 调用AI分析
    const result = await aiService.analyzeNode(
      selectedNode.value.id,
      context
    );
    
    // 更新节点的AI分析结果
    selectedNode.value.aiAnalysis = result;
    
    uni.hideLoading();
    uni.showToast({ title: t('messages.aiAnalyzeSuccess'), icon: 'success' });
  } catch (error) {
    uni.hideLoading();
    console.error('节点AI分析失败:', error);
    uni.showToast({ 
      title: 'AI分析失败，请稍后重试', 
      icon: 'none' 
    });
  }
};

// 缩放控制
const handleZoomIn = () => {
  canvasZoom.value = Math.min(canvasZoom.value + 0.1, 2);
};

const handleZoomOut = () => {
  canvasZoom.value = Math.max(canvasZoom.value - 0.1, 0.5);
};

const handleZoomReset = () => {
  canvasZoom.value = 1;
};

const handleResetView = () => {
  canvasZoom.value = 1;
  // 触发NodeCanvas重置画布偏移
  // 通过重新赋值nodes来触发组件更新
  const temp = nodes.value;
  nodes.value = [];
  setTimeout(() => {
    nodes.value = temp;
  }, 0);
  
  uni.showToast({ 
    title: t('messages.viewReset') || '视图已重置', 
    icon: 'success',
    duration: 1000
  });
};

const getNodeTypeName = (type: string) => {
  const def = getNodeDefinition(type);
  return def ? def.label : type;
};

// 语言切换
const toggleLanguage = () => {
  const newLang = nodeLang.value === 'zh' ? 'en' : 'zh';
  nodeLang.value = newLang;
  setNodeLang(newLang); // 这会同步更新i18n语言
  setLanguage(newLang);
  
  uni.showToast({ 
    title: t('messages.langSwitched'), 
    icon: 'success',
    duration: 1500
  });
};

// 获取相关节点
const getRelatedNodes = (nodeId: string) => {
  const related: any[] = [];
  
  // 获取输入节点
  connections.value
    .filter(conn => conn.to === nodeId)
    .forEach(conn => {
      const node = nodes.value.find(n => n.id === conn.from);
      if (node) {
        related.push({
          id: node.id,
          type: node.type,
          title: node.data.title,
          content: node.data.content
        });
      }
    });
  
  // 获取输出节点
  connections.value
    .filter(conn => conn.from === nodeId)
    .forEach(conn => {
      const node = nodes.value.find(n => n.id === conn.to);
      if (node) {
        related.push({
          id: node.id,
          type: node.type,
          title: node.data.title,
          content: node.data.content
        });
      }
    });
  
  return related;
};

// 自动保存（监听数据变化）
watch([nodes, connections], () => {
  if (!workpaperId.value) return;
  
  const saveData = {
    nodes: nodes.value,
    connections: connections.value,
    metadata: {
      version: Date.now(),
      lastModified: new Date().toISOString(),
      autoSaved: true
    }
  };
  
  autoSaveManager.debounceSave(
    workpaperId.value,
    saveData,
    async (id, data) => {
      await updateWorkpaper(id, data);
    },
    { immediate: false, showToast: false }
  );
}, { deep: true });

// 节点编辑器保存
const handleNodeEditorSave = (data: any) => {
  if (selectedNode.value) {
    selectedNode.value.data = {
      ...selectedNode.value.data,
      ...data
    };
    
    uni.showToast({
      title: '内容已更新',
      icon: 'success'
    });
  }
};

// 版本恢复
const handleVersionRestore = (versionData: any) => {
  if (versionData) {
    nodes.value = versionData.nodes || [];
    connections.value = versionData.connections || [];
    
    uni.showToast({
      title: '版本已恢复',
      icon: 'success'
    });
  }
};

// 页面卸载时清理
onUnmounted(() => {
  autoSaveManager.clearTimer();
});
</script>

<style lang="scss" scoped>
.workpaper-detail {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  color: #e0e0e0;
}

// 工具栏样式（类似ComfyUI）
.toolbar {
  height: 60px;
  background: #2d2d2d;
  border-bottom: 1px solid #3d3d3d;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  
  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .back-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #3d3d3d;
    border-radius: 6px;
    cursor: pointer;
    
    &:hover {
      background: #4d4d4d;
    }
  }
  
  .title-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    
    .title {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }
    
    .status {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      width: fit-content;
      
      &.status-draft {
        background: #4a4a4a;
        color: #aaa;
      }
      
      &.status-locked {
        background: #ffa50033;
        color: #ffa500;
      }
      
      &.status-reviewed {
        background: #1890ff33;
        color: #1890ff;
      }
      
      &.status-approved {
        background: #52c41a33;
        color: #52c41a;
      }
    }
  }
  
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .tool-btn {
    padding: 8px 16px;
    background: #2d2d2d;
    border: 1px solid #3d3d3d;
    border-radius: 6px;
    font-size: 13px;
    color: #e0e0e0;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      background: #3d3d3d;
      border-color: #555;
    }
    
    &:active {
      transform: translateY(1px);
    }
    
    &.lang-switch {
      background: linear-gradient(135deg, #722ed1 0%, #531dab 100%);
      border-color: #722ed1;
      color: #fff;
      font-weight: 500;
      
      &:hover {
        background: linear-gradient(135deg, #9254de 0%, #722ed1 100%);
      }
    }
    
    &.primary {
      background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
      border-color: #1890ff;
      color: #fff;
      
      &:hover {
        background: linear-gradient(135deg, #40a9ff 0%, #1890ff 100%);
      }
    }
    
    &.success {
      background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
      border-color: #52c41a;
      color: #fff;
      
      &:hover {
        background: linear-gradient(135deg, #73d13d 0%, #52c41a 100%);
      }
    }
  }
}

// 未保存更改警告栏
.unsaved-warning {
  background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%);
  border-bottom: 2px solid #ff4d4f;
  animation: slideDown 0.3s ease;
  box-shadow: 0 2px 8px rgba(255, 77, 79, 0.3);
  
  .warning-content {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    gap: 12px;
  }
  
  .warning-icon {
    font-size: 20px;
    animation: pulse 2s infinite;
  }
  
  .warning-text {
    flex: 1;
    color: white;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
  }
  
  .warning-actions {
    display: flex;
    gap: 8px;
  }
  
  .warning-btn {
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
    
    &.save {
      background: white;
      color: #ff4d4f;
      
      &:hover {
        background: #f0f0f0;
        transform: translateY(-1px);
      }
    }
    
    &.close {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      
      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    }
  }
}

@keyframes slideDown {
  from {
    max-height: 0;
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    max-height: 100px;
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

// 主工作区
.main-workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// 侧边面板样式
.node-panel,
.property-panel {
  background: #252525;
  border-right: 1px solid #3d3d3d;
  display: flex;
  flex-direction: column;
  transition: all 0.3s;
  
  &.collapsed {
    width: 40px;
    
    .panel-content {
      display: none;
    }
  }
}

.node-panel {
  width: 250px;
  border-right: 1px solid #3d3d3d;
}

.property-panel {
  width: 300px;
  border-left: 1px solid #3d3d3d;
  border-right: none;
}

.panel-header {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  border-bottom: 1px solid #3d3d3d;
  background: #252525;
  position: relative;
  z-index: 10;
  
  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }
  
  .toggle-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 4px;
    
    &:hover {
      background: #3d3d3d;
    }
  }
}

.panel-content {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  
  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #1e1e1e;
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #4d4d4d;
    border-radius: 4px;
    
    &:hover {
      background: #5d5d5d;
    }
  }
}

// 节点库
.node-category {
  margin-bottom: 20px;
  
  .category-title {
    font-size: 12px;
    color: #888;
    margin-bottom: 10px;
    text-transform: uppercase;
  }
  
  .node-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: #2d2d2d;
    border-radius: 6px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      background: #3d3d3d;
      transform: translateX(5px);
    }
    
    .node-icon {
      font-size: 20px;
    }
    
    .node-name {
      font-size: 13px;
      color: #e0e0e0;
    }
  }
}

// 画布容器
.canvas-container {
  flex: 1;
  position: relative;
  background: #1a1a1a;
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
}

// 缩放和视图控制
.zoom-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 2px;
  background: #2d2d2d;
  border-radius: 8px;
  padding: 5px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  
  .control-group {
    display: flex;
    gap: 2px;
  }
  
  .control-divider {
    width: 1px;
    background: #3d3d3d;
    margin: 0 5px;
  }
  
  .zoom-btn,
  .zoom-display {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      background: #3d3d3d;
      transform: scale(1.05);
    }
    
    &:active {
      transform: scale(0.95);
    }
  }
  
  .zoom-display {
    font-size: 12px;
    cursor: default;
    min-width: 50px;
    
    &:hover {
      background: transparent;
      transform: none;
    }
  }
}

// 画布操作提示
.canvas-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(45, 45, 45, 0.9);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  color: #aaa;
  pointer-events: none;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  
  text {
    white-space: nowrap;
  }
}

// 属性面板
.property-content {
  .property-section {
    margin-bottom: 25px;
    
    .section-title {
      font-size: 13px;
      color: #888;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    
    .property-item {
      margin-bottom: 15px;
      
      &.full {
        .textarea {
          height: 200px;
        }
      }
      
      .label {
        display: block;
        font-size: 12px;
        color: #aaa;
        margin-bottom: 6px;
      }
      
      .input,
      .textarea {
        width: 100%;
        padding: 8px 12px;
        background: #2d2d2d;
        border: 1px solid #3d3d3d;
        border-radius: 6px;
        color: #e0e0e0;
        font-size: 13px;
        
        &:focus {
          border-color: #1890ff;
          outline: none;
        }
      }
      
      .textarea {
        min-height: 80px;
        resize: vertical;
      }
      
      .value {
        color: #e0e0e0;
        font-size: 13px;
        
        &.description {
          color: #aaa;
          font-size: 12px;
          line-height: 1.5;
        }
      }
    }
  }
  
  .ai-result {
    .risk-level {
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 10px;
      font-size: 13px;
      
      &.risk-low {
        background: #52c41a33;
        color: #52c41a;
      }
      
      &.risk-medium {
        background: #ffa50033;
        color: #ffa500;
      }
      
      &.risk-high {
        background: #ff4d4f33;
        color: #ff4d4f;
      }
    }
    
    .findings {
      .finding-item {
        padding: 10px;
        background: #2d2d2d;
        border-radius: 6px;
        margin-bottom: 8px;
        
        .finding-title {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }
        
        .finding-desc {
          font-size: 12px;
          color: #aaa;
          line-height: 1.5;
        }
      }
    }
  }
  
  .property-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 20px;
    
    .action-btn {
      padding: 10px;
      background: #1890ff;
      color: #fff;
      border-radius: 6px;
      text-align: center;
      cursor: pointer;
      
      &:hover {
        background: #40a9ff;
      }
      
      &.danger {
        background: #ff4d4f;
        
        &:hover {
          background: #ff7875;
        }
      }
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  
  .empty-icon {
    font-size: 48px;
    margin-bottom: 15px;
    opacity: 0.3;
  }
  
  .empty-text {
    font-size: 14px;
    color: #666;
  }
}

// 弹窗样式
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 600px;
  max-height: 80vh;
  background: #2d2d2d;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid #3d3d3d;
    
    .modal-title {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
    }
    
    .close-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      cursor: pointer;
      
      &:hover {
        background: #3d3d3d;
      }
    }
  }
  
  .modal-body {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    
    .node-type-card {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px;
      background: #252525;
      border-radius: 8px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background: #3d3d3d;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
      
      .card-icon {
        font-size: 36px;
      }
      
      .card-info {
        flex: 1;
        
        .card-title {
          display: block;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }
        
        .card-desc {
          font-size: 13px;
          color: #888;
        }
      }
    }
  }
}
</style>
