/* uni-app 类型扩展 */

// 扩展 Button 组件
declare namespace UniApp {
  interface ButtonProps {
    type?: 'default' | 'primary' | 'warn';
    size?: 'default' | 'mini';
    plain?: boolean;
    disabled?: boolean;
    loading?: boolean;
  }
}

// Vue 运行时扩展，解决模板中的类型报错
declare module '@vue/runtime-dom' {
  interface ButtonHTMLAttributes {
    // 扩展标准 type 属性以包含 uni-app 的值
    type?: 'submit' | 'reset' | 'button' | 'primary' | 'warn' | 'default';
    size?: 'default' | 'mini';
    plain?: boolean;
    loading?: boolean;
  }
}

// uni API 返回类型
interface UniLoginResult {
  errMsg: string;
  code?: string;
  authResult?: string;
}

interface UniNetworkResult {
  errMsg: string;
  networkType: 'wifi' | '2g' | '3g' | '4g' | '5g' | 'unknown' | 'none';
}

interface UniScanCodeResult {
  errMsg: string;
  result: string;
  scanType: string;
  charSet: string;
  path: string;
}

interface UniFileResult {
  tempFilePaths: string[];
  tempFiles: Array<{
    path: string;
    size: number;
    name: string;
  }>;
}

interface UniImageResult {
  tempFilePaths: string[];
  tempFiles: Array<{
    path: string;
    size: number;
  }>;
}

interface UniVideoResult {
  tempFilePath: string;
  size: number;
  duration: number;
  width: number;
  height: number;
}
