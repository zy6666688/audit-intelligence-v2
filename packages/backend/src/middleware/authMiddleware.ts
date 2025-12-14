/**
 * JWT认证中间件
 * 验证请求中的JWT token，将用户信息附加到request对象
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { prisma } from '../db/prisma';

// 扩展Express Request类型，添加user属性
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        role: string;
        status: string;
      };
    }
  }
}

const authService = new AuthService(prisma);

/**
 * JWT认证中间件
 * 从请求头中提取并验证JWT token
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. 从请求头获取token
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'No authorization header',
        message: '缺少认证令牌'
      });
      return;
    }

    // 2. 验证Bearer格式
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        success: false,
        error: 'Invalid authorization format',
        message: '认证格式错误，应为: Bearer <token>'
      });
      return;
    }

    const token = parts[1];

    // 3. 验证token
    const decoded = await authService.verifyToken(token);
    
    if (!decoded) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: '无效的认证令牌'
      });
      return;
    }

    // 4. 检查用户是否存在且状态正常
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true
      }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
        message: '用户不存在'
      });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({
        success: false,
        error: 'User account is suspended',
        message: '用户账号已被停用'
      });
      return;
    }

    // 5. 将用户信息附加到request对象
    req.user = user;

    // 继续处理请求
    next();
  } catch (error: any) {
    console.error('Authentication error:', error);
    
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: error.message || '认证失败'
    });
  }
};

/**
 * 可选认证中间件
 * 如果有token则验证，没有token也允许通过
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    // 如果没有token，直接继续
    if (!authHeader) {
      next();
      return;
    }

    // 如果有token，尝试验证
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const decoded = await authService.verifyToken(token);
      
      if (decoded) {
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            status: true
          }
        });

        if (user && user.status === 'active') {
          req.user = user;
        }
      }
    }

    next();
  } catch (error) {
    // 可选认证失败不影响请求继续
    next();
  }
};

/**
 * 刷新token中间件
 * 检查token是否即将过期，如果是则返回新token
 */
export const refreshTokenIfNeeded = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 如果用户已认证
    if (req.user) {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        
        // 检查token是否即将过期（1小时内）
        const decoded = await authService.verifyToken(token);
        
        // 检查token是否即将过期（1小时内）
        if (decoded && decoded.exp) {
          const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
          
          // 如果token在1小时内过期，生成新token
          if (expiresIn < 3600) {
            const newToken = await authService.generateToken(req.user.id);
            // 在响应头中返回新token
            res.setHeader('X-New-Token', newToken);
          }
        }
      }
    }
    
    next();
  } catch (error) {
    // 刷新失败不影响请求继续
    next();
  }
};
