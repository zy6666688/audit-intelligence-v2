/**
 * 审计日志路由
 * 提供审计日志查询、统计等功能
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/authMiddleware';
import { requirePermission, Permission } from '../middleware/rbacMiddleware';

const router = Router();

/**
 * GET /api/audit-logs
 * 获取审计日志列表
 */
router.get('/',
  authenticate,
  requirePermission(Permission.AUDIT_LOG_READ),
  async (req: Request, res: Response) => {
    try {
      const {
        page = '1',
        limit = '50',
        action,
        resourceType,
        userId,
        startDate,
        endDate
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const where: any = {};

      // 按操作类型过滤
      if (action) {
        where.action = action as string;
      }

      // 按资源类型过滤
      if (resourceType) {
        where.resourceType = resourceType as string;
      }

      // 按用户过滤
      if (userId) {
        where.userId = userId as string;
      }

      // 按时间范围过滤
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate as string);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate as string);
        }
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                role: true
              }
            }
          },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.auditLog.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          items: logs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error: any) {
      console.error('Get audit logs error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '获取审计日志失败'
      });
    }
  }
);

/**
 * GET /api/audit-logs/:id
 * 获取审计日志详情
 */
router.get('/:id',
  authenticate,
  requirePermission(Permission.AUDIT_LOG_READ),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const log = await prisma.auditLog.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              email: true,
              role: true
            }
          }
        }
      });

      if (!log) {
        res.status(404).json({
          success: false,
          error: 'Audit log not found',
          message: '审计日志不存在'
        });
        return;
      }

      res.json({
        success: true,
        data: log
      });
    } catch (error: any) {
      console.error('Get audit log error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '获取审计日志详情失败'
      });
    }
  }
);

/**
 * GET /api/audit-logs/stats/summary
 * 获取审计日志统计摘要
 */
router.get('/stats/summary',
  authenticate,
  requirePermission(Permission.AUDIT_LOG_READ),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      const where: any = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate as string);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate as string);
        }
      }

      // 按操作类型统计
      const actionStats = await prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
        orderBy: { _count: { action: 'desc' } }
      });

      // 按资源类型统计
      const resourceStats = await prisma.auditLog.groupBy({
        by: ['resourceType'],
        where,
        _count: true,
        orderBy: { _count: { resourceType: 'desc' } }
      });

      // 按用户统计（Top 10）
      const userStats = await prisma.auditLog.groupBy({
        by: ['userId'],
        where,
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 10
      });

      // 获取用户信息
      const userIds = userStats.map((s: any) => s.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          displayName: true
        }
      });

      const userStatsWithInfo = userStats.map((s: any) => {
        const user = users.find((u: any) => u.id === s.userId);
        return {
          user,
          count: s._count
        };
      });

      // 总数
      const total = await prisma.auditLog.count({ where });

      res.json({
        success: true,
        data: {
          total,
          actionStats: actionStats.map((s: any) => ({
            action: s.action,
            count: s._count
          })),
          resourceStats: resourceStats.map((s: any) => ({
            resourceType: s.resourceType,
            count: s._count
          })),
          userStats: userStatsWithInfo
        }
      });
    } catch (error: any) {
      console.error('Get audit log stats error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '获取审计日志统计失败'
      });
    }
  }
);

/**
 * GET /api/audit-logs/resource/:resourceType/:resourceId
 * 获取特定资源的审计日志
 */
router.get('/resource/:resourceType/:resourceId',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { resourceType, resourceId } = req.params;
      const { page = '1', limit = '20' } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: {
            resourceType,
            resourceId
          },
          include: {
            user: {
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
        prisma.auditLog.count({
          where: {
            resourceType,
            resourceId
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          items: logs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error: any) {
      console.error('Get resource audit logs error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '获取资源审计日志失败'
      });
    }
  }
);

export default router;
