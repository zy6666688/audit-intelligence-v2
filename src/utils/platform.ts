/**
 * 平台适配器
 * 统一处理小程序和H5的平台差异
 */

export type PlatformType = 'mp-weixin' | 'h5' | 'app';

/**
 * 获取当前平台
 */
export function getPlatform(): PlatformType {
  // #ifdef MP-WEIXIN
  return 'mp-weixin';
  // #endif
  
  // #ifdef H5
  return 'h5';
  // #endif
  
  // #ifdef APP
  return 'app';
  // #endif
  
  return 'h5';
}

/**
 * 判断是否为小程序
 */
export function isMiniProgram(): boolean {
  return getPlatform() === 'mp-weixin';
}

/**
 * 判断是否为H5
 */
export function isH5(): boolean {
  return getPlatform() === 'h5';
}

/**
 * 判断是否为App
 */
export function isApp(): boolean {
  return getPlatform() === 'app';
}

/**
 * 登录结果
 */
export interface LoginResult {
  token: string;
  userInfo: {
    id: string;
    name: string;
    avatar?: string;
    role: 'auditor' | 'manager' | 'partner';
  };
}

/**
 * 文件信息
 */
export interface FileInfo {
  path?: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

/**
 * 上传结果
 */
export interface UploadResult {
  url: string;
  size: number;
  sha256?: string;
  fileId: string;
}

/**
 * 平台适配器类
 */
export class PlatformAdapter {
  
  private static readonly API_BASE = (import.meta.env?.VITE_API_BASE as string) || 'https://api.audit.com';
  
  /**
   * 统一的登录
   */
  static async login(): Promise<LoginResult> {
    // #ifdef MP-WEIXIN
    return this.wxLogin();
    // #endif
    
    // #ifdef H5
    return this.h5Login();
    // #endif
    
    throw new Error('Unsupported platform');
  }
  
  /**
   * 微信小程序登录
   */
  // #ifdef MP-WEIXIN
  private static async wxLogin(): Promise<LoginResult> {
    try {
      // 1. 获取code
      const loginRes = await uni.login({ provider: 'weixin' });
      const code = loginRes.code;
      
      // 2. 发送code到后端换取token
      const res = await uni.request({
        url: `${this.API_BASE}/auth/wx-login`,
        method: 'POST',
        data: { code }
      });
      
      const data = res.data as { token: string; userInfo: any };
      
      // 3. 保存token
      uni.setStorageSync('token', data.token);
      uni.setStorageSync('userInfo', data.userInfo);
      
      return {
        token: data.token,
        userInfo: data.userInfo
      };
    } catch (error) {
      console.error('微信登录失败:', error);
      throw error;
    }
  }
  // #endif
  
  /**
   * H5登录
   */
  // #ifdef H5
  private static async h5Login(): Promise<LoginResult> {
    // 检查是否在企业微信浏览器中
    if (this.isWeChatWorkBrowser()) {
      return this.wxWorkLogin();
    }
    
    // 否则使用账号密码登录
    return this.passwordLogin();
  }
  
  /**
   * 检查是否为企业微信浏览器
   */
  private static isWeChatWorkBrowser(): boolean {
    const ua = navigator.userAgent.toLowerCase();
    return ua.indexOf('wxwork') !== -1;
  }
  
  /**
   * 企业微信登录
   */
  private static async wxWorkLogin(): Promise<LoginResult> {
    // 企业微信OAuth2.0登录流程
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (!code) {
      // 跳转到授权页面
      const appId = (import.meta.env?.VITE_WXWORK_APPID as string) || '';
      const redirectUri = encodeURIComponent(window.location.href);
      const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=STATE#wechat_redirect`;
      window.location.href = authUrl;
      throw new Error('Redirecting to auth page');
    }
    
    // 用code换取token
    const res = await fetch(`${this.API_BASE}/auth/wxwork-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    
    const data = await res.json();
    
    // 保存token
    localStorage.setItem('token', data.token);
    localStorage.setItem('userInfo', JSON.stringify(data.userInfo));
    
    return {
      token: data.token,
      userInfo: data.userInfo
    };
  }
  
  /**
   * 账号密码登录
   */
  private static async passwordLogin(): Promise<LoginResult> {
    // 这里应该跳转到登录页面，这里简化处理
    const username = prompt('请输入用户名');
    const password = prompt('请输入密码');
    
    if (!username || !password) {
      throw new Error('用户名或密码为空');
    }
    
    const res = await fetch(`${this.API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    
    // 保存token
    localStorage.setItem('token', data.token);
    localStorage.setItem('userInfo', JSON.stringify(data.userInfo));
    
    return {
      token: data.token,
      userInfo: data.userInfo
    };
  }
  // #endif
  
  /**
   * 登出
   */
  static async logout(): Promise<void> {
    // #ifdef MP-WEIXIN
    uni.removeStorageSync('token');
    uni.removeStorageSync('userInfo');
    uni.reLaunch({ url: '/pages/login/index' });
    // #endif
    
    // #ifdef H5
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    window.location.href = '/pages/login/index';
    // #endif
  }
  
  /**
   * 获取token
   */
  static getToken(): string {
    // #ifdef MP-WEIXIN
    return uni.getStorageSync('token') || '';
    // #endif
    
    // #ifdef H5
    return localStorage.getItem('token') || '';
    // #endif
    
    return '';
  }
  
  /**
   * 统一的文件选择
   */
  static async chooseFile(options: {
    count?: number;
    type?: 'image' | 'video' | 'file';
  }): Promise<FileInfo[]> {
    // #ifdef MP-WEIXIN
    return this.wxChooseFile(options);
    // #endif
    
    // #ifdef H5
    return this.h5ChooseFile(options);
    // #endif
    
    return [];
  }
  
  /**
   * 微信小程序选择文件
   */
  // #ifdef MP-WEIXIN
  private static async wxChooseFile(options: any): Promise<FileInfo[]> {
    if (options.type === 'image') {
      const res = await uni.chooseImage({
        count: options.count || 9,
        sourceType: ['album', 'camera']
      }) as any;
      
      return res.tempFilePaths.map((path: string) => ({
        path,
        name: path.split('/').pop() || '',
        size: 0,
        type: 'image'
      }));
    } else if (options.type === 'video') {
      const res = await uni.chooseVideo({
        sourceType: ['album', 'camera']
      }) as any;
      
      return [{
        path: res.tempFilePath,
        name: res.tempFilePath.split('/').pop() || '',
        size: res.size,
        type: 'video'
      }];
    } else {
      const res = await uni.chooseMessageFile({
        count: options.count || 5,
        type: 'file'
      }) as any;
      
      return res.tempFiles.map((file: any) => ({
        path: file.path,
        name: file.name,
        size: file.size,
        type: file.type
      }));
    }
  }
  // #endif
  
  /**
   * H5选择文件
   */
  // #ifdef H5
  private static async h5ChooseFile(options: any): Promise<FileInfo[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = (options.count || 1) > 1;
      
      if (options.type === 'image') {
        input.accept = 'image/*';
      } else if (options.type === 'video') {
        input.accept = 'video/*';
      }
      
      input.onchange = (e: any) => {
        const files = Array.from(e.target.files || []) as File[];
        const fileInfos: FileInfo[] = files.map(file => ({
          file,
          name: file.name,
          size: file.size,
          type: file.type
        }));
        resolve(fileInfos);
      };
      
      input.onerror = reject;
      input.click();
    });
  }
  // #endif
  
  /**
   * 统一的文件上传
   */
  static async uploadFile(fileInfo: FileInfo): Promise<UploadResult> {
    // #ifdef MP-WEIXIN
    return this.wxUploadFile(fileInfo);
    // #endif
    
    // #ifdef H5
    return this.h5UploadFile(fileInfo);
    // #endif
    
    throw new Error('Unsupported platform');
  }
  
  /**
   * 微信小程序上传文件
   */
  // #ifdef MP-WEIXIN
  private static async wxUploadFile(fileInfo: FileInfo): Promise<UploadResult> {
    const token = this.getToken();
    
    const res = await uni.uploadFile({
      url: `${this.API_BASE}/upload`,
      filePath: fileInfo.path!,
      name: 'file',
      header: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = JSON.parse(res.data as string);
    return {
      url: data.url,
      size: data.size,
      sha256: data.sha256,
      fileId: data.fileId
    };
  }
  // #endif
  
  /**
   * H5上传文件
   */
  // #ifdef H5
  private static async h5UploadFile(fileInfo: FileInfo): Promise<UploadResult> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', fileInfo.file!);
    
    const res = await fetch(`${this.API_BASE}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await res.json();
    return {
      url: data.url,
      size: data.size,
      sha256: data.sha256,
      fileId: data.fileId
    };
  }
  // #endif
  
  /**
   * 统一的本地存储 - 设置
   */
  static async setStorage(key: string, value: any): Promise<void> {
    // #ifdef MP-WEIXIN
    uni.setStorageSync(key, value);
    // #endif
    
    // #ifdef H5
    localStorage.setItem(key, JSON.stringify(value));
    // #endif
  }
  
  /**
   * 统一的本地存储 - 获取
   */
  static async getStorage<T = any>(key: string): Promise<T | null> {
    // #ifdef MP-WEIXIN
    return uni.getStorageSync(key) || null;
    // #endif
    
    // #ifdef H5
    const value = localStorage.getItem(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('解析存储数据失败:', error);
      return null;
    }
    // #endif
    
    return null;
  }
  
  /**
   * 统一的本地存储 - 删除
   */
  static async removeStorage(key: string): Promise<void> {
    // #ifdef MP-WEIXIN
    uni.removeStorageSync(key);
    // #endif
    
    // #ifdef H5
    localStorage.removeItem(key);
    // #endif
  }
  
  /**
   * 统一的导航 - 跳转
   */
  static navigateTo(url: string): void {
    // #ifdef MP-WEIXIN
    uni.navigateTo({ url });
    // #endif
    
    // #ifdef H5
    // 使用 uni-app 的路由（在H5中会自动转换）
    uni.navigateTo({ url });
    // #endif
  }
  
  /**
   * 统一的导航 - 重定向
   */
  static redirectTo(url: string): void {
    // #ifdef MP-WEIXIN
    uni.redirectTo({ url });
    // #endif
    
    // #ifdef H5
    uni.redirectTo({ url });
    // #endif
  }
  
  /**
   * 统一的导航 - 返回
   */
  static navigateBack(delta: number = 1): void {
    uni.navigateBack({ delta });
  }
  
  /**
   * 统一的复制文本
   */
  static async copyText(text: string): Promise<void> {
    // #ifdef MP-WEIXIN
    await uni.setClipboardData({ data: text });
    this.showToast('已复制');
    // #endif
    
    // #ifdef H5
    await navigator.clipboard.writeText(text);
    this.showToast('已复制');
    // #endif
  }
  
  /**
   * 统一的提示
   */
  static showToast(
    title: string, 
    icon: 'success' | 'error' | 'loading' | 'none' = 'none',
    duration: number = 2000
  ): void {
    uni.showToast({ 
      title, 
      icon: icon as any,
      duration 
    });
  }
  
  /**
   * 统一的加载提示
   */
  static showLoading(title: string = '加载中...'): void {
    uni.showLoading({ title });
  }
  
  /**
   * 隐藏加载提示
   */
  static hideLoading(): void {
    uni.hideLoading();
  }
  
  /**
   * 统一的确认框
   */
  static async showConfirm(options: {
    title: string;
    content: string;
    confirmText?: string;
    cancelText?: string;
  }): Promise<boolean> {
    const res = await uni.showModal({
      title: options.title,
      content: options.content,
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消'
    }) as any;
    
    return res.confirm;
  }
  
  /**
   * 统一的ActionSheet
   */
  static async showActionSheet(options: {
    itemList: string[];
  }): Promise<number> {
    const res = await uni.showActionSheet({
      itemList: options.itemList
    }) as any;
    
    return res.tapIndex;
  }
  
  /**
   * 扫码
   */
  static async scanCode(): Promise<string> {
    // #ifdef MP-WEIXIN
    const res = await uni.scanCode({
      scanType: ['qrCode', 'barCode']
    }) as any;
    return res.result;
    // #endif
    
    // #ifdef H5
    // H5需要使用第三方库或跳转到扫码页面
    throw new Error('H5暂不支持扫码，请使用小程序');
    // #endif
    
    return '';
  }
  
  /**
   * 检查网络状态
   */
  static async isOnline(): Promise<boolean> {
    // #ifdef MP-WEIXIN
    const res = await uni.getNetworkType() as any;
    return res.networkType !== 'none';
    // #endif
    
    // #ifdef H5
    return navigator.onLine;
    // #endif
    
    return true;
  }
  
  /**
   * 监听网络变化
   */
  static watchNetwork(callback: (isOnline: boolean) => void): void {
    // #ifdef MP-WEIXIN
    uni.onNetworkStatusChange((res: any) => {
      callback(res.isConnected);
    });
    // #endif
    
    // #ifdef H5
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
    // #endif
  }
  
  /**
   * 预览图片
   */
  static previewImage(options: {
    urls: string[];
    current?: number | string;
  }): void {
    uni.previewImage({
      urls: options.urls,
      current: options.current
    });
  }
  
  /**
   * 保存图片到相册
   */
  static async saveImageToPhotosAlbum(filePath: string): Promise<void> {
    // #ifdef MP-WEIXIN
    await uni.saveImageToPhotosAlbum({ filePath });
    this.showToast('保存成功');
    // #endif
    
    // #ifdef H5
    // H5需要下载图片
    const a = document.createElement('a');
    a.href = filePath;
    a.download = filePath.split('/').pop() || 'image.jpg';
    a.click();
    this.showToast('开始下载');
    // #endif
  }
  
  /**
   * 震动反馈
   */
  static vibrateShort(): void {
    // #ifdef MP-WEIXIN
    uni.vibrateShort({ type: 'medium' });
    // #endif
    
    // #ifdef H5
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
    // #endif
  }
}
