import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlowEngine } from '@/utils/flowEngine';
import type { NodeInstance, EdgeBinding } from '@audit/shared';
import { engineApi } from '@/api/engineApi';

// 真实模拟后端行为的状态机
const mockBackendState = {
  tasks: new Map<string, { status: string, result?: any, createdAt: number }>()
};

// 拦截 engineApi
vi.mock('@/api/engineApi', () => ({
  engineApi: {
    submitTask: vi.fn().mockImplementation(async (nodeId, type, config, inputs) => {
      const taskId = `task_${Date.now()}_${nodeId}`;
      console.log(`[MockBackend] Received task: ${taskId} (${type})`);
      
      mockBackendState.tasks.set(taskId, { status: 'running', createdAt: Date.now() });
      
      // 模拟异步处理：100ms 后完成
      setTimeout(() => {
        const result = { 
          refId: `ref_result_${nodeId}`, 
          meta: { 
            source: 'MockBackend',
            processed: true,
            rowCount: 500 
          } 
        };
        mockBackendState.tasks.set(taskId, { status: 'completed', result, createdAt: Date.now() });
        console.log(`[MockBackend] Task completed: ${taskId}`);
      }, 100);

      return { taskId, status: 'running' };
    }),

    getTaskStatus: vi.fn().mockImplementation(async (taskId) => {
      const task = mockBackendState.tasks.get(taskId);
      if (!task) throw new Error('Task not found');
      return { taskId, status: task.status, result: task.result, progress: task.status === 'completed' ? 100 : 50 };
    })
  }
}));

vi.mock('@/utils/nodeRegistry', () => ({
  getNodeDefinition: (type: string) => {
    if (type === 'fund_loop_detect') return { executionMode: 'remote' };
    return { executionMode: 'local' };
  }
}));

describe('End-to-End Flow Integration (Mock Backend)', () => {
  beforeEach(() => {
    mockBackendState.tasks.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should dispatch remote node to backend and poll for result', async () => {
    const nodes: NodeInstance[] = [
      { 
        id: 'node_remote', 
        type: 'fund_loop_detect', 
        config: {},
        position: { x: 0, y: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    const connections: EdgeBinding[] = [];

    // 配置引擎为 Remote 模式
    // 注意：FlowEngine 内部混合了 local/remote 逻辑，如果 node 定义强制 remote，
    // FlowEngine 需要正确识别。目前 FlowEngine 构造函数接受全局 config.mode。
    // 为了测试"逐步绞杀"，我们假设整个引擎运行在 Remote 模式下
    const engine = new FlowEngine(nodes, connections, { 
      mode: 'remote', 
      pollInterval: 50 // 加快轮询
    });

    // 启动执行
    const executionPromise = engine.execute();

    // 推进时间以触发 setTimeout 和轮询
    // 1. 提交任务
    await vi.advanceTimersByTimeAsync(10); 
    // 2. 后端处理 (100ms) + 轮询 (50ms * N)
    await vi.advanceTimersByTimeAsync(200);

    const result = await executionPromise;

    expect(result.success).toBe(true);
    const output = result.outputs['node_remote'];
    
    // 验证结果来自 MockBackend
    expect(output).toBeDefined();
    expect(output.refId).toBe('ref_result_node_remote');
    expect(output.meta.source).toBe('MockBackend');
    expect(engineApi.submitTask).toHaveBeenCalled();
    expect(engineApi.getTaskStatus).toHaveBeenCalled();
  });
});
