<template>
  <div class="code-editor-wrapper">
    <div class="editor-header">
      <span class="editor-title">
        <span class="icon">💻</span>
        Python 脚本编辑器
      </span>
      <div class="editor-actions">
        <button @click="formatCode" class="btn-action" title="格式化代码">
          <span>🎨</span> 格式化
        </button>
        <button @click="$emit('run')" class="btn-action btn-run" title="运行脚本 (Ctrl+Enter)">
          <span>▶️</span> 运行
        </button>
      </div>
    </div>
    
    <div class="editor-container">
      <vue-monaco-editor
        v-model:value="code"
        language="python"
        :theme="theme"
        :options="editorOptions"
        @mount="handleMount"
        class="monaco-editor"
      />
    </div>
    
    <div v-if="showConsole" class="console-output">
      <div class="console-header">
        <span class="console-title">
          <span class="icon">📋</span>
          控制台输出
        </span>
        <button @click="clearConsole" class="btn-clear">清空</button>
      </div>
      <pre class="console-content">{{ consoleOutput || '等待执行...' }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'

interface Props {
  modelValue: string
  consoleOutput?: string
  showConsole?: boolean
  theme?: 'vs' | 'vs-dark' | 'hc-black'
  readOnly?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'run'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  consoleOutput: '',
  showConsole: true,
  theme: 'vs-dark',
  readOnly: false
})

const emit = defineEmits<Emits>()

const code = ref(props.modelValue)
const editorInstance = ref<any>(null)

// Monaco Editor 配置
const editorOptions = {
  automaticLayout: true,
  fontSize: 14,
  lineNumbers: 'on',
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  tabSize: 4,
  readOnly: props.readOnly,
  suggestOnTriggerCharacters: true,
  quickSuggestions: true,
  // Python specific
  formatOnPaste: true,
  formatOnType: true,
}

// Watch code changes and emit to parent
watch(code, (newValue) => {
  emit('update:modelValue', newValue)
})

// Watch prop changes
watch(() => props.modelValue, (newValue) => {
  if (newValue !== code.value) {
    code.value = newValue
  }
})

// Handle editor mount
const handleMount = (editor: any) => {
  editorInstance.value = editor
  
  // Add keyboard shortcuts
  editor.addAction({
    id: 'run-script',
    label: 'Run Script',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter
    ],
    run: () => {
      emit('run')
    }
  })
  
  // Add Python snippets
  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: (model: any, position: any) => {
      // Get the text before cursor to calculate range
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }
      
      const suggestions = [
        {
          label: 'df.head()',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'df.head(${1:10})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '显示 DataFrame 前 n 行',
          range: range
        },
        {
          label: 'df.groupby',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'df.groupby(\'${1:column}\')[\'${2:value}\'].${3|sum,mean,count,max,min|}()',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'DataFrame 分组聚合',
          range: range
        },
        {
          label: 'df.query',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'df.query(\'${1:column} > ${2:value}\')',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '使用条件查询 DataFrame',
          range: range
        },
        {
          label: 'result = df.copy()',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'result = df.copy()\n${0}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '创建 DataFrame 副本',
          range: range
        },
      ]
      return { suggestions }
    }
  })
}

// Format code (basic)
const formatCode = () => {
  if (editorInstance.value) {
    editorInstance.value.getAction('editor.action.formatDocument').run()
  }
}

// Clear console
const clearConsole = () => {
  emit('update:modelValue', code.value)
}
</script>

<style scoped lang="scss">
.code-editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #2d2d30;
  border-bottom: 1px solid #3e3e42;
}

.editor-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #cccccc;
  font-weight: 500;
  font-size: 14px;
  
  .icon {
    font-size: 16px;
  }
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #3c3c3c;
  color: #cccccc;
  border: 1px solid #555555;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #505050;
    border-color: #666666;
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  span {
    font-size: 14px;
  }
}

.btn-run {
  background: #0e639c;
  border-color: #1177bb;
  
  &:hover {
    background: #1177bb;
    border-color: #1890dd;
  }
}

.editor-container {
  flex: 1;
  min-height: 300px;
  overflow: hidden;
}

.monaco-editor {
  width: 100%;
  height: 100%;
}

.console-output {
  display: flex;
  flex-direction: column;
  max-height: 200px;
  border-top: 1px solid #3e3e42;
  background: #1e1e1e;
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
}

.console-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #cccccc;
  font-size: 13px;
  font-weight: 500;
  
  .icon {
    font-size: 14px;
  }
}

.btn-clear {
  padding: 4px 10px;
  background: transparent;
  color: #888888;
  border: 1px solid #555555;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    color: #cccccc;
    border-color: #666666;
    background: #3c3c3c;
  }
}

.console-content {
  flex: 1;
  margin: 0;
  padding: 12px 16px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  
  &::-webkit-scrollbar {
    width: 10px;
  }
  
  &::-webkit-scrollbar-track {
    background: #1e1e1e;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #424242;
    border-radius: 5px;
    
    &:hover {
      background: #4e4e4e;
    }
  }
}
</style>
