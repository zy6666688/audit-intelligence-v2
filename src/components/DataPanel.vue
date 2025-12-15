<template>
  <div v-if="isVisible" class="data-panel">
    <div class="data-panel-header">
      <div class="header-left">
        <h3>数据预览 / Data Preview</h3>
        <span v-if="previewData" class="row-count">
          {{ previewData.total_rows.toLocaleString() }} rows × {{ previewData.columns.length }} columns
        </span>
      </div>
      <div class="header-right">
        <button @click="refreshPreview" class="btn-icon" title="Refresh">
          <span>🔄</span>
        </button>
        <button @click="closePanel" class="btn-icon" title="Close">
          <span>✕</span>
        </button>
      </div>
    </div>

    <div class="data-panel-content">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading data...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p class="error-message">{{ error }}</p>
        <div v-if="errorDetails" class="error-details">
          <details>
            <summary>Error Details (Click to expand)</summary>
            <pre>{{ JSON.stringify(errorDetails, null, 2) }}</pre>
          </details>
        </div>
        <button @click="refreshPreview" class="btn-secondary">Retry</button>
      </div>

      <div v-else-if="previewData" class="data-table-container">
        <!-- Schema Info -->
        <div class="schema-info">
          <details>
            <summary>📋 Schema ({{ previewData.columns.length }} columns)</summary>
            <div class="schema-list">
              <div v-for="col in previewData.columns" :key="col" class="schema-item">
                <span class="col-name">{{ col }}</span>
                <span class="col-type">{{ previewData.schema[col] }}</span>
              </div>
            </div>
          </details>
        </div>

        <!-- Data Table -->
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="row-number">#</th>
                <th v-for="col in previewData.columns" :key="col">
                  {{ col }}
                  <span class="type-badge">{{ formatType(previewData.schema[col]) }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in previewData.rows" :key="index">
                <td class="row-number">{{ index + 1 }}</td>
                <td v-for="col in previewData.columns" :key="col" :class="getCellClass(row[col])">
                  {{ formatValue(row[col]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer Info -->
        <div class="table-footer">
          <span>Showing {{ previewData.rows.length }} of {{ previewData.total_rows.toLocaleString() }} rows</span>
          <span v-if="previewData.total_rows > previewData.rows.length" class="warning-text">
            ⚠️ Displaying preview only (first {{ previewData.rows.length }} rows)
          </span>
        </div>
      </div>

      <div v-else class="empty-state">
        <p>No data to display</p>
        <small>Execute a workflow and click the 👁️ icon on a node to preview its output</small>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import apiClient from '../api/axios-config'

interface DataPreviewResponse {
  rows: Array<Record<string, any>>
  total_rows: number
  columns: string[]
  schema: Record<string, string>
  sample_values: Record<string, any[]>
}

const props = defineProps<{
  promptId?: string
  nodeId?: string
  outputIndex?: number
  projectId?: string
  runId?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const isVisible = ref(true)
const loading = ref(false)
const error = ref<string | null>(null)
const errorDetails = ref<any>(null)
const previewData = ref<DataPreviewResponse | null>(null)

const closePanel = () => {
  isVisible.value = false
  emit('close')
}

const loadPreview = async () => {
  if (!props.nodeId) {
    return
  }

  loading.value = true
  error.value = null
  errorDetails.value = null

  try {
    let url: string

    if (props.projectId && props.runId) {
      // Project run preview
      url = `/preview/project/${props.projectId}/run/${props.runId}/node/${props.nodeId}/${props.outputIndex || 0}`
    } else if (props.promptId) {
      // Temporary execution preview
      url = `/preview/node/${props.promptId}/${props.nodeId}/${props.outputIndex || 0}`
    } else {
      throw new Error('Missing required parameters for preview')
    }

    // #region agent log
    const fullUrl = `${apiClient.defaults.baseURL || 'http://localhost:8000'}${url}`;
    fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataPanel.vue:140',message:'Before loading preview',data:{url,full_url:fullUrl,base_url:apiClient.defaults.baseURL,node_id:props.nodeId,prompt_id:props.promptId,project_id:props.projectId,run_id:props.runId},timestamp:Date.now(),sessionId:'debug-session',runId:'preview',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // 添加重试机制和更好的错误处理
    let response
    let lastError: any = null
    const maxRetries = 3
    const retryDelay = 1000 // 1秒
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        response = await apiClient.get<DataPreviewResponse>(url, {
          params: { limit: 100 },
          timeout: 15000 // 15秒超时
        })
        break // 成功，退出重试循环
      } catch (err: any) {
        lastError = err
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataPanel.vue:153',message:'Preview API request attempt failed',data:{attempt:attempt+1,max_retries:maxRetries,error_message:err.message,is_network_error:!err.response},timestamp:Date.now(),sessionId:'debug-session',runId:'load_preview',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // 如果是网络错误且还有重试机会，等待后重试
        if (!err.response && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
          continue
        }
        // 其他错误或最后一次重试，抛出错误
        throw err
      }
    }
    
    if (!response) {
      throw lastError || new Error('Failed to load preview after retries')
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataPanel.vue:150',message:'Preview loaded successfully',data:{has_data:!!response.data,row_count:response.data?.rows?.length||0,column_count:response.data?.columns?.length||0,status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'preview',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    previewData.value = response.data
  } catch (err: any) {
    console.error('Failed to load preview:', err)
    // #region agent log
    const errorDetailsObj = {
      error: String(err),
      error_message: err.message,
      status: err.response?.status,
      status_text: err.response?.statusText,
      detail: err.response?.data?.detail,
      url: err.config?.url,
      base_url: err.config?.baseURL,
      full_url: err.config ? `${err.config.baseURL}${err.config.url}` : 'unknown',
      code: err.code,
      is_network_error: !err.response,
      node_id: props.nodeId,
      prompt_id: props.promptId,
      project_id: props.projectId,
      run_id: props.runId,
      output_index: props.outputIndex
    };
    errorDetails.value = errorDetailsObj;
    fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataPanel.vue:159',message:'Preview load failed',data:errorDetailsObj,timestamp:Date.now(),sessionId:'debug-session',runId:'preview',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // 改进错误消息显示
    if (!err.response) {
      // 网络错误（后端离线或连接失败）
      if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        error.value = 'Network Error: Cannot connect to backend server. The backend may have crashed or stopped. Please:\n1. Check if the backend is still running\n2. Restart the backend server if needed\n3. Refresh this page and try again'
      } else {
        error.value = `Network Error: ${err.message || 'Failed to connect to backend'}`
      }
    } else if (err.response.status === 404) {
      // 文件未找到
      const detail = err.response?.data?.detail || ''
      error.value = detail || `No data found for node "${props.nodeId}". Possible reasons:\n1. The workflow may not have generated output data\n2. The cache file was not saved during execution\n3. The node output is not a DataFrame\n\nPlease check the backend logs to see if the node executed successfully.`
    } else if (err.response.status === 401) {
      // 认证错误
      error.value = 'Authentication required. Please login first.'
    } else if (err.response.status === 500) {
      // 服务器错误
      error.value = `Server Error: ${err.response?.data?.detail || err.message || 'Internal server error'}\n\nThe backend may have encountered an error. Please check the backend terminal for details.`
    } else {
      // 其他错误
      error.value = err.response?.data?.detail || err.message || 'Failed to load data preview'
    }
  } finally {
    loading.value = false
  }
}

const refreshPreview = () => {
  loadPreview()
}

const formatType = (type: string): string => {
  // Simplify type names
  const typeMap: Record<string, string> = {
    'int64': 'int',
    'float64': 'float',
    'object': 'str',
    'bool': 'bool',
    'datetime64[ns]': 'date'
  }
  return typeMap[type] || type
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined) {
    return 'null'
  }
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False'
  }
  return String(value)
}

const getCellClass = (value: any): string => {
  if (value === null || value === undefined) {
    return 'cell-null'
  }
  if (typeof value === 'number') {
    return 'cell-number'
  }
  if (typeof value === 'boolean') {
    return 'cell-boolean'
  }
  return 'cell-text'
}

// Auto-load on mount
loadPreview()

defineExpose({
  loadPreview,
  closePanel
})
</script>

<style scoped>
.data-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 400px;
  background: white;
  border-top: 2px solid #ddd;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.data-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.row-count {
  font-size: 13px;
  color: #666;
  background: #e9ecef;
  padding: 4px 8px;
  border-radius: 4px;
}

.header-right {
  display: flex;
  gap: 8px;
}

.btn-icon {
  background: transparent;
  border: none;
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 16px;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #e9ecef;
}

.data-panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-state,
.error-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state p {
  color: #e74c3c;
  margin-bottom: 16px;
}

.error-message {
  font-size: 14px;
  line-height: 1.5;
  max-width: 800px;
  word-wrap: break-word;
}

.error-details {
  margin: 16px 0;
  text-align: left;
  max-width: 800px;
}

.error-details details {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 12px;
}

.error-details summary {
  cursor: pointer;
  font-weight: 500;
  color: #495057;
  padding: 4px 0;
}

.error-details pre {
  margin-top: 8px;
  padding: 8px;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 11px;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}

.btn-secondary {
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary:hover {
  background: #5568d3;
}

.data-table-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.schema-info {
  padding: 8px 16px;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
}

.schema-info summary {
  cursor: pointer;
  font-weight: 500;
  color: #333;
  padding: 4px 0;
}

.schema-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
  margin-top: 8px;
  max-height: 100px;
  overflow-y: auto;
}

.schema-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background: white;
  border-radius: 4px;
  font-size: 12px;
}

.col-name {
  font-weight: 500;
  color: #333;
}

.col-type {
  color: #666;
  font-family: monospace;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table thead {
  position: sticky;
  top: 0;
  background: #f9f9f9;
  z-index: 10;
}

.data-table th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #ddd;
  white-space: nowrap;
}

.data-table th .type-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 6px;
  background: #e9ecef;
  color: #495057;
  border-radius: 3px;
  font-size: 10px;
  font-weight: normal;
  font-family: monospace;
}

.data-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-number {
  width: 50px;
  text-align: center;
  color: #999;
  font-size: 11px;
  background: #fafafa;
}

.cell-number {
  text-align: right;
  font-family: monospace;
  color: #2c3e50;
}

.cell-boolean {
  color: #8e44ad;
  font-weight: 500;
}

.cell-null {
  color: #95a5a6;
  font-style: italic;
}

.cell-text {
  color: #34495e;
}

.data-table tbody tr:hover {
  background: #f8f9fa;
}

.table-footer {
  padding: 8px 16px;
  border-top: 1px solid #eee;
  background: #f9f9f9;
  font-size: 12px;
  color: #666;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.warning-text {
  color: #f39c12;
}

.empty-state {
  color: #999;
}

.empty-state small {
  margin-top: 8px;
  font-size: 12px;
}
</style>
