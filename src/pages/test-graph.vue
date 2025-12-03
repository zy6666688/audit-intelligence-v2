<!--
  测试GraphStore和NodeAPI
  Week 1 Day 3 + Day 4-5 (SVG画布集成)
  
  注意：uni-app的button组件支持type="primary"和type="warn"
  但TypeScript类型定义不完整，已在script中添加@ts-nocheck
-->

<template>
  <view class="test-page">
    <!-- 协作光标 -->
    <CollaborationCursors :show-user-list="true" />
    <view class="header">
      <text class="title">GraphStore V2 测试</text>
    </view>
    
    <view class="section">
      <text class="section-title">📊 状态统计</text>
      <view class="stats">
        <view class="stat-item">
          <text class="stat-label">节点数</text>
          <text class="stat-value">{{ graphStore.nodeCount }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-label">连线数</text>
          <text class="stat-value">{{ graphStore.edgeCount }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-label">选中数</text>
          <text class="stat-value">{{ graphStore.selectedNodes.size }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-label">缩放</text>
          <text class="stat-value">{{ graphStore.viewport.zoom.toFixed(2) }}</text>
        </view>
      </view>
    </view>
    
    <view class="section">
      <text class="section-title">🔧 GraphStore 操作</text>
      <view class="buttons">
        <button @click="testAddNode" size="mini" type="primary">
          添加节点
        </button>
        <button @click="testAddEdge" size="mini" type="primary">
          添加连线
        </button>
        <button @click="testSelectAll" size="mini">
          全选
        </button>
        <button @click="testClearSelection" size="mini">
          清除选中
        </button>
        <button @click="testUndo" size="mini" :disabled="!graphStore.canUndo">
          撤销
        </button>
        <button @click="testRedo" size="mini" :disabled="!graphStore.canRedo">
          重做
        </button>
        <button @click="testClear" size="mini" type="warn">
          清空图
        </button>
      </view>
    </view>
    
    <view class="section">
      <text class="section-title">🌐 Node API 测试</text>
      <view class="buttons">
        <button @click="testHealthCheck" size="mini" type="primary">
          健康检查
        </button>
        <button @click="testListNodes" size="mini" type="primary">
          获取节点列表
        </button>
        <button @click="testExecuteNode" size="mini" type="primary">
          执行节点
        </button>
        <button @click="testNodeExamples" size="mini">
          测试示例
        </button>
      </view>
      
      <view v-if="apiResult" class="api-result">
        <text class="result-title">API结果:</text>
        <text class="result-content">{{ apiResult }}</text>
      </view>
    </view>
    
    <view class="section">
      <text class="section-title">📋 节点列表</text>
      <view class="node-list">
        <view
          v-for="node in graphStore.nodeList"
          :key="node.id"
          class="node-item"
          :class="{ selected: node.selected }"
          @click="toggleNodeSelection(node.id)"
        >
          <text class="node-id">{{ node.id }}</text>
          <text class="node-type">{{ node.type }}</text>
          <text class="node-pos">
            ({{ node.position.x }}, {{ node.position.y }})
          </text>
        </view>
        
        <view v-if="graphStore.nodeCount === 0" class="empty">
          <text>暂无节点</text>
        </view>
      </view>
    </view>
    
    <view class="section canvas-section">
      <text class="section-title">🎨 SVG画布预览 (Week 1 Day 4-5)</text>
      <view class="canvas-controls">
        <button @click="addTestNodes" size="mini" type="primary">
          添加测试节点
        </button>
        <button @click="createTestGraph" size="mini" type="primary">
          创建测试图
        </button>
        <button @click="graphStore.clearGraph()" size="mini" type="warn">
          清空画布
        </button>
        <button @click="toggleCanvas" size="mini">
          {{ showCanvas ? '隐藏' : '显示' }}画布
        </button>
      </view>
      
      <view v-if="showCanvas" class="canvas-wrapper">
        <!-- NodeCanvasV2 组件 -->
        <NodeCanvasV2 v-if="graphStore.nodeCount > 0" />
        <view v-else class="canvas-empty">
          <text>点击"添加测试节点"开始</text>
        </view>
      </view>
      
      <view class="canvas-info">
        <text class="info-text">
          ✨ 功能: 节点拖拽、视口缩放(滚轮)、视口平移、连线创建
        </text>
      </view>
    </view>
    
    <view class="section">
      <text class="section-title">📋 可用节点类型</text>
      <view class="available-nodes">
        <view
          v-for="manifest in availableNodes"
          :key="manifest.type"
          class="manifest-item"
        >
          <text class="manifest-type">{{ manifest.type }}</text>
          <text class="manifest-label">{{ manifest.label.zh }}</text>
          <text class="manifest-version">v{{ manifest.version }}</text>
        </view>
        
        <view v-if="availableNodes.length === 0" class="empty">
          <text>加载中...</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGraphStoreV2 } from '@/stores/graphV2';
import { useCollaborationStore } from '@/stores/collaboration';
import { nodeApiService } from '@/services/nodeApiV2';
import type { NodeInstance, NodeManifest } from '@audit/shared';
import NodeCanvasV2 from '@/components/NodeCanvasV2.vue';

// Store
const graphStore = useGraphStoreV2();
const collabStore = useCollaborationStore();
const currentGraphId = ref<string>('');
const nodeRegistry = ref<any>(null);

// API结果
const apiResult = ref<string>('');
const availableNodes = ref<NodeManifest[]>([]);

// 画布控制
const showCanvas = ref(true);

// 初始化协作
onMounted(() => {
  // 模拟用户登录
  const userId = 'user_' + Math.random().toString(36).substr(2, 9);
  const userName = '用户' + Math.floor(Math.random() * 100);
  collabStore.initUser(userId, userName);
  
  console.log('协作系统初始化完成:', userName);
});

// ==========================================
// GraphStore测试
// ==========================================

let nodeCounter = 1;

/**
 * 测试添加节点
 */
function testAddNode() {
  const node: NodeInstance = {
    id: graphStore.generateId('node'),
    type: 'simple_add',
    position: {
      x: Math.random() * 500,
      y: Math.random() * 300
    },
    config: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  graphStore.addNode(node);
  uni.showToast({
    title: '节点已添加',
    icon: 'success'
  });
}

/**
 * 测试添加连线
 */
function testAddEdge() {
  const nodes = graphStore.nodeList;
  
  if (nodes.length < 2) {
    uni.showToast({
      title: '至少需要2个节点',
      icon: 'none'
    });
    return;
  }
  
  const edge = {
    id: graphStore.generateId('edge'),
    from: {
      nodeId: nodes[0].id,
      portName: 'result'
    },
    to: {
      nodeId: nodes[1].id,
      portName: 'a'
    },
    createdAt: new Date().toISOString()
  };
  
  const success = graphStore.addEdge(edge);
  
  uni.showToast({
    title: success ? '连线已添加' : '连线已存在',
    icon: success ? 'success' : 'none'
  });
}

/**
 * 测试全选
 */
function testSelectAll() {
  graphStore.selectAll();
  uni.showToast({
    title: '已全选',
    icon: 'success'
  });
}

/**
 * 测试清除选中
 */
function testClearSelection() {
  graphStore.clearSelection();
  uni.showToast({
    title: '已清除选中',
    icon: 'success'
  });
}

/**
 * 测试撤销
 */
function testUndo() {
  graphStore.undo();
  uni.showToast({
    title: '已撤销',
    icon: 'success'
  });
}

/**
 * 测试重做
 */
function testRedo() {
  graphStore.redo();
  uni.showToast({
    title: '已重做',
    icon: 'success'
  });
}

/**
 * 测试清空
 */
function testClear() {
  graphStore.clearGraph();
  uni.showToast({
    title: '已清空',
    icon: 'success'
  });
}

/**
 * 切换节点选中
 */
function toggleNodeSelection(nodeId: string) {
  graphStore.toggleNodeSelection(nodeId);
}

// ==========================================
// 画布测试
// ==========================================

/**
 * 添加测试节点
 */
function addTestNodes() {
  const nodeTypes = ['simple_add', 'simple_multiply', 'echo'];
  
  nodeTypes.forEach((type, idx) => {
    const node: NodeInstance = {
      id: graphStore.generateId('node'),
      type,
      position: {
        x: 100 + idx * 300,
        y: 200
      },
      config: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    graphStore.addNode(node);
  });
  
  uni.showToast({
    title: '已添加3个测试节点',
    icon: 'success'
  });
}

/**
 * 创建测试图
 */
function createTestGraph() {
  graphStore.clearGraph();
  addTestNodes();
  
  // 等待节点添加完成后创建连线
  setTimeout(() => {
    const nodes = graphStore.nodeList;
    if (nodes.length >= 2) {
      const edge1 = {
        id: graphStore.generateId('edge'),
        from: { nodeId: nodes[0].id, portName: 'result' },
        to: { nodeId: nodes[1].id, portName: 'a' },
        createdAt: new Date().toISOString()
      };
      graphStore.addEdge(edge1);
      
      if (nodes.length >= 3) {
        const edge2 = {
          id: graphStore.generateId('edge'),
          from: { nodeId: nodes[1].id, portName: 'result' },
          to: { nodeId: nodes[2].id, portName: 'value' },
          createdAt: new Date().toISOString()
        };
        graphStore.addEdge(edge2);
      }
    }
    
    uni.showToast({
      title: '测试图创建完成',
      icon: 'success'
    });
  }, 100);
}

/**
 * 切换画布显示
 */
function toggleCanvas() {
  showCanvas.value = !showCanvas.value;
}

// ==========================================
// Node API测试
// ==========================================

/**
 * 测试健康检查
 */
async function testHealthCheck() {
  try {
    const result = await nodeApiService.healthCheck();
    apiResult.value = JSON.stringify(result, null, 2);
    uni.showToast({
      title: '健康检查成功',
      icon: 'success'
    });
  } catch (error: any) {
    apiResult.value = `错误: ${error.message}`;
    uni.showToast({
      title: '健康检查失败',
      icon: 'error'
    });
  }
}

/**
 * 测试获取节点列表
 */
async function testListNodes() {
  try {
    const nodes = await nodeApiService.listNodes();
    availableNodes.value = nodes;
    apiResult.value = `成功获取 ${nodes.length} 个节点类型`;
    uni.showToast({
      title: `获取${nodes.length}个节点`,
      icon: 'success'
    });
  } catch (error: any) {
    apiResult.value = `错误: ${error.message}`;
    uni.showToast({
      title: '获取节点列表失败',
      icon: 'error'
    });
  }
}

/**
 * 测试执行节点
 */
async function testExecuteNode() {
  try {
    const result = await nodeApiService.executeNode(
      'simple_add',
      { a: 5, b: 3 }
    );
    
    apiResult.value = JSON.stringify(result, null, 2);
    
    if (result.success) {
      uni.showToast({
        title: `结果: ${result.outputs?.result}`,
        icon: 'success'
      });
    } else {
      uni.showToast({
        title: '执行失败',
        icon: 'error'
      });
    }
  } catch (error: any) {
    apiResult.value = `错误: ${error.message}`;
    uni.showToast({
      title: '执行节点失败',
      icon: 'error'
    });
  }
}

/**
 * 测试节点示例
 */
async function testNodeExamples() {
  try {
    const result = await nodeApiService.testNodeExamples('simple_add');
    apiResult.value = JSON.stringify(result, null, 2);
    
    uni.showToast({
      title: `通过: ${result.passed}, 失败: ${result.failed}`,
      icon: result.failed === 0 ? 'success' : 'none'
    });
  } catch (error: any) {
    apiResult.value = `错误: ${error.message}`;
    uni.showToast({
      title: '测试失败',
      icon: 'error'
    });
  }
}

// ==========================================
// 生命周期
// ==========================================

onMounted(async () => {
  console.log('Test page mounted');
  
  // 自动加载可用节点
  try {
    availableNodes.value = await nodeApiService.listNodes();
  } catch (error) {
    console.error('Failed to load available nodes:', error);
  }
});
</script>

<style scoped lang="scss">
.test-page {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.header {
  margin-bottom: 20px;
  
  .title {
    font-size: 24px;
    font-weight: bold;
    color: #333;
  }
}

.section {
  background-color: white;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
  
  .section-title {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    margin-bottom: 10px;
    display: block;
  }
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  
  .stat-item {
    flex: 1;
    min-width: 80px;
    padding: 10px;
    background-color: #f0f0f0;
    border-radius: 6px;
    text-align: center;
    
    .stat-label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }
    
    .stat-value {
      display: block;
      font-size: 20px;
      font-weight: bold;
      color: #007aff;
    }
  }
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.api-result {
  margin-top: 15px;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  
  .result-title {
    display: block;
    font-weight: bold;
    margin-bottom: 8px;
  }
  
  .result-content {
    display: block;
    font-size: 12px;
    font-family: 'Courier New', monospace;
    color: #333;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.node-list,
.available-nodes {
  .node-item,
  .manifest-item {
    padding: 12px;
    background-color: #f9f9f9;
    border-radius: 6px;
    margin-bottom: 8px;
    border: 2px solid transparent;
    display: flex;
    gap: 10px;
    align-items: center;
    
    &.selected {
      border-color: #007aff;
      background-color: #e6f2ff;
    }
    
    text {
      font-size: 13px;
    }
    
    .node-id,
    .manifest-type {
      font-weight: bold;
      color: #007aff;
    }
    
    .node-type,
    .manifest-label {
      color: #333;
    }
    
    .node-pos,
    .manifest-version {
      color: #999;
      font-size: 11px;
    }
  }
  
  .empty {
    text-align: center;
    padding: 30px;
    color: #999;
  }
}

.canvas-section {
  .canvas-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 15px;
  }
  
  .canvas-wrapper {
    min-height: 600px;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
    position: relative;
  }
  
  .canvas-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 400px;
    color: #999;
    font-size: 16px;
  }
  
  .canvas-info {
    margin-top: 10px;
    padding: 10px;
    background: #f0f8ff;
    border-radius: 6px;
    border-left: 3px solid #007aff;
    
    .info-text {
      font-size: 12px;
      color: #666;
      display: block;
    }
  }
}
</style>
