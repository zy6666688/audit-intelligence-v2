/**
 * OCRExtractNode 测试
 */

import { OCRExtractNode } from '../preprocess/OCRExtractNode';
import { NodeTestFramework } from './test-framework';
import type { Records } from '../../../types/AuditDataTypes';

export async function testOCRExtractNode() {
  const node = new OCRExtractNode();
  
  return NodeTestFramework.runTestSuite('OCRExtractNode', [
    {
      name: 'should extract text from images',
      fn: async () => {
        const context = NodeTestFramework.createTestContext({
          ai: {
            ocr: async (imagePath: string) => 'Mock OCR result for ' + imagePath,
            chat: async () => '',
            embedding: async () => [],
            analyze: async () => ({})
          } as any
        });
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'id', type: 'string', required: true, description: 'ID' },
            { name: 'image_path', type: 'string', required: true, description: 'Image Path' }
          ],
          data: [
            { id: '001', image_path: '/test/image1.jpg' },
            { id: '002', image_path: '/test/image2.jpg' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 2,
          columnCount: 2
        };
        
        const result = await node.execute(
          { images: inputRecords },
          {
            provider: 'aliyun',
            minConfidence: 0.5
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        NodeTestFramework.assertOutputHasField(result, 'texts');
        NodeTestFramework.assertOutputHasField(result, 'metadata');
        
        const texts = result.outputs.texts as Records;
        if (texts.rowCount !== 2) {
          throw new Error(`Expected 2 results, got ${texts.rowCount}`);
        }
      }
    },
    
    {
      name: 'should filter by confidence threshold',
      fn: async () => {
        const context = NodeTestFramework.createTestContext({
          ai: {
            ocr: async (imagePath: string) => 'Sample text',
            chat: async () => '',
            embedding: async () => [],
            analyze: async () => ({})
          } as any
        });
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'image_path', type: 'string', required: true, description: 'Image Path' }
          ],
          data: [
            { image_path: '/test/low_quality.jpg' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 1,
          columnCount: 1
        };
        
        const result = await node.execute(
          { images: inputRecords },
          {
            provider: 'aliyun',
            minConfidence: 0.8  // 高于实际置信度
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const texts = result.outputs.texts as Records;
        
        // 应该被过滤掉
        if (texts.rowCount !== 0) {
          throw new Error('Low confidence result should be filtered');
        }
      }
    },
    
    {
      name: 'should handle batch processing',
      fn: async () => {
        const context = NodeTestFramework.createTestContext({
          ai: {
            ocr: async (imagePath: string) => 'Text from ' + imagePath,
            chat: async () => '',
            embedding: async () => [],
            analyze: async () => ({})
          } as any
        });
        
        const data = Array.from({ length: 25 }, (_, i) => ({
          id: String(i + 1),
          image_path: `/test/batch_${i + 1}.jpg`
        }));
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'id', type: 'string', required: true, description: 'ID' },
            { name: 'image_path', type: 'string', required: true, description: 'Image Path' }
          ],
          data,
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 25,
          columnCount: 2
        };
        
        const result = await node.execute(
          { images: inputRecords },
          {
            provider: 'aliyun',
            batchSize: 10  // 批处理大小
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const texts = result.outputs.texts as Records;
        
        if (texts.rowCount !== 25) {
          throw new Error(`Expected 25 results, got ${texts.rowCount}`);
        }
      }
    },
    
    {
      name: 'should use cache for repeated images',
      fn: async () => {
        let ocrCallCount = 0;
        const cache = new Map<string, any>();
        
        const context = NodeTestFramework.createTestContext({
          ai: {
            ocr: async (imagePath: string) => {
              ocrCallCount++;
              return 'OCR result';
            },
            chat: async () => '',
            embedding: async () => [],
            analyze: async () => ({})
          } as any,
          cache: {
            get: async (key: string) => cache.get(key),
            set: async (key: string, value: any) => { cache.set(key, value); },
            has: async (key: string) => cache.has(key),
            delete: async (key: string) => { cache.delete(key); return true; }
          } as any
        });
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'image_path', type: 'string', required: true, description: 'Image Path' }
          ],
          data: [
            { image_path: '/test/same.jpg' },
            { image_path: '/test/same.jpg' }  // 重复图片
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 2,
          columnCount: 1
        };
        
        const result = await node.execute(
          { images: inputRecords },
          {
            provider: 'aliyun',
            enableCache: true
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        
        // 应该只调用一次OCR（第二次使用缓存）
        if (ocrCallCount > 1) {
          throw new Error(`Expected 1 OCR call, got ${ocrCallCount}`);
        }
      }
    },
    
    {
      name: 'should generate metadata summary',
      fn: async () => {
        const context = NodeTestFramework.createTestContext({
          ai: {
            ocr: async () => 'Sample text',
            chat: async () => '',
            embedding: async () => [],
            analyze: async () => ({})
          } as any
        });
        
        const inputRecords: Records = {
          type: 'Records',
          schema: [
            { name: 'image_path', type: 'string', required: true, description: 'Image Path' }
          ],
          data: [
            { image_path: '/test/image1.jpg' },
            { image_path: '/test/image2.jpg' },
            { image_path: '/test/image3.jpg' }
          ],
          metadata: NodeTestFramework.createTestMetadata(),
          rowCount: 3,
          columnCount: 1
        };
        
        const result = await node.execute(
          { images: inputRecords },
          {
            provider: 'aliyun',
            minConfidence: 0.5
          },
          context
        );

        NodeTestFramework.assertSuccess(result);
        const metadata = result.outputs.metadata as Records;
        
        // 验证元数据包含关键指标
        const metrics = metadata.data.map((m: any) => m.metric);
        if (!metrics.includes('total_images')) {
          throw new Error('Missing total_images metric');
        }
        if (!metrics.includes('successful')) {
          throw new Error('Missing successful metric');
        }
      }
    }
  ]);
}
