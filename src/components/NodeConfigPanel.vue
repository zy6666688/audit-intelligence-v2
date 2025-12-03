<template>
  <view class="node-config-panel">
    <view class="panel-header">
      <text class="panel-title">节点配置</text>
      <button class="btn-close" @click="close" size="mini">✕</button>
    </view>

    <scroll-view class="panel-content" scroll-y>
      <!-- 基础信息 -->
      <view class="config-section">
        <text class="section-title">基础信息</text>
        
        <view class="form-item">
          <text class="form-label">节点名称</text>
          <input 
            v-model="localNode.label" 
            class="form-input"
            placeholder="请输入节点名称"
            @blur="updateNode"
          />
        </view>

        <view class="form-item">
          <text class="form-label">节点描述</text>
          <textarea 
            v-model="localNode.description" 
            class="form-textarea"
            placeholder="请输入节点描述"
            :maxlength="200"
            @blur="updateNode"
          />
        </view>

        <view class="form-item">
          <text class="form-label">节点类型</text>
          <view class="form-value">{{ getNodeTypeName(localNode.type) }}</view>
        </view>
      </view>

      <!-- 数据输入节点配置 -->
      <view class="config-section" v-if="localNode.type === 'data_input'">
        <text class="section-title">数据源配置</text>
        
        <view class="form-item">
          <text class="form-label">数据源类型</text>
          <picker 
            :range="dataSourceTypes" 
            range-key="label"
            :value="dataSourceTypeIndex"
            @change="onDataSourceTypeChange"
          >
            <view class="form-picker">
              {{ dataSourceTypes[dataSourceTypeIndex]?.label || '请选择' }}
            </view>
          </picker>
        </view>

        <view class="form-item" v-if="localNode.config?.dataSourceType === 'file'">
          <text class="form-label">文件路径</text>
          <view class="file-input">
            <input 
              v-model="localNode.config.filePath" 
              class="form-input"
              placeholder="选择文件"
              disabled
            />
            <button class="btn-select" @click="selectFile" size="mini">选择</button>
          </view>
        </view>

        <view class="form-item" v-if="localNode.config?.dataSourceType === 'database'">
          <text class="form-label">数据库连接</text>
          <input 
            v-model="localNode.config.dbConnection" 
            class="form-input"
            placeholder="输入数据库连接字符串"
            @blur="updateNode"
          />
        </view>

        <view class="form-item" v-if="localNode.config?.dataSourceType === 'api'">
          <text class="form-label">API地址</text>
          <input 
            v-model="localNode.config.apiUrl" 
            class="form-input"
            placeholder="输入API地址"
            @blur="updateNode"
          />
        </view>
      </view>

      <!-- 数据筛选节点配置 -->
      <view class="config-section" v-if="localNode.type === 'data_filter'">
        <text class="section-title">筛选条件</text>
        
        <view class="form-item">
          <text class="form-label">筛选字段</text>
          <input 
            v-model="localNode.config.filterField" 
            class="form-input"
            placeholder="输入字段名"
            @blur="updateNode"
          />
        </view>

        <view class="form-item">
          <text class="form-label">条件类型</text>
          <picker 
            :range="filterOperators" 
            range-key="label"
            :value="filterOperatorIndex"
            @change="onFilterOperatorChange"
          >
            <view class="form-picker">
              {{ filterOperators[filterOperatorIndex]?.label || '请选择' }}
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">筛选值</text>
          <input 
            v-model="localNode.config.filterValue" 
            class="form-input"
            placeholder="输入筛选值"
            @blur="updateNode"
          />
        </view>
      </view>

      <!-- AI分析节点配置 -->
      <view class="config-section" v-if="localNode.type?.startsWith('ai_')">
        <text class="section-title">AI配置</text>
        
        <view class="form-item">
          <text class="form-label">AI模型</text>
          <picker 
            :range="aiModels" 
            range-key="label"
            :value="aiModelIndex"
            @change="onAiModelChange"
          >
            <view class="form-picker">
              {{ aiModels[aiModelIndex]?.label || '请选择' }}
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">置信度阈值</text>
          <slider 
            :value="localNode.config?.confidenceThreshold || 0.7" 
            @change="onConfidenceChange"
            min="0" 
            max="1" 
            step="0.1"
            show-value
          />
        </view>

        <view class="form-item">
          <text class="form-label">最大结果数</text>
          <input 
            v-model.number="localNode.config.maxResults" 
            class="form-input"
            type="number"
            placeholder="输入最大结果数"
            @blur="updateNode"
          />
        </view>
      </view>

      <!-- 报告生成节点配置 -->
      <view class="config-section" v-if="localNode.type === 'report_generator'">
        <text class="section-title">报告配置</text>
        
        <view class="form-item">
          <text class="form-label">报告模板</text>
          <picker 
            :range="reportTemplates" 
            range-key="label"
            :value="reportTemplateIndex"
            @change="onReportTemplateChange"
          >
            <view class="form-picker">
              {{ reportTemplates[reportTemplateIndex]?.label || '请选择' }}
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">报告格式</text>
          <picker 
            :range="reportFormats" 
            range-key="label"
            :value="reportFormatIndex"
            @change="onReportFormatChange"
          >
            <view class="form-picker">
              {{ reportFormats[reportFormatIndex]?.label || '请选择' }}
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">包含图表</text>
          <switch 
            :checked="localNode.config?.includeCharts || false" 
            @change="onIncludeChartsChange"
          />
        </view>
      </view>

      <!-- 高级选项 -->
      <view class="config-section">
        <text class="section-title">高级选项</text>
        
        <view class="form-item">
          <text class="form-label">超时时间(秒)</text>
          <input 
            v-model.number="localNode.config.timeout" 
            class="form-input"
            type="number"
            placeholder="默认30秒"
            @blur="updateNode"
          />
        </view>

        <view class="form-item">
          <text class="form-label">重试次数</text>
          <input 
            v-model.number="localNode.config.retryCount" 
            class="form-input"
            type="number"
            placeholder="默认0次"
            @blur="updateNode"
          />
        </view>

        <view class="form-item">
          <text class="form-label">错误处理</text>
          <picker 
            :range="errorHandlers" 
            range-key="label"
            :value="errorHandlerIndex"
            @change="onErrorHandlerChange"
          >
            <view class="form-picker">
              {{ errorHandlers[errorHandlerIndex]?.label || '请选择' }}
            </view>
          </picker>
        </view>
      </view>
    </scroll-view>

    <view class="panel-footer">
      <button class="btn-cancel" @click="close" size="mini">取消</button>
      <button class="btn-save" @click="save" size="mini">保存</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Props {
  node: any;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update', node: any): void;
  (e: 'close'): void;
}>();

// 本地节点数据
const localNode = ref<any>({ ...props.node, config: { ...props.node.config } });

// 监听props变化
watch(() => props.node, (newNode) => {
  localNode.value = { ...newNode, config: { ...newNode.config } };
}, { deep: true });

// 配置选项
const dataSourceTypes = [
  { value: 'file', label: '文件' },
  { value: 'database', label: '数据库' },
  { value: 'api', label: 'API接口' },
  { value: 'manual', label: '手动输入' }
];

const filterOperators = [
  { value: 'equals', label: '等于' },
  { value: 'not_equals', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'greater_than', label: '大于' },
  { value: 'less_than', label: '小于' },
  { value: 'between', label: '介于' }
];

const aiModels = [
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5', label: 'GPT-3.5' },
  { value: 'claude', label: 'Claude' },
  { value: 'custom', label: '自定义模型' }
];

const reportTemplates = [
  { value: 'standard', label: '标准报告' },
  { value: 'detailed', label: '详细报告' },
  { value: 'summary', label: '摘要报告' },
  { value: 'custom', label: '自定义模板' }
];

const reportFormats = [
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
  { value: 'html', label: 'HTML' }
];

const errorHandlers = [
  { value: 'stop', label: '停止执行' },
  { value: 'skip', label: '跳过节点' },
  { value: 'retry', label: '自动重试' },
  { value: 'fallback', label: '使用备用值' }
];

// 计算索引
const dataSourceTypeIndex = computed(() => {
  return dataSourceTypes.findIndex(t => t.value === localNode.value.config?.dataSourceType) || 0;
});

const filterOperatorIndex = computed(() => {
  return filterOperators.findIndex(o => o.value === localNode.value.config?.filterOperator) || 0;
});

const aiModelIndex = computed(() => {
  return aiModels.findIndex(m => m.value === localNode.value.config?.aiModel) || 0;
});

const reportTemplateIndex = computed(() => {
  return reportTemplates.findIndex(t => t.value === localNode.value.config?.reportTemplate) || 0;
});

const reportFormatIndex = computed(() => {
  return reportFormats.findIndex(f => f.value === localNode.value.config?.reportFormat) || 0;
});

const errorHandlerIndex = computed(() => {
  return errorHandlers.findIndex(h => h.value === localNode.value.config?.errorHandler) || 0;
});

// 事件处理
function onDataSourceTypeChange(e: any) {
  if (!localNode.value.config) localNode.value.config = {};
  localNode.value.config.dataSourceType = dataSourceTypes[e.detail.value].value;
  updateNode();
}

function onFilterOperatorChange(e: any) {
  if (!localNode.value.config) localNode.value.config = {};
  localNode.value.config.filterOperator = filterOperators[e.detail.value].value;
  updateNode();
}

function onAiModelChange(e: any) {
  if (!localNode.value.config) localNode.value.config = {};
  localNode.value.config.aiModel = aiModels[e.detail.value].value;
  updateNode();
}

function onReportTemplateChange(e: any) {
  if (!localNode.value.config) localNode.value.config = {};
  localNode.value.config.reportTemplate = reportTemplates[e.detail.value].value;
  updateNode();
}

function onReportFormatChange(e: any) {
  if (!localNode.value.config) localNode.value.config = {};
  localNode.value.config.reportFormat = reportFormats[e.detail.value].value;
  updateNode();
}

function onErrorHandlerChange(e: any) {
  if (!localNode.value.config) localNode.value.config = {};
  localNode.value.config.errorHandler = errorHandlers[e.detail.value].value;
  updateNode();
}

function onConfidenceChange(e: any) {
  if (!localNode.value.config) localNode.value.config = {};
  localNode.value.config.confidenceThreshold = e.detail.value;
  updateNode();
}

function onIncludeChartsChange(e: any) {
  if (!localNode.value.config) localNode.value.config = {};
  localNode.value.config.includeCharts = e.detail.value;
  updateNode();
}

function selectFile() {
  uni.chooseFile({
    count: 1,
    success: (res: any) => {
      if (!localNode.value.config) localNode.value.config = {};
      localNode.value.config.filePath = res.tempFiles[0].name;
      updateNode();
    }
  });
}

function updateNode() {
  emit('update', localNode.value);
}

function save() {
  emit('update', localNode.value);
  close();
}

function close() {
  emit('close');
}

function getNodeTypeName(type: string) {
  const typeNames: Record<string, string> = {
    data_input: '数据输入',
    data_transform: '数据转换',
    data_filter: '数据筛选',
    data_aggregate: '数据聚合',
    risk_assessment: '风险评估',
    compliance_check: '合规检查',
    anomaly_detection: '异常检测',
    trend_analysis: '趋势分析',
    ai_classification: 'AI分类',
    ai_prediction: 'AI预测',
    ai_sentiment: '情感分析',
    report_generator: '报告生成',
    data_export: '数据导出',
    notification: '通知'
  };
  return typeNames[type] || type;
}
</script>

<style scoped>
.node-config-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #e8e8e8;
}

.panel-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #999;
  padding: 0;
  width: 24px;
  height: 24px;
}

.panel-content {
  flex: 1;
  padding: 15px;
}

.config-section {
  margin-bottom: 20px;
}

.section-title {
  display: block;
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.form-item {
  margin-bottom: 15px;
}

.form-label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-input,
.form-textarea,
.form-picker {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}

.form-textarea {
  height: 80px;
  resize: vertical;
}

.form-picker {
  display: flex;
  align-items: center;
  min-height: 40px;
  color: #333;
}

.form-value {
  padding: 10px 12px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 13px;
  color: #666;
}

.file-input {
  display: flex;
  gap: 8px;
}

.btn-select {
  padding: 0 16px;
  background: #1890ff;
  color: #fff;
  border: none;
  border-radius: 6px;
  flex-shrink: 0;
}

.panel-footer {
  display: flex;
  gap: 10px;
  padding: 15px;
  border-top: 1px solid #e8e8e8;
}

.btn-cancel,
.btn-save {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
}

.btn-cancel {
  background: #fff;
  border: 1px solid #d9d9d9;
  color: #333;
}

.btn-save {
  background: #1890ff;
  color: #fff;
  border: none;
}
</style>
