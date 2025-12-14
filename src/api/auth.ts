/**
 * 认证相关API
 * 对接后端 /api/auth 路由
 */

import { post, get } from './request';

/**
 * 微信登录
 */
export function wxLogin(data: { code: string }) {
  return post('/auth/wx/login', data);
}

/**
 * 账号密码登录
 */
export function passwordLogin(data: { email: string; password: string }) {
  return post<{ token: string; user: any }>('/auth/login', data);
}

/**
 * 用户注册
 */
export function register(data: { email: string; password: string; username: string; displayName?: string }) {
  return post<{ token: string; user: any }>('/auth/register', data);
}

/**
 * 企业微信登录
 */
export function wxWorkLogin(data: { code: string }) {
  return post('/auth/wxwork/login', data);
}

/**
 * 退出登录
 */
export function logout() {
  return post('/auth/logout');
}

/**
 * 刷新Token
 */
export function refreshToken(data: { refreshToken: string }) {
  return post('/auth/refresh', data);
}

/**
 * 获取当前用户信息
 */
export function getUserInfo() {
  return get<any>('/auth/me');
}

/**
 * 修改密码
 */
export function changePassword(data: { oldPassword: string; newPassword: string }) {
  return post('/auth/change-password', data);
}

/**
 * 检查Token有效性
 */
export function checkToken() {
  return get<{ valid: boolean }>('/auth/check');
}
