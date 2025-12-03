/**
 * 文件管理路由
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authMiddleware';
import { requirePermission, Permission } from '../middleware/rbacMiddleware';
import { auditLog } from '../middleware/auditLogMiddleware';
import { fileStorageService } from '../services/FileStorageService';
import { fileRepository } from '../repositories/FileRepository';

const router = Router();

// 配置multer - 使用内存存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10 // 最多10个文件
  },
  fileFilter: (req, file, cb) => {
    // 可以在这里添加文件类型过滤
    cb(null, true);
  }
});

/**
 * @route POST /api/files/upload
 * @desc 上传单个文件
 * @access Private
 */
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  auditLog('upload', 'file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '未提供文件'
        });
      }

      const userId = (req as any).user.id;
      const { projectId, workflowId, category, description } = req.body;

      // 上传文件到存储
      const fileInfo = await fileStorageService.uploadFile({
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        buffer: req.file.buffer,
        size: req.file.size
      });

      // 保存文件记录到数据库
      const file = await fileRepository.create({
        filename: fileInfo.filename,
        originalName: fileInfo.originalName,
        mimeType: fileInfo.mimeType,
        size: fileInfo.size,
        path: fileInfo.path,
        url: fileInfo.url,
        uploadedBy: userId,
        projectId: projectId || undefined,
        workflowId: workflowId || undefined,
        category: category || undefined,
        description: description || undefined
      });

      res.json({
        success: true,
        data: file,
        message: '文件上传成功'
      });
    } catch (error: any) {
      console.error('文件上传失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '文件上传失败'
      });
    }
  }
);

/**
 * @route POST /api/files/upload-multiple
 * @desc 上传多个文件
 * @access Private
 */
router.post(
  '/upload-multiple',
  authenticate,
  upload.array('files', 10),
  auditLog('upload_multiple', 'file'),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: '未提供文件'
        });
      }

      const userId = (req as any).user.id;
      const { projectId, workflowId, category, description } = req.body;

      // 上传所有文件
      const uploadedFiles = await fileStorageService.uploadFiles(
        files.map(file => ({
          fieldname: file.fieldname,
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype,
          buffer: file.buffer,
          size: file.size
        }))
      );

      // 批量创建文件记录
      const fileRecords = await fileRepository.createMany(
        uploadedFiles.map(fileInfo => ({
          filename: fileInfo.filename,
          originalName: fileInfo.originalName,
          mimeType: fileInfo.mimeType,
          size: fileInfo.size,
          path: fileInfo.path,
          url: fileInfo.url,
          uploadedBy: userId,
          projectId: projectId || undefined,
          workflowId: workflowId || undefined,
          category: category || undefined,
          description: description || undefined
        }))
      );

      res.json({
        success: true,
        data: fileRecords,
        message: `成功上传${fileRecords.length}个文件`
      });
    } catch (error: any) {
      console.error('批量上传失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '批量上传失败'
      });
    }
  }
);

/**
 * @route GET /api/files
 * @desc 获取文件列表
 * @access Private
 */
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const {
        page = 1,
        limit = 20,
        projectId,
        workflowId,
        category,
        mimeType
      } = req.query;

      const result = await fileRepository.findMany({
        page: Number(page),
        limit: Number(limit),
        projectId: projectId as string,
        workflowId: workflowId as string,
        category: category as string,
        mimeType: mimeType as string
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('获取文件列表失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取文件列表失败'
      });
    }
  }
);

/**
 * @route GET /api/files/:id
 * @desc 获取文件详情
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const file = await fileRepository.findById(id);

      if (!file) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }

      res.json({
        success: true,
        data: file
      });
    } catch (error: any) {
      console.error('获取文件详情失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取文件详情失败'
      });
    }
  }
);

/**
 * @route GET /api/files/download/:id
 * @desc 下载文件
 * @access Private
 */
router.get(
  '/download/:id',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const file = await fileRepository.findById(id);

      if (!file) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }

      const fullPath = fileStorageService.getFullPath(file.storagePath);
      
      res.download(fullPath, file.originalName, (err) => {
        if (err) {
          console.error('文件下载失败:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: '文件下载失败'
            });
          }
        }
      });
    } catch (error: any) {
      console.error('文件下载失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '文件下载失败'
      });
    }
  }
);

/**
 * @route PATCH /api/files/:id
 * @desc 更新文件信息
 * @access Private
 */
router.patch(
  '/:id',
  authenticate,
  auditLog('update', 'file'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { category, description } = req.body;

      const file = await fileRepository.update(id, {
        category,
        description
      });

      res.json({
        success: true,
        data: file,
        message: '文件信息更新成功'
      });
    } catch (error: any) {
      console.error('更新文件信息失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '更新文件信息失败'
      });
    }
  }
);

/**
 * @route DELETE /api/files/:id
 * @desc 删除文件
 * @access Private
 */
router.delete(
  '/:id',
  authenticate,
  requirePermission(Permission.FILE_DELETE),
  auditLog('delete', 'file'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // 获取文件信息
      const file = await fileRepository.findById(id);
      if (!file) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }

      // 删除物理文件
      await fileStorageService.deleteFile(file.storagePath);

      // 删除数据库记录
      await fileRepository.delete(id);

      res.json({
        success: true,
        message: '文件删除成功'
      });
    } catch (error: any) {
      console.error('删除文件失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '删除文件失败'
      });
    }
  }
);

/**
 * @route GET /api/files/stats/overview
 * @desc 获取文件统计信息
 * @access Private
 */
router.get(
  '/stats/overview',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string | undefined;
      const stats = await fileRepository.getStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('获取文件统计失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取文件统计失败'
      });
    }
  }
);

export default router;
