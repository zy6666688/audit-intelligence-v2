/**
 * ExecutionStore - 执行状态管理
 * Week 2 Day 1
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { NodeId } from '@audit/shared';

/**
 * 节点执行状态
 */
export enum NodeExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  ERROR = 'error',
  SKIPPED = 'skipped'
}

/**
 * 节点执行状态信息
 */
export interface NodeExecutionState {
  nodeId: NodeId;
  status: NodeExecutionStatus;
  startTime?: number;
  endTime?: number;
  duration?: number;
  error?: string;
  output?: any;
}

/**
 * 执行日志
 */
export interface ExecutionLog {
  id: string;
  timestamp: number;
  nodeId?: NodeId;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export const useExecutionStore = defineStore('execution', () => {
  // ========== State ==========
  
  /** 是否正在执行 */
  const isExecuting = ref(false);
  
  /** 执行ID */
  const executionId = ref<string | null>(null);
  
  /** 节点状态映射 */
  const nodeStates = ref<Map<NodeId, NodeExecutionState>>(new Map());
  
  /** 执行顺序 */
  const executionOrder = ref<NodeId[]>([]);
  
  /** 当前执行到的节点索引 */
  const currentIndex = ref(0);
  
  /** 执行日志 */
  const logs = ref<ExecutionLog[]>([]);
  
  /** 开始时间 */
  const startTime = ref<number | null>(null);
  
  /** 结束时间 */
  const endTime = ref<number | null>(null);
  
  /** 是否暂停 */
  const isPaused = ref(false);
  
  // ========== Computed ==========
  
  /** 总节点数 */
  const totalNodes = computed(() => executionOrder.value.length);
  
  /** 已完成节点数 */
  const completedNodes = computed(() => {
    return Array.from(nodeStates.value.values()).filter(
      state => state.status === NodeExecutionStatus.SUCCESS || 
               state.status === NodeExecutionStatus.ERROR ||
               state.status === NodeExecutionStatus.SKIPPED
    ).length;
  });
  
  /** 执行进度 0-100 */
  const progress = computed(() => {
    if (totalNodes.value === 0) return 0;
    return Math.round((completedNodes.value / totalNodes.value) * 100);
  });
  
  /** 当前执行的节点ID */
  const currentNodeId = computed(() => {
    if (currentIndex.value >= 0 && currentIndex.value < executionOrder.value.length) {
      return executionOrder.value[currentIndex.value];
    }
    return null;
  });
  
  /** 执行持续时间（毫秒） */
  const duration = computed(() => {
    if (!startTime.value) return 0;
    const end = endTime.value || Date.now();
    return end - startTime.value;
  });
  
  /** 成功节点数 */
  const successCount = computed(() => {
    return Array.from(nodeStates.value.values()).filter(
      state => state.status === NodeExecutionStatus.SUCCESS
    ).length;
  });
  
  /** 失败节点数 */
  const errorCount = computed(() => {
    return Array.from(nodeStates.value.values()).filter(
      state => state.status === NodeExecutionStatus.ERROR
    ).length;
  });
  
  /** 是否执行成功（所有节点都成功） */
  const isSuccess = computed(() => {
    return !isExecuting.value && 
           errorCount.value === 0 && 
           completedNodes.value === totalNodes.value &&
           totalNodes.value > 0;
  });
  
  /** 是否执行失败（有节点失败） */
  const isError = computed(() => {
    return !isExecuting.value && errorCount.value > 0;
  });
  
  // ========== Actions ==========
  
  /**
   * 开始执行
   */
  function startExecution(order: NodeId[]) {
    isExecuting.value = true;
    executionId.value = `exec_${Date.now()}`;
    executionOrder.value = order;
    currentIndex.value = 0;
    nodeStates.value.clear();
    logs.value = [];
    startTime.value = Date.now();
    endTime.value = null;
    isPaused.value = false;
    
    // 初始化所有节点状态为PENDING
    for (const nodeId of order) {
      nodeStates.value.set(nodeId, {
        nodeId,
        status: NodeExecutionStatus.PENDING
      });
    }
    
    addLog('info', '执行开始', undefined);
  }
  
  /**
   * 更新节点状态
   */
  function updateNodeState(nodeId: NodeId, state: Partial<NodeExecutionState>) {
    const existing = nodeStates.value.get(nodeId) || { nodeId, status: NodeExecutionStatus.PENDING };
    nodeStates.value.set(nodeId, {
      ...existing,
      ...state,
      nodeId
    });
    
    // 如果状态变为RUNNING，更新当前索引
    if (state.status === NodeExecutionStatus.RUNNING) {
      const index = executionOrder.value.indexOf(nodeId);
      if (index !== -1) {
        currentIndex.value = index;
      }
      addLog('info', `节点开始执行: ${nodeId}`, nodeId);
    }
    
    // 如果状态变为SUCCESS
    if (state.status === NodeExecutionStatus.SUCCESS) {
      addLog('info', `节点执行成功: ${nodeId}`, nodeId);
    }
    
    // 如果状态变为ERROR
    if (state.status === NodeExecutionStatus.ERROR) {
      addLog('error', `节点执行失败: ${state.error || '未知错误'}`, nodeId);
    }
  }
  
  /**
   * 完成执行
   */
  function finishExecution(success: boolean) {
    isExecuting.value = false;
    endTime.value = Date.now();
    currentIndex.value = executionOrder.value.length;
    
    if (success) {
      addLog('info', `执行完成 - 成功: ${successCount.value}/${totalNodes.value}`, undefined);
    } else {
      addLog('error', `执行失败 - 成功: ${successCount.value}, 失败: ${errorCount.value}`, undefined);
    }
  }
  
  /**
   * 暂停执行
   */
  function pauseExecution() {
    isPaused.value = true;
    addLog('warn', '执行已暂停', undefined);
  }
  
  /**
   * 恢复执行
   */
  function resumeExecution() {
    isPaused.value = false;
    addLog('info', '执行已恢复', undefined);
  }
  
  /**
   * 停止执行
   */
  function stopExecution() {
    isExecuting.value = false;
    isPaused.value = false;
    endTime.value = Date.now();
    addLog('warn', '执行已停止', undefined);
  }
  
  /**
   * 添加日志
   */
  function addLog(level: 'info' | 'warn' | 'error', message: string, nodeId?: NodeId) {
    const log: ExecutionLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      nodeId,
      level,
      message
    };
    logs.value.push(log);
    
    // 限制日志数量（最多保留1000条）
    if (logs.value.length > 1000) {
      logs.value.shift();
    }
  }
  
  /**
   * 清空日志
   */
  function clearLogs() {
    logs.value = [];
  }
  
  /**
   * 重置所有状态
   */
  function reset() {
    isExecuting.value = false;
    executionId.value = null;
    nodeStates.value.clear();
    executionOrder.value = [];
    currentIndex.value = 0;
    logs.value = [];
    startTime.value = null;
    endTime.value = null;
    isPaused.value = false;
  }
  
  /**
   * 获取节点状态
   */
  function getNodeState(nodeId: NodeId): NodeExecutionState | undefined {
    return nodeStates.value.get(nodeId);
  }
  
  return {
    // State
    isExecuting,
    executionId,
    nodeStates,
    executionOrder,
    currentIndex,
    logs,
    startTime,
    endTime,
    isPaused,
    
    // Computed
    totalNodes,
    completedNodes,
    progress,
    currentNodeId,
    duration,
    successCount,
    errorCount,
    isSuccess,
    isError,
    
    // Actions
    startExecution,
    updateNodeState,
    finishExecution,
    pauseExecution,
    resumeExecution,
    stopExecution,
    addLog,
    clearLogs,
    reset,
    getNodeState
  };
});
