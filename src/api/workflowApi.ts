/**
 * 工作流API封装 (ComfyUI风格)
 */

import { request } from './request';

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: any[];
  connections: any[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowListItem {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NodeLibrary {
  [category: string]: {
    type: string;
    name: string;
    icon: string;
    description: string;
    version: string;
    tags: string[];
  }[];
}

/**
 * 工作流管理 API
 */
export const workflowApi = {
  /**
   * 保存工作流
   */
  saveWorkflow(data: {
    name: string;
    description?: string;
    nodes: any[];
    connections: any[];
  }) {
    return request<Workflow>({
      url: '/api/workflows',
      method: 'POST',
      data
    });
  },

  /**
   * 获取工作流列表
   */
  getWorkflowList() {
    return request<{
      data: WorkflowListItem[];
      count: number;
    }>({
      url: '/api/workflows',
      method: 'GET'
    });
  },

  /**
   * 获取工作流详情
   */
  getWorkflow(workflowId: string) {
    return request<Workflow>({
      url: `/api/workflows/${workflowId}`,
      method: 'GET'
    });
  },

  /**
   * 删除工作流
   */
  deleteWorkflow(workflowId: string) {
    return request<void>({
      url: `/api/workflows/${workflowId}`,
      method: 'DELETE'
    });
  },

  /**
   * 获取节点库（按分类）
   */
  getNodeLibrary() {
    return request<{
      data: NodeLibrary;
      totalNodes: number;
    }>({
      url: '/api/node-library',
      method: 'GET'
    });
  },

  /**
   * 取消任务
   */
  cancelTask(taskId: string) {
    return request<{
      taskId: string;
      status: string;
    }>({
      url: `/api/engine/tasks/${taskId}/cancel`,
      method: 'POST'
    });
  }
};

export default workflowApi;
