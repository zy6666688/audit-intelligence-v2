/**
 * 工作流Repository
 * 处理工作流相关的数据库操作
 */

import { PrismaClient, Workflow } from '@prisma/client';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';

export interface CreateWorkflowDto {
  projectId?: string;
  name: string;
  description?: string;
  category?: string;
  config?: any;
  nodes: any;
  edges: any;
  viewport?: any;
  createdBy: string;
  isTemplate?: boolean;
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string;
  category?: string;
  config?: any;
  nodes?: any;
  edges?: any;
  viewport?: any;
  status?: string;
  updatedBy?: string;
  isPublished?: boolean;
}

export class WorkflowRepository extends BaseRepository<Workflow> {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<Workflow | null> {
    return this.prisma.workflow.findUnique({
      where: { id },
      include: {
        project: true,
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async create(data: CreateWorkflowDto): Promise<Workflow> {
    return this.prisma.workflow.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        category: data.category,
        nodes: data.nodes,
        edges: data.edges,
        viewport: data.viewport,
        createdBy: data.createdBy,
        isTemplate: data.isTemplate || false,
      },
    });
  }

  async update(id: string, data: UpdateWorkflowDto): Promise<Workflow> {
    return this.prisma.workflow.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        nodes: data.nodes,
        edges: data.edges,
        viewport: data.viewport,
        updatedBy: data.updatedBy,
        isPublished: data.isPublished,
        version: { increment: 1 },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workflow.delete({
      where: { id },
    });
  }

  async listByProject(
    projectId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Workflow>> {
    const { skip, take, page, pageSize } = this.getPaginationParams(options);

    const [data, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where: { projectId },
        include: {
          creator: {
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
      this.prisma.workflow.count({
        where: { projectId },
      }),
    ]);

    return this.buildPaginatedResult(data, total, page, pageSize);
  }

  async listTemplates(options?: PaginationOptions): Promise<PaginatedResult<Workflow>> {
    const { skip, take, page, pageSize } = this.getPaginationParams(options);

    const [data, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where: { isTemplate: true, isPublished: true },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
        skip,
        take,
        orderBy: { executionCount: 'desc' },
      }),
      this.prisma.workflow.count({
        where: { isTemplate: true, isPublished: true },
      }),
    ]);

    return this.buildPaginatedResult(data, total, page, pageSize);
  }

  async incrementExecutionCount(id: string, duration?: number): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      select: { executionCount: true, avgExecutionTime: true },
    });

    if (!workflow) return;

    const newCount = workflow.executionCount + 1;
    let newAvg: number | null = workflow.avgExecutionTime ? Number(workflow.avgExecutionTime) : null;

    if (duration !== undefined && duration > 0) {
      const currentAvg = Number(workflow.avgExecutionTime) || 0;
      newAvg = (currentAvg * workflow.executionCount + duration) / newCount;
    }

    await this.prisma.workflow.update({
      where: { id },
      data: {
        executionCount: newCount,
        avgExecutionTime: newAvg,
        lastExecutedAt: new Date(),
      },
    });
  }

  async search(
    query: string,
    category?: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Workflow>> {
    const { skip, take, page, pageSize } = this.getPaginationParams(options);

    const whereCondition: any = {
      AND: [
        {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    };

    if (category) {
      whereCondition.AND.push({ category });
    }

    const [data, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where: whereCondition,
        include: {
          creator: {
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
      this.prisma.workflow.count({
        where: whereCondition,
      }),
    ]);

    return this.buildPaginatedResult(data, total, page, pageSize);
  }
}
