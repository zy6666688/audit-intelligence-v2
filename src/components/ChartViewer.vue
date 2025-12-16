<template>
  <div class="chart-viewer">
    <div v-if="error" class="error-message">
      <span class="error-icon">⚠️</span>
      <span>{{ error }}</span>
    </div>
    <v-chart
      v-else-if="chartOption"
      :option="chartOption"
      :autoresize="true"
      class="chart"
      :style="{ height: height, width: width }"
    />
    <div v-else class="loading-message">
      <span>Loading chart...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  LineChart,
  BarChart,
  PieChart,
  ScatterChart
} from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent
} from 'echarts/components'
import VChart from 'vue-echarts'

// Register ECharts components
use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent
])

// Props
interface Props {
  optionJson?: string  // ECharts option as JSON string
  height?: string
  width?: string
}

const props = withDefaults(defineProps<Props>(), {
  optionJson: '',
  height: '400px',
  width: '100%'
})

// State
const error = ref<string>('')
const chartOption = computed(() => {
  if (!props.optionJson) {
    return null
  }
  
  try {
    const option = JSON.parse(props.optionJson)
    error.value = ''
    return option
  } catch (e) {
    error.value = `Failed to parse chart option: ${e instanceof Error ? e.message : String(e)}`
    return null
  }
})

// Watch for option changes
watch(() => props.optionJson, (newVal) => {
  if (newVal) {
    console.log('ChartViewer: Option updated', newVal.substring(0, 100) + '...')
  }
})
</script>

<style scoped>
.chart-viewer {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 16px;
}

.chart {
  width: 100%;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c33;
  font-size: 14px;
}

.error-icon {
  font-size: 20px;
}

.loading-message {
  padding: 32px;
  color: #999;
  font-size: 14px;
}
</style>
