/**
 * 工作流管理路由
 * 包含工作流CRUD、执行、模板等功能
 */

import { Router, Request, Response } from 'express';
import { WorkflowRepository } from '../repositories/WorkflowRepository';
import { ExecutionHistoryRepository } from '../repositories/ExecutionHistoryRepository';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/authMiddleware';
import { 
  requirePermission,
  requireOwnershipOrAdmin,
  requireProjectMember,
  Permission 
} from '../middleware/rbacMiddleware';

const router = Router();
const workflowRepo = new WorkflowRepository(prisma);
const executionRepo = new ExecutionHistoryRepository(prisma);

/**
 * GET /api/workflows
 * 获取工作流列表
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', projectId, category, isTemplate } = req.query;
    const userId = req.user!.id;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const where: any = {};

    // 按项目过滤
    if (projectId) {
      where.projectId = projectId as string;
    } else {
      // 如果没有指定项目，只显示用户可访问的
      where.OR = [
        { createdBy: userId },
        { isTemplate: true },
        { project: { ownerId: userId } },
        { project: { members: { some: { userId } } } }
      ];
    }

    // 按分类过滤
    if (category) {
      where.category = category as string;
    }

    // 是否模板
    if (isTemplate !== undefined) {
      where.isTemplate = isTemplate === 'true';
    }

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true
            }
          },
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true
            }
          },
          _count: {
            select: {
              executions: true
            }
          }
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.workflow.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        items: workflows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    console.error('Get workflows error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '获取工作流列表失败'
    });
  }
});

/**
 * POST /api/workflows
 * 创建工作流
 */
router.post('/',
  authenticate,
  requirePermission(Permission.WORKFLOW_CREATE),
  async (req: Request, res: Response) => {
    try {
      const { name, description, projectId, category, config, nodes, edges, isTemplate } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Missing required field',
          message: '工作流名称不能为空'
        });
        return;
      }

      // 如果指定了项目，验证用户是否有权限
      if (projectId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            members: {
              where: { userId: req.user!.id }
            }
          }
        });

        if (!project) {
          res.status(404).json({
            success: false,
            error: 'Project not found',
            message: '项目不存在'
          });
          return;
        }

        // 检查是否是所有者或成员
        const isMember = project.ownerId === req.user!.id || project.members.length > 0;
        if (!isMember) {
          res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: '您不是该项目的成员'
          });
          return;
        }
      }

      const workflow = await workflowRepo.create({
        name,
        description,
        projectId,
        category,
        config: config || {},
        nodes: nodes || [],
        edges: edges || [],
        isTemplate: isTemplate || false,
        createdBy: req.user!.id
      });

      res.status(201).json({
        success: true,
        data: workflow,
        message: '工作流创建成功'
      });
    } catch (error: any) {
      console.error('Create workflow error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '创建工作流失败'
      });
    }
  }
);

/**
 * GET /api/workflows/:id
 * 获取工作流详情
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            members: {
              select: {
                userId: true
              }
            }
          }
        },
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    if (!workflow) {
      res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: '工作流不存在'
      });
      return;
    }

    // 权限检查：模板公开，非模板需要权限
    if (!workflow.isTemplate) {
      const userId = req.user!.id;
      const hasAccess = workflow.createdBy === userId ||
        (workflow.project && (
          workflow.project.ownerId === userId ||
          workflow.project.members?.some((m: any) => m.userId === userId)
        ));

      if (!hasAccess && req.user!.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: '您没有权限访问此工作流'
        });
        return;
      }
    }

    // 获取最近执行记录
    const recentExecutions = await prisma.executionHistory.findMany({
      where: { workflowId: id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        taskId: true,
        status: true,
        startedAt: true,
        completedAt: true,
        finalOutput: true,
        duration: true
      }
    });

    res.json({
      success: true,
      data: {
        ...workflow,
        recentExecutions
      }
    });
  } catch (error: any) {
    console.error('Get workflow error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '获取工作流详情失败'
    });
  }
});

/**
 * PUT /api/workflows/:id
 * 更新工作流
 */
router.put('/:id',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, category, config, nodes, edges } = req.body;

      // 检查工作流是否存在及权限
      const existing = await prisma.workflow.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              ownerId: true
            }
          }
        }
      });
      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found',
          message: '工作流不存在'
        });
        return;
      }

      // 权限检查
      const userId = req.user!.id;
      const isOwner = existing.createdBy === userId;
      const isProjectOwner = existing.project?.ownerId === userId;
      const isAdmin = req.user!.role === 'admin';

      if (!isOwner && !isProjectOwner && !isAdmin) {
        res.status(404).json({
          success: false,
          error: 'Forbidden',
          message: '您没有权限修改此工作流'
        });
        return;
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (config !== undefined) updateData.config = config;
      if (nodes !== undefined) updateData.nodes = nodes;
      if (edges !== undefined) updateData.edges = edges;

      const workflow = await workflowRepo.update(id, updateData);

      res.json({
        success: true,
        data: workflow,
        message: '工作流更新成功'
      });
    } catch (error: any) {
      console.error('Update workflow error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '更新工作流失败'
      });
    }
  }
);

/**
 * DELETE /api/workflows/:id
 * 删除工作流（软删除）
 */
router.delete('/:id',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // 检查工作流是否存在及权限
      const existing = await prisma.workflow.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              ownerId: true
            }
          }
        }
      });
      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found',
          message: '工作流不存在'
        });
        return;
      }

      // 权限检查
      const userId = req.user!.id;
      const isOwner = existing.createdBy === userId;
      const isProjectOwner = existing.project?.ownerId === userId;
      const isAdmin = req.user!.role === 'admin';

      if (!isOwner && !isProjectOwner && !isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: '您没有权限删除此工作流'
        });
        return;
      }

      // 删除工作流
      await workflowRepo.delete(id);

      res.json({
        success: true,
        message: '工作流删除成功'
      });
    } catch (error: any) {
      console.error('Delete workflow error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '删除工作流失败'
      });
    }
  }
);

/**
 * GET /api/workflows/templates
 * 获取工作流模板列表
 */
router.get('/special/templates', authenticate, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', category } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const templates = await workflowRepo.listTemplates({
      page: pageNum,
      pageSize: limitNum
    } as any);

    const total = await prisma.workflow.count({
      where: {
        isTemplate: true,
        ...(category ? { category: category as string } : {})
      }
    });

    res.json({
      success: true,
      data: {
        items: templates.data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '获取模板列表失败'
    });
  }
});

/**
 * POST /api/workflows/:id/clone
 * 克隆工作流
 */
router.post('/:id/clone',
  authenticate,
  requirePermission(Permission.WORKFLOW_CREATE),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, projectId } = req.body;

      const original = await workflowRepo.findById(id);
      if (!original) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found',
          message: '原工作流不存在'
        });
        return;
      }

      // 克隆工作流
      const cloned = await workflowRepo.create({
        name: name || `${original.name} (副本)`,
        description: original.description ?? undefined,
        projectId: projectId ?? original.projectId ?? undefined,
        category: original.category ?? undefined,
        nodes: original.nodes,
        edges: original.edges,
        isTemplate: false,
        createdBy: req.user!.id
      });

      res.status(201).json({
        success: true,
        data: cloned,
        message: '工作流克隆成功'
      });
    } catch (error: any) {
      console.error('Clone workflow error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '克隆工作流失败'
      });
    }
  }
);

/**
 * GET /api/workflows/:id/executions
 * 获取工作流执行历史
 */
router.get('/:id/executions', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '20', status } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const where: any = { workflowId: id };
    if (status) {
      where.status = status as string;
    }

    const [executions, total] = await Promise.all([
      prisma.executionHistory.findMany({
        where,
        include: {
          executor: {
            select: {
              id: true,
              username: true,
              displayName: true
            }
          }
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.executionHistory.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        items: executions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    console.error('Get executions error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '获取执行历史失败'
    });
  }
});

/**
 * GET /api/workflows/:id/stats
 * 获取工作流统计
 */
router.get('/:id/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stats = await executionRepo.getStatsByWorkflow(id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Get workflow stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '获取工作流统计失败'
    });
  }
});

export default router;
