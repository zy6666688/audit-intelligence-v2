/**
 * 全局错误处理中间件
 * 
 * @description 提供Express全局错误处理、404处理和异步错误包装器
 * 统一处理各种类型的错误，返回标准格式的错误响应
 * 
 * @author SHENJI Team
 * @date 2025-12-03
 * @version 1.0.0
 * @since Week 1: API优化 - 核心文件
 * 
 * @remarks
 * 支持的错误类型：
 * - BusinessError: 业务逻辑异常
 * - JsonWebTokenError: JWT令牌错误
 * - MulterError: 文件上传错误
 * - ValidationError: 数据验证错误
 * - PrismaError: 数据库错误
 * - 其他未知错误
 * 
 * @example
 * ```typescript
 * // 在Express应用中使用
 * import { errorHandler, notFoundHandler } from './middleware/errorHandler';
 * 
 * app.use(errorHandler);
 * app.use(notFoundHandler);
 * 
 * // 使用异步包装器
 * app.get('/users/:id', asyncHandler(async (req, res) => {
 *   const user = await getUserById(req.params.id);
 *   res.json(ResponseFormatter.success(user));
 * }));
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../utils/ResponseFormatter';
import { ErrorCode, BusinessError, getErrorMessage } from '../constants/ErrorCode';

/**
 * 全局错误处理中间件
 * 
 * @description Express全局错误处理中间件，捕获并处理所有未捕获的异常
 * 根据错误类型返回相应的HTTP状态码和错误信息
 * 在开发环境记录详细错误信息和调用堆栈
 * 
 * @param {Error} err - 错误对象
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 * @param {NextFunction} next - Express下一个中间件
 * 
 * @returns {void}
 * 
 * @example
 * ```typescript
 * // 作为最后一个中间件注册
 * app.use(errorHandler);
 * 
 * // 在路由中抛出异常，会被errorHandler捕获
 * app.get('/test', async (req, res) => {
 *   throw new BusinessError(ErrorCode.NOT_FOUND, '资源不存在');
 * });
 * ```
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
 * 404路由未找到处理中间件
 * 
 * @description 处理所有未匹配的路由请求，返回404错误
 * 应在所有路由注册之后、errorHandler之前注册
 * 
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 * 
 * @returns {void}
 * 
 * @example
 * ```typescript
 * // 注册顺序：
 * app.use('/api', apiRoutes);  // 1. 先注册所有路由
 * app.use(notFoundHandler);     // 2. 然后注册404处理
 * app.use(errorHandler);        // 3. 最后注册错误处理
 * 
 * // 当访问不存在的路由时
 * // GET /api/nonexistent -> 404 { code: 3001, message: "路由 GET /api/nonexistent 不存在" }
 * ```
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
 * 异步路由处理器包装器
 * 
 * @description 包装异步路由处理器，自动捕获Promise拒绝并传递给错误处理中间件
 * 避免在每个异步路由中手动编写try-catch
 * 
 * @param {Function} fn - 异步路由处理函数
 * @returns {Function} 包装后的路由处理函数
 * 
 * @example
 * ```typescript
 * // 不使用asyncHandler（需要手动try-catch）
 * app.get('/users/:id', async (req, res, next) => {
 *   try {
 *     const user = await getUserById(req.params.id);
 *     res.json(ResponseFormatter.success(user));
 *   } catch (error) {
 *     next(error);
 *   }
 * });
 * 
 * // 使用asyncHandler（自动处理错误）
 * app.get('/users/:id', asyncHandler(async (req, res) => {
 *   const user = await getUserById(req.params.id);
 *   res.json(ResponseFormatter.success(user));
 * }));
 * 
 * // 任何被rejected的Promise都会被自动捕获并传递给errorHandler
 * ```
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 根据错误码获取HTTP状态码
 * 
 * @description 将自定义错误码映射到标准HTTP状态码
 * 根据错误码范围判断错误类型
 * 
 * @param {ErrorCode} errorCode - 自定义错误码
 * @returns {number} HTTP状态码
 * 
 * @remarks
 * 映射规则：
 * - 1xxx → 400 (客户端错误)
 * - 2xxx → 401 (认证错误)
 * - 3xxx → 404 (资源不存在)
 * - 4xxx → 400 (业务错误)
 * - 5xxx → 500 (服务器错误)
 * - 6xxx → 429 (限流错误)
 * 
 * @example
 * ```typescript
 * getHttpStatus(ErrorCode.INVALID_PARAMS);  // 400
 * getHttpStatus(ErrorCode.UNAUTHORIZED);    // 401
 * getHttpStatus(ErrorCode.NOT_FOUND);       // 404
 * getHttpStatus(ErrorCode.INTERNAL_ERROR);  // 500
 * getHttpStatus(ErrorCode.RATE_LIMIT_EXCEEDED); // 429
 * ```
 * 
 * @private
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
