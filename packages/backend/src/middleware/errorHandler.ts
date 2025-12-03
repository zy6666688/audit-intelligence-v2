/**
 * 全局错误处理中间件
 * Week 1: API优化 - 核心文件
 */

import { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../utils/ResponseFormatter';
import { ErrorCode, BusinessError, getErrorMessage } from '../constants/ErrorCode';

/**
 * 全局错误处理中间件
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 记录错误日志
  console.error('[Error Handler]', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });

  // 业务异常
  if (err instanceof BusinessError) {
    return res.status(getHttpStatus(err.code)).json(
      ResponseFormatter.error(err.code, err.message, err.details)
    );
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(
      ResponseFormatter.error(
        ErrorCode.INVALID_TOKEN,
        getErrorMessage(ErrorCode.INVALID_TOKEN)
      )
    );
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(
      ResponseFormatter.error(
        ErrorCode.TOKEN_EXPIRED,
        getErrorMessage(ErrorCode.TOKEN_EXPIRED)
      )
    );
  }

  // Multer文件上传错误
  if (err.name === 'MulterError') {
    const multerErr = err as any;
    if (multerErr.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json(
        ResponseFormatter.error(
          ErrorCode.FILE_TOO_LARGE,
          '文件大小超过限制'
        )
      );
    }
    if (multerErr.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json(
        ResponseFormatter.error(
          ErrorCode.INVALID_PARAMS,
          '文件数量超过限制'
        )
      );
    }
  }

  // Validation错误
  if (err.name === 'ValidationError') {
    return res.status(400).json(
      ResponseFormatter.error(
        ErrorCode.INVALID_PARAMS,
        err.message
      )
    );
  }

  // Prisma错误
  if (err.name.startsWith('Prisma')) {
    console.error('[Database Error]', err);
    return res.status(500).json(
      ResponseFormatter.error(
        ErrorCode.DATABASE_ERROR,
        getErrorMessage(ErrorCode.DATABASE_ERROR)
      )
    );
  }

  // 默认服务器错误
  return res.status(500).json(
    ResponseFormatter.error(
      ErrorCode.INTERNAL_ERROR,
      getErrorMessage(ErrorCode.INTERNAL_ERROR),
      process.env.NODE_ENV === 'development' ? err.stack : undefined
    )
  );
}

/**
 * 404处理
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json(
    ResponseFormatter.error(
      ErrorCode.NOT_FOUND,
      `路由 ${req.method} ${req.path} 不存在`
    )
  );
}

/**
 * 异步错误包装器
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 根据错误码获取HTTP状态码
 */
function getHttpStatus(errorCode: ErrorCode): number {
  if (errorCode >= 1000 && errorCode < 2000) return 400; // 客户端错误
  if (errorCode >= 2000 && errorCode < 3000) return 401; // 认证错误
  if (errorCode >= 3000 && errorCode < 4000) return 404; // 资源错误
  if (errorCode >= 4000 && errorCode < 5000) return 400; // 业务错误
  if (errorCode >= 5000 && errorCode < 6000) return 500; // 服务器错误
  if (errorCode >= 6000 && errorCode < 7000) return 429; // 限流错误
  return 500;
}
