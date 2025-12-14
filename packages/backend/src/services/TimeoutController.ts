/**
 * TimeoutController - 超时控制器
 * Week 2 Day 2
 * 
 * 提供超时控制和可取消Promise功能
 */

/**
 * 超时错误
 */
export class TimeoutError extends Error {
  constructor(message: string, public timeout: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * 可取消的Promise包装器
 */
export interface CancellablePromise<T> {
  promise: Promise<T>;
  cancel: () => void;
}

/**
 * TimeoutController - 超时控制器
 * 
 * 特性:
 * - 执行带超时的异步函数
 * - 创建可取消的Promise
 * - 支持AbortSignal集成
 */
export class TimeoutController {
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * 执行带超时的异步函数
   */
  async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout?: number
  ): Promise<T> {
    const actualTimeout = timeout ?? this.defaultTimeout;
    
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(
          `Operation timed out after ${actualTimeout}ms`,
          actualTimeout
        ));
      }, actualTimeout);
      
      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 创建带超时的Promise竞赛
   */
  async raceWithTimeout<T>(
    promise: Promise<T>,
    timeout?: number
  ): Promise<T> {
    const actualTimeout = timeout ?? this.defaultTimeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(
          `Promise timed out after ${actualTimeout}ms`,
          actualTimeout
        ));
      }, actualTimeout);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * 创建可取消的Promise
   */
  createCancellable<T>(promise: Promise<T>): CancellablePromise<T> {
    let cancelled = false;
    let cancelReject: (reason: Error) => void;
    
    const cancellablePromise = new Promise<T>((resolve, reject) => {
      cancelReject = reject;
      
      promise
        .then(result => {
          if (!cancelled) {
            resolve(result);
          }
        })
        .catch(error => {
          if (!cancelled) {
            reject(error);
          }
        });
    });
    
    return {
      promise: cancellablePromise,
      cancel: () => {
        if (!cancelled) {
          cancelled = true;
          cancelReject(new Error('Promise cancelled'));
        }
      }
    };
  }

  /**
   * 使用AbortSignal执行异步函数
   */
  async executeWithSignal<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    timeout?: number
  ): Promise<T> {
    const actualTimeout = timeout ?? this.defaultTimeout;
    const controller = new AbortController();
    
    const timer = setTimeout(() => {
      controller.abort();
    }, actualTimeout);
    
    try {
      const result = await fn(controller.signal);
      clearTimeout(timer);
      return result;
    } catch (error: any) {
      clearTimeout(timer);
      
      if (error.name === 'AbortError') {
        throw new TimeoutError(
          `Operation aborted after ${actualTimeout}ms`,
          actualTimeout
        );
      }
      
      throw error;
    }
  }

  /**
   * 批量执行带超时的Promise
   */
  async executeAllWithTimeout<T>(
    promises: Promise<T>[],
    timeout?: number
  ): Promise<T[]> {
    const actualTimeout = timeout ?? this.defaultTimeout;
    
    const wrappedPromises = promises.map(p => 
      this.raceWithTimeout(p, actualTimeout)
    );
    
    return Promise.all(wrappedPromises);
  }

  /**
   * 设置默认超时时间
   */
  setDefaultTimeout(timeout: number): void {
    if (timeout <= 0) {
      throw new Error('Timeout must be positive');
    }
    this.defaultTimeout = timeout;
  }

  /**
   * 获取默认超时时间
   */
  getDefaultTimeout(): number {
    return this.defaultTimeout;
  }

  /**
   * 创建延迟Promise
   */
  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重试执行（带超时）
   */
  async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      timeout?: number;
      delay?: number;
      backoff?: 'linear' | 'exponential';
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      timeout = this.defaultTimeout,
      delay: initialDelay = 1000,
      backoff = 'linear'
    } = options;
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.executeWithTimeout(fn, timeout);
      } catch (error: any) {
        lastError = error;
        
        // 最后一次尝试不延迟
        if (attempt < maxAttempts) {
          const delayMs = backoff === 'exponential'
            ? initialDelay * Math.pow(2, attempt - 1)
            : initialDelay * attempt;
          
          await this.delay(delayMs);
        }
      }
    }
    
    throw new Error(
      `Failed after ${maxAttempts} attempts. Last error: ${lastError?.message}`
    );
  }
}
