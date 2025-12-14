/**
 * RBAC (Role-Based Access Control) 权限控制中间件
 * 基于用户角色和资源权限进行访问控制
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';

/**
 * 角色定义
 */
export enum Role {
  ADMIN = 'admin',      // 系统管理员
  AUDITOR = 'auditor',  // 审计员
  USER = 'user'         // 普通用户
}

/**
 * 权限定义
 */
export enum Permission {
  // 用户管理
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_MANAGE = 'user:manage',
  
  // 项目管理
  PROJECT_CREATE = 'project:create',
  PROJECT_READ = 'project:read',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  PROJECT_MANAGE = 'project:manage',
  
  // 工作流管理
  WORKFLOW_CREATE = 'workflow:create',
  WORKFLOW_READ = 'workflow:read',
  WORKFLOW_UPDATE = 'workflow:update',
  WORKFLOW_DELETE = 'workflow:delete',
  WORKFLOW_EXECUTE = 'workflow:execute',
  
  // 审计日志
  AUDIT_LOG_READ = 'audit_log:read',
  AUDIT_LOG_MANAGE = 'audit_log:manage',
  
  // 文件管理
  FILE_CREATE = 'file:create',
  FILE_READ = 'file:read',
  FILE_UPDATE = 'file:update',
  FILE_DELETE = 'file:delete',
  
  // 系统配置
  SYSTEM_MANAGE = 'system:manage'
}

/**
 * 角色权限映射
 */
const rolePermissions: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    // 管理员拥有所有权限
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.USER_MANAGE,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.PROJECT_MANAGE,
    Permission.WORKFLOW_CREATE,
    Permission.WORKFLOW_READ,
    Permission.WORKFLOW_UPDATE,
    Permission.WORKFLOW_DELETE,
    Permission.WORKFLOW_EXECUTE,
    Permission.AUDIT_LOG_READ,
    Permission.AUDIT_LOG_MANAGE,
    Permission.SYSTEM_MANAGE
  ],
  
  [Role.AUDITOR]: [
    // 审计员权限
    Permission.USER_READ,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_MANAGE,
    Permission.WORKFLOW_CREATE,
    Permission.WORKFLOW_READ,
    Permission.WORKFLOW_UPDATE,
    Permission.WORKFLOW_DELETE,
    Permission.WORKFLOW_EXECUTE,
    Permission.AUDIT_LOG_READ
  ],
  
  [Role.USER]: [
    // 普通用户权限
    Permission.USER_READ,
    Permission.PROJECT_READ,
    Permission.WORKFLOW_READ,
    Permission.WORKFLOW_EXECUTE
  ]
};

/**
 * 检查用户是否有指定权限
 */
export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = rolePermissions[role as Role];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * 检查用户是否有任一权限
 */
export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * 检查用户是否有所有权限
 */
export function hasAllPermissions(role: string, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * 要求特定角色的中间件
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: '需要登录'
      });
      return;
    }

    if (!roles.includes(req.user.role as Role)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: '权限不足',
        required: roles,
        current: req.user.role
      });
      return;
    }

    next();
  };
}

/**
 * 要求特定权限的中间件
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: '需要登录'
      });
      return;
    }

    const hasRequired = permissions.every(permission => 
      hasPermission(req.user!.role, permission)
    );

    if (!hasRequired) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: '权限不足',
        required: permissions,
        role: req.user.role
      });
      return;
    }

    next();
  };
}

/**
 * 要求任一权限的中间件
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: '需要登录'
      });
      return;
    }

    const hasAny = permissions.some(permission => 
      hasPermission(req.user!.role, permission)
    );

    if (!hasAny) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: '权限不足',
        required: permissions,
        role: req.user.role
      });
      return;
    }

    next();
  };
}

/**
 * 资源所有权检查中间件
 * 检查用户是否是资源的所有者或有管理权限
 */
export function requireOwnershipOrAdmin(resourceType: 'project' | 'workflow') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: '需要登录'
        });
        return;
      }

      // 管理员直接通过
      if (req.user.role === Role.ADMIN) {
        next();
        return;
      }

      const resourceId = req.params.id;
      
      if (!resourceId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: '缺少资源ID'
        });
        return;
      }

      let isOwner = false;

      // 检查资源所有权
      if (resourceType === 'project') {
        const project = await prisma.project.findUnique({
          where: { id: resourceId },
          select: { ownerId: true }
        });
        isOwner = project?.ownerId === req.user.id;
      } else if (resourceType === 'workflow') {
        const workflow = await prisma.workflow.findUnique({
          where: { id: resourceId },
          include: { project: { select: { ownerId: true } } }
        });
        
        // 工作流创建者或项目所有者都算拥有权限
        isOwner = workflow?.createdBy === req.user.id || 
                  workflow?.project?.ownerId === req.user.id;
      }

      if (!isOwner) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: '您没有权限访问此资源'
        });
        return;
      }

      next();
    } catch (error: any) {
      console.error('Ownership check error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: '权限检查失败'
      });
    }
  };
}

/**
 * 项目成员检查中间件
 * 检查用户是否是项目成员
 */
export function requireProjectMember() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: '需要登录'
        });
        return;
      }

      // 管理员直接通过
      if (req.user.role === Role.ADMIN) {
        next();
        return;
      }

      const projectId = req.params.projectId || req.params.id;
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: '缺少项目ID'
        });
        return;
      }

      // 检查是否是项目成员或所有者
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: req.user.id
          }
        }
      });

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true }
      });

      const isMember = membership !== null;
      const isOwner = project?.ownerId === req.user.id;

      if (!isMember && !isOwner) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: '您不是该项目成员'
        });
        return;
      }

      next();
    } catch (error: any) {
      console.error('Project membership check error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: '成员检查失败'
      });
    }
  };
}
