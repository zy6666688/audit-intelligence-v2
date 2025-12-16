import { Node, Input, Output } from '@/types/graph';
import { nodeRegistry } from '@/core/registry/NodeRegistry';

export class BaseNode implements Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data: Record<string, any>;
  
  inputs: Input[];
  outputs: Output[];
  
  status: 'idle' | 'running' | 'completed' | 'error' = 'idle';
  errorMessage?: string;
  
  // UI Config
  autoResize: boolean = true;
  static readonly TITLE_HEIGHT = 32;

  constructor(type: string) {
    this.id = crypto.randomUUID();
    this.type = type;
    this.position = { x: 0, y: 0 };
    this.size = { width: 140, height: 100 };
    this.data = {};
    
    // Initialize from Registry
    const def = nodeRegistry.getNodeDefinition(type);
    if (def) {
      // Clone arrays to prevent mutation of registry definition and init link props
      this.inputs = (def.inputs || []).map(i => ({ ...i, link: null }));
      this.outputs = (def.outputs || []).map(o => ({ ...o, links: [] }));
    } else {
      this.inputs = [];
      this.outputs = [];
    }
  }

  /**
   * Custom drawing for node content (widgets, text, etc.)
   * The frame, title, and ports are drawn by CanvasEngine.
   */
  draw(_ctx: CanvasRenderingContext2D) {
    // Default: draw nothing or simple placeholder
    // Subclasses can override this to draw widgets
  }
  
  isPointInside(x: number, y: number): boolean {
    return (
      x >= this.position.x &&
      x <= this.position.x + this.size.width &&
      y >= this.position.y &&
      y <= this.position.y + this.size.height
    );
  }
}
