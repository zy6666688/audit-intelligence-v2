/**
 * 未保存更改检测和提示系统
 */
import { ref, onBeforeUnmount } from 'vue';

export interface UnsavedNode {
  id: string;
  title: string;
  lastModified: number;
}

export function useUnsavedChanges() {
  const hasUnsavedChanges = ref(false);
  const unsavedNodes = ref<UnsavedNode[]>([]);
  const lastSaveTime = ref<number>(Date.now());

  // 标记节点已修改
  const markNodeAsModified = (nodeId: string, title: string) => {
    const existing = unsavedNodes.value.find(n => n.id === nodeId);
    if (existing) {
      existing.lastModified = Date.now();
    } else {
      unsavedNodes.value.push({
        id: nodeId,
        title: title || '未命名节点',
        lastModified: Date.now()
      });
    }
    hasUnsavedChanges.value = true;
  };

  // 清除未保存标记
  const clearUnsavedChanges = () => {
    unsavedNodes.value = [];
    hasUnsavedChanges.value = false;
    lastSaveTime.value = Date.now();
  };

  // 移除特定节点的未保存标记
  const removeUnsavedNode = (nodeId: string) => {
    unsavedNodes.value = unsavedNodes.value.filter(n => n.id !== nodeId);
    if (unsavedNodes.value.length === 0) {
      hasUnsavedChanges.value = false;
    }
  };

  // 获取未保存时长（分钟）
  const getUnsavedDuration = (nodeId: string): number => {
    const node = unsavedNodes.value.find(n => n.id === nodeId);
    if (!node) return 0;
    return Math.floor((Date.now() - node.lastModified) / 1000 / 60);
  };

  // 显示强提示对话框
  const showStrongWarning = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const nodeList = unsavedNodes.value
        .map((n, i) => `${i + 1}. ${n.title}`)
        .join('\n');

      uni.showModal({
        title: '⚠️ 有未保存的更改',
        content: `以下节点已修改但未保存：\n\n${nodeList}\n\n是否现在保存？`,
        confirmText: '立即保存',
        cancelText: '稍后保存',
        confirmColor: '#f56c6c',
        success: (res) => {
          resolve(res.confirm);
        }
      });
    });
  };

  // 页面卸载前检查
  onBeforeUnmount(() => {
    if (hasUnsavedChanges.value && unsavedNodes.value.length > 0) {
      // 保存到localStorage以便下次恢复
      try {
        localStorage.setItem('unsaved_nodes', JSON.stringify(unsavedNodes.value));
      } catch (error) {
        console.error('保存未保存节点信息失败:', error);
      }
    }
  });

  // 从localStorage恢复未保存节点
  const restoreUnsavedNodes = (): UnsavedNode[] => {
    try {
      const saved = localStorage.getItem('unsaved_nodes');
      if (saved) {
        const nodes = JSON.parse(saved);
        unsavedNodes.value = nodes;
        hasUnsavedChanges.value = nodes.length > 0;
        return nodes;
      }
    } catch (error) {
      console.error('恢复未保存节点信息失败:', error);
    }
    return [];
  };

  // 清除localStorage中的未保存信息
  const clearStoredUnsavedNodes = () => {
    try {
      localStorage.removeItem('unsaved_nodes');
    } catch (error) {
      console.error('清除未保存节点信息失败:', error);
    }
  };

  return {
    hasUnsavedChanges,
    unsavedNodes,
    lastSaveTime,
    markNodeAsModified,
    clearUnsavedChanges,
    removeUnsavedNode,
    getUnsavedDuration,
    showStrongWarning,
    restoreUnsavedNodes,
    clearStoredUnsavedNodes
  };
}
