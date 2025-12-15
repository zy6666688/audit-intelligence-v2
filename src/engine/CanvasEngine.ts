import { Graph, Input, Output } from '@/types/graph';
import { nodeRegistry } from '@/core/registry/NodeRegistry';
import { BaseNode } from '@/nodes/BaseNode';
import { GraphMeta, NodeMeta, LinkMeta } from '@/core/graph/GraphMeta';
import { comfyApi } from '@/api/comfyApi';
import { translator } from '@/utils/translator';

export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  // 视口状态 (Viewport State)
  private viewport = { 
    x: 0, 
    y: 0, 
    scale: 1 
  };

  // 数据源 (Data Source)
  private graph: Graph = { nodes: [], links: [] };

  // 渲染循环控制
  private isRunning: boolean = false;

  // 交互状态 (Interaction State)
  private isDragging = false;
  // private dragStart = { x: 0, y: 0 }; // Removed unused
  private lastMousePos = { x: 0, y: 0 }; 
  private draggedNode: BaseNode | null = null; 
  private selectedNodeId: string | null = null; // 记录选中节点 ID
  private lastExecutionId: string | null = null; // 记录最后一次执行的 prompt_id
  
  private clientId: string; // Persistent Client ID
  private lastMoveEmitTime = 0; // Throttle for move events

  // 连线状态
  private connecting = {
    isConnecting: false,
    sourceNode: null as BaseNode | null,
    sourceSlot: -1,
    currentMousePos: { x: 0, y: 0 }
  };

  // 连线吸附状态
  private snapState = {
    snappedNode: null as BaseNode | null,
    snappedSlot: -1,
    snappedPos: { x: 0, y: 0 }
  };

  // 回调函数 (Callbacks)
  public onNodeSelected?: (nodeId: string | null) => void;
  public onNodeDeleted?: (nodeId: string) => void; 
  public onConnectionCreated?: (sourceId: string, sourceSlot: number, targetId: string, targetSlot: number, linkId?: string) => void;
  public onLinkRemoved?: (linkId: string) => void; // 新增回调
  public onContextMenu?: (x: number, y: number) => void;
  public onNodeDocRequested?: (nodeType: string) => void; // 新增：节点文档请求回调

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false }); 
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;

    // 允许 canvas 获取焦点以接收键盘事件
    this.canvas.tabIndex = 1; 
    this.canvas.style.outline = 'none';

    this.clientId = "client-" + Date.now();
    this.init();
  }

  /**
   * 初始化 Canvas 事件和渲染循环
   */
  init() {
    this.setupResizeObserver();
    this.initWebSocket();
    
    // 绑定交互事件
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    this.canvas.addEventListener('contextmenu', this.onContextMenuEvent.bind(this));
    this.canvas.addEventListener('keydown', this.onKeyDown.bind(this));

    // 启动渲染循环
    this.isRunning = true;
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  destroy() {
    this.isRunning = false;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.removeEventListener('wheel', this.onWheel.bind(this));
    this.canvas.removeEventListener('contextmenu', this.onContextMenuEvent.bind(this));
    this.canvas.removeEventListener('keydown', this.onKeyDown.bind(this));
  }

  private initWebSocket() {
    comfyApi.connectWS(this.clientId, (msg: any) => {
        console.log('[WS]', msg);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:107',message:'WebSocket message received',data:{type:msg.type,node:msg.node,has_output:!!msg.output,has_error:!!msg.error},timestamp:Date.now(),sessionId:'debug-session',runId:'ws-message',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        if (msg.type === 'executing') {
          console.log(`[CanvasEngine] Node ${msg.node} is executing (step ${msg.step}/${msg.max_steps})`);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:110',message:'Node executing',data:{node_id:msg.node,step:msg.step,max_steps:msg.max_steps},timestamp:Date.now(),sessionId:'debug-session',runId:'ws-message',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          const node = this.graph.nodes.find(n => n.id === msg.node) as unknown as BaseNode;
          if (node) {
            node.status = 'running';
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:114',message:'Node status set to running',data:{node_id:msg.node,node_found:true},timestamp:Date.now(),sessionId:'debug-session',runId:'ws-message',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            this.forceRender();
          } else {
            console.warn(`[CanvasEngine] Node ${msg.node} not found for executing message`);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:117',message:'Node not found for executing',data:{node_id:msg.node,available_nodes:this.graph.nodes.map((n:any)=>n.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'ws-message',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
          }
        } else if (msg.type === 'executed') {
           // #region agent log
           const outputInfo = msg.output ? {
             is_array: Array.isArray(msg.output),
             length: Array.isArray(msg.output) ? msg.output.length : Object.keys(msg.output).length,
             first_item_type: Array.isArray(msg.output) ? (msg.output[0] ? typeof msg.output[0] : 'empty') : 'object',
             keys: Array.isArray(msg.output) ? [] : Object.keys(msg.output)
           } : { is_null: true };
           fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:132',message:'Node executed message received',data:{node_id:msg.node,output_info:outputInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'ws-message',hypothesisId:'A'})}).catch(()=>{});
           // #endregion
           const node = this.graph.nodes.find(n => n.id === msg.node) as unknown as BaseNode;
           if (node) {
             node.status = 'completed';
             node.data['results'] = msg.output;
             
             // 使用后端发送的has_dataframe_output信息，如果没有则回退到检查节点定义
             // 这样眼睛图标的显示就不会依赖后端连接状态，而是基于节点执行完成时的实际输出类型
             const hasDataFrameOutput = (msg as any).has_dataframe_output !== undefined 
               ? (msg as any).has_dataframe_output 
               : this.checkIfOutputHasDataFrame(msg.output, node.type);
             node.data['hasDataFrameOutput'] = hasDataFrameOutput;
             
             console.log(`[Node ${node.id}] Execution Results:`, msg.output);
             // #region agent log
             fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:140',message:'Node status set to completed',data:{node_id:msg.node,node_found:true,has_results:!!node.data['results'],has_dataframe_output:hasDataFrameOutput,from_backend:(msg as any).has_dataframe_output!==undefined,results_type:node.data['results']?typeof node.data['results']:'none'},timestamp:Date.now(),sessionId:'debug-session',runId:'ws-message',hypothesisId:'A'})}).catch(()=>{});
             // #endregion
             this.forceRender();
           } else {
             // #region agent log
             fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:145',message:'Node not found for executed',data:{node_id:msg.node,available_nodes:this.graph.nodes.map((n:any)=>n.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'ws-message',hypothesisId:'A'})}).catch(()=>{});
             // #endregion
           }
        } else if (msg.type === 'execution_error') {
           console.error(`[CanvasEngine] Execution error for node ${msg.node}:`, msg.error);
           // #region agent log
           fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:133',message:'Execution error',data:{node_id:msg.node,error:msg.error,class_type:msg.class_type},timestamp:Date.now(),sessionId:'debug-session',runId:'ws-message',hypothesisId:'A'})}).catch(()=>{});
           // #endregion
           const node = this.graph.nodes.find(n => n.id === msg.node) as unknown as BaseNode;
           if (node) {
             node.status = 'error';
             node.errorMessage = msg.error || 'Unknown error';
             console.error(`[CanvasEngine] Node ${msg.node} marked as error:`, node.errorMessage);
             this.forceRender();
             
             // 显示错误提示
             alert(`节点执行失败: ${node.errorMessage}\n\n节点ID: ${msg.node}\n节点类型: ${msg.class_type || 'Unknown'}`);
           } else {
             console.warn(`[CanvasEngine] Node ${msg.node} not found for error message`);
           }
        } else if (msg.type === 'GRAPH_NODE_MOVE') {
           // 协同：更新其他用户移动的节点位置
           const node = this.graph.nodes.find(n => n.id === msg.id) as unknown as BaseNode;
           // 如果当前用户正在拖拽该节点，则不更新，避免冲突跳变
           if (node && node.id !== this.selectedNodeId) {
             node.position.x = msg.x;
             node.position.y = msg.y;
             this.forceRender();
           }
        } else if (msg.type === 'GRAPH_LINK_CONNECT') {
           // 协同：添加连线
           const exists = this.graph.links.some(l => l.id === msg.id);
           if (!exists) {
             this.graph.links.push({
               id: msg.id,
               sourceNodeId: msg.sourceId,
               sourceSlot: msg.sourceSlot,
               targetNodeId: msg.targetId,
               targetSlot: msg.targetSlot,
               type: 'default'
             });
             this.forceRender();
           }
        } else if (msg.type === 'GRAPH_LINK_REMOVE') {
           // 协同：删除连线
           this.graph.links = this.graph.links.filter(l => l.id !== msg.id);
           this.forceRender();
        } else if (msg.type === 'GRAPH_NODE_REMOVE') {
           // 协同：删除节点
           this.graph.nodes = this.graph.nodes.filter(n => n.id !== msg.id);
           this.graph.links = this.graph.links.filter(l => l.sourceNodeId !== msg.id && l.targetNodeId !== msg.id);
           this.forceRender();
        } else if (msg.type === 'GRAPH_NODE_ADD') {
           // 协同：添加节点
           // 简单的防重
           const exists = this.graph.nodes.some(n => n.id === msg.id);
           if (!exists) {
             const newNode = new BaseNode(msg.nodeType);
             newNode.id = msg.id;
             newNode.position = { x: msg.x, y: msg.y };
             this.graph.nodes.push(newNode);
             this.forceRender();
           }
        }
    });
  }

  loadGraph(graph: Graph) {
    this.graph = graph;
  }

  /**
   * 使用 ResizeObserver 监听容器大小变化
   */
  private resizeObserver: ResizeObserver | null = null;
  
  private setupResizeObserver() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === parent) {
          this.handleResize();
        }
      }
    });
    
    this.resizeObserver.observe(parent);
    // 立即触发一次
    this.handleResize();
  }

  /**
   * 处理窗口大小变化
   */
  private handleResize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      // 必须显式设置 canvas 的 width 和 height 属性（像素值），而不仅仅是 CSS 样式
      // 使用 clientWidth/clientHeight 获取实际显示像素
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    }
    this.render(); 
  }

  /**
   * 渲染循环
   */
  private renderLoop() {
    if (!this.isRunning) return;
    this.render();
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  public forceRender() {
    this.render();
  }

  // ==================== 交互逻辑 ====================

  private screenToWorld(x: number, y: number) {
    return {
      x: (x - this.viewport.x) / this.viewport.scale,
      y: (y - this.viewport.y) / this.viewport.scale
    };
  }

  private onMouseDown(e: MouseEvent) {
    this.canvas.focus(); // 确保获取焦点以接收键盘事件
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = this.screenToWorld(mouseX, mouseY);

    // 1. 检测端口点击 (连线)
    const PORT_RADIUS = 5;
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const node = this.graph.nodes[i] as unknown as BaseNode; 
      
      // A. 检测输出端口 (开始新连接)
      if (node.outputs) {
        for (let index = 0; index < node.outputs.length; index++) {
          const pos = this.getNodeOutputPos(node, index);
          const dist = Math.hypot(worldPos.x - pos.x, worldPos.y - pos.y);
          if (dist < PORT_RADIUS + 2) {
             this.connecting.isConnecting = true;
             this.connecting.sourceNode = node;
             this.connecting.sourceSlot = index;
             this.connecting.currentMousePos = worldPos;
             return;
          }
        }
      }

      // B. 检测输入端口 (断开连接/重新连接)
      if (node.inputs) {
        for (let index = 0; index < node.inputs.length; index++) {
          const pos = this.getNodeInputPos(node, index);
          const dist = Math.hypot(worldPos.x - pos.x, worldPos.y - pos.y);
          if (dist < PORT_RADIUS + 2) {
             // 检查该输入端口是否有连线
             const link = this.graph.links.find(l => l.targetNodeId === node.id && l.targetSlot === index);
             if (link) {
               // 找到连线，执行“拔出”操作
               const sourceNode = this.graph.nodes.find(n => n.id === link.sourceNodeId) as unknown as BaseNode;
               if (sourceNode) {
                 // 1. 删除旧连线
                 if (this.onLinkRemoved) {
                   this.onLinkRemoved(link.id);
                 }
                 comfyApi.sendWSMessage({ type: "GRAPH_LINK_REMOVE", id: link.id });

                 // 为了视觉上的即时反馈，本地也先移除（Store 更新回来前）
                 // 注意：如果 Store 更新是异步的，这里可能需要防抖，但通常 Pinia 是同步的
                 // 稍微不规范但体验好：
                 this.graph.links = this.graph.links.filter(l => l.id !== link.id);

                 // 2. 开始拖拽 (模拟从源头拉出的线)
                 this.connecting.isConnecting = true;
                 this.connecting.sourceNode = sourceNode;
                 this.connecting.sourceSlot = link.sourceSlot;
                 this.connecting.currentMousePos = worldPos;
                 return;
               }
             }
          }
        }
      }
    }

    // 2. 检测眼睛图标点击 (数据预览)
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const node = this.graph.nodes[i] as unknown as BaseNode;
      const eyeBounds = (node as any)._eyeIconBounds;
      
      if (eyeBounds && node.status === 'completed') {
        const isEyeClick = (
          worldPos.x >= eyeBounds.x &&
          worldPos.x <= eyeBounds.x + eyeBounds.width &&
          worldPos.y >= eyeBounds.y &&
          worldPos.y <= eyeBounds.y + eyeBounds.height
        );
        
        if (isEyeClick) {
          // 调用数据预览
          const promptId = (node.data as any)?.prompt_id || this.lastExecutionId;
          if ((window as any).showDataPreview) {
            (window as any).showDataPreview(node.id, promptId, 0);
          }
          return;
        }
      }
    }

    // 3. 检测节点点击 (拖拽 + 选中 + 文档)
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const node = this.graph.nodes[i] as unknown as BaseNode;
      // 本地碰撞检测
      const isInside = (
        worldPos.x >= node.position.x &&
        worldPos.x <= node.position.x + node.size.width &&
        worldPos.y >= node.position.y &&
        worldPos.y <= node.position.y + node.size.height
      );

      if (isInside) {
        // A. 检查 Ctrl + Click (查看文档)
        if (e.ctrlKey) {
            if (this.onNodeDocRequested) {
                this.onNodeDocRequested(node.type);
            }
            return;
        }

        this.draggedNode = node;
        this.isDragging = true;
        this.selectedNodeId = node.id; // 更新选中状态
        this.lastMousePos = { x: mouseX, y: mouseY };
        // 移至顶层
        this.graph.nodes.splice(i, 1);
        this.graph.nodes.push(node);
        
        // 触发选中回调
        if (this.onNodeSelected) {
          this.onNodeSelected(node.id);
        }
        return;
      }
    }

    // 3. 拖拽画布 (点击空白处)
    this.isDragging = true;
    this.draggedNode = null;
    this.selectedNodeId = null; // 清除选中
    this.lastMousePos = { x: mouseX, y: mouseY };
    
    // 点击空白处取消选中
    if (this.onNodeSelected) {
      this.onNodeSelected(null);
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNodeId) {
      if (this.onNodeDeleted) {
        this.onNodeDeleted(this.selectedNodeId);
        comfyApi.sendWSMessage({ type: "GRAPH_NODE_REMOVE", id: this.selectedNodeId });
        this.selectedNodeId = null; // 删除后清除选中
        if (this.onNodeSelected) {
          this.onNodeSelected(null);
        }
      }
    }
  }

  private onMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = this.screenToWorld(mouseX, mouseY);

    // 处理连线拖拽与吸附
    if (this.connecting.isConnecting) {
      this.connecting.currentMousePos = worldPos;
      
      // 重置吸附状态
      this.snapState = { snappedNode: null, snappedSlot: -1, snappedPos: { x: 0, y: 0 } };

      // 寻找最近的输入端口
      let minDesc = 1000; // 初始距离
      const SNAP_DISTANCE = 20; // 吸附阈值

      for (const node of this.graph.nodes) {
        // 排除自己连接自己（如果需要）
        if (node.id === this.connecting.sourceNode?.id) continue;
        
        const baseNode = node as unknown as BaseNode;
        if (baseNode.inputs) {
          baseNode.inputs.forEach((_input, index) => {
            const pos = this.getNodeInputPos(baseNode, index);
            const dist = Math.hypot(worldPos.x - pos.x, worldPos.y - pos.y);
            
            if (dist < SNAP_DISTANCE && dist < minDesc) {
              minDesc = dist;
              this.snapState = {
                snappedNode: baseNode,
                snappedSlot: index,
                snappedPos: pos
              };
            }
          });
        }
      }
    }

    if (!this.isDragging) return;

    const dx = mouseX - this.lastMousePos.x;
    const dy = mouseY - this.lastMousePos.y;

    if (this.draggedNode) {
      this.draggedNode.position.x += dx / this.viewport.scale;
      this.draggedNode.position.y += dy / this.viewport.scale;

      // 协同：广播移动事件 (Throttle 50ms)
      const now = Date.now();
      if (now - this.lastMoveEmitTime > 50) {
        comfyApi.sendWSMessage({
           type: "GRAPH_NODE_MOVE",
           id: this.draggedNode.id,
           x: this.draggedNode.position.x,
           y: this.draggedNode.position.y
        });
        this.lastMoveEmitTime = now;
      }
    } else {
      this.viewport.x += dx;
      this.viewport.y += dy;
    }

    this.lastMousePos = { x: mouseX, y: mouseY };
  }

  private onMouseUp(e: MouseEvent) {
    if (this.connecting.isConnecting && this.connecting.sourceNode) {
      // 优先使用吸附状态进行连接
      if (this.snapState.snappedNode && this.snapState.snappedSlot !== -1) {
         if (this.onConnectionCreated) {
           const linkId = crypto.randomUUID();
           this.onConnectionCreated(
             this.connecting.sourceNode.id,
             this.connecting.sourceSlot,
             this.snapState.snappedNode.id,
             this.snapState.snappedSlot,
             linkId
           );
           comfyApi.sendWSMessage({
             type: "GRAPH_LINK_CONNECT",
             sourceId: this.connecting.sourceNode.id,
             sourceSlot: this.connecting.sourceSlot,
             targetId: this.snapState.snappedNode.id,
             targetSlot: this.snapState.snappedSlot,
             id: linkId
           });
         }
      } else {
        // 如果没有吸附（比如鼠标直接松开在端口上但没有触发move），兜底检测
        const rect = this.canvas.getBoundingClientRect();
        const worldPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        const PORT_RADIUS = 5;
        
        for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
          const node = this.graph.nodes[i] as unknown as BaseNode;
          if (node.inputs) {
             for (let index = 0; index < node.inputs.length; index++) {
                const pos = this.getNodeInputPos(node, index);
                const dist = Math.hypot(worldPos.x - pos.x, worldPos.y - pos.y);
                if (dist < PORT_RADIUS + 5) { // 稍微大一点的容差
                   if (this.onConnectionCreated) {
                     const linkId = crypto.randomUUID();
                     this.onConnectionCreated(
                       this.connecting.sourceNode.id,
                       this.connecting.sourceSlot,
                       node.id,
                       index,
                       linkId
                     );
                     comfyApi.sendWSMessage({
                       type: "GRAPH_LINK_CONNECT",
                       sourceId: this.connecting.sourceNode.id,
                       sourceSlot: this.connecting.sourceSlot,
                       targetId: node.id,
                       targetSlot: index,
                       id: linkId
                     });
                   }
                   break;
                }
             }
          }
        }
      }
    }

    this.isDragging = false;
    this.draggedNode = null;
    this.connecting.isConnecting = false;
    this.connecting.sourceNode = null;
    this.snapState = { snappedNode: null, snappedSlot: -1, snappedPos: { x: 0, y: 0 } };
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const delta = e.deltaY < 0 ? 1 + zoomIntensity : 1 / (1 + zoomIntensity);
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newScale = this.viewport.scale * delta;
    if (newScale < 0.1 || newScale > 5) return;

    this.viewport.x = mouseX - (mouseX - this.viewport.x) * delta;
    this.viewport.y = mouseY - (mouseY - this.viewport.y) * delta;
    this.viewport.scale = newScale;
  }

  private onContextMenuEvent(e: MouseEvent) {
    e.preventDefault();
    if (this.onContextMenu) {
      // 传递相对于视口的坐标，方便菜单定位
      this.onContextMenu(e.clientX, e.clientY);
    }
  }

  // ==================== 渲染逻辑 ====================

  private render() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // 0. 预计算所有节点的尺寸 (智能布局)
    this.updateAllNodeDimensions();

    // 清空
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(this.viewport.x, this.viewport.y);
    ctx.scale(this.viewport.scale, this.viewport.scale);

    this.drawGrid(this.viewport, width, height);
    this.drawLinks();
    this.drawNodes();

    ctx.restore();
  }

  private updateAllNodeDimensions() {
    const ctx = this.ctx;
    ctx.font = '14px Arial'; // 保持与绘制时一致的字体配置
    const TITLE_HEIGHT = 40;
    const PORT_HEIGHT = 24; // 稍微增加端口行高
    const BOTTOM_PADDING = 10;
    const MIN_WIDTH = 140;
    const PADDING_X = 10;

    for (const node of this.graph.nodes) {
      const baseNode = node as unknown as BaseNode;
      if (!baseNode.autoResize) continue; // 如果禁用了自动调整，跳过
      
      // 1. 计算高度
      const maxSlots = Math.max(
        baseNode.inputs?.length || 0,
        baseNode.outputs?.length || 0
      );
      const calculatedHeight = TITLE_HEIGHT + (maxSlots * PORT_HEIGHT) + BOTTOM_PADDING;
      
      // 2. 计算宽度
      // 标题宽度
      let maxTitleWidth = ctx.measureText(baseNode.type).width + (PADDING_X * 2) + 20; // 20 for icon or extra space
      
      // 端口文字宽度 (左侧输入 + 右侧输出 + 中间间距)
      let maxPortRowWidth = 0;
      for (let i = 0; i < maxSlots; i++) {
        const inputName = baseNode.inputs?.[i]?.name || '';
        const outputName = baseNode.outputs?.[i]?.name || '';
        
        const translatedInputName = inputName ? translator.translatePortName(baseNode.type, inputName, true) : '';
        const translatedOutputName = outputName ? translator.translatePortName(baseNode.type, outputName, false) : '';
        
        const inputWidth = translatedInputName ? ctx.measureText(translatedInputName).width : 0;
        const outputWidth = translatedOutputName ? ctx.measureText(translatedOutputName).width : 0;
        
        // 左右文字之间至少留 60px 间距，两边各留 PADDING_X
        const rowWidth = inputWidth + outputWidth + 60 + (PADDING_X * 2);
        if (rowWidth > maxPortRowWidth) {
          maxPortRowWidth = rowWidth;
        }
      }

      // 取最大值
      const finalWidth = Math.max(MIN_WIDTH, maxTitleWidth, maxPortRowWidth);

      // 更新节点尺寸 (直接修改节点对象，这样后续 drawLinks/drawNodes 都能读到)
      node.size = {
        width: finalWidth,
        height: Math.max(calculatedHeight, 60) // 最小高度
      };
    }
  }

  private drawGrid(viewport: { x: number, y: number, scale: number }, width: number, height: number) {
    const ctx = this.ctx;
    const scale = viewport.scale;
    const gridSize = 20;

    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = '#2a2a2a';

    const left = -viewport.x / scale;
    const top = -viewport.y / scale;
    const right = (width - viewport.x) / scale;
    const bottom = (height - viewport.y) / scale;

    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;

    ctx.beginPath();
    for (let x = startX; x < right; x += gridSize) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = startY; y < bottom; y += gridSize) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();

    // 原点
    ctx.lineWidth = 2 / scale;
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(100, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 100);
    ctx.stroke();
  }

  // ==================== 辅助方法 (Helper Methods) ====================
  
  /**
   * 获取指定屏幕坐标下的节点
   */
  public getNodeAtScreenPos(x: number, y: number): BaseNode | null {
    const worldPos = this.screenToWorld(x, y);
    // 逆序遍历 (优先检测上层节点)
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const node = this.graph.nodes[i] as unknown as BaseNode;
      if (node.isPointInside(worldPos.x, worldPos.y)) {
        return node;
      }
    }
    return null;
  }

  private getNodeInputPos(node: any, index: number): { x: number, y: number } {
    // 重新实现 BaseNode 的逻辑，防止 Pinia 序列化导致方法丢失
    const TITLE_HEIGHT = 40; 
    const PORT_HEIGHT = 24; // 同步为 24
    const SLOT_OFFSET_Y = 12; // 调整偏移量以垂直居中 (PORT_HEIGHT/2)
    return {
      x: node.position.x,
      y: node.position.y + TITLE_HEIGHT + (index * PORT_HEIGHT) + SLOT_OFFSET_Y
    };
  }

  private getNodeOutputPos(node: any, index: number): { x: number, y: number } {
    const TITLE_HEIGHT = 40; 
    const PORT_HEIGHT = 24; // 同步为 24
    const SLOT_OFFSET_Y = 12; // 调整偏移量以垂直居中
    return {
      x: node.position.x + node.size.width,
      y: node.position.y + TITLE_HEIGHT + (index * PORT_HEIGHT) + SLOT_OFFSET_Y
    };
  }

  private drawLinks() {
    // 1. 绘制现有连线
    if (this.graph.links) {
      for (const link of this.graph.links) {
        // 使用宽松匹配，防止 ID 类型不一致
        const sourceNode = this.graph.nodes.find(n => n.id == link.sourceNodeId);
        const targetNode = this.graph.nodes.find(n => n.id == link.targetNodeId);

        if (sourceNode && targetNode) {
          // 使用本地辅助方法计算坐标 (Safe)
          const startPos = this.getNodeOutputPos(sourceNode, link.sourceSlot);
          const endPos = this.getNodeInputPos(targetNode, link.targetSlot);
          
          this.drawBezierLink(startPos, endPos, '#aaa'); // 默认连线颜色
        }
      }
    }
    
    // 2. 绘制拖拽中的连线
    if (this.connecting.isConnecting && this.connecting.sourceNode) {
      // 使用本地方法
      const startPos = this.getNodeOutputPos(this.connecting.sourceNode, this.connecting.sourceSlot);
      
      const endPos = this.snapState.snappedNode 
        ? this.snapState.snappedPos 
        : this.connecting.currentMousePos;
      
      this.drawBezierLink(startPos, endPos, '#fff'); // 拖拽中高亮

      // 绘制吸附提示 (光圈)
      if (this.snapState.snappedNode) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.arc(this.snapState.snappedPos.x, this.snapState.snappedPos.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }
  }

  private drawBezierLink(start: {x:number, y:number}, end: {x:number, y:number}, color: string) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2; // 连接线稍微细一点

    const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    const cp1 = { x: start.x + dist * 0.25, y: start.y };
    const cp2 = { x: end.x - dist * 0.25, y: end.y };

    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
    ctx.stroke();
  }

  private drawNodes() {
    const ctx = this.ctx;
    for (const node of this.graph.nodes) {
      const baseNode = node as unknown as BaseNode;
      const { x, y } = node.position;
      const { width, height } = node.size;

      // 阴影 (根据状态改变颜色)
      ctx.shadowBlur = 10 * this.viewport.scale;
      ctx.shadowOffsetX = 4 * this.viewport.scale;
      ctx.shadowOffsetY = 4 * this.viewport.scale;

      if (baseNode.status === 'running') {
        ctx.shadowColor = 'rgba(52, 152, 219, 0.8)'; // Blue
        ctx.shadowBlur = 20 * this.viewport.scale;
      } else if (baseNode.status === 'completed') {
        ctx.shadowColor = 'rgba(46, 204, 113, 0.6)'; // Green
      } else if (baseNode.status === 'error') {
        ctx.shadowColor = 'rgba(231, 76, 60, 0.8)'; // Red
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      }

      // 背景
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 4);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // 标题栏
      ctx.fillStyle = '#333';
      // Error 状态标题栏变红
      if (baseNode.status === 'error') ctx.fillStyle = '#c0392b';
      
      ctx.beginPath();
      ctx.roundRect(x, y, width, BaseNode.TITLE_HEIGHT, [4, 4, 0, 0]); // 使用 BaseNode 定义的高度
      ctx.fill();

      // 标题文字
      ctx.fillStyle = '#ccc';
      ctx.font = '14px Arial'; // 稍微加大字体
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (node.type) {
        const title = translator.translateNodeTitle(node.type);
        ctx.fillText(title, x + 10, y + 16); // 调整文字垂直位置
      }
      
      // 状态图标 (右上角)
      if (baseNode.status !== 'idle') {
        const iconX = x + width - 16;
        const iconY = y + 16;
        ctx.beginPath();
        ctx.arc(iconX, iconY, 4, 0, Math.PI * 2);
        if (baseNode.status === 'running') ctx.fillStyle = '#3498db';
        else if (baseNode.status === 'completed') ctx.fillStyle = '#2ecc71';
        else if (baseNode.status === 'error') ctx.fillStyle = '#e74c3c';
        ctx.fill();
      }
      
      // 状态文字提示（在节点下方，更明显）
      if (baseNode.status !== 'idle') {
        ctx.fillStyle = baseNode.status === 'running' ? '#3498db' : 
                       baseNode.status === 'completed' ? '#2ecc71' : '#e74c3c';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const statusText = baseNode.status === 'running' ? '运行中...' :
                          baseNode.status === 'completed' ? '已完成 ✓' :
                          baseNode.status === 'error' ? '错误 ✗' : '';
        if (statusText) {
          ctx.fillText(statusText, x + width / 2, y + height + 8);
        }
      }
      
      // 错误消息显示 (在节点内容区域，更明显)
      if (baseNode.status === 'error' && baseNode.errorMessage) {
        // 绘制错误背景框
        ctx.fillStyle = 'rgba(231, 76, 60, 0.2)'; // 半透明红色背景
        ctx.beginPath();
        ctx.roundRect(x + 5, y + BaseNode.TITLE_HEIGHT + 5, width - 10, height - BaseNode.TITLE_HEIGHT - 15, 3);
        ctx.fill();
        
        // 绘制错误文字
        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        // 截断错误消息以适应节点宽度，支持多行显示
        const maxWidth = width - 20;
        const lineHeight = 14;
        const maxLines = Math.floor((height - BaseNode.TITLE_HEIGHT - 20) / lineHeight);
        let errorText = baseNode.errorMessage;
        const words = errorText.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
            if (lines.length >= maxLines) {
              currentLine += '...';
              break;
            }
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }
        
        // 绘制多行错误消息
        lines.slice(0, maxLines).forEach((line, idx) => {
          ctx.fillText(line, x + 10, y + BaseNode.TITLE_HEIGHT + 10 + (idx * lineHeight));
        });
      }
      
      // 眼睛图标 (数据预览，仅在 completed 状态显示，且节点输出包含 DATAFRAME 类型)
      if (baseNode.status === 'completed') {
        // 检查节点是否有 DATAFRAME 类型的输出
        const nodeDef = nodeRegistry.getNodeDefinition(node.type);
        // 更严格的检查：确保outputs存在且是数组，然后查找type为'DATAFRAME'的输出
        const hasDataFrameOutput = nodeDef?.outputs && Array.isArray(nodeDef.outputs) 
          ? nodeDef.outputs.some((output: { name: string; type: string }) => 
              output && typeof output === 'object' && output.type === 'DATAFRAME'
            )
          : false;
        
        // #region agent log
        const hasResults = !!baseNode.data['results'];
        const resultsType = baseNode.data['results'] ? typeof baseNode.data['results'] : 'none';
        const resultsInfo = baseNode.data['results'] ? (Array.isArray(baseNode.data['results']) ? {is_array:true,length:baseNode.data['results'].length} : {is_object:true,keys:Object.keys(baseNode.data['results'])}) : {is_null:true};
        fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:914',message:'Checking if node has DataFrame output',data:{node_id:baseNode.id,node_type:node.type,has_dataframe_output:hasDataFrameOutput,node_def_exists:!!nodeDef,outputs:nodeDef?.outputs,has_results:hasResults,results_type:resultsType,results_info:resultsInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'render',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // 只为有 DATAFRAME 输出的节点显示眼睛图标
        if (hasDataFrameOutput) {
          const eyeX = x + width - 36;
          const eyeY = y + 16;
          const eyeSize = 12;
          
          // 存储眼睛图标的位置，用于点击检测
          (baseNode as any)._eyeIconBounds = {
            x: eyeX - eyeSize/2,
            y: eyeY - eyeSize/2,
            width: eyeSize,
            height: eyeSize
          };
          
          // 绘制眼睛图标 (使用简单的 emoji)
          ctx.fillStyle = '#95a5a6';
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('👁️', eyeX, eyeY);
          
          // 在眼睛图标下方显示提示文字（如果有结果）
          if (baseNode.data['results'] && Array.isArray(baseNode.data['results']) && baseNode.data['results'].length > 0) {
            ctx.fillStyle = '#95a5a6';
            ctx.font = '9px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('点击查看', eyeX, eyeY + 10);
          }
        } else {
          // 没有 DATAFRAME 输出，清除眼睛图标边界（防止误点击）
          (baseNode as any)._eyeIconBounds = null;
        }
      }

      // 选中状态 (使用 selectedNodeId)
      if (node.id === this.selectedNodeId) {
        ctx.strokeStyle = '#e67e22'; // 橙色高亮
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
      }

      // 绘制自定义内容 (Widget)
      // Save/Restore 确保节点内部绘制不污染全局状态
      ctx.save();
      // 将坐标原点移动到节点左上角 (内容区开始位置)
      // 标题栏高度 32px (或 40px, 取决于实现)
      // BaseNode.TITLE_HEIGHT 目前定义为 30，但在 CanvasEngine 中绘制标题背景用了 32
      // 我们统一移动到 (x, y) 处，由节点自己决定相对位置
      ctx.translate(x, y);
      baseNode.draw(ctx);
      ctx.restore();

      // 绘制端口
      this.drawPorts(baseNode);
    }
  }

  private drawPorts(node: BaseNode) {
    const ctx = this.ctx;
    
    // Inputs
    if (node.inputs) {
      node.inputs.forEach((input: Input, index: number) => {
        const pos = this.getNodeInputPos(node, index);
        ctx.fillStyle = '#777';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'left';
        const portName = translator.translatePortName(node.type, input.name, true);
        ctx.fillText(portName, pos.x + 10, pos.y);
      });
    }

    // Outputs
    if (node.outputs) {
      node.outputs.forEach((output: Output, index: number) => {
        const pos = this.getNodeOutputPos(node, index);
        ctx.fillStyle = '#777';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'right';
        const portName = translator.translatePortName(node.type, output.name, false);
        ctx.fillText(portName, pos.x - 10, pos.y);
      });
    }
  }

  // API: 更新视口 (供 NodeEditor 组件的交互事件调用)
  setViewport(x: number, y: number, scale: number) {
    this.viewport = { x, y, scale };
  }

  // API: 获取当前视口状态
  getViewport() {
    return this.viewport;
  }

  // ==================== 适配器层 (UI <-> Runtime) ====================

  /**
   * 将当前 UI 图导出为 Runtime 可执行的 Metadata 图
   * 核心逻辑：将 Slot Index 转换为 Port Name
   */
  exportGraphMeta(): GraphMeta {
    // 1. 转换节点
    const nodes: NodeMeta[] = this.graph.nodes.map(node => {
      // 提取节点配置数据 (假设存在 node.data 中，目前 BaseNode 暂未严格定义 data 结构，暂取空)
      // 实际项目中应从 PropertiesPanel 绑定的 store 数据中获取
      const config = (node as any).data || {}; 
      
      return {
        id: node.id,
        type: node.type,
        data: config,
        // UI 布局信息保留 (可选)
        position: { ...node.position }
      };
    });

    // 2. 转换连线 (Index -> Name)
    const links: LinkMeta[] = [];
    
    this.graph.links.forEach(link => {
      const sourceNode = this.graph.nodes.find(n => n.id === link.sourceNodeId);
      const targetNode = this.graph.nodes.find(n => n.id === link.targetNodeId);

      if (!sourceNode || !targetNode) return;

      // 从 Registry 获取端口定义
      // 注意：这里假设 UI 上的 Slot 顺序与 Registry 定义的顺序严格一致
      // BaseNode 初始化时就是按照 Registry 生成 inputs/outputs 的，所以顺序应该是一致的
      
      // 获取源端口名
      const sourceDef = nodeRegistry.getNodeDefinition(sourceNode.type);
      const sourcePortName = sourceDef?.outputs?.[link.sourceSlot]?.name;

      // 获取目标端口名
      const targetDef = nodeRegistry.getNodeDefinition(targetNode.type);
      const targetPortName = targetDef?.inputs?.[link.targetSlot]?.name;

      if (sourcePortName && targetPortName) {
        links.push({
          id: link.id,
          sourceNodeId: link.sourceNodeId,
          sourcePort: sourcePortName,
          targetNodeId: link.targetNodeId,
          targetPort: targetPortName
        });
      } else {
        console.warn(`Could not resolve port names for link ${link.id}: ${sourceNode.type}[${link.sourceSlot}] -> ${targetNode.type}[${link.targetSlot}]`);
      }
    });

    return {
      id: 'graph_' + Date.now(),
      version: 1,
      nodes,
      links,
      viewport: this.viewport
    };
  }

  /**
   * 导出完整工作流 JSON (包含 UI 信息)
   */
  exportWorkflowJSON(): string {
    const meta = this.exportGraphMeta();
    // 增加 UI 相关的额外信息 (如 viewport)
    // 这里的 meta 已经包含了 nodes (带 position) 和 links
    // 我们只需包装一下即可
    const workflow = {
      ...meta,
      app_version: 'AuditIntelligence-v2'
    };
    return JSON.stringify(workflow, null, 2);
  }

  /**
   * 运行当前图 (仅支持 Remote 模式)
   * Returns: prompt_id (execution ID)
   */
  async runGraph(): Promise<string> {
    console.log(`--- Start Execution (remote) ---`);
    
    // 清除之前状态
    this.graph.nodes.forEach(n => (n as unknown as BaseNode).status = 'idle');
    this.forceRender();

    return await this.runRemoteGraph();
  }

  /**
   * 远程 Python 后端执行
   */
  private async runRemoteGraph(): Promise<string> {
    const prompt = this.exportComfyPrompt();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:1056',message:'Before exporting prompt',data:{node_count:Object.keys(prompt).length},timestamp:Date.now(),sessionId:'debug-session',runId:'workflow-exec',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    try {
      // 提交任务
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:1060',message:'Before postPrompt',data:{client_id:this.clientId},timestamp:Date.now(),sessionId:'debug-session',runId:'workflow-exec',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const response = await comfyApi.postPrompt(prompt, this.clientId);
      const promptId = response.data.prompt_id || crypto.randomUUID(); // Fallback if backend doesn't return ID
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:1064',message:'After postPrompt',data:{prompt_id:promptId,response_status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'workflow-exec',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      this.lastExecutionId = promptId;
      console.log('--- Remote Prompt Submitted ---', `Prompt ID: ${promptId}`);
      return promptId;

    } catch (e) {
      console.error('--- Remote Execution Failed ---', e);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0bea752c-2495-4aed-9539-09b12ac0bb7b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CanvasEngine.ts:1072',message:'postPrompt failed',data:{error:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'workflow-exec',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      throw e;
    }
  }

  /**
   * 导出为 ComfyUI Prompt 格式
   */
  private exportComfyPrompt() {
    const prompt: Record<string, any> = {};

    this.graph.nodes.forEach(node => {
      const baseNode = node as unknown as BaseNode;
      const inputs: Record<string, any> = {};

      // 1. 处理普通参数 (Widget Values)
      // 假设 BaseNode.data 存储了 widget 值
      Object.entries(baseNode.data).forEach(([key, val]) => {
        inputs[key] = val;
      });

      // 2. 处理连线 (Link References)
      // ComfyUI 格式: "input_name": ["source_node_id", source_output_index]
      if (baseNode.inputs) {
        baseNode.inputs.forEach((input, inputIdx) => {
          const link = this.graph.links.find(l => l.targetNodeId === node.id && l.targetSlot === inputIdx);
          if (link) {
            // 注意：这里需要确保 input.name 与后端定义的变量名一致
            inputs[input.name] = [link.sourceNodeId, link.sourceSlot];
          }
        });
      }

      prompt[node.id] = {
        class_type: node.type,
        inputs
      };
    });

    return prompt;
  }

  /**
   * 检查节点输出中是否包含DataFrame类型
   * 在节点执行完成时调用，将结果保存到节点状态中
   * 这样眼睛图标的显示就不会依赖后端连接状态，而是基于节点执行完成时的实际输出类型
   * 
   * @param _output 节点输出（当前未使用，保留用于未来扩展）
   * @param nodeType 节点类型
   * @returns 是否有DataFrame类型的输出
   */
  private checkIfOutputHasDataFrame(_output: any, nodeType: string): boolean {
    // 根据节点定义检查是否有DATAFRAME类型的输出
    // 这样判断是固定的，不依赖后端连接状态
    const nodeDef = nodeRegistry.getNodeDefinition(nodeType);
    if (nodeDef?.outputs && Array.isArray(nodeDef.outputs)) {
      // 检查节点定义中是否有DATAFRAME类型的输出
      return nodeDef.outputs.some((out: { name: string; type: string }) => 
        out && typeof out === 'object' && out.type === 'DATAFRAME'
      );
    }
    return false;
  }
}
