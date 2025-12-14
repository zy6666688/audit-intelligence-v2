/**
 * WebSocketServer - WebSocket服务
 * Week 7: 实时协作通信
 * 
 * 功能:
 * 1. WebSocket连接管理
 * 2. 锁事件广播
 * 3. 心跳检测
 * 4. 用户在线状态
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import { nodeLockManager, type LockEvent } from './NodeLockManager';

/**
 * WebSocket消息类型
 */
export enum WSMessageType {
  // 连接相关
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  PING = 'ping',
  PONG = 'pong',
  
  // 锁相关
  LOCK_ACQUIRED = 'lock_acquired',
  LOCK_RELEASED = 'lock_released',
  LOCK_RENEWED = 'lock_renewed',
  LOCK_EXPIRED = 'lock_expired',
  LOCK_FORCE_RELEASED = 'lock_force_released',
  
  // 用户状态
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  USER_LIST = 'user_list',
  
  // 光标和选择
  CURSOR_MOVE = 'cursor_move',
  SELECTION_CHANGE = 'selection_change'
}

/**
 * WebSocket消息
 */
export interface WSMessage {
  type: WSMessageType;
  payload: any;
  timestamp: string;
}

/**
 * 连接的客户端信息
 */
interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  graphId?: string;
  lastPing: Date;
}

/**
 * WebSocket服务器
 */
export class CollaborationWebSocketServer extends EventEmitter {
  private wss: WSServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private pingInterval!: NodeJS.Timeout;
  
  private readonly PING_INTERVAL = 30000; // 30秒
  private readonly PING_TIMEOUT = 60000; // 60秒超时
  
  constructor(server: HTTPServer) {
    super();
    
    // 创建WebSocket服务器
    this.wss = new WSServer({ 
      server,
      path: '/ws/collaboration'
    });
    
    this.setupWebSocketServer();
    this.startPingCheck();
    
    // 监听锁事件
    this.setupLockEventListeners();
  }
  
  /**
   * 设置WebSocket服务器
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      console.log('🔗 New WebSocket connection');
      
      // 等待客户端发送身份信息
      ws.on('message', (data: any) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('❌ Failed to parse message:', error);
        }
      });
      
      ws.on('close', () => {
        this.handleDisconnect(ws);
      });
      
      ws.on('error', (error: any) => {
        console.error('❌ WebSocket error:', error);
      });
    });
  }
  
  /**
   * 处理消息
   */
  private handleMessage(ws: WebSocket, message: WSMessage): void {
    switch (message.type) {
      case WSMessageType.CONNECT:
        this.handleConnect(ws, message.payload);
        break;
        
      case WSMessageType.PING:
        this.handlePing(ws);
        break;
        
      case WSMessageType.CURSOR_MOVE:
        this.broadcastToGraph(message.payload.graphId, message, ws);
        break;
        
      case WSMessageType.SELECTION_CHANGE:
        this.broadcastToGraph(message.payload.graphId, message, ws);
        break;
        
      default:
        console.warn('⚠️ Unknown message type:', message.type);
    }
  }
  
  /**
   * 处理连接
   */
  private handleConnect(ws: WebSocket, payload: {
    userId: string;
    userName: string;
    graphId?: string;
  }): void {
    const { userId, userName, graphId } = payload;
    
    // 保存客户端信息
    const client: ConnectedClient = {
      ws,
      userId,
      userName,
      graphId,
      lastPing: new Date()
    };
    
    this.clients.set(userId, client);
    
    console.log(`✅ User connected: ${userName} (${userId})`);
    
    // 发送当前在线用户列表
    this.sendUserList(ws, graphId);
    
    // 广播用户加入事件
    if (graphId) {
      this.broadcastToGraph(graphId, {
        type: WSMessageType.USER_JOINED,
        payload: { userId, userName },
        timestamp: new Date().toISOString()
      }, ws);
    }
  }
  
  /**
   * 处理断开连接
   */
  private handleDisconnect(ws: WebSocket): void {
    // 查找并移除客户端
    for (const [userId, client] of this.clients.entries()) {
      if (client.ws === ws) {
        const { userName, graphId } = client;
        
        // 释放用户的所有锁
        nodeLockManager.releaseUserLocks(userId);
        
        // 移除客户端
        this.clients.delete(userId);
        
        console.log(`👋 User disconnected: ${userName} (${userId})`);
        
        // 广播用户离开事件
        if (graphId) {
          this.broadcastToGraph(graphId, {
            type: WSMessageType.USER_LEFT,
            payload: { userId, userName },
            timestamp: new Date().toISOString()
          });
        }
        
        break;
      }
    }
  }
  
  /**
   * 处理心跳
   */
  private handlePing(ws: WebSocket): void {
    // 更新最后ping时间
    for (const client of this.clients.values()) {
      if (client.ws === ws) {
        client.lastPing = new Date();
        
        // 发送pong
        this.send(ws, {
          type: WSMessageType.PONG,
          payload: {},
          timestamp: new Date().toISOString()
        });
        
        break;
      }
    }
  }
  
  /**
   * 设置锁事件监听
   */
  private setupLockEventListeners(): void {
    nodeLockManager.on('lockEvent', (event: LockEvent) => {
      let messageType: WSMessageType;
      
      switch (event.type) {
        case 'acquired':
          messageType = WSMessageType.LOCK_ACQUIRED;
          break;
        case 'released':
          messageType = WSMessageType.LOCK_RELEASED;
          break;
        case 'renewed':
          messageType = WSMessageType.LOCK_RENEWED;
          break;
        case 'expired':
          messageType = WSMessageType.LOCK_EXPIRED;
          break;
        case 'force_released':
          messageType = WSMessageType.LOCK_FORCE_RELEASED;
          break;
        default:
          return;
      }
      
      // 广播锁事件到所有客户端
      this.broadcast({
        type: messageType,
        payload: {
          nodeId: event.nodeId,
          userId: event.userId,
          userName: event.userName
        },
        timestamp: new Date().toISOString()
      });
    });
  }
  
  /**
   * 发送消息给指定客户端
   */
  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * 广播消息到所有客户端
   */
  private broadcast(message: WSMessage, exclude?: WebSocket): void {
    for (const client of this.clients.values()) {
      if (client.ws !== exclude) {
        this.send(client.ws, message);
      }
    }
  }
  
  /**
   * 广播消息到指定图的所有客户端
   */
  private broadcastToGraph(
    graphId: string,
    message: WSMessage,
    exclude?: WebSocket
  ): void {
    for (const client of this.clients.values()) {
      if (client.graphId === graphId && client.ws !== exclude) {
        this.send(client.ws, message);
      }
    }
  }
  
  /**
   * 发送在线用户列表
   */
  private sendUserList(ws: WebSocket, graphId?: string): void {
    const users = Array.from(this.clients.values())
      .filter(client => !graphId || client.graphId === graphId)
      .map(client => ({
        userId: client.userId,
        userName: client.userName
      }));
    
    this.send(ws, {
      type: WSMessageType.USER_LIST,
      payload: { users },
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * 启动心跳检查
   */
  private startPingCheck(): void {
    this.pingInterval = setInterval(() => {
      const now = new Date();
      
      for (const [userId, client] of this.clients.entries()) {
        const timeSinceLastPing = now.getTime() - client.lastPing.getTime();
        
        // 检查超时
        if (timeSinceLastPing > this.PING_TIMEOUT) {
          console.log(`⏰ Client timeout: ${client.userName}`);
          client.ws.close();
          this.clients.delete(userId);
        } else {
          // 发送ping
          this.send(client.ws, {
            type: WSMessageType.PING,
            payload: {},
            timestamp: new Date().toISOString()
          });
        }
      }
    }, this.PING_INTERVAL);
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalConnections: this.clients.size,
      clients: Array.from(this.clients.values()).map(client => ({
        userId: client.userId,
        userName: client.userName,
        graphId: client.graphId,
        lastPing: client.lastPing.toISOString()
      }))
    };
  }
  
  /**
   * 关闭服务器
   */
  close(): void {
    clearInterval(this.pingInterval);
    this.wss.close();
    this.clients.clear();
  }
}
