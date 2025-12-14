/**
 * 统一错误码定义
 * 
 * @description 定义系统中所有可能出现的错误码和错误消息
 * 按照错误类型分组，便于统一管理和错误处理
 * 
 * @author SHENJI Team
 * @date 2025-12-03
 * @version 1.0.0
 * @since Week 1: API优化 - 核心文件
 * 
 * @remarks
 * 错误码分组规则：
 * - 1xxx: 客户端错误（参数、格式等）
 * - 2xxx: 认证/授权错误
 * - 3xxx: 资源错误（不存在、冲突等）
 * - 4xxx: 业务错误（工作流、审计业务等）
 * - 5xxx: 服务器错误
 * - 6xxx: 限流错误
 * 
 * @example
 * ```typescript
 * // 抛出业务异常
 * throw new BusinessError(ErrorCode.NOT_FOUND, '用户不存在');
 * 
 * // 获取错误消息
 * const message = getErrorMessage(ErrorCode.INVALID_PARAMS);
 * ```
 */

/**
 * 错误码枚举
 * 
 * @description 定义系统中所有错误的数字编码
 * 每个错误码对应一个唯一的错误场景
 * 
 * @enum {number}
 */
export enum ErrorCode {
  // 1xxx - 客户端错误
  INVALID_PARAMS = 1001,
  MISSING_PARAMS = 1002,
  INVALID_FORMAT = 1003,
  FILE_TOO_LARGE = 1004,
  INVALID_FILE_TYPE = 1005,

  // 2xxx - 认证/授权错误
  UNAUTHORIZED = 2001,
  TOKEN_EXPIRED = 2002,
  INVALID_TOKEN = 2003,
  FORBIDDEN = 2004,
  INVALID_CREDENTIALS = 2005,

  // 3xxx - 资源错误
  NOT_FOUND = 3001,
  ALREADY_EXISTS = 3002,
  CONFLICT = 3003,
  RESOURCE_LOCKED = 3004,

  // 4xxx - 业务错误
  BUSINESS_ERROR = 4001,
  WORKFLOW_ERROR = 4002,
  AI_SERVICE_ERROR = 4003,
  WORKFLOW_EXECUTION_ERROR = 4004,
  NODE_EXECUTION_ERROR = 4005,

  // 审计业务错误 4100-4199
  ASSET_NOT_FOUND = 4101,
  ACCOUNT_MISMATCH = 4102,
  SALARY_ERROR = 4103,
  CASH_COUNT_ERROR = 4104,
  INVENTORY_ERROR = 4105,
  INVOICE_VERIFICATION_ERROR = 4106,
  FRAUD_DETECTION_ERROR = 4107,

  // 5xxx - 服务器错误
  INTERNAL_ERROR = 5001,
  DATABASE_ERROR = 5002,
  EXTERNAL_SERVICE_ERROR = 5003,
  TIMEOUT = 5004,
  SERVICE_UNAVAILABLE = 5005,

  // 6xxx - 限流错误
  RATE_LIMIT_EXCEEDED = 6001,
  QUOTA_EXCEEDED = 6002,
  CONCURRENT_LIMIT_EXCEEDED = 6003,
}

/**
 * 错误消息映射表
 * 
 * @description 错误码到错误消息的映射关系
 * 提供用户友好的错误提示文案
 * 
 * @type {Record<ErrorCode, string>}
 * 
 * @example
 * ```typescript
 * const message = ErrorMessage[ErrorCode.NOT_FOUND];
 * console.log(message); // '资源不存在'
 * ```
 */
export const ErrorMessage: Record<ErrorCode, string> = {
  // 客户端错误
  [ErrorCode.INVALID_PARAMS]: '参数错误',
  [ErrorCode.MISSING_PARAMS]: '缺少必需参数',
  [ErrorCode.INVALID_FORMAT]: '格式错误',
  [ErrorCode.FILE_TOO_LARGE]: '文件太大',
  [ErrorCode.INVALID_FILE_TYPE]: '文件类型不支持',

  // 认证错误
  [ErrorCode.UNAUTHORIZED]: '请先登录',
  [ErrorCode.TOKEN_EXPIRED]: '登录已过期',
  [ErrorCode.INVALID_TOKEN]: '无效的登录凭证',
  [ErrorCode.FORBIDDEN]: '权限不足',
  [ErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',

  // 资源错误
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.ALREADY_EXISTS]: '资源已存在',
  [ErrorCode.CONFLICT]: '操作冲突',
  [ErrorCode.RESOURCE_LOCKED]: '资源已被锁定',

  // 业务错误
  [ErrorCode.BUSINESS_ERROR]: '业务处理失败',
  [ErrorCode.WORKFLOW_ERROR]: '工作流执行失败',
  [ErrorCode.AI_SERVICE_ERROR]: 'AI服务暂时不可用',
  [ErrorCode.WORKFLOW_EXECUTION_ERROR]: '工作流执行出错',
  [ErrorCode.NODE_EXECUTION_ERROR]: '节点执行失败',

  // 审计业务错误
  [ErrorCode.ASSET_NOT_FOUND]: '资产不存在',
  [ErrorCode.ACCOUNT_MISMATCH]: '账目不匹配',
  [ErrorCode.SALARY_ERROR]: '工资数据有误',
  [ErrorCode.CASH_COUNT_ERROR]: '现金盘点异常',
  [ErrorCode.INVENTORY_ERROR]: '库存数据异常',
  [ErrorCode.INVOICE_VERIFICATION_ERROR]: '发票验证失败',
  [ErrorCode.FRAUD_DETECTION_ERROR]: '舞弊检测失败',

  // 服务器错误
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.DATABASE_ERROR]: '数据库错误',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: '外部服务不可用',
  [ErrorCode.TIMEOUT]: '请求超时',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用',

  // 限流错误
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求过于频繁',
  [ErrorCode.QUOTA_EXCEEDED]: '超过使用配额',
  [ErrorCode.CONCURRENT_LIMIT_EXCEEDED]: '超过并发限制',
};

/**
 * 业务异常类
 * 
 * @description 自定义的业务异常类，用于表示业务逻辑层面的错误
 * 包含错误码、错误消息和详细信息
 * 
 * @extends {Error}
 * 
 * @example
 * ```typescript
 * // 抛出基本异常
 * throw new BusinessError(ErrorCode.NOT_FOUND);
 * 
 * // 抛出带自定义消息的异常
 * throw new BusinessError(ErrorCode.INVALID_PARAMS, '用户ID必须为数字');
 * 
 * // 抛出带详细信息的异常
 * throw new BusinessError(
 *   ErrorCode.ACCOUNT_MISMATCH,
 *   '账目不匹配',
 *   { expected: 1000, actual: 900, difference: 100 }
 * );
 * 
 * // 捕获并处理
 * try {
 *   await someBusinessOperation();
 * } catch (error) {
 *   if (error instanceof BusinessError) {
 *     console.log(`错误码: ${error.code}, 消息: ${error.message}`);
 *     if (error.details) {
 *       console.log('详细信息:', error.details);
 *     }
 *   }
 * }
 * ```
 */
export class BusinessError extends Error {
  /**
   * 创建业务异常实例
   * 
   * @param {ErrorCode} code - 错误码
   * @param {string} [message] - 自定义错误消息，不提供则使用默认消息
   * @param {any} [details] - 错误详细信息，用于调试和日志
   */
  constructor(
    public code: ErrorCode,
    message?: string,
    public details?: any
  ) {
    super(message || ErrorMessage[code]);
    this.name = 'BusinessError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 获取错误消息
 * 
 * @description 根据错误码获取对应的错误消息
 * 如果错误码不存在，返回'未知错误'
 * 
 * @param {ErrorCode} code - 错误码
 * @returns {string} 错误消息字符串
 * 
 * @example
 * ```typescript
 * const message = getErrorMessage(ErrorCode.NOT_FOUND);
 * console.log(message); // '资源不存在'
 * 
 * const unknownMessage = getErrorMessage(9999 as ErrorCode);
 * console.log(unknownMessage); // '未知错误'
 * ```
 */
export function getErrorMessage(code: ErrorCode): string {
  return ErrorMessage[code] || '未知错误';
}
