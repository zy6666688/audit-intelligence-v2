<template>
  <view class="node-palette">
    <view class="palette-header">
      <text class="title">节点面板</text>
      <input 
        class="search-input"
        v-model="searchQuery"
        placeholder="搜索节点..."
        @input="handleSearch"
      />
    </view>

    <view class="palette-content">
      <!-- 分类列表 -->
      <view 
        v-for="category in filteredCategories" 
        :key="category.name"
        class="category-section"
      >
        <view class="category-header" @click="toggleCategory(category.name)">
          <text class="category-icon">{{ category.expanded ? '▼' : '▶' }}</text>
          <text class="category-name">{{ category.label }}</text>
          <text class="category-count">({{ category.nodes.length }})</text>
        </view>

        <view v-show="category.expanded" class="category-nodes">
          <view
            v-for="node in category.nodes"
            :key="node.type"
            class="node-item"
            :draggable="true"
            @touchstart="handleDragStart(node, $event)"
            @mousedown="handleDragStart(node, $event)"
          >
            <view class="node-icon">{{ getCategoryIcon(category.name) }}</view>
            <view class="node-info">
              <text class="node-name">{{ node.label.zh }}</text>
              <text class="node-desc">{{ node.description.zh }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="filteredCategories.length === 0" class="empty-state">
        <text>没有找到匹配的节点</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { NodeManifest } from '@audit/shared';

const searchQuery = ref('');
const categories = ref<any[]>([
  { name: 'input', label: '数据输入', expanded: true, nodes: [] },
  { name: 'transformation', label: '数据转换', expanded: false, nodes: [] },
  { name: 'ai', label: 'AI推理', expanded: false, nodes: [] },
  { name: 'audit', label: '审计规则', expanded: false, nodes: [] },
  { name: 'output', label: '输出', expanded: false, nodes: [] }
]);

const allNodes = ref<NodeManifest[]>([]);

// 过滤后的分类
const filteredCategories = computed(() => {
  const query = searchQuery.value.toLowerCase();
  if (!query) {
    return categories.value;
  }

  return categories.value
    .map(cat => ({
      ...cat,
      nodes: cat.nodes.filter((node: NodeManifest) => 
        node.label.zh.toLowerCase().includes(query) ||
        node.description.zh.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query)
      )
    }))
    .filter(cat => cat.nodes.length > 0);
});

// 切换分类展开
function toggleCategory(categoryName: string) {
  const cat = categories.value.find(c => c.name === categoryName);
  if (cat) {
    cat.expanded = !cat.expanded;
  }
}

// 获取分类图标
function getCategoryIcon(categoryName: string): string {
  const icons: Record<string, string> = {
    input: '📥',
    transformation: '⚙️',
    ai: '🤖',
    audit: '📋',
    output: '📤',
    filter: '🔍',
    analysis: '📊',
    utility: '🔧'
  };
  return icons[categoryName] || '📦';
}

// 处理搜索
function handleSearch() {
  // 搜索时展开所有分类
  if (searchQuery.value) {
    categories.value.forEach(cat => cat.expanded = true);
  }
}

// 处理拖拽开始
function handleDragStart(node: NodeManifest, event: any) {
  console.log('拖拽节点:', node.type);
  
  // 存储节点类型到拖拽数据
  if (event.dataTransfer) {
    event.dataTransfer.setData('nodeType', node.type);
    event.dataTransfer.effectAllowed = 'copy';
  }
  
  // uni-app的拖拽处理
  // TODO: 实现uni-app的拖拽逻辑
}

// 加载节点列表
async function loadNodes() {
  try {
    // TODO: 从NodeRegistry获取节点列表
    // 临时使用模拟数据
    const mockNodes: Partial<NodeManifest>[] = [
      {
        type: 'csv_reader',
        category: 'input',
        label: { zh: 'CSV读取', en: 'CSV Reader' },
        description: { zh: '读取CSV文件', en: 'Read CSV file' }
      },
      {
        type: 'excel_reader',
        category: 'input',
        label: { zh: 'Excel读取', en: 'Excel Reader' },
        description: { zh: '读取Excel文件', en: 'Read Excel file' }
      },
      {
        type: 'filter',
        category: 'transformation',
        label: { zh: '数据过滤', en: 'Filter' },
        description: { zh: '过滤数据行', en: 'Filter data rows' }
      },
      {
        type: 'map',
        category: 'transformation',
        label: { zh: '数据映射', en: 'Map' },
        description: { zh: '转换数据字段', en: 'Transform data fields' }
      },
      {
        type: 'text_analysis',
        category: 'ai',
        label: { zh: '文本分析', en: 'Text Analysis' },
        description: { zh: 'AI文本分析', en: 'AI text analysis' }
      },
      {
        type: 'sentiment_analysis',
        category: 'ai',
        label: { zh: '情感分析', en: 'Sentiment Analysis' },
        description: { zh: '分析文本情感', en: 'Analyze text sentiment' }
      },
      {
        type: 'audit_check',
        category: 'audit',
        label: { zh: '审计检查', en: 'Audit Check' },
        description: { zh: '执行审计规则', en: 'Execute audit rules' }
      },
      {
        type: 'risk_assessment',
        category: 'audit',
        label: { zh: '风险评估', en: 'Risk Assessment' },
        description: { zh: '评估风险等级', en: 'Assess risk level' }
      },
      {
        type: 'excel_writer',
        category: 'output',
        label: { zh: 'Excel输出', en: 'Excel Writer' },
        description: { zh: '输出到Excel', en: 'Write to Excel' }
      }
    ];

    // 将节点分配到分类
    categories.value.forEach(cat => {
      cat.nodes = mockNodes.filter(n => n.category === cat.name);
    });

    allNodes.value = mockNodes as NodeManifest[];
  } catch (error) {
    console.error('加载节点失败:', error);
  }
}

onMounted(() => {
  loadNodes();
});
</script>

<style scoped>
.node-palette {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #e0e0e0;
}

.palette-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.title {
  font-size: 16px;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.palette-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.category-section {
  margin-bottom: 16px;
}

.category-header {
  display: flex;
  align-items: center;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}

.category-icon {
  width: 20px;
  font-size: 12px;
  color: #666;
}

.category-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
}

.category-count {
  font-size: 12px;
  color: #999;
}

.category-nodes {
  margin-top: 4px;
}

.node-item {
  display: flex;
  align-items: center;
  padding: 8px;
  margin: 4px 0;
  background: #fafafa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  cursor: move;
  transition: all 0.2s;
}

.node-item:hover {
  background: #f0f0f0;
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
}

.node-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 8px;
}

.node-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.node-name {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
}

.node-desc {
  font-size: 11px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #999;
}
</style>
