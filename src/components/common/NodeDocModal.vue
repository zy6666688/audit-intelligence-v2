<template>
  <div v-if="visible" class="doc-modal-overlay" @click.self="close">
    <div class="doc-modal">
      <div class="modal-header">
        <h3>{{ title }}</h3>
        <button class="close-btn" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div v-if="loading" class="loading">Loading documentation...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else class="markdown-content" v-html="parsedContent"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { nodeRegistry } from '@/core/registry/NodeRegistry';
import { translator } from '@/utils/translator';

const props = defineProps<{
  visible: boolean;
  nodeType: string;
  nodeTitle?: string;
}>();

const emit = defineEmits(['close']);

const content = ref('');
const loading = ref(false);
const error = ref('');

// 简单的 Markdown 解析器 (仅支持基础语法)
const parsedContent = computed(() => {
  if (!content.value) return '';
  
  let html = content.value
    // Headers
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Code blocks
    .replace(/```python([\s\S]*?)```/g, '<pre><code class="language-python">$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Lists
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n/g, '<br>');
    
  return html;
});

const title = computed(() => props.nodeTitle || props.nodeType);

const close = () => {
  emit('close');
};

// 工具：获取中文分类/端口名称，避免影响全局语言
function translateCategoryZh(category: string | undefined) {
  if (!category) return '未分类';
  const lang = translator.getLanguage();
  try {
    translator.setLanguage('zh');
    return translator.translateCategory(category);
  } finally {
    translator.setLanguage(lang);
  }
}

function translatePortNameZh(nodeType: string, portName: string, isInput: boolean) {
  const lang = translator.getLanguage();
  try {
    translator.setLanguage('zh');
    return translator.translatePortName(nodeType, portName, isInput);
  } finally {
    translator.setLanguage(lang);
  }
}

const fetchDoc = async () => {
  if (!props.nodeType) return;
  
  loading.value = true;
  error.value = '';
  content.value = '';
  
  try {
    // 首先尝试从节点注册表获取说明
    const nodeDef = nodeRegistry.getNodeDefinition(props.nodeType);
    
    if (nodeDef) {
      // 构建中文说明（即使 description 为空也生成结构化说明）
      const desc = nodeDef.description || '（暂无详细描述，以下为自动生成的接口说明）';
      const titleZh = nodeDef.title || props.nodeTitle || props.nodeType;
      const categoryZh = translateCategoryZh(nodeDef.category);
      content.value = `# ${titleZh}\n\n${desc}\n\n## 节点信息\n\n- **类型**: \`${props.nodeType}\`\n- **分类**: ${categoryZh}\n`;
      
      if (nodeDef.inputs && nodeDef.inputs.length > 0) {
        content.value += `\n## 输入\n\n`;
        nodeDef.inputs.forEach(input => {
          const portName = translatePortNameZh(props.nodeType, input.name, true);
          content.value += `- **${portName}** (${input.type})\n`;
        });
      }
      
      if (nodeDef.outputs && nodeDef.outputs.length > 0) {
        content.value += `\n## 输出\n\n`;
        nodeDef.outputs.forEach(output => {
          const portName = translatePortNameZh(props.nodeType, output.name, false);
          content.value += `- **${portName}** (${output.type})\n`;
        });
      }
      
      // 如果有属性说明，也添加进去
      if (nodeDef.properties && nodeDef.properties.length > 0) {
        content.value += `\n## 属性说明\n\n`;
        nodeDef.properties.forEach(prop => {
          content.value += `- **${prop.label}** (${prop.type})`;
          if (prop.description) {
            content.value += `: ${prop.description}`;
          }
          content.value += `\n`;
        });
      }
      
      loading.value = false;
      return;
    }
    
    // 如果节点注册表中没有，尝试加载Markdown文档
    let url = `/docs/nodes/${props.nodeType}.md`;
    let res = await fetch(url);
    
    let textContent = '';
    if (res.ok) {
      textContent = await res.text();
    }

    // 如果请求失败，或者内容为空/纯空白，则显示默认提示
    if (!res.ok || !textContent.trim()) {
      console.warn(`[NodeDoc] No documentation found (or empty) for ${props.nodeType}`);
      content.value = `# ${props.nodeTitle || props.nodeType}\n\n⚠️ **暂无详细说明书**\n\n该节点尚未提供详细的使用文档（待添加）。\n\n节点类型 ID: \`${props.nodeType}\`\n\n请联系管理员补充该节点说明。`;
    } else {
      content.value = textContent;
    }
  } catch (e) {
    error.value = 'Failed to load documentation.';
    console.error(e);
  } finally {
    loading.value = false;
  }
};

watch(() => props.visible, (newVal) => {
  if (newVal) {
    fetchDoc();
  }
});
</script>

<style scoped lang="scss">
.doc-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.doc-modal {
  background: #252525;
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  border: 1px solid #333;
  color: #eee;

  .modal-header {
    padding: 16px;
    border-bottom: 1px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #2a2a2a;
    border-radius: 8px 8px 0 0;

    h3 {
      margin: 0;
      font-size: 18px;
    }

    .close-btn {
      background: none;
      border: none;
      color: #999;
      font-size: 24px;
      cursor: pointer;
      line-height: 1;
      
      &:hover {
        color: #fff;
      }
    }
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
    line-height: 1.6;
    
    .loading, .error {
      text-align: center;
      padding: 20px;
      color: #888;
    }
    
    .error {
      color: #e74c3c;
    }

    // Markdown styles
    color: #eee; // Ensure base text color is visible

    :deep(h1) { font-size: 24px; margin-bottom: 16px; border-bottom: 1px solid #444; padding-bottom: 8px; color: #fff; }
    :deep(h2) { font-size: 20px; margin-top: 24px; margin-bottom: 12px; color: #3498db; }
    :deep(h3) { font-size: 16px; margin-top: 16px; margin-bottom: 8px; font-weight: bold; color: #ccc; }
    :deep(p) { margin-bottom: 12px; line-height: 1.6; }
    :deep(strong) { color: #fff; font-weight: bold; }
    :deep(code) { 
      background: #333; 
      padding: 2px 4px; 
      border-radius: 3px; 
      font-family: monospace; 
      color: #e67e22;
    }
    :deep(pre) {
      background: #111;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 12px 0;
      
      code {
        background: transparent;
        padding: 0;
        color: #eee;
      }
    }
    :deep(li) { margin-bottom: 4px; margin-left: 20px; list-style-type: disc; }
  }
}
</style>
