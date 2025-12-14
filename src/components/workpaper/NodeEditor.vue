<!--
  节点内容编辑器组件
  支持富文本编辑、表格、附件等
-->
<template>
  <view class="node-editor-modal" v-if="visible">
    <view class="modal-mask" @click="handleClose"></view>
    <view class="modal-content">
      <!-- 头部 -->
      <view class="modal-header">
        <text class="modal-title">编辑节点内容</text>
        <view class="modal-actions">
          <view class="action-btn" @click="handleSave">
            <text>💾 保存</text>
          </view>
          <view class="action-btn close" @click="handleClose">
            <text>✕</text>
          </view>
        </view>
      </view>

      <!-- 编辑区域 -->
      <view class="modal-body">
        <!-- 节点标题 -->
        <view class="form-group">
          <text class="form-label">节点标题</text>
          <input
            class="form-input"
            v-model="editData.title"
            placeholder="请输入节点标题"
          />
        </view>

        <!-- 编辑工具栏 -->
        <view class="editor-toolbar">
          <view class="toolbar-group">
            <view 
              class="tool-btn" 
              :class="{ active: editorMode === 'text' }"
              @click="editorMode = 'text'"
            >
              <text>📝 文本</text>
            </view>
            <view 
              class="tool-btn"
              :class="{ active: editorMode === 'table' }"
              @click="editorMode = 'table'"
            >
              <text>📊 表格</text>
            </view>
            <view 
              class="tool-btn"
              :class="{ active: editorMode === 'attachment' }"
              @click="editorMode = 'attachment'"
            >
              <text>📎 附件</text>
            </view>
          </view>
        </view>

        <!-- 文本编辑器 -->
        <view v-if="editorMode === 'text'" class="text-editor">
          <!-- 富文本编辑器 -->
          <RichTextEditor
            ref="richTextEditor"
            v-model="editData.content"
            placeholder="请输入节点内容，支持富文本格式..."
          />
        </view>

        <!-- 表格编辑器 -->
        <view v-if="editorMode === 'table'" class="table-editor">
          <view class="table-controls">
            <view class="control-btn" @click="addTableRow">
              <text>➕ 添加行</text>
            </view>
            <view class="control-btn" @click="addTableColumn">
              <text>➕ 添加列</text>
            </view>
            <view class="control-btn danger" @click="clearTable">
              <text>🗑️ 清空表格</text>
            </view>
          </view>

          <scroll-view class="table-container" scroll-x scroll-y>
            <view class="data-table">
              <view class="table-row header-row">
                <view 
                  class="table-cell header-cell"
                  v-for="(col, colIndex) in tableData.columns"
                  :key="colIndex"
                >
                  <input
                    class="cell-input"
                    v-model="col.title"
                    placeholder="列标题"
                  />
                </view>
              </view>
              <view 
                class="table-row"
                v-for="(row, rowIndex) in tableData.rows"
                :key="rowIndex"
              >
                <view 
                  class="table-cell"
                  v-for="(col, colIndex) in tableData.columns"
                  :key="colIndex"
                >
                  <input
                    class="cell-input"
                    v-model="row[col.key]"
                    placeholder="输入内容"
                  />
                </view>
              </view>
            </view>
          </scroll-view>
        </view>

        <!-- 附件管理 -->
        <view v-if="editorMode === 'attachment'" class="attachment-manager">
          <view class="upload-area" @click="handleUpload">
            <text class="upload-icon">📤</text>
            <text class="upload-text">点击上传附件</text>
            <text class="upload-hint">支持图片、PDF、Excel等文件</text>
          </view>

          <view class="attachment-list" v-if="attachments.length > 0">
            <view 
              class="attachment-item"
              v-for="(file, index) in attachments"
              :key="index"
            >
              <view class="file-icon">{{ getFileIcon(file.type) }}</view>
              <view class="file-info">
                <text class="file-name">{{ file.name }}</text>
                <text class="file-size">{{ formatFileSize(file.size) }}</text>
              </view>
              <view class="file-actions">
                <view class="action-icon" @click="previewFile(file)">
                  <text>👁️</text>
                </view>
                <view class="action-icon" @click="deleteFile(index)">
                  <text>🗑️</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 字数统计 -->
        <view class="editor-footer">
          <text class="word-count">
            字数: {{ editData.content.length }} | 
            表格: {{ tableData.rows.length }}行 × {{ tableData.columns.length }}列 | 
            附件: {{ attachments.length }}个
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import RichTextEditor from './RichTextEditor.vue';

interface Props {
  visible: boolean;
  nodeData: any;
}

const props = defineProps<Props>();
const emit = defineEmits(['close', 'save']);

// 编辑数据
const editData = ref({
  title: '',
  content: ''
});

// 编辑模式
const editorMode = ref<'text' | 'table' | 'attachment'>('text');

// 表格数据
const tableData = ref({
  columns: [
    { key: 'col1', title: '列1' },
    { key: 'col2', title: '列2' },
    { key: 'col3', title: '列3' }
  ],
  rows: [
    { col1: '', col2: '', col3: '' },
    { col1: '', col2: '', col3: '' }
  ]
});

// 附件列表
const attachments = ref<any[]>([]);

// 监听节点数据变化
watch(() => props.nodeData, (newData) => {
  if (newData) {
    editData.value = {
      title: newData.data?.title || '',
      content: newData.data?.content || ''
    };
    
    // 加载表格数据
    if (newData.data?.tableData) {
      tableData.value = newData.data.tableData;
    }
    
    // 加载附件
    if (newData.data?.attachments) {
      attachments.value = newData.data.attachments;
    }
  }
}, { immediate: true });

// 富文本编辑器引用
const richTextEditor = ref<any>(null);

// 表格操作
const addTableRow = () => {
  const newRow: any = {};
  tableData.value.columns.forEach(col => {
    newRow[col.key] = '';
  });
  tableData.value.rows.push(newRow);
};

const addTableColumn = () => {
  const colIndex = tableData.value.columns.length + 1;
  const newCol = {
    key: `col${colIndex}`,
    title: `列${colIndex}`
  };
  tableData.value.columns.push(newCol);
  
  // 为所有行添加新列
  tableData.value.rows.forEach(row => {
    row[newCol.key] = '';
  });
};

const clearTable = () => {
  uni.showModal({
    title: '确认清空',
    content: '确定要清空表格数据吗？',
    success: (res) => {
      if (res.confirm) {
        tableData.value.rows = [
          { col1: '', col2: '', col3: '' }
        ];
      }
    }
  });
};

// 附件操作
const handleUpload = () => {
  uni.chooseImage({
    count: 9,
    success: (res) => {
      const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : [res.tempFilePaths];
      paths.forEach((path) => {
        attachments.value.push({
          name: `附件${attachments.value.length + 1}.jpg`,
          type: 'image',
          size: 1024 * 100, // 模拟文件大小
          path: path
        });
      });
      
      uni.showToast({
        title: `已添加${paths.length}个附件`,
        icon: 'success'
      });
    }
  });
};

const getFileIcon = (type: string) => {
  const icons: Record<string, string> = {
    image: '🖼️',
    pdf: '📄',
    excel: '📊',
    word: '📝',
    default: '📎'
  };
  return icons[type] || icons.default;
};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
};

const previewFile = (file: any) => {
  if (file.type === 'image') {
    uni.previewImage({
      urls: [file.path],
      current: file.path
    });
  } else {
    uni.showToast({
      title: '暂不支持预览此类型文件',
      icon: 'none'
    });
  }
};

const deleteFile = (index: number) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除此附件吗？',
    success: (res) => {
      if (res.confirm) {
        attachments.value.splice(index, 1);
      }
    }
  });
};

// 保存和关闭
const handleSave = () => {
  const saveData = {
    ...editData.value,
    tableData: tableData.value,
    attachments: attachments.value
  };
  
  emit('save', saveData);
  emit('close');
  
  uni.showToast({
    title: '保存成功',
    icon: 'success'
  });
};

const handleClose = () => {
  emit('close');
};
</script>

<style lang="scss" scoped>
.node-editor-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 800px;
  height: 80vh;
  background: #2a2a2a;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #3d3d3d;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0e0e0;
}

.modal-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 8px 16px;
  background: #1890ff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #40a9ff;
  }

  &.close {
    background: #ff4d4f;
    
    &:hover {
      background: #ff7875;
    }
  }

  text {
    color: white;
    font-size: 14px;
  }
}

.modal-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  color: #999;
  font-size: 14px;
}

.form-input {
  width: 100%;
  padding: 12px;
  background: #1e1e1e;
  border: 1px solid #3d3d3d;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 14px;

  &:focus {
    border-color: #1890ff;
  }
}

.editor-toolbar {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #3d3d3d;
}

.toolbar-group {
  display: flex;
  gap: 10px;
}

.tool-btn {
  padding: 8px 16px;
  background: #3d3d3d;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #4d4d4d;
  }

  &.active {
    background: #1890ff;
  }

  text {
    color: #e0e0e0;
    font-size: 14px;
  }
}

.text-editor {
  padding: 0;
}

.table-editor {
  .table-controls {
    margin-bottom: 15px;
    display: flex;
    gap: 10px;
  }

  .control-btn {
    padding: 8px 16px;
    background: #1890ff;
    border-radius: 6px;
    cursor: pointer;

    &.danger {
      background: #ff4d4f;
    }

    text {
      color: white;
      font-size: 14px;
    }
  }

  .table-container {
    max-height: 400px;
    background: #1e1e1e;
    border: 1px solid #3d3d3d;
    border-radius: 6px;
  }

  .data-table {
    min-width: 100%;
  }

  .table-row {
    display: flex;
    border-bottom: 1px solid #3d3d3d;

    &.header-row {
      background: #2a2a2a;
    }
  }

  .table-cell {
    flex: 1;
    min-width: 150px;
    padding: 8px;
    border-right: 1px solid #3d3d3d;

    &:last-child {
      border-right: none;
    }

    &.header-cell {
      font-weight: 600;
    }
  }

  .cell-input {
    width: 100%;
    padding: 6px;
    background: transparent;
    border: none;
    color: #e0e0e0;
    font-size: 14px;

    &:focus {
      background: #3d3d3d;
    }
  }
}

.attachment-manager {
  .upload-area {
    padding: 60px 20px;
    background: #1e1e1e;
    border: 2px dashed #3d3d3d;
    border-radius: 8px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #1890ff;
      background: #2a2a2a;
    }
  }

  .upload-icon {
    display: block;
    font-size: 48px;
    margin-bottom: 10px;
  }

  .upload-text {
    display: block;
    color: #e0e0e0;
    font-size: 16px;
    margin-bottom: 5px;
  }

  .upload-hint {
    display: block;
    color: #999;
    font-size: 12px;
  }

  .attachment-list {
    margin-top: 20px;
  }

  .attachment-item {
    display: flex;
    align-items: center;
    padding: 12px;
    background: #1e1e1e;
    border: 1px solid #3d3d3d;
    border-radius: 6px;
    margin-bottom: 10px;
  }

  .file-icon {
    font-size: 32px;
    margin-right: 12px;
  }

  .file-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .file-name {
    color: #e0e0e0;
    font-size: 14px;
    margin-bottom: 4px;
  }

  .file-size {
    color: #999;
    font-size: 12px;
  }

  .file-actions {
    display: flex;
    gap: 10px;
  }

  .action-icon {
    font-size: 20px;
    cursor: pointer;
    padding: 4px;

    &:hover {
      opacity: 0.7;
    }
  }
}

.editor-footer {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #3d3d3d;
}

.word-count {
  color: #999;
  font-size: 12px;
}
</style>
