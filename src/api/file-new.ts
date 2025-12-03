/**
 * 文件管理API
 * Day 4 - 文件上传系统前端
 */

import request from './request';

/**
 * 上传单个文件
 */
export function uploadFile(data: {
  file: File;
  projectId?: string;
  workflowId?: string;
  category?: string;
  description?: string;
}) {
  const formData = new FormData();
  formData.append('file', data.file);
  
  if (data.projectId) {
    formData.append('projectId', data.projectId);
  }
  if (data.workflowId) {
    formData.append('workflowId', data.workflowId);
  }
  if (data.category) {
    formData.append('category', data.category);
  }
  if (data.description) {
    formData.append('description', data.description);
  }

  return request({
    url: '/files/upload',
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

/**
 * 上传多个文件
 */
export function uploadMultipleFiles(data: {
  files: File[];
  projectId?: string;
  workflowId?: string;
  category?: string;
}) {
  const formData = new FormData();
  
  data.files.forEach(file => {
    formData.append('files', file);
  });
  
  if (data.projectId) {
    formData.append('projectId', data.projectId);
  }
  if (data.workflowId) {
    formData.append('workflowId', data.workflowId);
  }
  if (data.category) {
    formData.append('category', data.category);
  }

  return request({
    url: '/files/upload-multiple',
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

/**
 * 获取文件列表
 */
export function getFiles(params: {
  page?: number;
  limit?: number;
  projectId?: string;
  workflowId?: string;
  category?: string;
  mimeType?: string;
}) {
  return request({
    url: '/files',
    method: 'GET',
    params
  });
}

/**
 * 获取文件详情
 */
export function getFileDetail(id: string) {
  return request({
    url: `/files/${id}`,
    method: 'GET'
  });
}

/**
 * 下载文件
 */
export function downloadFile(id: string) {
  // 返回下载URL
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  return `${baseURL}/files/download/${id}`;
}

/**
 * 更新文件信息
 */
export function updateFile(id: string, data: {
  category?: string;
  description?: string;
}) {
  return request({
    url: `/files/${id}`,
    method: 'PUT',
    data
  });
}

/**
 * 删除文件
 */
export function deleteFile(id: string) {
  return request({
    url: `/files/${id}`,
    method: 'DELETE'
  });
}

/**
 * 获取文件统计
 */
export function getFileStats(userId?: string) {
  return request({
    url: '/files/stats/overview',
    method: 'GET',
    params: userId ? { userId } : undefined
  });
}
