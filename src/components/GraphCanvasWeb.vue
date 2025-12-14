<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/background/dist/style.css';
import '@vue-flow/controls/dist/style.css';

import type { GraphSchema } from '@/types/graph-protocol';
import { useGraphAdapter } from '@/composables/useGraphAdapter';

const props = defineProps<{
  data: GraphSchema;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'node:click', nodeId: string): void;
  (e: 'update:data', data: GraphSchema): void;
}>();

const { fitView } = useVueFlow();
const adapter = useGraphAdapter();

// Vue Flow 状态
const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);

// 初始化数据
watch(() => props.data, (newData) => {
  if (newData) {
    nodes.value = newData.nodes;
    edges.value = newData.edges;
    // 等待渲染后自适应视图
    setTimeout(() => fitView(), 50);
  }
}, { immediate: true, deep: true });

// 监听节点变动（拖拽、连接等），同步回业务数据
// 注意：这里简化处理，实际应使用 onNodesChange 等钩子
const onPaneReady = (instance: any) => {
  fitView();
};

const onNodeClick = (event: any) => {
  emit('node:click', event.node.id);
};

// 样式配置
const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  style: { stroke: '#b1b1b7', strokeWidth: 2 },
};
</script>

<template>
  <div class="graph-canvas-web">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :default-edge-options="defaultEdgeOptions"
      :min-zoom="0.1"
      :max-zoom="4"
      :nodes-draggable="!readonly"
      :nodes-connectable="!readonly"
      @pane-ready="onPaneReady"
      @node-click="onNodeClick"
    >
      <!-- 背景网格 -->
      <Background pattern-color="#aaa" :gap="16" />

      <!-- 控制栏 (缩放、全屏等) -->
      <Controls />

      <!-- 这里可以添加自定义节点插槽 (Custom Node Slots) -->
      <!-- <template #node-custom="props">...</template> -->
    </VueFlow>
  </div>
</template>

<style scoped>
.graph-canvas-web {
  width: 100%;
  height: 100%;
  background-color: #f8f9fa;
}

/* 覆盖 Vue Flow 默认样式以匹配审计系统主题 */
:deep(.vue-flow__node) {
  padding: 10px;
  border-radius: 4px;
  background: white;
  border: 1px solid #ddd;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  font-size: 12px;
  color: #333;
  min-width: 120px;
  text-align: center;
}

:deep(.vue-flow__node.selected) {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

:deep(.vue-flow__handle) {
  width: 8px;
  height: 8px;
  background: #1890ff;
}
</style>
