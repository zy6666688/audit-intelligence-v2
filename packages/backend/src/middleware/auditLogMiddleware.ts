/**
 * 审计日志中间件
 * 自动记录重要操作的审计日志
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';

/**
 * 创建审计日志
 */
export async function createAuditLog(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resourceType,
        resourceId,
        details: details || {},
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 审计日志中间件工厂函数
 * @param action 操作类型
 * @param resourceType 资源类型
 * @param getResourceId 获取资源ID的函数
 */
export function auditLog(
  action: string,
  resourceType: string,
  getResourceId?: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 保存原始的res.json和res.send
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // 拦截响应
    const logAudit = async (body: any) => {
      try {
        // 只记录成功的操作
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const userId = req.user?.id;
          if (userId) {
            let resourceId = '';
            
            // 获取资源ID
            if (getResourceId) {
              resourceId = getResourceId(req);
            } else if (req.params.id) {
              resourceId = req.params.id;
            } else if (body?.data?.id) {
              resourceId = body.data.id;
            }

            // 收集请求详情
            const details: any = {
              method: req.method,
              path: req.path,
              query: req.query,
              params: req.params
            };

            // 对于POST/PUT/PATCH，记录请求体（排除敏感信息）
            if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
              const sanitizedBody = { ...req.body };
              // 移除敏感字段
              delete sanitizedBody.password;
              delete sanitizedBody.oldPassword;
              delete sanitizedBody.newPassword;
              details.body = sanitizedBody;
            }

            // 记录响应摘要
            if (body?.data) {
              details.response = {
                success: body.success,
                dataType: Array.isArray(body.data) ? 'array' : typeof body.data
              };
            }

            // 创建审计日志
            await createAuditLog(
              userId,
              action,
              resourceType,
              resourceId,
              details,
              req.ip || req.socket.remoteAddress,
              req.get('user-agent')
            );
          }
        }
      } catch (error) {
        console.error('Audit log middleware error:', error);
      }
    };

    // 重写res.json
    res.json = function(body: any) {
      logAudit(body).finally(() => {
        originalJson(body);
      });
      return this;
    };

    // 重写res.send
    res.send = function(body: any) {
      logAudit(body).finally(() => {
        originalSend(body);
      });
      return this;
    };

    next();
  };
}

/**
 * 便捷的审计日志函数（用于路由中手动调用）
 */
export async function logActivity(
  req: Request,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: any
) {
  if (req.user?.id) {
    await createAuditLog(
      req.user.id,
      action,
      resourceType,
      resourceId,
      details,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }
}

/**
 * 预定义的审计操作类型
 */
export const AuditAction = {
  // 认证相关
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REGISTER: 'auth.register',
  PASSWORD_CHANGE: 'auth.password_change',
  
  // 项目相关
  PROJECT_CREATE: 'project.create',
  PROJECT_UPDATE: 'project.update',
  PROJECT_DELETE: 'project.delete',
  PROJECT_MEMBER_ADD: 'project.member.add',
  PROJECT_MEMBER_REMOVE: 'project.member.remove',
  PROJECT_MEMBER_ROLE_UPDATE: 'project.member.role_update',
  
  // 工作流相关
  WORKFLOW_CREATE: 'workflow.create',
  WORKFLOW_UPDATE: 'workflow.update',
  WORKFLOW_DELETE: 'workflow.delete',
  WORKFLOW_EXECUTE: 'workflow.execute',
  WORKFLOW_CLONE: 'workflow.clone',
  
  // 执行相关
  EXECUTION_START: 'execution.start',
  EXECUTION_CANCEL: 'execution.cancel',
  EXECUTION_COMPLETE: 'execution.complete',
  
  // 用户管理
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_STATUS_CHANGE: 'user.status_change'
} as const;

/**
 * 资源类型
 */
export const ResourceType = {
  USER: 'user',
  PROJECT: 'project',
  WORKFLOW: 'workflow',
  EXECUTION: 'execution',
  PROJECT_MEMBER: 'project_member',
  AUDIT_LOG: 'audit_log'
} as const;
