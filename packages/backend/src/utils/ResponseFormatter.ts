/**
 * 统一API响应格式工具类
 * Week 1: API优化 - 核心文件
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
   * 成功响应
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
   * 失败响应
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
   * 分页响应
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
   * 创建响应
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
   * 无内容响应
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
