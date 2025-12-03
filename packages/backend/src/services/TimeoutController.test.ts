/**
 * TimeoutController测试
 * Week 2 Day 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TimeoutController, TimeoutError } from './TimeoutController';

describe('TimeoutController', () => {
  let controller: TimeoutController;

  beforeEach(() => {
    controller = new TimeoutController(1000);
  });

  describe('executeWithTimeout', () => {
    it('应该成功执行快速函数', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      };
      
      const result = await controller.executeWithTimeout(fn, 100);
      expect(result).toBe('success');
    });

    it('应该在超时后抛出错误', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'success';
      };
      
      await expect(
        controller.executeWithTimeout(fn, 50)
      ).rejects.toThrow(TimeoutError);
    });

    it('超时错误应该包含超时时间', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      };
      
      try {
        await controller.executeWithTimeout(fn, 50);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect(error.timeout).toBe(50);
      }
    });

    it('应该使用默认超时时间', async () => {
      controller.setDefaultTimeout(50);
      
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      };
      
      await expect(
        controller.executeWithTimeout(fn)
      ).rejects.toThrow(TimeoutError);
    });
  });

  describe('raceWithTimeout', () => {
    it('应该在Promise完成前返回', async () => {
      const promise = Promise.resolve('result');
      const result = await controller.raceWithTimeout(promise, 100);
      expect(result).toBe('result');
    });

    it('应该在超时后拒绝', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve('late'), 200));
      
      await expect(
        controller.raceWithTimeout(promise, 50)
      ).rejects.toThrow(TimeoutError);
    });
  });

  describe('createCancellable', () => {
    it('应该创建可取消的Promise', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve('result'), 100));
      const cancellable = controller.createCancellable(promise);
      
      cancellable.cancel();
      
      await expect(cancellable.promise).rejects.toThrow('cancelled');
    });

    it('未取消的Promise应该正常解析', async () => {
      const promise = Promise.resolve('result');
      const cancellable = controller.createCancellable(promise);
      
      const result = await cancellable.promise;
      expect(result).toBe('result');
    });
  });

  describe('executeAllWithTimeout', () => {
    it('应该执行所有Promise', async () => {
      const promises = [
        Promise.resolve(1),
        Promise.resolve(2),
        Promise.resolve(3)
      ];
      
      const results = await controller.executeAllWithTimeout(promises, 100);
      expect(results).toEqual([1, 2, 3]);
    });

    it('任一Promise超时应该拒绝', async () => {
      const promises = [
        Promise.resolve(1),
        new Promise(resolve => setTimeout(() => resolve(2), 200)),
        Promise.resolve(3)
      ];
      
      await expect(
        controller.executeAllWithTimeout(promises, 50)
      ).rejects.toThrow(TimeoutError);
    });
  });

  describe('retry', () => {
    it('应该在首次成功时返回', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        return 'success';
      };
      
      const result = await controller.retry(fn, { maxAttempts: 3, timeout: 100, delay: 10 });
      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('应该重试失败的函数', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('fail');
        }
        return 'success';
      };
      
      const result = await controller.retry(fn, { maxAttempts: 3, timeout: 100, delay: 10 });
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('达到最大尝试次数后应该抛出错误', async () => {
      const fn = async () => {
        throw new Error('always fail');
      };
      
      await expect(
        controller.retry(fn, { maxAttempts: 2, timeout: 50, delay: 10 })
      ).rejects.toThrow('Failed after 2 attempts');
    });
  });

  describe('配置', () => {
    it('应该能设置和获取默认超时', () => {
      controller.setDefaultTimeout(5000);
      expect(controller.getDefaultTimeout()).toBe(5000);
    });

    it('设置非正数超时应该抛出错误', () => {
      expect(() => controller.setDefaultTimeout(0)).toThrow();
      expect(() => controller.setDefaultTimeout(-100)).toThrow();
    });
  });

  describe('delay', () => {
    it('应该延迟指定时间', async () => {
      const start = Date.now();
      await controller.delay(50);
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(150);
    });
  });
});
