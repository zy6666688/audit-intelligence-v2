/**
 * 项目管理路由
 * 包含项目CRUD、成员管理、工作流关联等功能
 */

import { Router, Request, Response } from 'express';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { WorkflowRepository } from '../repositories/WorkflowRepository';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/authMiddleware';
import { 
  requirePermission, 
  requireOwnershipOrAdmin,
  requireProjectMember,
  Permission 
} from '../middleware/rbacMiddleware';

const router = Router();
const projectRepo = new ProjectRepository(prisma);
const workflowRepo = new WorkflowRepository(prisma);

/**
 * GET /api/projects
 * 获取项目列表
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const userId = req.user!.id;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // 获取用户的项目（作为所有者或成员）
    const projects = await projectRepo.listByUser(userId, {
      page: pageNum,
      pageSize: limitNum,
      search: search as string
    } as any);

    // 获取总数
    const total = await prisma.project.count({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ],
        ...(search ? {
          OR: [
            { name: { contains: search as string, mode: 'insensitive' } },
            { description: { contains: search as string, mode: 'insensitive' } }
          ]
        } : {})
      }
    });

    res.json({
      success: true,
      data: {
        items: projects,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '获取项目列表失败'
    });
  }
});

/**
 * POST /api/projects
 * 创建项目
 */
router.post('/', 
  authenticate,
  requirePermission(Permission.PROJECT_CREATE),
  async (req: Request, res: Response) => {
    try {
      const { name, description, auditType, clientName, auditPeriod, startDate, endDate } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Missing required field',
          message: '项目名称不能为空'
        });
        return;
      }

      const project = await projectRepo.create({
        name,
        description,
        ownerId: req.user!.id,
        auditType,
        clientName,
        auditPeriod,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });

      res.status(201).json({
        success: true,
        data: project,
        message: '项目创建成功'
      });
    } catch (error: any) {
      console.error('Create project error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '创建项目失败'
      });
    }
  }
);

/**
 * GET /api/projects/:id
 * 获取项目详情
 */
router.get('/:id',
  authenticate,
  requireProjectMember(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const project = await projectRepo.findById(id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
          message: '项目不存在'
        });
        return;
      }

      // 获取项目成员
      const members = await prisma.projectMember.findMany({
        where: { projectId: id },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              displayName: true,
              role: true
            }
          }
        }
      });

      // 获取项目工作流数量
      const workflowCount = await prisma.workflow.count({
        where: { projectId: id }
      });

      res.json({
        success: true,
        data: {
          ...project,
          members,
          workflowCount
        }
      });
    } catch (error: any) {
      console.error('Get project error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '获取项目详情失败'
      });
    }
  }
);

/**
 * PUT /api/projects/:id
 * 更新项目
 */
router.put('/:id',
  authenticate,
  requireOwnershipOrAdmin('project'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, auditType, clientName, auditPeriod, startDate, endDate, status } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (auditType !== undefined) updateData.auditType = auditType;
      if (clientName !== undefined) updateData.clientName = clientName;
      if (auditPeriod !== undefined) updateData.auditPeriod = auditPeriod;
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = new Date(endDate);
      if (status !== undefined) updateData.status = status;

      const project = await projectRepo.update(id, updateData);

      res.json({
        success: true,
        data: project,
        message: '项目更新成功'
      });
    } catch (error: any) {
      console.error('Update project error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '更新项目失败'
      });
    }
  }
);

/**
 * DELETE /api/projects/:id
 * 删除项目（软删除）
 */
router.delete('/:id',
  authenticate,
  requireOwnershipOrAdmin('project'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // 软删除：设置状态为deleted
      await projectRepo.update(id, { status: 'deleted' });

      res.json({
        success: true,
        message: '项目删除成功'
      });
    } catch (error: any) {
      console.error('Delete project error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '删除项目失败'
      });
    }
  }
);

/**
 * POST /api/projects/:id/members
 * 添加项目成员
 */
router.post('/:id/members',
  authenticate,
  requireOwnershipOrAdmin('project'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId, role = 'viewer' } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'Missing required field',
          message: '用户ID不能为空'
        });
        return;
      }

      // 验证用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          message: '用户不存在'
        });
        return;
      }

      const member = await projectRepo.addMember(id, userId, role);

      res.status(201).json({
        success: true,
        data: member,
        message: '成员添加成功'
      });
    } catch (error: any) {
      console.error('Add member error:', error);
      
      if (error.code === 'P2002') {
        res.status(400).json({
          success: false,
          error: 'Member already exists',
          message: '该用户已是项目成员'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: error.message,
        message: '添加成员失败'
      });
    }
  }
);

/**
 * PUT /api/projects/:id/members/:userId
 * 更新成员角色
 */
router.put('/:id/members/:userId',
  authenticate,
  requireOwnershipOrAdmin('project'),
  async (req: Request, res: Response) => {
    try {
      const { id, userId } = req.params;
      const { role } = req.body;

      if (!role) {
        res.status(400).json({
          success: false,
          error: 'Missing required field',
          message: '角色不能为空'
        });
        return;
      }

      const member = await projectRepo.updateMemberRole(id, userId, role);

      res.json({
        success: true,
        data: member,
        message: '成员角色更新成功'
      });
    } catch (error: any) {
      console.error('Update member role error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '更新成员角色失败'
      });
    }
  }
);

/**
 * DELETE /api/projects/:id/members/:userId
 * 移除项目成员
 */
router.delete('/:id/members/:userId',
  authenticate,
  requireOwnershipOrAdmin('project'),
  async (req: Request, res: Response) => {
    try {
      const { id, userId } = req.params;

      // 不允许移除项目所有者
      const project = await projectRepo.findById(id);
      if (project?.ownerId === userId) {
        res.status(400).json({
          success: false,
          error: 'Cannot remove owner',
          message: '不能移除项目所有者'
        });
        return;
      }

      await projectRepo.removeMember(id, userId);

      res.json({
        success: true,
        message: '成员移除成功'
      });
    } catch (error: any) {
      console.error('Remove member error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '移除成员失败'
      });
    }
  }
);

/**
 * GET /api/projects/:id/workflows
 * 获取项目的工作流列表
 */
router.get('/:id/workflows',
  authenticate,
  requireProjectMember(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { page = '1', limit = '20' } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const workflows = await workflowRepo.listByProject(id, {
        page: pageNum,
        pageSize: limitNum
      });

      const total = await prisma.workflow.count({
        where: { projectId: id }
      });

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
      console.error('Get project workflows error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '获取项目工作流失败'
      });
    }
  }
);

/**
 * GET /api/projects/:id/stats
 * 获取项目统计信息
 */
router.get('/:id/stats',
  authenticate,
  requireProjectMember(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // 获取工作流统计
      const workflowStats = await prisma.workflow.groupBy({
        by: ['category'],
        where: { projectId: id },
        _count: true
      });

      // 获取执行统计
      const executionStats = await prisma.executionHistory.groupBy({
        by: ['status'],
        where: {
          workflow: { projectId: id }
        },
        _count: true
      });

      // 获取成员数量
      const memberCount = await prisma.projectMember.count({
        where: { projectId: id }
      });

      res.json({
        success: true,
        data: {
          workflows: workflowStats.reduce((acc: Record<string, number>, item: any) => {
            acc[item.status] = item._count;
            return acc;
          }, {} as Record<string, number>),
          executions: executionStats.reduce((acc: Record<string, number>, item: any) => {
            acc[item.status] = item._count;
            return acc;
          }, {} as Record<string, number>),
          memberCount
        }
      });
    } catch (error: any) {
      console.error('Get project stats error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '获取项目统计失败'
      });
    }
  }
);

export default router;
