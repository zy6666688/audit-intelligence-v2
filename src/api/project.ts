/**
 * 项目相关API
 */

import { get, post, put, del } from './request';

/**
 * 获取项目列表
 */
export function getProjectList(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
}) {
  return get('/projects', params);
}

/**
 * 获取项目详情
 */
export function getProjectDetail(id: string) {
  return get(`/projects/${id}`);
}

/**
 * 创建项目
 */
export function createProject(data: {
  name: string;
  client: string;
  type: string;
  description?: string;
}) {
  return post('/projects', data);
}

/**
 * 更新项目
 */
export function updateProject(id: string, data: any) {
  return put(`/projects/${id}`, data);
}

/**
 * 删除项目
 */
export function deleteProject(id: string) {
  return del(`/projects/${id}`);
}

/**
 * 获取项目成员
 */
export function getProjectMembers(projectId: string) {
  return get(`/projects/${projectId}/members`);
}

/**
 * 添加项目成员
 */
export function addProjectMember(projectId: string, data: {
  userId: string;
  role: string;
}) {
  return post(`/projects/${projectId}/members`, data);
}
