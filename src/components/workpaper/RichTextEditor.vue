<!--
  富文本编辑器组件（基于uni-app实现）
  支持格式化、列表、对齐等功能
-->
<template>
  <view class="rich-text-editor">
    <!-- 工具栏 -->
    <view class="editor-toolbar">
      <!-- 字体样式 -->
      <view class="toolbar-group">
        <view 
          class="toolbar-btn" 
          :class="{ active: formats.bold }"
          @click="format('bold')"
        >
          <text class="btn-icon">B</text>
        </view>
        <view 
          class="toolbar-btn" 
          :class="{ active: formats.italic }"
          @click="format('italic')"
        >
          <text class="btn-icon italic">I</text>
        </view>
        <view 
          class="toolbar-btn" 
          :class="{ active: formats.underline }"
          @click="format('underline')"
        >
          <text class="btn-icon underline">U</text>
        </view>
      </view>

      <view class="toolbar-divider"></view>

      <!-- 对齐 -->
      <view class="toolbar-group">
        <view 
          class="toolbar-btn"
          :class="{ active: formats.align === 'left' }"
          @click="format('align', 'left')"
        >
          <text class="btn-text">≡</text>
        </view>
        <view 
          class="toolbar-btn"
          :class="{ active: formats.align === 'center' }"
          @click="format('align', 'center')"
        >
          <text class="btn-text">≣</text>
        </view>
        <view 
          class="toolbar-btn"
          :class="{ active: formats.align === 'right' }"
          @click="format('align', 'right')"
        >
          <text class="btn-text">≡</text>
        </view>
      </view>

      <view class="toolbar-divider"></view>

      <!-- 列表 -->
      <view class="toolbar-group">
        <view 
          class="toolbar-btn"
          :class="{ active: formats.list === 'ordered' }"
          @click="format('list', 'ordered')"
        >
          <text class="btn-text">1. 2. 3.</text>
        </view>
        <view 
          class="toolbar-btn"
          :class="{ active: formats.list === 'bullet' }"
          @click="format('list', 'bullet')"
        >
          <text class="btn-text">• • •</text>
        </view>
      </view>

      <view class="toolbar-divider"></view>

      <!-- 特殊标签 -->
      <view class="toolbar-group">
        <view class="toolbar-btn" @click="insertTag('【重点】')">
          <text class="btn-text">⭐</text>
        </view>
        <view class="toolbar-btn" @click="insertTag('【风险】')">
          <text class="btn-text">⚠️</text>
        </view>
        <view class="toolbar-btn" @click="insertTag('【建议】')">
          <text class="btn-text">💡</text>
        </view>
        <view class="toolbar-btn" @click="insertTag('【结论】')">
          <text class="btn-text">✅</text>
        </view>
      </view>
    </view>

    <!-- 编辑区域 -->
    <editor
      id="richTextEditor"
      class="editor-content"
      :placeholder="placeholder"
      :show-img-size="true"
      :show-img-toolbar="true"
      :show-img-resize="true"
      @ready="onEditorReady"
      @focus="onEditorFocus"
      @blur="onEditorBlur"
      @input="onEditorInput"
      @statuschange="onStatusChange"
    />

    <!-- 底部信息栏 -->
    <view class="editor-footer">
      <text class="footer-text">字数: {{ wordCount }}</text>
      <text class="footer-text">|</text>
      <text class="footer-text">格式: {{ currentFormat }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

interface Props {
  modelValue?: string;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '请输入内容...'
});

const emit = defineEmits(['update:modelValue', 'change']);

// 编辑器实例
let editorCtx: any = null;

// 格式状态
const formats = ref({
  bold: false,
  italic: false,
  underline: false,
  align: 'left',
  list: ''
});

// 内容
const content = ref('');
const wordCount = ref(0);

// 当前格式文本
const currentFormat = computed(() => {
  const formatArr: string[] = [];
  if (formats.value.bold) formatArr.push('粗体');
  if (formats.value.italic) formatArr.push('斜体');
  if (formats.value.underline) formatArr.push('下划线');
  if (formats.value.list) formatArr.push(formats.value.list === 'ordered' ? '有序列表' : '无序列表');
  return formatArr.length > 0 ? formatArr.join(', ') : '正文';
});

// 监听外部值变化
watch(() => props.modelValue, (newVal) => {
  if (newVal !== content.value && editorCtx) {
    // 设置编辑器内容
    editorCtx.setContents({
      html: newVal
    });
  }
});

// 编辑器就绪
const onEditorReady = () => {
  // #ifdef H5
  uni.createSelectorQuery().select('#richTextEditor').context((res: any) => {
    if (res && res.context) {
      editorCtx = res.context;
      
      // 初始化内容
      if (props.modelValue) {
        editorCtx.setContents({
          html: props.modelValue
        });
      }
    }
  }).exec();
  // #endif

  // #ifdef MP
  uni.createSelectorQuery().select('#richTextEditor').context((res: any) => {
    if (res && res.context) {
      editorCtx = res.context;
      
      if (props.modelValue) {
        editorCtx.setContents({
          html: props.modelValue
        });
      }
    }
  }).exec();
  // #endif
};

// 聚焦
const onEditorFocus = () => {
  // 可以添加聚焦时的处理
};

// 失焦
const onEditorBlur = () => {
  // 可以添加失焦时的处理
};

// 内容输入
const onEditorInput = (e: any) => {
  if (editorCtx) {
    editorCtx.getContents({
      success: (res: any) => {
        content.value = res.html;
        
        // 计算字数（去除HTML标签）
        const text = res.text || '';
        wordCount.value = text.length;
        
        // 触发更新
        emit('update:modelValue', res.html);
        emit('change', res.html);
      }
    });
  }
};

// 状态变化
const onStatusChange = (e: any) => {
  const detail = e.detail;
  
  // 更新格式状态
  formats.value = {
    bold: detail.bold || false,
    italic: detail.italic || false,
    underline: detail.underline || false,
    align: detail.align || 'left',
    list: detail.list || ''
  };
};

// 格式化
const format = (name: string, value?: any) => {
  if (!editorCtx) return;
  
  switch (name) {
    case 'bold':
    case 'italic':
    case 'underline':
      editorCtx.format(name);
      break;
    case 'align':
      editorCtx.format('align', value);
      break;
    case 'list':
      editorCtx.format('list', value === formats.value.list ? false : value);
      break;
  }
};

// 插入标签
const insertTag = (tag: string) => {
  if (!editorCtx) return;
  
  editorCtx.insertText({
    text: tag + ' '
  });
};

// 清除格式
const clearFormat = () => {
  if (!editorCtx) return;
  
  editorCtx.removeFormat();
};

// 获取内容
const getContent = () => {
  return new Promise((resolve) => {
    if (editorCtx) {
      editorCtx.getContents({
        success: (res: any) => {
          resolve(res.html);
        }
      });
    } else {
      resolve(content.value);
    }
  });
};

// 设置内容
const setContent = (html: string) => {
  if (editorCtx) {
    editorCtx.setContents({
      html: html
    });
  }
};

// 暴露方法给父组件
defineExpose({
  getContent,
  setContent,
  clearFormat
});
</script>

<style lang="scss" scoped>
.rich-text-editor {
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  border: 1px solid #3d3d3d;
  border-radius: 8px;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 10px;
  background: #2a2a2a;
  border-bottom: 1px solid #3d3d3d;
  flex-wrap: wrap;
  gap: 5px;
}

.toolbar-group {
  display: flex;
  gap: 4px;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #3d3d3d;
  margin: 0 8px;
}

.toolbar-btn {
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3d3d3d;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0 8px;

  &:hover {
    background: #4d4d4d;
  }

  &.active {
    background: #1890ff;
  }

  .btn-icon {
    color: #e0e0e0;
    font-size: 14px;
    font-weight: bold;

    &.italic {
      font-style: italic;
    }

    &.underline {
      text-decoration: underline;
    }
  }

  .btn-text {
    color: #e0e0e0;
    font-size: 12px;
    white-space: nowrap;
  }
}

.editor-content {
  flex: 1;
  min-height: 300px;
  background: #1e1e1e;
  padding: 15px;
}

// 编辑器内容样式
::v-deep .ql-container {
  font-size: 14px;
  line-height: 1.6;
  color: #e0e0e0;
}

::v-deep .ql-editor {
  padding: 0;
  
  p {
    margin-bottom: 10px;
  }

  strong {
    font-weight: bold;
  }

  em {
    font-style: italic;
  }

  u {
    text-decoration: underline;
  }

  ol, ul {
    padding-left: 20px;
    margin-bottom: 10px;
  }

  li {
    margin-bottom: 5px;
  }
}

.editor-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 15px;
  background: #2a2a2a;
  border-top: 1px solid #3d3d3d;
}

.footer-text {
  color: #999;
  font-size: 12px;
}
</style>
