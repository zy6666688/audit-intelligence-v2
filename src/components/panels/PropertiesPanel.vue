<script setup lang="ts">
import { useGraphStore } from '@/store/useGraphStore';
import { computed } from 'vue';
import { nodeRegistry } from '@/core/registry/NodeRegistry';
import { translator } from '@/utils/translator';
import { useProjectFileStore } from '@/store/useProjectFileStore';

interface Props {
  backendStatus?: 'connecting' | 'connected' | 'error';
  onClose?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  backendStatus: 'connecting',
  onClose: undefined
});

const store = useGraphStore();
const node = computed(() => store.selectedNode);

const projectFileStore = useProjectFileStore();
const projectFiles = computed(() => projectFileStore.files);

// 计算是否后端在线
const isBackendOnline = computed(() => props.backendStatus === 'connected');

// 处理关闭按钮点击
const handleClose = () => {
  if (props.onClose) {
    props.onClose();
  }
};

const nodeDefinition = computed(() => {
  if (node.value) {
    return nodeRegistry.getNodeDefinition(node.value.type);
  }
  return null;
});

const localizedDescription = computed(() => {
  const def = nodeDefinition.value;
  if (!def) return '';

  // 固定使用中文呈现说明
  const currentLang = translator.getLanguage();
  translator.setLanguage('zh');
  const title = translator.translateNodeTitle(def.type);
  const category = translator.translateCategory(def.category || '未分类');

  const inputs = def.inputs
    ?.map((i) => `- 输入：${translator.translatePortName(def.type, i.name, true)} (${i.type})`)
    .join('\n');
  const outputs = def.outputs
    ?.map((o) => `- 输出：${translator.translatePortName(def.type, o.name, false)} (${o.type})`)
    .join('\n');

  const desc = def.description || '暂无详细说明。';
  translator.setLanguage(currentLang);

  return `${title}\n\n${desc}\n\n分类：${category}\n类型：${def.type}${inputs ? `\n\n${inputs}` : ''}${outputs ? `\n${outputs}` : ''}`;
});

function handleFileChange(event: Event, key: string) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    // 存储真实 File 对象以便 Runtime 使用
    // 注意：持久化时需要特殊处理，但目前内存运行是可行的
    if (node.value) {
      node.value.data[key] = target.files[0];
    }
  }
}

function getFileName(value: any): string {
  if (value instanceof File) {
    return value.name;
  }
  return String(value);
}

// ============ 与项目文件区的前端联动（只读展示 + 引导） ============
const excelBindingLabel = computed(() => {
  if (!node.value || node.value.type !== 'ExcelLoader') return '';
  const data: any = node.value.data || {};
  const path = data.storage_path || data.file_path;
  if (!path) return '未绑定';
  const file = projectFiles.value.find(f => f.storagePath === path);
  return file ? file.name : path;
});

const uploadBindingLabel = computed(() => {
  if (!node.value) return '';
  if (node.value.type !== 'FileUpload' && node.value.type !== 'FileUploadNode') return '';
  const data: any = node.value.data || {};
  const path = data.storage_path || data.file_path;
  const fileId = data.file_id;
  let label = '';
  if (fileId) {
    const file = projectFiles.value.find(f => f.id === fileId);
    label = file ? file.name : fileId;
  } else if (path) {
    const file = projectFiles.value.find(f => f.storagePath === path);
    label = file ? file.name : path;
  }
  return label || '未绑定';
});

const complianceBoundFiles = computed(() => {
  if (!node.value || node.value.type !== 'ComplianceCheck') return [];
  const data: any = node.value.data || {};
  const ids: string[] = data.source_file_ids || [];
  if (!ids.length) return [];
  return projectFiles.value.filter(f => ids.includes(f.id));
});

function focusProjectFilePanel() {
  const panel = document.querySelector('.project-file-panel');
  if (panel) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
</script>

<template>
  <div class="properties-panel" v-if="node">
    <div class="header">
      <h3>属性配置</h3>
      <div class="header-actions">
        <span class="node-id">ID: {{ node.id.slice(0, 8) }}...</span>
        <button 
          v-if="onClose" 
          @click="handleClose" 
          class="close-btn" 
          title="隐藏属性面板"
        >
          ×
        </button>
      </div>
    </div>

    <div class="content">
      <!-- 节点说明 -->
      <div v-if="nodeDefinition" class="node-description">
        <h4>节点说明</h4>
        <pre class="node-description-text">{{ localizedDescription }}</pre>
      </div>

      <!-- 通用属性 -->
      <div class="form-group">
        <label>节点类型</label>
        <input type="text" :value="node.type" disabled />
      </div>

      <div class="form-group">
        <label>位置 (X, Y)</label>
        <div class="row">
          <input type="number" v-model="node.position.x" disabled />
          <input type="number" v-model="node.position.y" disabled />
        </div>
      </div>

      <!-- 与项目文件区的联动信息 -->
      <div
        v-if="node.type === 'ExcelLoader'"
        class="form-group bound-file-group"
      >
        <label>项目文件绑定</label>
        <p class="bound-file">{{ excelBindingLabel }}</p>
        <button type="button" class="link-btn" @click="focusProjectFilePanel">
          从项目文件区选择 Excel
        </button>
      </div>

      <div
        v-if="node.type === 'FileUpload' || node.type === 'FileUploadNode'"
        class="form-group bound-file-group"
      >
        <label>项目文件绑定</label>
        <p class="bound-file">{{ uploadBindingLabel }}</p>
        <button type="button" class="link-btn" @click="focusProjectFilePanel">
          从项目文件区选择源文件
        </button>
      </div>

      <div
        v-if="node.type === 'ComplianceCheck'"
        class="form-group bound-file-group"
      >
        <label>关联合同文件（项目文件区）</label>
        <p v-if="!complianceBoundFiles.length" class="bound-file">未绑定</p>
        <ul v-else class="bound-file-list">
          <li v-for="f in complianceBoundFiles" :key="f.id">
            {{ f.name }}
          </li>
        </ul>
        <button type="button" class="link-btn" @click="focusProjectFilePanel">
          从项目文件区选择合同
        </button>
      </div>

      <hr />

      <!-- 动态属性渲染 -->
      <div v-if="nodeDefinition?.properties">
        <div 
          v-for="prop in nodeDefinition.properties" 
          :key="prop.name" 
          class="form-group"
          v-show="isBackendOnline || !(prop as any).hidden"
        >
          <label>
            {{ prop.label }}
            <span v-if="prop.description" class="property-hint" :title="prop.description">ℹ️</span>
          </label>
          <p v-if="prop.description" class="property-description">{{ prop.description }}</p>
          
          <!-- String / Number Input -->
          <input 
            v-if="prop.type === 'string' || prop.type === 'number'"
            :type="prop.type === 'string' ? 'text' : 'number'"
            v-model="node.data[prop.name]"
            :placeholder="prop.placeholder"
          />

          <!-- Boolean Checkbox -->
          <div v-else-if="prop.type === 'boolean'" class="checkbox-wrapper">
             <input type="checkbox" v-model="node.data[prop.name]" />
             <span>启用</span>
          </div>

          <!-- Select Dropdown -->
          <select 
            v-else-if="prop.type === 'select'"
            v-model="node.data[prop.name]"
          >
            <option v-for="opt in prop.options" :key="opt" :value="opt">
              {{ opt }}
            </option>
          </select>

          <!-- File Input -->
          <div v-else-if="prop.type === 'file'">
            <input type="file" @change="(e) => handleFileChange(e, prop.name)" />
            <div class="file-info" v-if="node.data[prop.name]">
              已选: {{ getFileName(node.data[prop.name]) }}
            </div>
          </div>

          <!-- Code Input (Textarea) -->
          <textarea 
            v-else-if="prop.type === 'code'"
            v-model="node.data[prop.name]"
            :placeholder="prop.placeholder"
            rows="5"
            class="code-input"
          ></textarea>
        
        </div>
      </div>
      
      <div v-else class="no-properties">
        <p>此节点无配置项</p>
      </div>

    </div>
  </div>
  <div class="properties-panel empty" v-else>
    <div class="empty-content">
      <p class="empty-hint">点击节点以查看属性</p>
      <p v-if="!isBackendOnline" class="backend-offline-hint">后端离线中</p>
      <button 
        v-if="onClose" 
        @click="handleClose" 
        class="close-btn-empty" 
        title="隐藏属性面板"
      >
        × 隐藏
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.properties-panel {
  width: 300px;
  height: 100%;
  background-color: #252525;
  border-left: 1px solid #333;
  color: #eee;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;

  &.empty {
    align-items: center;
    justify-content: center;
    color: #666;
    flex-direction: column;
    gap: 8px;
    
    .empty-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      position: relative;
    }
    
    .empty-hint {
      margin: 0;
      font-size: 14px;
      color: #888;
    }
    
    .backend-offline-hint {
      margin: 0;
      font-size: 12px;
      color: #ff6b6b;
      opacity: 0.7;
    }
    
    .close-btn-empty {
      margin-top: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #aaa;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        color: #fff;
      }
    }
  }

  .header {
    padding: 16px;
    border-bottom: 1px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-title {
      flex: 1;
      
      h3 {
        margin: 0 0 4px 0;
        font-size: 16px;
      }
      
      .node-description {
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 16px;
        
        h4 {
          margin: 0 0 8px 0;
          font-size: 13px;
          font-weight: 600;
          color: #4a9eff;
        }
        
        p {
          margin: 0;
          font-size: 12px;
          color: #bbb;
          line-height: 1.6;
          white-space: pre-wrap;
        }
      }
    }
    
    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .node-id {
      font-size: 12px;
      color: #666;
    }
    
    .close-btn {
      background: transparent;
      border: none;
      color: #aaa;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
      
      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
    }
  }

  .content {
    padding: 16px;
    flex: 1;
    overflow-y: auto;

    .form-group {
      margin-bottom: 16px;

      label {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 8px;
        font-size: 12px;
        color: #aaa;
        
        .property-hint {
          font-size: 10px;
          color: #666;
          cursor: help;
          opacity: 0.7;
          
          &:hover {
            opacity: 1;
          }
        }
      }
      
      .property-description {
        font-size: 11px;
        color: #777;
        margin: -4px 0 8px 0;
        line-height: 1.4;
        font-style: italic;
      }

      input[type="text"],
      input[type="number"],
      select {
        width: 100%;
        background: #1e1e1e;
        border: 1px solid #444;
        color: #eee;
        padding: 6px;
        border-radius: 4px;
        
        &:focus {
          border-color: #3498db;
          outline: none;
        }
      }

      .row {
        display: flex;
        gap: 8px;
      }
      
      .checkbox-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        input {
          width: auto;
        }
      }

      .file-info {
        font-size: 11px;
        color: #888;
        margin-top: 4px;
        word-break: break-all;
      }
      
      .code-input {
        width: 100%;
        background: #1e1e1e;
        border: 1px solid #444;
        color: #a9b7c6;
        padding: 6px;
        border-radius: 4px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 12px;
        resize: vertical;
        
        &:focus {
          border-color: #3498db;
          outline: none;
        }
      }
    }

    .bound-file-group {
      .bound-file {
        margin: 4px 0;
        color: #ddd;
        font-size: 12px;
        word-break: break-all;
      }
      .bound-file-list {
        margin: 4px 0;
        padding-left: 16px;
        li {
          font-size: 12px;
          color: #ddd;
        }
      }
      .link-btn {
        margin-top: 4px;
        padding: 4px 8px;
        background: #444;
        border-radius: 3px;
        border: none;
        color: #eee;
        font-size: 12px;
        cursor: pointer;
        &:hover {
          background: #555;
        }
      }
    }

    hr {
      border: none;
      border-top: 1px solid #333;
      margin: 16px 0;
    }
    
    .no-properties {
      color: #666;
      font-size: 12px;
      text-align: center;
      padding-top: 20px;
    }
  }
}
</style>
