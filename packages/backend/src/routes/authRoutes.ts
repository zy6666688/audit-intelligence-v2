/**
 * 认证相关路由
 * 包含登录、注册、登出、刷新token等功能
 */

import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();
const authService = new AuthService(prisma);

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, displayName } = req.body;

    // 验证必填字段
    if (!username || !email || !password) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: '缺少必填字段'
      });
      return;
    }

    // 注册用户
    const result = await authService.register({
      username,
      email,
      password,
      displayName
    });

    res.status(201).json({
      success: true,
      data: result,
      message: '注册成功'
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
      message: '注册失败'
    });
  }
});

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 验证必填字段
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: '缺少邮箱或密码'
      });
      return;
    }

    // 登录
    const result = await authService.login({ email, password });

    res.json({
      success: true,
      data: result,
      message: '登录成功'
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message,
      message: '登录失败'
    });
  }
});

/**
 * POST /api/auth/logout
 * 用户登出
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      await authService.logout(token);
    }

    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '登出失败'
    });
  }
});

/**
 * POST /api/auth/refresh
 * 刷新Token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
        message: '缺少Token'
      });
      return;
    }

    const result = await authService.refreshToken(token);

    res.json({
      success: true,
      data: result,
      message: 'Token刷新成功'
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      error: error.message,
      message: 'Token刷新失败'
    });
  }
});

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: req.user,
      message: '获取用户信息成功'
    });
  } catch (error: any) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '获取用户信息失败'
    });
  }
});

/**
 * POST /api/auth/change-password
 * 修改密码
 */
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: '缺少旧密码或新密码'
      });
      return;
    }

    await authService.changePassword(
      req.user!.id,
      oldPassword,
      newPassword
    );

    res.json({
      success: true,
      message: '密码修改成功，请重新登录'
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
      message: '密码修改失败'
    });
  }
});

/**
 * GET /api/auth/check
 * 检查token是否有效
 */
router.get('/check', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.json({
        success: true,
        data: { valid: false },
        message: '未提供Token'
      });
      return;
    }

    const payload = await authService.verifyToken(token);

    res.json({
      success: true,
      data: {
        valid: !!payload,
        payload: payload || null
      },
      message: payload ? 'Token有效' : 'Token无效'
    });
  } catch (error: any) {
    res.json({
      success: true,
      data: { valid: false },
      message: 'Token无效'
    });
  }
});

export default router;
