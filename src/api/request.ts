/**
 * HTTP请求封装
 */

import { PlatformAdapter } from '@/utils/platform';

// API基础配置
const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
};

// 请求配置接口
interface RequestConfig {
  baseURL?: string;
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeout?: number;
  header?: Record<string, string>; // uni.request 使用 header
}

// 响应接口
interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// 请求拦截器
async function requestInterceptor(config: RequestConfig): Promise<RequestConfig> {
  // 添加Token
  const token = await PlatformAdapter.getStorage('token');
  if (token) {
    config.header = config.header || {};
    config.header['Authorization'] = `Bearer ${token}`;
  }

  // 添加时间戳
  config.header = config.header || {};
  config.header['X-Request-Time'] = Date.now().toString();

  return config;
}

// 响应拦截器
function responseInterceptor<T>(response: { data: any; statusCode?: number }): T {
  // 检查HTTP状态码
  if (response.statusCode === 401) {
    PlatformAdapter.removeStorage('token');
    PlatformAdapter.removeStorage('userInfo');
    uni.reLaunch({ url: '/pages/login/index' });
    throw new Error('未登录或登录已过期');
  }

  if (response.statusCode === 403) {
    PlatformAdapter.showToast('权限不足', 'none');
    throw new Error('权限不足');
  }

  // 处理后端响应格式
  const resData = response.data as ApiResponse<T>;
  
  // 新的后端响应格式 {success: true/false, data, message, error}
  if (resData.success) {
    return resData.data;
  }

  // 失败情况
  const message = resData.message || resData.error || '请求失败';
  throw new Error(message);
}

// 错误处理
function handleError(error: any) {
  console.error('请求错误:', error);

  let message = '网络错误，请稍后重试';

  if (error.message) {
    message = error.message;
  } else if (error.statusCode === 404) {
    message = '请求的资源不存在';
  } else if (error.statusCode === 500) {
    message = '服务器错误';
  } else if (error.statusCode === 503) {
    message = '服务暂不可用';
  }

  PlatformAdapter.showToast(message, 'none');

  throw error;
}

/**
 * 发送HTTP请求
 */
export async function request<T = unknown>(options: {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeout?: number;
}): Promise<T> {
  try {
    // 构建配置
    let config: RequestConfig = {
      url: options.url.startsWith('http') ? options.url : API_CONFIG.baseURL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: { ...API_CONFIG.headers, ...options.headers },
      timeout: options.timeout || API_CONFIG.timeout
    };

    // 处理GET请求参数
    if (options.params && config.method === 'GET') {
      const queryString = Object.keys(options.params)
        .map(key => `${key}=${encodeURIComponent(String(options.params![key]))}`)
        .join('&');
      config.url += (config.url.includes('?') ? '&' : '?') + queryString;
    }

    // 请求拦截
    config = await requestInterceptor(config);

    // 发送请求
    const response = await uni.request({
        url: config.url,
        method: config.method,
        data: config.data,
        header: config.header,
        timeout: config.timeout
    });

    // 响应拦截
    return responseInterceptor<T>(response);
  } catch (error) {
    handleError(error);
    throw error; // handleError会抛出错误，这行代码实际不会执行
  }
}

/**
 * GET请求
 */
export function get<T = unknown>(url: string, params?: Record<string, any>, options?: any): Promise<T> {
  return request<T>({ url, method: 'GET', params, ...options });
}

/**
 * POST请求
 */
export function post<T = unknown>(url: string, data?: unknown, options?: any): Promise<T> {
  return request<T>({ url, method: 'POST', data, ...options });
}

/**
 * PUT请求
 */
export function put<T = unknown>(url: string, data?: unknown, options?: any): Promise<T> {
  return request<T>({ url, method: 'PUT', data, ...options });
}

/**
 * DELETE请求
 */
export function del<T = unknown>(url: string, data?: unknown, options?: any): Promise<T> {
  return request<T>({ url, method: 'DELETE', data, ...options });
}

/**
 * 上传文件
 */
export async function uploadFile(filePath: string, options?: {
  name?: string;
  formData?: any;
  onProgress?: (progress: number) => void;
}): Promise<any> {
  try {
    const token = await PlatformAdapter.getStorage('token');

    const result = await uni.uploadFile({
      url: API_CONFIG.baseURL + '/upload',
      filePath,
      name: options?.name || 'file',
      formData: options?.formData || {},
      header: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = JSON.parse(result.data);
    return responseInterceptor({ data });
  } catch (error) {
    handleError(error);
    throw error;
  }
}

export default request;
