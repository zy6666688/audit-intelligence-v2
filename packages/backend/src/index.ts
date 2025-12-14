/**
 * Backend服务入口
 * Week 1 Day 2
 */

import express from 'express';
import cors from 'cors';
import { nodeRegistry, ExecutionError } from './services/NodeRegistryV2';
import { allNodes } from './nodes';
import type { ExecutionContext } from '@audit/shared';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import workflowRoutes from './routes/workflowRoutes';
import auditLogRoutes from './routes/auditLogRoutes';
import fileRoutes from './routes/fileRoutes';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// 注册所有节点（包括业务节点）
console.log('🔧 Registering all nodes...');
nodeRegistry.registerAll(allNodes);
console.log(`✅ Registered ${nodeRegistry.list().length} nodes\n`);

// ==========================================
// API路由
// ==========================================

/**
 * 根路径 - API文档
 */
app.get('/', (req, res) => {
  const nodes = nodeRegistry.list();
  res.json({
    name: '审计数智析 - 后端API',
    version: '0.1.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh',
        me: 'GET /api/auth/me',
        changePassword: 'POST /api/auth/change-password',
        check: 'GET /api/auth/check'
      },
      projects: {
        list: 'GET /api/projects',
        create: 'POST /api/projects',
        detail: 'GET /api/projects/:id',
        update: 'PUT /api/projects/:id',
        delete: 'DELETE /api/projects/:id',
        members: {
          add: 'POST /api/projects/:id/members',
          update: 'PUT /api/projects/:id/members/:userId',
          remove: 'DELETE /api/projects/:id/members/:userId'
        },
        workflows: 'GET /api/projects/:id/workflows',
        stats: 'GET /api/projects/:id/stats'
      },
      workflows: {
        list: 'GET /api/workflows',
        create: 'POST /api/workflows',
        detail: 'GET /api/workflows/:id',
        update: 'PUT /api/workflows/:id',
        delete: 'DELETE /api/workflows/:id',
        templates: 'GET /api/workflows/special/templates',
        clone: 'POST /api/workflows/:id/clone',
        executions: 'GET /api/workflows/:id/executions',
        stats: 'GET /api/workflows/:id/stats'
      },
      auditLogs: {
        list: 'GET /api/audit-logs',
        detail: 'GET /api/audit-logs/:id',
        stats: 'GET /api/audit-logs/stats/summary',
        resource: 'GET /api/audit-logs/resource/:resourceType/:resourceId'
      },
      files: {
        upload: 'POST /api/files/upload',
        uploadMultiple: 'POST /api/files/upload-multiple',
        list: 'GET /api/files',
        detail: 'GET /api/files/:id',
        download: 'GET /api/files/download/:id',
        update: 'PATCH /api/files/:id',
        delete: 'DELETE /api/files/:id',
        stats: 'GET /api/files/stats/overview'
      },
      nodes: {
        list: 'GET /api/nodes',
        detail: 'GET /api/nodes/:nodeType',
        execute: 'POST /api/nodes/:nodeType/execute',
        test: 'POST /api/nodes/:nodeType/test'
      },
      engine: {
        dispatch: 'POST /api/engine/dispatch',
        taskStatus: 'GET /api/engine/tasks/:taskId',
        cancelTask: 'POST /api/engine/tasks/:taskId/cancel'
      },
      execution: {
        execute: 'POST /api/execute/workflow/:id',
        history: 'GET /api/execute/history'
      },
      nodeLibrary: 'GET /api/node-library'
    },
    features: {
      authentication: 'JWT',
      authorization: 'RBAC',
      roles: ['admin', 'auditor', 'user']
    },
    statistics: {
      registeredNodes: nodes.length,
      nodeTypes: [...new Set(nodes.map(n => n.split('.')[0]))].length
    }
  });
});

/**
 * 健康检查（增强版）
 */
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
    },
    tasks: {
      active: tasks.size,
      stats: taskStats
    },
    nodes: {
      registered: nodeRegistry.list().length
    }
  });
});

/**
 * 获取所有节点清单 - 支持语言切换
 */
app.get('/api/nodes', (req, res) => {
  try {
    const lang = (req.query.lang as string) || 'zh';
    const manifests = nodeRegistry.listManifests();
    
    // 辅助函数：获取本地化文本
    const getLocalizedText = (text: any) => {
      if (typeof text === 'string') return text;
      return text?.[lang] || text?.zh || text?.en || '';
    };
    
    // 格式化为指定语言
    const localizedManifests = manifests.map(manifest => ({
      ...manifest,
      label: getLocalizedText(manifest.label),
      description: getLocalizedText(manifest.description)
    }));
    
    res.json({
      success: true,
      data: localizedManifests,
      lang: lang,
      count: localizedManifests.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个节点清单
 */
app.get('/api/nodes/:nodeType', (req, res) => {
  try {
    const { nodeType } = req.params;
    const manifest = nodeRegistry.getManifest(nodeType);
    res.json({
      success: true,
      data: manifest
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 执行节点
 */
app.post('/api/nodes/:nodeType/execute', async (req, res) => {
  try {
    const { nodeType } = req.params;
    const { inputs, config = {} } = req.body;
    
    if (!inputs) {
      return res.status(400).json({
        success: false,
        error: 'Inputs are required'
      });
    }
    
    // 创建执行上下文
    const context: ExecutionContext = {
      executionId: `exec-${Date.now()}`,
      nodeId: `node-${Date.now()}`,
      graphId: 'test-graph',
      userId: 'test-user',
      logger: console
    };
    
    // 执行节点
    const result = await nodeRegistry.execute(nodeType, inputs, config, context);
    
    res.json({
      success: result.success,
      data: result.outputs,
      metadata: {
        duration: result.duration,
        cached: result.cached,
        ...result.metadata
      },
      error: result.error
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.details
    });
  }
});

/**
 * 测试节点示例
 */
app.post('/api/nodes/:nodeType/test', async (req, res) => {
  try {
    const { nodeType } = req.params;
    
    const result = await nodeRegistry.validateExamples(nodeType);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// Engine API - 用于 FlowEngine 远程执行
// ==========================================

// 任务存储 (内存模拟，生产环境应使用Redis)
const tasks = new Map<string, {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  nodeId: string;
  nodeType: string;
  startTime: number;
  endTime?: number;
}>();

// 任务统计
const taskStats = {
  total: 0,
  completed: 0,
  failed: 0,
  pending: 0,
  running: 0
};

// 任务清理配置
const TASK_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟
const TASK_MAX_AGE = 10 * 60 * 1000; // 10分钟

// 定期清理已完成的任务
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [taskId, task] of tasks.entries()) {
    if ((task.status === 'completed' || task.status === 'failed') && 
        task.endTime && 
        (now - task.endTime > TASK_MAX_AGE)) {
      tasks.delete(taskId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} old tasks (total: ${tasks.size})`);
  }
}, TASK_CLEANUP_INTERVAL);

/**
 * 提交节点执行任务
 */
app.post('/api/engine/dispatch', async (req, res) => {
  try {
    const { nodeId, type: nodeType, config = {}, inputs } = req.body;
    
    if (!nodeId || !nodeType || !inputs) {
      return res.status(400).json({
        code: 400,
        message: 'Missing required fields: nodeId, type, inputs'
      });
    }
    
    // 生成任务ID
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建任务记录
    tasks.set(taskId, {
      taskId,
      status: 'pending',
      progress: 0,
      nodeId,
      nodeType,
      startTime: Date.now()
    });
    
    // 更新统计
    taskStats.total++;
    taskStats.pending++;
    
    // 异步执行任务
    (async () => {
      const task = tasks.get(taskId)!;
      task.status = 'running';
      task.progress = 10;
      
      try {
        // 创建执行上下文
        const context: ExecutionContext = {
          executionId: taskId,
          nodeId,
          graphId: req.body.graphId || 'default',
          userId: req.body.userId || 'system',
          logger: console
        };
        
        task.progress = 30;
        
        // 执行节点
        const result = await nodeRegistry.execute(nodeType, inputs, config, context);
        
        task.progress = 90;
        
        if (result.success) {
          task.status = 'completed';
          task.progress = 100;
          task.result = result.outputs;
          task.endTime = Date.now();
          
          // 更新统计
          taskStats.pending--;
          taskStats.completed++;
          
          const duration = task.endTime - task.startTime;
          console.log(`✓ Task ${taskId} completed in ${duration}ms`);
        } else {
          task.status = 'failed';
          task.endTime = Date.now();
          
          // 处理 ExecutionError 类型
          if (result.error instanceof ExecutionError) {
            task.error = `${result.error.message} (${result.error.code})`;
          } else if (typeof result.error === 'string') {
            task.error = result.error;
          } else {
            task.error = 'Execution failed';
          }
          
          // 更新统计
          taskStats.pending--;
          taskStats.failed++;
          
          console.error(`✗ Task ${taskId} failed: ${task.error}`);
        }
      } catch (error: any) {
        task.status = 'failed';
        task.error = error.message || 'Unknown error';
        task.endTime = Date.now();
        
        // 更新统计
        taskStats.pending--;
        taskStats.failed++;
        
        console.error(`✗ Task ${taskId} exception:`, error);
      }
    })();
    
    // 立即返回任务ID
    res.json({
      code: 200,
      data: {
        taskId,
        status: 'pending',
        queuePosition: tasks.size
      },
      message: 'Task submitted successfully'
    });
    
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

/**
 * 查询任务状态
 */
app.get('/api/engine/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const task = tasks.get(taskId);
    
    if (!task) {
      return res.status(404).json({
        code: 404,
        message: 'Task not found'
      });
    }
    
    const response: any = {
      code: 200,
      data: {
        taskId: task.taskId,
        status: task.status,
        progress: task.progress
      },
      message: 'ok'
    };
    
    if (task.status === 'completed' && task.result) {
      response.data.result = task.result;
    }
    
    if (task.status === 'failed' && task.error) {
      response.data.error = task.error;
    }
    
    res.json(response);
    
    // 注意：任务清理由定时器统一处理
    
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

// ==========================================
// 执行工作流 API (新增)
// ==========================================

/**
 * 执行工作流
 */
app.post('/api/execute/workflow/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { inputs = {}, config = {} } = req.body;
    
    // 获取工作流
    const workflow = workflows.get(id);
    if (!workflow) {
      return res.status(404).json({
        code: 404,
        message: 'Workflow not found'
      });
    }
    
    // 创建执行任务
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 构建工作流图结构
    const graph: any = {
      nodes: {},
      connections: workflow.connections || []
    };
    
    // 转换节点格式
    workflow.nodes.forEach((node: any) => {
      graph.nodes[node.id] = {
        type: node.type,
        config: node.data?.config || {},
        inputs: node.data?.inputs || {}
      };
    });
    
    // 创建任务对象（扩展类型以支持工作流信息）
    const task: any = {
      taskId,
      nodeId: 'workflow',
      nodeType: 'workflow',
      graph,
      status: 'pending' as const,
      progress: 0,
      startTime: Date.now(),
      nodeResults: {},
      workflowId: id,
      workflowName: workflow.name
    };
    
    tasks.set(taskId, task);
    taskStats.total++;
    taskStats.pending++;
    
    // 异步执行（简化版：顺序执行所有节点）
    (async () => {
      try {
        task.status = 'running';
        const nodeResults: any = {};
        
        // 顺序执行每个节点
        for (let i = 0; i < workflow.nodes.length; i++) {
          const node = workflow.nodes[i];
          const progress = Math.round(((i + 1) / workflow.nodes.length) * 100);
          task.progress = progress;
          
          const context: ExecutionContext = {
            executionId: taskId,
            nodeId: node.id,
            graphId: id,
            userId: 'system',
            logger: console
          };
          
          // 执行节点
          const result = await nodeRegistry.execute(
            node.type,
            node.data?.inputs || {},
            node.data?.config || {},
            context
          );
          
          nodeResults[node.id] = result;
          task.nodeResults = nodeResults;
        }
        
        // 执行成功
        task.status = 'completed';
        task.result = nodeResults;
        task.endTime = Date.now();
        task.progress = 100;
        taskStats.pending--;
        taskStats.completed++;
        console.log(`✅ Workflow ${workflow.name} completed (${taskId})`);
        
      } catch (error: any) {
        task.status = 'failed';
        task.error = error.message;
        task.endTime = Date.now();
        taskStats.pending--;
        taskStats.failed++;
        console.error(`❌ Workflow ${workflow.name} failed (${taskId}):`, error.message);
      }
    })();
    
    console.log(`🚀 Workflow ${workflow.name} started (${taskId})`);
    
    res.json({
      code: 200,
      data: {
        taskId,
        status: 'pending',
        workflowId: id,
        workflowName: workflow.name
      },
      message: 'Workflow execution started'
    });
    
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

/**
 * 获取执行历史
 */
app.get('/api/execute/history', (req, res) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;
    
    // 获取所有任务
    let taskList = Array.from(tasks.values());
    
    // 按状态过滤
    if (status) {
      taskList = taskList.filter(task => task.status === status);
    }
    
    // 按时间排序（最新的在前）
    taskList.sort((a, b) => b.startTime - a.startTime);
    
    // 分页
    const total = taskList.length;
    const start = Number(offset);
    const end = start + Number(limit);
    const paginatedList = taskList.slice(start, end);
    
    // 格式化输出
    const history = paginatedList.map((task: any) => ({
      taskId: task.taskId,
      workflowId: task.workflowId || null,
      workflowName: task.workflowName || task.nodeType || 'Unknown',
      status: task.status,
      progress: task.progress,
      startTime: task.startTime,
      endTime: task.endTime || null,
      duration: task.endTime ? task.endTime - task.startTime : null,
      error: task.error || null,
      hasResult: !!task.result
    }));
    
    res.json({
      code: 200,
      data: history,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: end < total
      }
    });
    
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

// ==========================================
// 启动服务器
// ==========================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 Backend server started');
  console.log(`📍 URL: http://0.0.0.0:${PORT}`);
  console.log(`📊 Registered nodes: ${nodeRegistry.list().length}`);
  console.log('\n📚 API Endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /api/nodes');
  console.log('  GET  /api/nodes/:nodeType');
  console.log('  POST /api/nodes/:nodeType/execute');
  console.log('  POST /api/nodes/:nodeType/test');
  console.log('\n🔧 Engine API (Remote Execution):');
  console.log('  POST /api/engine/dispatch');
  console.log('  GET  /api/engine/tasks/:taskId');
  console.log('  POST /api/engine/tasks/:taskId/cancel');
  console.log('\n📁 Workflow API (ComfyUI Style):');
  console.log('  GET  /api/workflows');
  console.log('  POST /api/workflows');
  console.log('  GET  /api/workflows/:id');
  console.log('  DELETE /api/workflows/:id');
  console.log('\n📚 Node Library:');
  console.log('  GET  /api/node-library');
  console.log('\n⚡ Execution API (新增):');
  console.log('  POST /api/execute/workflow/:id');
  console.log('  GET  /api/execute/history');
  console.log('');
});

// 取消任务
app.post('/api/engine/tasks/:taskId/cancel', (req, res) => {
  try {
    const { taskId } = req.params;
    const task = tasks.get(taskId);
    
    if (!task) {
      return res.status(404).json({
        code: 404,
        message: 'Task not found'
      });
    }
    
    if (task.status === 'completed' || task.status === 'failed') {
      return res.json({
        code: 200,
        message: 'Task already finished',
        data: { status: task.status }
      });
    }
    
    // 更新统计（在修改状态之前）
    const wasPending = task.status === 'pending';
    
    // 标记为已取消（通过设置为failed状态）
    task.status = 'failed';
    task.error = 'Task cancelled by user';
    task.endTime = Date.now();
    
    if (wasPending) {
      taskStats.pending--;
    }
    taskStats.failed++;
    
    console.log(`🛑 Task ${taskId} cancelled`);
    
    res.json({
      code: 200,
      message: 'Task cancelled successfully',
      data: { taskId, status: 'cancelled' }
    });
    
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

// ==========================================
// 工作流管理 API (ComfyUI 风格)
// ==========================================

// 工作流存储（内存，生产环境应使用数据库）
const workflows = new Map<string, any>();

/**
 * 保存工作流
 */
app.post('/api/workflows', (req, res) => {
  try {
    const { name, description, nodes, connections } = req.body;
    
    if (!name || !nodes) {
      return res.status(400).json({
        code: 400,
        message: 'Name and nodes are required'
      });
    }
    
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const workflow = {
      id: workflowId,
      name,
      description: description || '',
      nodes,
      connections: connections || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    workflows.set(workflowId, workflow);
    
    console.log(`💾 Workflow saved: ${name} (${workflowId})`);
    
    res.json({
      code: 200,
      data: workflow,
      message: 'Workflow saved successfully'
    });
    
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

/**
 * 获取工作流列表
 */
app.get('/api/workflows', (req, res) => {
  try {
    const workflowList = Array.from(workflows.values()).map(wf => ({
      id: wf.id,
      name: wf.name,
      description: wf.description,
      nodeCount: wf.nodes.length,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt
    }));
    
    res.json({
      code: 200,
      data: workflowList,
      count: workflowList.length
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

/**
 * 获取工作流详情
 */
app.get('/api/workflows/:workflowId', (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflow = workflows.get(workflowId);
    
    if (!workflow) {
      return res.status(404).json({
        code: 404,
        message: 'Workflow not found'
      });
    }
    
    res.json({
      code: 200,
      data: workflow
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

/**
 * 删除工作流
 */
app.delete('/api/workflows/:workflowId', (req, res) => {
  try {
    const { workflowId } = req.params;
    
    if (!workflows.has(workflowId)) {
      return res.status(404).json({
        code: 404,
        message: 'Workflow not found'
      });
    }
    
    workflows.delete(workflowId);
    console.log(`🗑️  Workflow deleted: ${workflowId}`);
    
    res.json({
      code: 200,
      message: 'Workflow deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

/**
 * 认证相关路由
 */
app.use('/api/auth', authRoutes);

/**
 * 项目管理路由
 */
app.use('/api/projects', projectRoutes);

/**
 * 工作流管理路由
 */
app.use('/api/workflows', workflowRoutes);

/**
 * 审计日志路由
 */
app.use('/api/audit-logs', auditLogRoutes);

/**
 * 文件管理路由
 */
app.use('/api/files', fileRoutes);

/**
 * 获取节点库（按分类）- 支持语言切换
 */
app.get('/api/node-library', (req, res) => {
  const lang = (req.query.lang as string) || 'zh';
  const manifests = nodeRegistry.listManifests();
  
  // 按分类组织节点
  const categories: Record<string, any[]> = {};
  
  // 辅助函数：获取本地化文本
  const getLocalizedText = (text: any) => {
    if (typeof text === 'string') return text;
    return text?.[lang] || text?.zh || text?.en || '';
  };
  
  manifests.forEach(manifest => {
    const category = manifest.category || 'other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push({
      type: manifest.type,
      name: getLocalizedText(manifest.label),
      icon: manifest.icon || '📦',
      description: getLocalizedText(manifest.description),
      version: manifest.version,
      tags: manifest.metadata?.tags || []
    });
  });
  
  res.json({
    code: 200,
    data: categories,
    totalNodes: manifests.length,
    lang: lang
  });
});

// 全局错误处理中间件（放在所有路由之后）
app.use((err: any, req: any, res: any, next: any) => {
  console.error('🚨 Unhandled error:', err);
  res.status(500).json({
    code: 500,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: `Route not found: ${req.method} ${req.path}`
  });
});

// 优雅退出
process.on('SIGTERM', () => {
  console.log('👋 Server shutting down...');
  console.log(`Final stats: ${JSON.stringify(taskStats)}`);
  process.exit(0);
});

// 未捕获异常处理
process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});
