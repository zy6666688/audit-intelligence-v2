/**
 * 项目管理API
 * 对接后端 /api/projects 路由
 */

import { get, post, put, del } from './request';

/**
 * 项目接口定义
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    username: string;
    displayName?: string;
  };
  _count?: {
    workflows: number;
    members: number;
  };
}

export interface ProjectMember {
  userId: string;
  role: string;
  user: {
    id: string;
    username: string;
    email: string;
    displayName?: string;
  };
}

/**
 * 获取项目列表
 */
export function getProjects(params?: { page?: number; limit?: number; search?: string }) {
  return get<{ items: Project[]; pagination: any }>('/projects', params);
}

/**
 * 创建项目
 */
export function createProject(data: { name: string; description?: string }) {
  return post<Project>('/projects', data);
}

/**
 * 获取项目详情
 */
export function getProjectDetail(id: string) {
  return get<Project>(`/projects/${id}`);
}

/**
 * 更新项目
 */
export function updateProject(id: string, data: { name?: string; description?: string; status?: string }) {
  return put<Project>(`/projects/${id}`, data);
}

/**
 * 删除项目
 */
export function deleteProject(id: string) {
  return del(`/projects/${id}`);
}

/**
 * 添加项目成员
 */
export function addProjectMember(projectId: string, data: { userId: string; role: string }) {
  return post<ProjectMember>(`/projects/${projectId}/members`, data);
}

/**
 * 更新成员角色
 */
export function updateMemberRole(projectId: string, userId: string, data: { role: string }) {
  return put<ProjectMember>(`/projects/${projectId}/members/${userId}`, data);
}

/**
 * 移除项目成员
 */
export function removeMember(projectId: string, userId: string) {
  return del(`/projects/${projectId}/members/${userId}`);
}

/**
 * 获取项目工作流列表
 */
export function getProjectWorkflows(projectId: string, params?: { page?: number; limit?: number }) {
  return get<{ items: any[]; pagination: any }>(`/projects/${projectId}/workflows`, params);
}

/**
 * 获取项目统计
 */
export function getProjectStats(projectId: string) {
  return get<{ workflows: any; executions: any; memberCount: number }>(`/projects/${projectId}/stats`);
}
