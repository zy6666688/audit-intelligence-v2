/**
 * 认证服务
 * 处理用户登录、注册、JWT生成等
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/UserRepository';
import { prisma } from '../db/prisma';

export interface RegisterDto {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  exp?: number;
  iat?: number;
}

export class AuthService {
  private userRepo: UserRepository;
  private jwtSecret: string;
  private jwtExpiresIn: string | number;

  constructor(private prisma: any) {
    this.userRepo = new UserRepository(prisma);
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-change-this';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
  }

  /**
   * 用户注册
   */
  async register(data: RegisterDto) {
    // 检查用户名是否已存在
    const existingUsername = await this.userRepo.findByUsername(data.username);
    if (existingUsername) {
      throw new Error('用户名已存在');
    }

    // 检查邮箱是否已存在
    const existingEmail = await this.userRepo.findByEmail(data.email);
    if (existingEmail) {
      throw new Error('邮箱已被注册');
    }

    // 密码强度验证
    if (data.password.length < 6) {
      throw new Error('密码长度至少6位');
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(data.password, 10);

    // 创建用户
    const user = await this.userRepo.create({
      username: data.username,
      email: data.email,
      passwordHash,
      displayName: data.displayName || data.username,
    });

    // 生成Token
    const token = this.generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // 创建Session
    await this.createSession(user.id, token);

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 用户登录
   */
  async login(data: LoginDto) {
    // 查找用户
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) {
      throw new Error('邮箱或密码错误');
    }

    // 检查用户状态
    if (user.status === 'suspended') {
      throw new Error('账号已被暂停');
    }
    if (user.status === 'deleted') {
      throw new Error('账号不存在');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('邮箱或密码错误');
    }

    // 更新最后登录时间
    await this.userRepo.updateLastLogin(user.id);

    // 生成Token
    const token = this.generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // 创建Session
    await this.createSession(user.id, token);

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 验证Token
   */
  async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * 刷新Token
   */
  async refreshToken(oldToken: string) {
    const payload = await this.verifyToken(oldToken);
    
    if (!payload) {
      throw new Error('Token无效或已过期');
    }
    
    // 查询用户最新信息
    const user = await this.userRepo.findById(payload.userId);
    if (!user || user.status !== 'active') {
      throw new Error('用户不存在或已被禁用');
    }

    // 生成新Token
    const newToken = this.generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // 删除旧Session，创建新Session
    await this.deleteSessionByToken(oldToken);
    await this.createSession(user.id, newToken);

    return {
      token: newToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 退出登录
   */
  async logout(token: string) {
    await this.deleteSessionByToken(token);
  }

  /**
   * 修改密码
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('原密码错误');
    }

    // 验证新密码强度
    if (newPassword.length < 6) {
      throw new Error('新密码长度至少6位');
    }

    // 加密新密码
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await this.userRepo.update(userId, { passwordHash } as any);

    // 删除所有Session（强制重新登录）
    await this.deleteAllUserSessions(userId);
  }

  /**
   * 生成JWT Token
   */
  generateToken(payload: JwtPayload | string): string {
    if (typeof payload === 'string') {
      // 简化调用，只传userId
      return jwt.sign({ userId: payload }, this.jwtSecret, { expiresIn: this.jwtExpiresIn as any });
    }
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn as any });
  }

  /**
   * 创建Session
   */
  private async createSession(userId: string, token: string) {
    const tokenHash = await bcrypt.hash(token, 5); // 简单哈希
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7天后过期

    await prisma.session.create({
      data: {
        id: `session_${Date.now()}_${Math.random().toString(36)}`,
        userId,
        tokenHash,
        expiresAt,
        lastActiveAt: new Date(),
      },
    });
  }

  /**
   * 删除Session
   */
  private async deleteSessionByToken(token: string) {
    // 简化实现：删除所有过期Session
    await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  /**
   * 删除用户所有Session
   */
  private async deleteAllUserSessions(userId: string) {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  /**
   * 清除敏感信息
   */
  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
