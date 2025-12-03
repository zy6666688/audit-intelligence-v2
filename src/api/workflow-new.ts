/**
 * 工作流管理API
 * 对接后端 /api/workflows 路由
 */

import { get, post, put, del } from './request';

/**
 * 工作流接口定义
 */
export interface Workflow {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  category?: string;
  config?: any;
  nodes: any;
  edges: any;
  viewport?: any;
  status: string;
  isTemplate: boolean;
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  executionCount?: number;
}

/**
 * 执行历史接口
 */
export interface ExecutionHistory {
  id: string;
  taskId: string;
  workflowId: string;
  userId: string;
  status: string;
  startTime: string;
  endTime?: string;
  result?: any;
}

/**
 * 获取工作流列表
 */
export function getWorkflows(params?: {
  page?: number;
  limit?: number;
  projectId?: string;
  category?: string;
  status?: string;
  isTemplate?: boolean;
  search?: string;
}) {
  return get<{ items: Workflow[]; pagination: any }>('/workflows', params);
}

/**
 * 创建工作流
 */
export function createWorkflow(data: {
  name: string;
  description?: string;
  projectId?: string;
  category?: string;
  config?: any;
  nodes: any;
  edges: any;
  viewport?: any;
  isTemplate?: boolean;
}) {
  return post<Workflow>('/workflows', data);
}

/**
 * 获取工作流详情
 */
export function getWorkflowDetail(id: string) {
  return get<Workflow & { recentExecutions: ExecutionHistory[] }>(`/workflows/${id}`);
}

/**
 * 更新工作流
 */
export function updateWorkflow(id: string, data: {
  name?: string;
  description?: string;
  category?: string;
  config?: any;
  nodes?: any;
  edges?: any;
  status?: string;
}) {
  return put<Workflow>(`/workflows/${id}`, data);
}

/**
 * 删除工作流
 */
export function deleteWorkflow(id: string) {
  return del(`/workflows/${id}`);
}

/**
 * 获取工作流模板列表
 */
export function getWorkflowTemplates(params?: { page?: number; limit?: number; category?: string }) {
  return get<{ items: Workflow[]; pagination: any }>('/workflows/special/templates', params);
}

/**
 * 克隆工作流
 */
export function cloneWorkflow(id: string, data: { name?: string; projectId?: string }) {
  return post<Workflow>(`/workflows/${id}/clone`, data);
}

/**
 * 获取工作流执行历史
 */
export function getWorkflowExecutions(id: string, params?: { page?: number; limit?: number; status?: string }) {
  return get<{ items: ExecutionHistory[]; pagination: any }>(`/workflows/${id}/executions`, params);
}

/**
 * 获取工作流统计
 */
export function getWorkflowStats(id: string) {
  return get<any>(`/workflows/${id}/stats`);
}

/**
 * 执行工作流
 */
export function executeWorkflow(id: string, data?: any) {
  return post<{ taskId: string; status: string }>(`/workflows/${id}/execute`, data || {});
}
