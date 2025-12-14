import { request } from './request';
import type { DataHandle } from '@/types/graph-protocol';

// 任务状态枚举
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

// 任务提交响应
export interface TaskSubmitResponse {
  taskId: string;
  status: TaskStatus;
  queuePosition?: number;
}

// 任务状态响应
export interface TaskStatusResponse {
  taskId: string;
  status: TaskStatus;
  progress?: number; // 0-100
  result?: DataHandle; // 只有 completed 才有
  error?: string;      // 只有 failed 才有
}

// 引擎 API 封装
export const engineApi = {
  /**
   * 提交节点执行任务
   */
  submitTask: (nodeId: string, nodeType: string, config: any, inputs: Record<string, any>) => {
    return request<TaskSubmitResponse>({
      url: '/api/engine/dispatch',
      method: 'POST',
      data: {
        nodeId,
        type: nodeType,
        config,
        inputs
      }
    });
  },

  /**
   * 查询任务状态
   */
  getTaskStatus: (taskId: string) => {
    return request<TaskStatusResponse>({
      url: `/api/engine/tasks/${taskId}`,
      method: 'GET'
    });
  }
};
