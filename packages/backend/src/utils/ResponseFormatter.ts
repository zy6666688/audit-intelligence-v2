/**
 * 统一API响应格式工具类
 * 
 * @description 提供统一的API响应格式化方法，确保所有API返回格式一致
 * 包括成功响应、错误响应、分页响应等多种场景
 * 
 * @author SHENJI Team
 * @date 2025-12-03
 * @version 1.0.0
 * @since Week 1: API优化 - 核心文件
 * 
 * @example
 * ```typescript
 * // 成功响应
 * return ResponseFormatter.success({ id: 1, name: 'test' }, '查询成功');
 * 
 * // 错误响应
 * return ResponseFormatter.error(404, '资源不存在');
 * 
 * // 分页响应
 * return ResponseFormatter.paginated(users, 100, 1, 10, '查询成功');
 * ```
 */

export interface ApiResponse<T = any> {
  code: number;
  success: boolean;
  data: T | null;
  message: string;
  timestamp: number;
  error?: any;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export class ResponseFormatter {
  /**
   * 创建成功响应
   * 
   * @description 用于返回操作成功的标准响应格式
   * 
   * @template T - 响应数据的类型
   * @param {T} data - 要返回的数据
   * @param {string} [message='操作成功'] - 成功提示消息
   * @returns {ApiResponse<T>} 格式化的成功响应对象
   * 
   * @example
   * ```typescript
   * const user = { id: 1, name: 'John Doe', email: 'john@example.com' };
   * return ResponseFormatter.success(user, '用户查询成功');
   * // 返回:
   * // {
   * //   code: 200,
   * //   success: true,
   * //   data: { id: 1, name: 'John Doe', email: 'john@example.com' },
   * //   message: '用户查询成功',
   * //   timestamp: 1701619200000
   * // }
   * ```
   */
  static success<T>(data: T, message: string = '操作成功'): ApiResponse<T> {
    return {
      code: 200,
      success: true,
      data,
      message,
      timestamp: Date.now(),
    };
  }

  /**
   * 创建失败响应
   * 
   * @description 用于返回操作失败的标准错误响应格式
   * 在开发环境会返回详细错误信息，生产环境只返回错误消息
   * 
   * @param {number} code - HTTP状态码（如400, 404, 500等）
   * @param {string} message - 错误提示消息
   * @param {any} [error] - 错误详情对象（仅在开发环境返回）
   * @returns {ApiResponse<null>} 格式化的错误响应对象
   * 
   * @example
   * ```typescript
   * // 基本错误响应
   * return ResponseFormatter.error(404, '用户不存在');
   * 
   * // 带详细错误信息（开发环境）
   * try {
   *   await someOperation();
   * } catch (err) {
   *   return ResponseFormatter.error(500, '操作失败', err);
   * }
   * ```
   */
  static error(
    code: number,
    message: string,
    error?: any
  ): ApiResponse<null> {
    return {
      code,
      success: false,
      data: null,
      message,
      error: process.env.NODE_ENV === 'development' ? error : undefined,
      timestamp: Date.now(),
    };
  }

  /**
   * 创建分页响应
   * 
   * @description 用于返回带分页信息的数据列表响应
   * 自动计算总页数并包含完整的分页元数据
   * 
   * @template T - 列表项的数据类型
   * @param {T[]} data - 当前页的数据列表
   * @param {number} total - 数据总条数
   * @param {number} page - 当前页码（从1开始）
   * @param {number} pageSize - 每页显示条数
   * @param {string} [message='查询成功'] - 响应提示消息
   * @returns {PaginatedResponse<T>} 格式化的分页响应对象
   * 
   * @example
   * ```typescript
   * const users = await getUserList(1, 10);
   * const total = await getUserCount();
   * return ResponseFormatter.paginated(users, total, 1, 10, '用户列表查询成功');
   * // 返回:
   * // {
   * //   code: 200,
   * //   success: true,
   * //   data: [...],
   * //   message: '用户列表查询成功',
   * //   timestamp: 1701619200000,
   * //   pagination: {
   * //     total: 100,
   * //     page: 1,
   * //     pageSize: 10,
   * //     totalPages: 10
   * //   }
   * // }
   * ```
   */
  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number,
    message: string = '查询成功'
  ): PaginatedResponse<T> {
    return {
      code: 200,
      success: true,
      data,
      message,
      timestamp: Date.now(),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 创建资源成功响应（201）
   * 
   * @description 用于POST请求创建资源成功后的响应
   * 返回HTTP 201状态码，符合RESTful规范
   * 
   * @template T - 创建的资源数据类型
   * @param {T} data - 新创建的资源数据
   * @param {string} [message='创建成功'] - 成功提示消息
   * @returns {ApiResponse<T>} 格式化的创建成功响应对象
   * 
   * @example
   * ```typescript
   * const newUser = await createUser(userData);
   * return ResponseFormatter.created(newUser, '用户创建成功');
   * // 返回: { code: 201, success: true, data: {...}, message: '用户创建成功', ... }
   * ```
   */
  static created<T>(data: T, message: string = '创建成功'): ApiResponse<T> {
    return {
      code: 201,
      success: true,
      data,
      message,
      timestamp: Date.now(),
    };
  }

  /**
   * 无内容响应（204）
   * 
   * @description 用于DELETE或PUT请求成功但无需返回数据的场景
   * 返回HTTP 204状态码，符合RESTful规范
   * 
   * @param {string} [message='操作成功'] - 成功提示消息
   * @returns {ApiResponse<null>} 格式化的无内容响应对象
   * 
   * @example
   * ```typescript
   * await deleteUser(userId);
   * return ResponseFormatter.noContent('用户删除成功');
   * // 返回: { code: 204, success: true, data: null, message: '用户删除成功', ... }
   * ```
   */
  static noContent(message: string = '操作成功'): ApiResponse<null> {
    return {
      code: 204,
      success: true,
      data: null,
      message,
      timestamp: Date.now(),
    };
  }
}
