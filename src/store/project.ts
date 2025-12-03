/**
 * 项目状态管理
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as projectApi from '@/api/project';

export const useProjectStore = defineStore('project', () => {
  // 状态
  const projects = ref<any[]>([]);
  const currentProject = ref<any>(null);
  const loading = ref(false);

  // 获取项目列表
  async function fetchProjects(params?: any) {
    try {
      loading.value = true;
      const data = await projectApi.getProjectList(params) as any;
      projects.value = data.list || data;
      return data;
    } catch (error) {
      console.error('获取项目列表失败:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  // 获取项目详情
  async function fetchProjectDetail(id: string) {
    try {
      loading.value = true;
      const data = await projectApi.getProjectDetail(id);
      currentProject.value = data;
      return data;
    } catch (error) {
      console.error('获取项目详情失败:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  // 创建项目
  async function createProject(data: any) {
    try {
      loading.value = true;
      const result = await projectApi.createProject(data);
      
      // 添加到列表
      if (result) {
        projects.value.unshift(result);
      }
      
      return result;
    } catch (error) {
      console.error('创建项目失败:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  // 更新项目
  async function updateProject(id: string, data: any) {
    try {
      loading.value = true;
      const result = await projectApi.updateProject(id, data);
      
      // 更新列表中的项目
      const index = projects.value.findIndex(p => p.id === id);
      if (index !== -1 && result) {
        projects.value[index] = { ...projects.value[index], ...(result as any) };
      }
      
      // 更新当前项目
      if (currentProject.value?.id === id && result) {
        currentProject.value = { ...currentProject.value, ...(result as any) };
      }
      
      return result;
    } catch (error) {
      console.error('更新项目失败:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  // 删除项目
  async function deleteProject(id: string) {
    try {
      loading.value = true;
      await projectApi.deleteProject(id);
      
      // 从列表中移除
      const index = projects.value.findIndex(p => p.id === id);
      if (index !== -1) {
        projects.value.splice(index, 1);
      }
      
      // 清空当前项目
      if (currentProject.value?.id === id) {
        currentProject.value = null;
      }
    } catch (error) {
      console.error('删除项目失败:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  // 清空状态
  function reset() {
    projects.value = [];
    currentProject.value = null;
  }

  return {
    // 状态
    projects,
    currentProject,
    loading,

    // 方法
    fetchProjects,
    fetchProjectDetail,
    createProject,
    updateProject,
    deleteProject,
    reset
  };
});
