/**
 * 键盘快捷键Composable
 * Week 5
 */

import { onMounted, onUnmounted } from 'vue';

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description?: string;
}

export function useKeyboard(bindings: KeyBinding[]) {
  const handleKeyDown = (event: KeyboardEvent) => {
    for (const binding of bindings) {
      const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase();
      const ctrlMatch = binding.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
      const shiftMatch = binding.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = binding.alt ? event.altKey : !event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        binding.handler();
        break;
      }
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  return {
    bindings
  };
}

/**
 * 常用快捷键配置
 */
export function useGraphKeyboard(graphStore: any) {
  const bindings: KeyBinding[] = [
    {
      key: 'z',
      ctrl: true,
      handler: () => graphStore.undo(),
      description: '撤销'
    },
    {
      key: 'y',
      ctrl: true,
      handler: () => graphStore.redo(),
      description: '重做'
    },
    {
      key: 'a',
      ctrl: true,
      handler: () => graphStore.selectAll(),
      description: '全选'
    },
    {
      key: 'Delete',
      handler: () => {
        const selected = Array.from(graphStore.selectedNodes);
        selected.forEach((id: string) => graphStore.removeNode(id));
      },
      description: '删除选中'
    },
    {
      key: 'd',
      ctrl: true,
      handler: () => {
        // 复制选中节点
        const selected = Array.from(graphStore.selectedNodes);
        selected.forEach((id: string) => {
          const node = graphStore.nodes.get(id);
          if (node) {
            const newNode = {
              ...node,
              id: graphStore.generateId('node'),
              position: {
                x: node.position.x + 20,
                y: node.position.y + 20
              }
            };
            graphStore.addNode(newNode);
          }
        });
      },
      description: '复制节点'
    },
    {
      key: 's',
      ctrl: true,
      handler: () => {
        // TODO: 保存图
        console.log('保存图');
      },
      description: '保存'
    }
  ];

  useKeyboard(bindings);

  return {
    bindings
  };
}
