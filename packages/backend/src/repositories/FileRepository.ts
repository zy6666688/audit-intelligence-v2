/**
 * 文件数据访问层
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateFileDto {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  uploadedBy: string;
  projectId?: string;
  workflowId?: string;
  category?: string;
  description?: string;
}

export interface UpdateFileDto {
  description?: string;
  category?: string;
}

export interface FileQueryParams {
  page?: number;
  limit?: number;
  projectId?: string;
  workflowId?: string;
  uploadedBy?: string;
  category?: string;
  mimeType?: string;
}

export class FileRepository {
  /**
   * 创建文件记录
   */
  async create(data: CreateFileDto) {
    return prisma.file.create({
      data: {
        filename: data.filename,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: BigInt(data.size),
        storagePath: data.path,
        url: data.url,
        uploadedBy: data.uploadedBy,
        projectId: data.projectId,
        workflowId: data.workflowId,
        category: data.category,
        description: data.description
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        workflow: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  }

  /**
   * 批量创建文件记录
   */
  async createMany(files: CreateFileDto[]) {
    const createPromises = files.map(file => this.create(file));
    return Promise.all(createPromises);
  }

  /**
   * 根据ID获取文件
   */
  async findById(id: string) {
    return prisma.file.findUnique({
      where: { id },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        workflow: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  }

  /**
   * 查询文件列表
   */
  async findMany(params: FileQueryParams) {
    const {
      page = 1,
      limit = 20,
      projectId,
      workflowId,
      uploadedBy,
      category,
      mimeType
    } = params;

    const where: any = {};

    if (projectId) where.projectId = projectId;
    if (workflowId) where.workflowId = workflowId;
    if (uploadedBy) where.uploadedBy = uploadedBy;
    if (category) where.category = category;
    if (mimeType) {
      where.mimeType = {
        contains: mimeType
      };
    }

    const [items, total] = await Promise.all([
      prisma.file.findMany({
        where,
        include: {
          uploader: {
            select: {
              id: true,
              username: true,
              displayName: true,
              email: true
            }
          },
          project: {
            select: {
              id: true,
              name: true
            }
          },
          workflow: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.file.count({ where })
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 更新文件信息
   */
  async update(id: string, data: UpdateFileDto) {
    return prisma.file.update({
      where: { id },
      data: {
        description: data.description,
        category: data.category
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * 删除文件记录
   */
  async delete(id: string) {
    return prisma.file.delete({
      where: { id }
    });
  }

  /**
   * 获取文件统计
   */
  async getStats(userId?: string) {
    const where = userId ? { uploadedBy: userId } : {};

    const [total, totalSize, byType] = await Promise.all([
      prisma.file.count({ where }),
      prisma.file.aggregate({
        where,
        _sum: {
          size: true
        }
      }),
      prisma.file.groupBy({
        by: ['mimeType'],
        where,
        _count: true,
        _sum: {
          size: true
        }
      })
    ]);

    return {
      total,
      totalSize: totalSize._sum.size || 0,
      byType: byType.map(item => ({
        mimeType: item.mimeType,
        count: item._count,
        size: item._sum.size || 0
      }))
    };
  }
}

export const fileRepository = new FileRepository();
