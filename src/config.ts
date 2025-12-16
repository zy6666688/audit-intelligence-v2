/**
 * 前端配置管理
 * 优先从 window.__CONFIG__ 读取（运行时注入），回退到环境变量
 */

interface Config {
  API_BASE_URL: string;
}

// 声明全局配置对象（由后端注入）
declare global {
  interface Window {
    __CONFIG__?: Config;
  }
}

/**
 * 获取运行时配置
 * 优先级: window.__CONFIG__ > import.meta.env > 默认值
 */
export const config: Config = {
  API_BASE_URL:
    window.__CONFIG__?.API_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8000",
};

export default config;
