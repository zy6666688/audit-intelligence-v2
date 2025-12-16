import apiClient, { BASE_URL } from "./axios-config";

let activeWS: WebSocket | null = null;

export interface ComfyObjectInfo {
  [nodeName: string]: {
    input: {
      required?: Record<string, any>;
      optional?: Record<string, any>;
    };
    output: string[];
    output_name: string[];
    name: string;
    display_name: string;
    description: string;
    category: string;
  };
}

export const comfyApi = {
  /**
   * 获取后端所有节点的元数据定义
   */
  async getObjectInfo(): Promise<ComfyObjectInfo> {
    try {
      // Use apiClient which handles auth
      const res = await apiClient.get<ComfyObjectInfo>('/object_info');
      return res.data;
    } catch (e) {
      console.error("Failed to fetch object info from backend", e);
      return {};
    }
  },

  /**
   * 提交任务到后端
   */
  async postPrompt(prompt: any, clientId: string) {
    // Use apiClient which handles auth
    return apiClient.post('/prompt', {
      prompt,
      client_id: clientId
    });
  },

  /**
   * 建立 WebSocket 连接 (支持自动重连，最多10次)
   */
  connectWS(clientId: string, onMessage: (data: any) => void): void {
    let ws: WebSocket;
    let reconnectDelay = 1000;
    let isReconnecting = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;

    const connect = () => {
      if (isReconnecting) return;
      
      // Check max reconnection attempts
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`[WS] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
        return;
      }
      
      isReconnecting = true;
      reconnectAttempts++;

      console.log(`[WS] Connecting to backend... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      
      // Get WebSocket URL from BASE_URL (replace http:// with ws://)
      const wsUrl = BASE_URL.replace(/^http/, 'ws');
      
      // Get token from localStorage for authentication
      const token = localStorage.getItem('token');
      const wsUrlWithAuth = token 
        ? `${wsUrl}/ws?clientId=${clientId}&token=${token}`
        : `${wsUrl}/ws?clientId=${clientId}`;
      
      ws = new WebSocket(wsUrlWithAuth);
      activeWS = ws;
      
      ws.onopen = () => {
        console.log("[WS] Connected successfully");
        reconnectDelay = 1000; // Reset delay
        reconnectAttempts = 0; // Reset attempts on successful connection
        isReconnecting = false;
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          onMessage(data);
        } catch (e) {
          console.error("WS message parse error", e);
        }
      };

      ws.onclose = (event) => {
        console.warn(`[WS] Disconnected (Code: ${event.code}). Reconnecting in ${reconnectDelay}ms...`);
        isReconnecting = false;
        
        // Only reconnect if not manually closed (code 1000) or too many attempts
        if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 30000); // Cap at 30s
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.error("[WS] Too many reconnection failures. Please refresh the page.");
        }
      };

      ws.onerror = (err) => {
        console.error("[WS] Connection Error", err);
        ws.close(); // Force close to trigger onclose logic
      };
    };

    connect();
  },

  /**
   * 发送 WebSocket 消息 (用于协同)
   */
  sendWSMessage(data: any) {
    if (activeWS && activeWS.readyState === WebSocket.OPEN) {
      activeWS.send(JSON.stringify(data));
    }
  }
};
