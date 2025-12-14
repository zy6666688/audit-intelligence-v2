/**
 * 用户Repository
 * 处理用户相关的数据库操作
 */

import { PrismaClient, User } from '@prisma/client';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';

export interface CreateUserDto {
  username: string;
  email: string;
  passwordHash: string;
  displayName?: string;
  role?: string;
}

export interface UpdateUserDto {
  displayName?: string;
  avatarUrl?: string;
  role?: string;
  status?: string;
}

export class UserRepository extends BaseRepository<User> {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async create(data: CreateUserDto): Promise<User> {
    return this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash: data.passwordHash,
        displayName: data.displayName,
        role: data.role || 'user',
      },
    });
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    // 软删除 - 更新状态为deleted
    await this.prisma.user.update({
      where: { id },
      data: { status: 'deleted' },
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async list(options?: PaginationOptions): Promise<PaginatedResult<User>> {
    const { skip, take, page, pageSize } = this.getPaginationParams(options);

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { status: { not: 'deleted' } },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({
        where: { status: { not: 'deleted' } },
      }),
    ]);

    return this.buildPaginatedResult(data, total, page, pageSize);
  }

  async search(query: string, options?: PaginationOptions): Promise<PaginatedResult<User>> {
    const { skip, take, page, pageSize } = this.getPaginationParams(options);

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          AND: [
            { status: { not: 'deleted' } },
            {
              OR: [
                { username: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { displayName: { contains: query, mode: 'insensitive' } },
              ],
            },
          ],
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({
        where: {
          AND: [
            { status: { not: 'deleted' } },
            {
              OR: [
                { username: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { displayName: { contains: query, mode: 'insensitive' } },
              ],
            },
          ],
        },
      }),
    ]);

    return this.buildPaginatedResult(data, total, page, pageSize);
  }
}
