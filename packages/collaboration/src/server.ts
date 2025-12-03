import { Server } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
import * as Y from 'yjs';

// 模拟 DuckDB 计算逻辑
const computeData = (doc: Y.Doc) => {
  const nodesMap = doc.getMap('nodes');
  const edgesMap = doc.getMap('edges');
  
  // 简单的响应式计算示例：
  // 如果有一个 'filter' 节点，我们就在日志里模拟计算
  nodesMap.forEach((node: any, id: string) => {
    if (node.type === 'fund_loop_detect' && node.status === 'pending') {
      console.log(`[Compute] Triggering calculation for node ${id}...`);
      
      // 模拟耗时操作
      setTimeout(() => {
        doc.transact(() => {
          // 更新节点状态和结果
          node.status = 'completed';
          node.result = {
            refId: `ref_${id}_${Date.now()}`,
            riskLevel: 'HIGH'
          };
          nodesMap.set(id, node); // 写回 Y.doc，这将自动同步给前端
        });
        console.log(`[Compute] Finished calculation for node ${id}`);
      }, 2000);
    }
  });
};

// 自定义扩展：监听变更
class ComputeExtension {
  async onChange(data: any) {
    // 当文档发生变化时触发
    computeData(data.document);
  }
}

const server = Server.configure({
  port: 1234,
  extensions: [
    new Logger(),
    new ComputeExtension(),
  ],
  
  async onConnect(data) {
    console.log(`New connection: ${data.documentName}`);
  },
});

server.listen().then(() => {
  console.log('🚀 Collaboration Server (with Compute Engine) listening on port 1234');
});
