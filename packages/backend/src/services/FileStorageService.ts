/**
 * 文件存储服务
 * 支持本地存储和云存储（可扩展）
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface StoredFileInfo {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
}

export class FileStorageService {
  private uploadDir: string;
  private baseUrl: string;

  constructor() {
    // 上传目录配置
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    // 确保上传目录存在
    this.ensureUploadDir();
  }

  /**
   * 确保上传目录存在
   */
  private async ensureUploadDir(): Promise<void> {
    try {
      await mkdir(this.uploadDir, { recursive: true });
      
      // 创建子目录
      const subDirs = ['images', 'documents', 'others'];
      for (const dir of subDirs) {
        await mkdir(path.join(this.uploadDir, dir), { recursive: true });
      }
    } catch (error) {
      console.error('创建上传目录失败:', error);
    }
  }

  /**
   * 根据MIME类型获取存储子目录
   */
  private getSubDirectory(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'images';
    } else if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('sheet') ||
      mimeType.includes('presentation') ||
      mimeType.includes('text')
    ) {
      return 'documents';
    } else {
      return 'others';
    }
  }

  /**
   * 生成唯一文件名
   */
  private generateFileName(originalName: string): string {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0];
    return `${name}_${timestamp}_${uuid}${ext}`;
  }

  /**
   * 上传文件
   */
  async uploadFile(file: UploadedFile): Promise<StoredFileInfo> {
    try {
      const subDir = this.getSubDirectory(file.mimetype);
      const filename = this.generateFileName(file.originalname);
      const filePath = path.join(this.uploadDir, subDir, filename);
      
      // 写入文件
      await writeFile(filePath, file.buffer);
      
      // 生成文件信息
      const fileInfo: StoredFileInfo = {
        id: uuidv4(),
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: path.join(subDir, filename),
        url: `${this.baseUrl}/api/files/${subDir}/${filename}`
      };
      
      return fileInfo;
    } catch (error) {
      console.error('文件上传失败:', error);
      throw new Error('文件上传失败');
    }
  }

  /**
   * 批量上传文件
   */
  async uploadFiles(files: UploadedFile[]): Promise<StoredFileInfo[]> {
    const uploadPromises = files.map(file => this.uploadFile(file));
    return Promise.all(uploadPromises);
  }

  /**
   * 删除文件
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.uploadDir, filePath);
      await unlink(fullPath);
    } catch (error) {
      console.error('文件删除失败:', error);
      throw new Error('文件删除失败');
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(filePath: string): Promise<{ size: number; mtime: Date }> {
    try {
      const fullPath = path.join(this.uploadDir, filePath);
      const stats = await stat(fullPath);
      return {
        size: stats.size,
        mtime: stats.mtime
      };
    } catch (error) {
      console.error('获取文件信息失败:', error);
      throw new Error('文件不存在');
    }
  }

  /**
   * 获取文件的完整路径
   */
  getFullPath(filePath: string): string {
    return path.join(this.uploadDir, filePath);
  }

  /**
   * 验证文件类型
   */
  validateFileType(mimeType: string, allowedTypes?: string[]): boolean {
    if (!allowedTypes || allowedTypes.length === 0) {
      return true;
    }
    
    return allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        // 支持通配符，如 image/*
        const prefix = type.replace('/*', '');
        return mimeType.startsWith(prefix);
      }
      return mimeType === type;
    });
  }

  /**
   * 验证文件大小
   */
  validateFileSize(size: number, maxSize?: number): boolean {
    if (!maxSize) {
      return true;
    }
    return size <= maxSize;
  }
}

// 导出单例
export const fileStorageService = new FileStorageService();
