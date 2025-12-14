/**
 * 全局类型定义
 */

/// <reference types="@dcloudio/types" />

/**
 * Vue文件模块声明
 */
declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

/**
 * Vite环境变量
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_WXWORK_APPID: string;
  readonly VITE_QWEN_API_KEY: string;
  readonly VITE_OSS_BUCKET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * uni-app全局对象（已在@dcloudio/types中定义）
 */
declare const uni: UniApp.Uni;

/**
 * 微信小程序全局对象
 */
declare const wx: WechatMiniprogram.Wx;

/**
 * 自定义类型扩展
 */
declare namespace UniApp {
  interface Uni {
    // 存储API
    getStorageSync(key: string): any;
    setStorageSync(key: string, data: any): void;
    removeStorageSync(key: string): void;
    clearStorageSync(): void;
    getStorageInfoSync(): {
      keys: string[];
      currentSize: number;
      limitSize: number;
    };
    
    // 登录API
    login(options: { provider?: string; timeout?: number }): Promise<any>;
    
    // 网络请求API
    request(options: {
      url: string;
      data?: any;
      header?: any;
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      timeout?: number;
      dataType?: string;
      responseType?: string;
    }): Promise<any>;
    
    // 上传下载API
    uploadFile(options: {
      url: string;
      filePath: string;
      name: string;
      header?: any;
      formData?: any;
      timeout?: number;
    }): Promise<any>;
    
    // 文件选择API
    chooseImage(options: {
      count?: number;
      sourceType?: string[];
      sizeType?: string[];
    }): Promise<any>;
    
    chooseVideo(options: {
      sourceType?: string[];
      maxDuration?: number;
      camera?: string;
    }): Promise<any>;
    
    chooseMessageFile(options: {
      count?: number;
      type?: string;
      extension?: string[];
    }): Promise<any>;
    
    // 导航API
    navigateTo(options: { url: string; animationType?: string; animationDuration?: number }): void;
    redirectTo(options: { url: string }): void;
    reLaunch(options: { url: string }): void;
    switchTab(options: { url: string }): void;
    navigateBack(options: { delta?: number }): void;
    
    // UI交互API
    showToast(options: {
      title: string;
      icon?: 'success' | 'loading' | 'error' | 'none';
      image?: string;
      duration?: number;
      mask?: boolean;
    }): void;
    
    showLoading(options: { title: string; mask?: boolean }): void;
    hideLoading(): void;
    
    showModal(options: {
      title?: string;
      content: string;
      showCancel?: boolean;
      cancelText?: string;
      confirmText?: string;
    }): Promise<any>;
    
    showActionSheet(options: { itemList: string[]; itemColor?: string }): Promise<any>;
    
    // 剪贴板API
    setClipboardData(options: { data: string; showToast?: boolean }): Promise<any>;
    getClipboardData(): Promise<any>;
    
    // 扫码API
    scanCode(options: {
      scanType?: string[];
      onlyFromCamera?: boolean;
    }): Promise<any>;
    
    // 网络状态API
    getNetworkType(): Promise<any>;
    onNetworkStatusChange(callback: (res: any) => void): void;
    
    // 图片预览和保存API
    previewImage(options: {
      urls: string[];
      current?: number | string;
      indicator?: string;
      loop?: boolean;
    }): void;
    
    saveImageToPhotosAlbum(options: { filePath: string }): Promise<any>;
    
    // 震动API
    vibrateShort(options?: { type?: 'heavy' | 'medium' | 'light' }): void;
    vibrateLong(): void;
  }
}
