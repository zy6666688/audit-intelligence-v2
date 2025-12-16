<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { nodeRegistry, NodeDefinition } from '@/core/registry/NodeRegistry';

const props = defineProps<{
  visible: boolean;
  position: { x: number; y: number };
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'add-node', type: string): void;
}>();

const menuRef = ref<HTMLElement | null>(null);

// 获取按类别分组的节点定义
const categorizedNodes = computed(() => {
  const definitions = nodeRegistry.getAllDefinitions();
  const groups: Record<string, NodeDefinition[]> = {};
  
  definitions.forEach(def => {
    const category = def.category || '其他';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(def);
  });
  
  return groups;
});

// 点击外部关闭
const handleClickOutside = (e: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close');
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

function handleAddNode(type: string) {
  emit('add-node', type);
  emit('close');
}
</script>

<template>
  <div 
    v-if="visible"
    ref="menuRef"
    class="context-menu" 
    :style="{ top: `${position.y}px`, left: `${position.x}px` }"
  >
    <div class="menu-header">添加节点</div>
    
    <div class="menu-content">
      <div v-for="(nodes, category) in categorizedNodes" :key="category" class="menu-group">
        <div class="group-title">{{ category }}</div>
        <div 
          v-for="node in nodes" 
          :key="node.type" 
          class="menu-item"
          @click="handleAddNode(node.type)"
        >
          {{ node.title }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.context-menu {
  position: fixed;
  z-index: 1000;
  background: #2a2a2a;
  border: 1px solid #444;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  min-width: 180px;
  color: #eee;
  font-size: 13px;
  user-select: none;
  overflow: hidden; /* 防止圆角溢出 */

  .menu-header {
    padding: 8px 12px;
    background: #333;
    font-weight: bold;
    border-bottom: 1px solid #444;
    /* border-radius 已经在父级 overflow: hidden 处理 */
  }

  .menu-content {
    max-height: 400px;
    overflow-y: auto;
    
    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-track {
      background: #252525;
    }
    &::-webkit-scrollbar-thumb {
      background: #555;
      border-radius: 3px;
    }
    &::-webkit-scrollbar-thumb:hover {
      background: #777;
    }
  }

  .menu-group {
    border-bottom: 1px solid #3a3a3a;
    
    &:last-child {
      border-bottom: none;
    }

    .group-title {
      padding: 6px 12px;
      color: #888;
      font-size: 11px;
      text-transform: uppercase;
      background: #252525;
    }

    .menu-item {
      padding: 8px 16px;
      cursor: pointer;
      transition: background 0.1s;

      &:hover {
        background: #3498db;
        color: #fff;
      }
    }
  }
}
</style>
