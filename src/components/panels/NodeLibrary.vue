<template>
  <div class="node-library">
    <div class="header">
      <span>节点库</span>
      <button class="refresh-btn" @click="refresh" title="刷新节点列表">↻</button>
    </div>
    <div class="node-list">
      <div v-if="Object.keys(categorizedNodes).length === 0" class="empty-state">
        暂无节点
      </div>
      <div v-for="(nodes, category) in categorizedNodes" :key="category" class="category-group">
        <div class="category-title">{{ category }}</div>
        <div 
          v-for="node in nodes" 
          :key="node.type" 
          class="node-item" 
          draggable="true"
          :title="node.title + ' (按住 Ctrl + 点击已放置的节点查看说明)'"
          @dragstart="handleDragStart($event, node)"
        >
          <div class="node-icon">
            {{ getNodeIcon(node.type) }}
          </div>
          <span class="node-label">{{ translator.translateNodeTitle(node.type) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { nodeRegistry, NodeDefinition } from '@/core/registry/NodeRegistry';
import { translator } from '@/utils/translator';
import { useLanguageStore } from '@/store/useLanguageStore';

// 定义拖拽数据类型
export interface DraggedNodeData {
  type: string;
  label: string;
}

const emit = defineEmits<{
  (e: 'drag-start', data: DraggedNodeData): void;
}>();

// 从注册表中获取所有节点定义
const nodeDefinitions = ref<NodeDefinition[]>([]);
const languageStore = useLanguageStore();

const refresh = () => {
  // 强制重新获取
  const defs = nodeRegistry.getAllDefinitions();
  // console.log('NodeLibrary refreshing, count:', defs.length);
  nodeDefinitions.value = [...defs];
};

// 监听语言变化，触发重新渲染
watch(() => languageStore.language, () => {
  refresh();
});

onMounted(() => {
  refresh();
});

defineExpose({ refresh });

// 图标映射
function getNodeIcon(type: string): string {
  if (type.includes('Script')) return '🐍';
  if (type.includes('Plot') || type.includes('Chart')) return '📊';
  if (type.includes('Excel') || type.includes('File')) return '📄';
  if (type.includes('Audit')) return '🛡️';
  return '📦';
}

// 按分类分组
const categorizedNodes = computed(() => {
  const groups: Record<string, NodeDefinition[]> = {};
  nodeDefinitions.value.forEach((def: NodeDefinition) => {
    const category = def.category || '未分类';
    const translatedCategory = translator.translateCategory(category);
    if (!groups[translatedCategory]) {
      groups[translatedCategory] = [];
    }
    groups[translatedCategory].push(def);
  });
  return groups;
});

function handleDragStart(event: DragEvent, node: NodeDefinition) {
  if (event.dataTransfer) {
    // 设置拖拽数据，方便 drop 时获取
    const data: DraggedNodeData = {
      type: node.type,
      label: node.title
    };
    event.dataTransfer.setData('application/json', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'copy';
    
    emit('drag-start', data);
  }
}
</script>

<style scoped lang="scss">
.node-library {
  width: 220px;
  background-color: #252525;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  color: #eee;
  user-select: none;

  .header {
    padding: 12px 16px;
    font-weight: bold;
    background-color: #2a2a2a;
    border-bottom: 1px solid #333;
    font-size: 14px;
    letter-spacing: 0.5px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .refresh-btn {
      background: transparent;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 16px;
      padding: 0 4px;
      transition: color 0.2s;

      &:hover {
        color: #fff;
      }
    }
  }

  .node-list {
    flex: 1;
    padding: 10px;
    overflow-y: auto;

    .empty-state {
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 13px;
    }

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: #444;
      border-radius: 3px;
    }

    .category-group {
      margin-bottom: 16px;

      .category-title {
        font-size: 12px;
        color: #888;
        margin-bottom: 6px;
        padding-left: 4px;
        text-transform: uppercase;
      }
    }

    .node-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background-color: #333;
      margin-bottom: 6px;
      border-radius: 4px;
      cursor: grab;
      border: 1px solid #444;
      transition: all 0.2s;

      &:hover {
        background-color: #3a3a3a;
        border-color: #666;
        transform: translateY(-1px);
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      }

      &:active {
        cursor: grabbing;
      }

      .node-icon {
        margin-right: 10px;
        font-size: 16px;
        opacity: 0.8;
      }

      .node-label {
        font-size: 13px;
        color: #ddd;
      }
    }
  }
}
</style>
