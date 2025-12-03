/**
 * 项目Repository
 * 处理项目相关的数据库操作
 */

import { PrismaClient, Project } from '@prisma/client';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';

export interface CreateProjectDto {
  name: string;
  description?: string;
  ownerId: string;
  startDate?: Date;
  endDate?: Date;
  auditType?: string;
  clientName?: string;
  auditPeriod?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  auditType?: string;
  clientName?: string;
  auditPeriod?: string;
}

export class ProjectRepository extends BaseRepository<Project> {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        workflows: {
          select: {
            id: true,
            name: true,
            category: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async create(data: CreateProjectDto): Promise<Project> {
    return this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        ownerId: data.ownerId,
        startDate: data.startDate,
        endDate: data.endDate,
        auditType: data.auditType,
        clientName: data.clientName,
        auditPeriod: data.auditPeriod,
      },
    });
  }

  async update(id: string, data: UpdateProjectDto): Promise<Project> {
    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    // 软删除
    await this.prisma.project.update({
      where: { id },
      data: { status: 'deleted' },
    });
  }

  async listByOwner(
    ownerId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Project>> {
    const { skip, take, page, pageSize } = this.getPaginationParams(options);

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          ownerId,
          status: { not: 'deleted' },
        },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({
        where: {
          ownerId,
          status: { not: 'deleted' },
        },
      }),
    ]);

    return this.buildPaginatedResult(data, total, page, pageSize);
  }

  async listByMember(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Project>> {
    const { skip, take, page, pageSize } = this.getPaginationParams(options);

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          members: {
            some: {
              userId,
            },
          },
          status: { not: 'deleted' },
        },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({
        where: {
          members: {
            some: {
              userId,
            },
          },
          status: { not: 'deleted' },
        },
      }),
    ]);

    return this.buildPaginatedResult(data, total, page, pageSize);
  }

  async listByUser(
    userId: string,
    options?: PaginationOptions & { search?: string }
  ): Promise<any[]> {
    const { page = 1, pageSize = 20, search } = options || {};
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    return this.prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ],
        status: { not: 'deleted' },
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as any } },
            { description: { contains: search, mode: 'insensitive' as any } }
          ]
        } : {})
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            workflows: true,
            members: true
          }
        }
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async addMember(projectId: string, userId: string, role: string): Promise<any> {
    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true
          }
        }
      }
    });
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
  }

  async updateMemberRole(projectId: string, userId: string, role: string): Promise<any> {
    return this.prisma.projectMember.update({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true
          }
        }
      }
    });
  }

  async checkMemberAccess(projectId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.projectMember.count({
      where: {
        projectId,
        userId,
      },
    });
    return count > 0;
  }
}
