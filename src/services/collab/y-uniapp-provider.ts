import * as Y from 'yjs';
import { Observable } from 'lib0/observable';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

// 消息类型定义
const messageSync = 0;
const messageAwareness = 1;

/**
 * Y.js Provider for UniApp (WeChat Mini Program)
 * 实现完整的 Sync Protocol 和 Awareness Protocol
 */
export class YUniAppProvider extends Observable<string> {
  doc: Y.Doc;
  url: string;
  socket: UniApp.SocketTask | null = null;
  shouldConnect: boolean = false;
  awareness: awarenessProtocol.Awareness;
  
  constructor(url: string, roomName: string, doc: Y.Doc) {
    super();
    this.url = `${url}/${roomName}`;
    this.doc = doc;
    
    // 创建 Awareness (用于光标协同)
    this.awareness = new awarenessProtocol.Awareness(doc);
    
    this.doc.on('update', this.handleDocUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);
    
    this.connect();
  }

  connect() {
    this.shouldConnect = true;
    this.socket = uni.connectSocket({
      url: this.url,
      complete: () => {}
    });

    this.socket.onOpen(() => {
      console.log('[Yjs] WebSocket Connected');
      this.emit('status', [{ status: 'connected' }]);
      
      // 握手第一步：发送 Sync Step 1 (由客户端发起)
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      this.send(encoding.toUint8Array(encoder));

      // 发送初始 Awareness 状态
      if (this.awareness.getLocalState() !== null) {
        const awarenessEncoder = encoding.createEncoder();
        encoding.writeVarUint(awarenessEncoder, messageAwareness);
        awarenessProtocol.writeAwarenessUpdate(awarenessEncoder, this.awareness, [this.doc.clientID]);
        this.send(encoding.toUint8Array(awarenessEncoder));
      }
    });

    this.socket.onMessage((res) => {
      const buffer = res.data as ArrayBuffer;
      this.handleMessage(new Uint8Array(buffer));
    });

    this.socket.onClose(() => {
      console.log('[Yjs] Disconnected');
      this.emit('status', [{ status: 'disconnected' }]);
      this.socket = null;
      if (this.shouldConnect) {
        // 简单的指数退避重连
        setTimeout(() => this.connect(), 3000);
      }
    });
    
    this.socket.onError((err) => {
      console.error('[Yjs] WebSocket Error:', err);
    });
  }

  disconnect() {
    this.shouldConnect = false;
    this.doc.off('update', this.handleDocUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);
    if (this.socket) {
      this.socket.close({});
    }
  }

  // 处理接收到的二进制消息
  private handleMessage(buf: Uint8Array) {
    const decoder = decoding.createDecoder(buf);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case messageSync:
        // 处理同步消息
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        // readSyncMessage 会根据 Step 1/2 自动处理并写入响应
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, null);
        
        // 如果 encoder 有内容（即需要回复 Step 2 或 Update），则发送
        if (encoding.length(encoder) > 1) {
          this.send(encoding.toUint8Array(encoder));
        }
        break;
        
      case messageAwareness:
        // 处理感知消息（光标位置等）
        awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
        break;
        
      default:
        console.warn('[Yjs] Unknown message type:', messageType);
    }
  }

  // 监听本地文档更新 -> 发送给服务端
  private handleDocUpdate = (update: Uint8Array, origin: any) => {
    if (origin !== this) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      this.send(encoding.toUint8Array(encoder));
    }
  }

  // 监听本地 Awareness 更新 -> 发送给服务端
  private handleAwarenessUpdate = ({ added, updated, removed }: any, origin: any) => {
    if (origin !== this) {
      const changedClients = added.concat(updated).concat(removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      awarenessProtocol.writeAwarenessUpdate(encoder, this.awareness, changedClients);
      this.send(encoding.toUint8Array(encoder));
    }
  }

  private send(buf: Uint8Array) {
    if (this.socket && (this.socket as any).readyState === 1) { // OPEN
      // 小程序 send 支持 ArrayBuffer
      this.socket.send({
        data: buf.buffer as ArrayBuffer
      });
    }
  }
}
