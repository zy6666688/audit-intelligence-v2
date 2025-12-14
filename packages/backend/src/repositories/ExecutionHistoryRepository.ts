/**
 * 执行历史Repository
 * 处理工作流执行历史的数据库操作
 */

import { PrismaClient, ExecutionHistory } from '@prisma/client';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';

export interface CreateExecutionDto {
  workflowId: string;
  taskId: string;
  executedBy: string;
  inputParams?: any;
  nodesTotal: number;
}

export interface UpdateExecutionStatusDto {
  status: string;
  progress?: number;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  nodeResults?: any;
  finalOutput?: any;
  errorMessage?: string;
  nodesCompleted?: number;
  nodesFailed?: number;
}

export class ExecutionHistoryRepository extends BaseRepository<ExecutionHistory> {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<ExecutionHistory | null> {
    return this.prisma.executionHistory.findUnique({
      where: { id },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        executor: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        nodeLogs: {
          orderBy: { startedAt: 'asc' },
        },
      },
    });
  }

  async findByTaskId(taskId: string): Promise<ExecutionHistory | null> {
    return this.prisma.executionHistory.findUnique({
      where: { taskId },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        nodeLogs: {
          orderBy: { startedAt: 'asc' },
        },
      },
    });
  }

  async create(data: CreateExecutionDto): Promise<ExecutionHistory> {
    return this.prisma.executionHistory.create({
      data: {
        workflowId: data.workflowId,
        taskId: data.taskId,
        executedBy: data.executedBy,
        inputParams: data.inputParams,
        nodesTotal: data.nodesTotal,
        status: 'pending',
        progress: 0,
      },
    });
  }

  async update(id: string, data: UpdateExecutionStatusDto): Promise<ExecutionHistory> {
    return this.prisma.executionHistory.update({
      where: { id },
      data,
    });
  }

  async updateByTaskId(taskId: string, data: UpdateExecutionStatusDto): Promise<ExecutionHistory> {
    return this.prisma.executionHistory.update({
      where: { taskId },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.executionHistory.delete({
      where: { id },
    });
  }

  async listByWorkflow(
    workflowId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ExecutionHistory>> {
    const { skip, take, page, pageSize } = this.getPaginationParams(options);

    const [data, total] = await Promise.all([
      this.prisma.executionHistory.findMany({
        where: { workflowId },
        include: {
          executor: {
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
      this.prisma.executionHistory.count({
        where: { workflowId },
      }),
    ]);

    return this.buildPaginatedResult(data, total, page, pageSize);
  }

  async listByUser(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ExecutionHistory>> {
    const { skip, take, page, pageSize } = this.getPaginationParams(options);

    const [data, total] = await Promise.all([
      this.prisma.executionHistory.findMany({
        where: { executedBy: userId },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.executionHistory.count({
        where: { executedBy: userId },
      }),
    ]);

    return this.buildPaginatedResult(data, total, page, pageSize);
  }

  async addNodeLog(executionId: string, nodeLog: any): Promise<void> {
    await this.prisma.nodeExecutionLog.create({
      data: {
        executionId,
        nodeId: nodeLog.nodeId,
        nodeType: nodeLog.nodeType,
        status: nodeLog.status,
        startedAt: nodeLog.startedAt,
        completedAt: nodeLog.completedAt,
        duration: nodeLog.duration,
        input: nodeLog.input,
        output: nodeLog.output,
        error: nodeLog.error,
        memoryUsed: nodeLog.memoryUsed,
        cpuTime: nodeLog.cpuTime,
      },
    });
  }

  async getStatsByWorkflow(workflowId: string): Promise<any> {
    const stats = await this.prisma.executionHistory.groupBy({
      by: ['status'],
      where: { workflowId },
      _count: true,
    });

    const avgDuration = await this.prisma.executionHistory.aggregate({
      where: {
        workflowId,
        status: 'completed',
      },
      _avg: {
        duration: true,
      },
    });

    return {
      byStatus: stats.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      avgDuration: avgDuration._avg.duration,
    };
  }
}
