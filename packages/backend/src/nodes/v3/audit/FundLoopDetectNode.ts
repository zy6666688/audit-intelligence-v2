/**
 * Fund Loop Detect Node - 资金闭环检测节点
 * 
 * 核心功能：检测资金空转、循环回流等异常模式
 * 
 * 审计价值：
 * - 识别虚构交易（资金循环）
 * - 检测洗钱行为
 * - 发现关联方资金往来
 * 
 * 算法：基于有向图的环路检测（DFS + 时间窗口约束）
 * 复杂度：H（高）- 图算法、大数据量
 */

import { BaseNodeV3, NodeManifest, NodeExecutionResult, NodeExecutionContext } from '../BaseNode';
import type { Records, RiskSet, Evidence, AuditDataType } from '../../../types/AuditDataTypes';

interface FundLoopConfig {
  timeWindowDays: number;        // 时间窗口（天）
  minLoopAmount: number;         // 最小循环金额
  returnRatio: number;           // 资金回流比例（0.8 = 80%）
  maxDepth: number;              // 最大搜索深度
  minLoopLength: number;         // 最小循环路径长度
}

interface FundFlow {
  from: string;
  to: string;
  amount: number;
  date: Date;
  id: string;
  description?: string;
}

interface Loop {
  id: string;
  path: string[];              // 账户路径
  flows: FundFlow[];           // 涉及的流水
  totalAmount: number;         // 总金额
  returnAmount: number;        // 回流金额
  returnRatio: number;         // 回流比例
  duration: number;            // 持续时间（天）
  riskScore: number;           // 风险分数
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class FundLoopDetectNode extends BaseNodeV3 {
  getManifest(): NodeManifest {
    return {
      type: 'audit.fund_loop_detect',
      version: '1.0.0',
      category: 'audit',
      
      label: {
        zh: '资金闭环检测',
        en: 'Fund Loop Detect'
      },
      
      description: {
        zh: '检测资金空转、循环回流等异常模式。识别虚构交易、洗钱行为和关联方资金往来。基于图算法的环路检测。',
        en: 'Detect fund circulation, loop-back patterns. Identify fake transactions, money laundering, and related-party fund flows. Graph-based cycle detection.'
      },
      
      icon: '💸',
      color: '#E74C3C',
      
      inputs: [
        {
          id: 'flows',
          name: 'flows',
          type: 'Records',
          required: true,
          description: {
            zh: '银行流水记录（需包含：付款方、收款方、金额、日期）',
            en: 'Bank flow records (must include: from_account, to_account, amount, date)'
          }
        },
        {
          id: 'accounts',
          name: 'accounts',
          type: 'Records',
          required: false,
          description: {
            zh: '账户信息（可选，用于账户名称映射）',
            en: 'Account info (optional, for account name mapping)'
          }
        }
      ],
      
      outputs: [
        {
          id: 'loops',
          name: 'loops',
          type: 'Records',
          required: true,
          description: {
            zh: '检测到的资金循环',
            en: 'Detected fund loops'
          }
        },
        {
          id: 'risks',
          name: 'risks',
          type: 'RiskSet',
          required: true,
          description: {
            zh: '风险点集合',
            en: 'Risk set'
          }
        },
        {
          id: 'graph',
          name: 'graph',
          type: 'Records',
          required: true,
          description: {
            zh: '资金流向图数据（节点和边）',
            en: 'Fund flow graph data (nodes and edges)'
          }
        },
        {
          id: 'evidence',
          name: 'evidence',
          type: 'Evidence',
          required: true,
          description: {
            zh: '审计证据',
            en: 'Audit evidence'
          }
        }
      ],
      
      config: [
        {
          id: 'timeWindowDays',
          name: { zh: '时间窗口（天）', en: 'Time Window (Days)' },
          type: 'number',
          required: false,
          defaultValue: 7,
          description: {
            zh: '检测循环的时间窗口',
            en: 'Time window for loop detection'
          },
          validation: {
            min: 1,
            max: 365
          }
        },
        {
          id: 'minLoopAmount',
          name: { zh: '最小循环金额', en: 'Min Loop Amount' },
          type: 'number',
          required: false,
          defaultValue: 100000,
          description: {
            zh: '触发检测的最小金额',
            en: 'Minimum amount to trigger detection'
          },
          validation: {
            min: 0
          }
        },
        {
          id: 'returnRatio',
          name: { zh: '资金回流比例', en: 'Return Ratio' },
          type: 'number',
          required: false,
          defaultValue: 0.8,
          description: {
            zh: '认定为循环的资金回流比例（0.8 = 80%）',
            en: 'Return ratio to be considered as loop (0.8 = 80%)'
          },
          validation: {
            min: 0.5,
            max: 1.0
          }
        },
        {
          id: 'maxDepth',
          name: { zh: '最大搜索深度', en: 'Max Search Depth' },
          type: 'number',
          required: false,
          defaultValue: 6,
          description: {
            zh: '环路搜索的最大深度',
            en: 'Maximum depth for loop search'
          },
          validation: {
            min: 2,
            max: 10
          }
        },
        {
          id: 'minLoopLength',
          name: { zh: '最小循环长度', en: 'Min Loop Length' },
          type: 'number',
          required: false,
          defaultValue: 2,
          description: {
            zh: '最小循环路径长度（节点数）',
            en: 'Minimum loop path length (node count)'
          },
          validation: {
            min: 2,
            max: 10
          }
        }
      ],
      
      metadata: {
        author: 'Audit System',
        tags: ['audit', 'fraud-detection', 'fund-loop', 'money-laundering', 'graph-algorithm'],
        documentation: 'https://docs.audit-system.com/nodes/audit/fund-loop-detect',
        examples: [
          {
            title: '检测资金空转',
            description: '在7天内检测资金循环回流',
            inputs: {
              flows: { type: 'Records', rowCount: 1000 }
            },
            config: {
              timeWindowDays: 7,
              minLoopAmount: 100000,
              returnRatio: 0.8
            }
          }
        ]
      },
      
      capabilities: {
        cacheable: true,
        parallel: false,      // 图算法不适合并行
        streaming: false,
        aiPowered: false
      }
    };
  }

  async execute(
    inputs: Record<string, AuditDataType>,
    config: Record<string, any>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      const flows = inputs.flows as Records;
      const accounts = inputs.accounts as Records | undefined;
      
      const cfg: FundLoopConfig = {
        timeWindowDays: config.timeWindowDays ?? 7,
        minLoopAmount: config.minLoopAmount ?? 100000,
        returnRatio: config.returnRatio ?? 0.8,
        maxDepth: config.maxDepth ?? 6,
        minLoopLength: config.minLoopLength ?? 2
      };
      
      context.logger?.info?.(`💸 Starting fund loop detection: ${flows.rowCount} flows, time window: ${cfg.timeWindowDays} days`);
      
      // 1. 解析流水数据
      const fundFlows = this.parseFlows(flows.data);
      
      // 2. 构建图
      const graph = this.buildGraph(fundFlows);
      
      // 3. 检测循环
      const loops = this.detectLoops(fundFlows, graph, cfg);
      
      context.logger?.info?.(`🔍 Detected ${loops.length} potential loops`);
      
      // 4. 评分和筛选
      const scoredLoops = this.scoreLoops(loops, cfg);
      const significantLoops = scoredLoops.filter(l => 
        l.totalAmount >= cfg.minLoopAmount && 
        l.returnRatio >= cfg.returnRatio
      );
      
      context.logger?.info?.(`⚠️  Found ${significantLoops.length} significant loops`);
      
      // 5. 生成风险集
      const risks = this.generateRisks(significantLoops);
      
      // 6. 生成证据
      const evidence = this.generateEvidence(significantLoops, flows, context);
      
      // 7. 构造输出
      const loopsRecords: Records = {
        type: 'Records',
        schema: [
          { name: 'loop_id', type: 'string', required: true, description: 'Loop ID' },
          { name: 'path', type: 'string', required: true, description: 'Account Path' },
          { name: 'total_amount', type: 'number', required: true, description: 'Total Amount' },
          { name: 'return_ratio', type: 'number', required: true, description: 'Return Ratio' },
          { name: 'duration_days', type: 'number', required: true, description: 'Duration (days)' },
          { name: 'risk_score', type: 'number', required: true, description: 'Risk Score' },
          { name: 'risk_level', type: 'string', required: true, description: 'Risk Level' },
          { name: 'flow_count', type: 'number', required: true, description: 'Flow Count' }
        ],
        data: significantLoops.map(loop => ({
          loop_id: loop.id,
          path: loop.path.join(' → '),
          total_amount: loop.totalAmount,
          return_ratio: loop.returnRatio,
          duration_days: loop.duration,
          risk_score: loop.riskScore,
          risk_level: loop.riskLevel,
          flow_count: loop.flows.length
        })),
        metadata: this.createMetadata(context.nodeId, context.executionId, 'fund_loops'),
        rowCount: significantLoops.length,
        columnCount: 8
      };
      
      const graphRecords: Records = {
        type: 'Records',
        schema: [
          { name: 'type', type: 'string', required: true, description: 'node or edge' },
          { name: 'id', type: 'string', required: true, description: 'ID' },
          { name: 'from', type: 'string', required: false, description: 'From Account' },
          { name: 'to', type: 'string', required: false, description: 'To Account' },
          { name: 'amount', type: 'number', required: false, description: 'Amount' },
          { name: 'in_loop', type: 'boolean', required: false, description: 'In Loop' }
        ],
        data: this.exportGraphData(graph, significantLoops),
        metadata: this.createMetadata(context.nodeId, context.executionId, 'fund_graph'),
        rowCount: 0,
        columnCount: 6
      };
      graphRecords.rowCount = graphRecords.data.length;
      
      const duration = Date.now() - startTime;
      
      context.logger?.info?.(`✅ Fund loop detection completed: ${significantLoops.length} loops found (${duration}ms)`);
      
      return this.wrapSuccess(
        {
          loops: loopsRecords,
          risks,
          graph: graphRecords,
          evidence
        },
        duration,
        context
      );
      
    } catch (error: any) {
      context.logger?.error?.('❌ Fund loop detection failed:', error);
      return this.wrapError('EXECUTION_ERROR', error.message, error.stack);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private parseFlows(data: Array<Record<string, any>>): FundFlow[] {
    return data.map((row, index) => ({
      id: row.id || `flow_${index}`,
      from: this.getFieldValue(row, 'from_account', 'from', 'payer'),
      to: this.getFieldValue(row, 'to_account', 'to', 'payee'),
      amount: parseFloat(this.getFieldValue(row, 'amount', 'money') || '0'),
      date: new Date(this.getFieldValue(row, 'date', 'time', 'timestamp') || Date.now()),
      description: this.getFieldValue(row, 'description', 'memo', 'remark')
    })).filter(f => f.from && f.to && f.amount > 0);
  }

  private getFieldValue(record: Record<string, any>, ...fieldNames: string[]): any {
    for (const name of fieldNames) {
      const variants = [
        name,
        name.toLowerCase(),
        name.toUpperCase(),
        name.replace(/_/g, '')
      ];
      
      for (const variant of variants) {
        if (record[variant] !== undefined) {
          return record[variant];
        }
      }
    }
    return undefined;
  }

  private buildGraph(flows: FundFlow[]): Map<string, Map<string, FundFlow[]>> {
    const graph = new Map<string, Map<string, FundFlow[]>>();
    
    for (const flow of flows) {
      if (!graph.has(flow.from)) {
        graph.set(flow.from, new Map());
      }
      
      const edges = graph.get(flow.from)!;
      if (!edges.has(flow.to)) {
        edges.set(flow.to, []);
      }
      
      edges.get(flow.to)!.push(flow);
    }
    
    return graph;
  }

  private detectLoops(
    flows: FundFlow[],
    graph: Map<string, Map<string, FundFlow[]>>,
    config: FundLoopConfig
  ): Loop[] {
    const loops: Loop[] = [];
    const visited = new Set<string>();
    
    // 对每个节点尝试查找循环
    for (const startNode of graph.keys()) {
      if (visited.has(startNode)) continue;
      
      const foundLoops = this.dfsLoops(
        startNode,
        startNode,
        [],
        [],
        new Set(),
        graph,
        config,
        0
      );
      
      loops.push(...foundLoops);
      visited.add(startNode);
    }
    
    return loops;
  }

  private dfsLoops(
    current: string,
    target: string,
    path: string[],
    flowPath: FundFlow[],
    visitedInPath: Set<string>,
    graph: Map<string, Map<string, FundFlow[]>>,
    config: FundLoopConfig,
    depth: number
  ): Loop[] {
    // 超过最大深度
    if (depth > config.maxDepth) {
      return [];
    }
    
    // 找到循环
    if (depth > 0 && current === target && path.length >= config.minLoopLength) {
      return [this.createLoop(path, flowPath, config)];
    }
    
    // 已访问过（非目标节点）
    if (visitedInPath.has(current) && current !== target) {
      return [];
    }
    
    const loops: Loop[] = [];
    const neighbors = graph.get(current);
    
    if (!neighbors) {
      return loops;
    }
    
    visitedInPath.add(current);
    path.push(current);
    
    for (const [nextNode, flows] of neighbors.entries()) {
      // 检查时间窗口约束
      const validFlows = this.filterByTimeWindow(flows, flowPath, config.timeWindowDays);
      
      if (validFlows.length === 0) continue;
      
      for (const flow of validFlows) {
        const newFlowPath = [...flowPath, flow];
        const foundLoops = this.dfsLoops(
          nextNode,
          target,
          path,
          newFlowPath,
          new Set(visitedInPath),
          graph,
          config,
          depth + 1
        );
        
        loops.push(...foundLoops);
      }
    }
    
    return loops;
  }

  private filterByTimeWindow(
    flows: FundFlow[],
    existingPath: FundFlow[],
    windowDays: number
  ): FundFlow[] {
    if (existingPath.length === 0) return flows;
    
    const startDate = existingPath[0].date;
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    
    return flows.filter(f => {
      const diff = Math.abs(f.date.getTime() - startDate.getTime());
      return diff <= windowMs;
    });
  }

  private createLoop(path: string[], flows: FundFlow[], config: FundLoopConfig): Loop {
    const totalAmount = flows.reduce((sum, f) => sum + f.amount, 0);
    const firstDate = flows[0].date;
    const lastDate = flows[flows.length - 1].date;
    const duration = Math.abs((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // 计算回流金额（最后一笔流水）
    const returnAmount = flows[flows.length - 1].amount;
    const returnRatio = returnAmount / totalAmount;
    
    return {
      id: `loop_${path.join('_')}`,
      path: [...path],
      flows,
      totalAmount,
      returnAmount,
      returnRatio,
      duration,
      riskScore: 0,  // 稍后计算
      riskLevel: 'low'
    };
  }

  private scoreLoops(loops: Loop[], config: FundLoopConfig): Loop[] {
    return loops.map(loop => {
      let score = 0;
      
      // 金额因素（越大越可疑）
      if (loop.totalAmount > config.minLoopAmount * 10) score += 0.3;
      else if (loop.totalAmount > config.minLoopAmount * 5) score += 0.2;
      else if (loop.totalAmount > config.minLoopAmount) score += 0.1;
      
      // 回流比例（越高越可疑）
      if (loop.returnRatio > 0.95) score += 0.3;
      else if (loop.returnRatio > 0.9) score += 0.2;
      else if (loop.returnRatio > 0.8) score += 0.1;
      
      // 时间因素（越短越可疑）
      if (loop.duration < 1) score += 0.3;
      else if (loop.duration < 3) score += 0.2;
      else if (loop.duration < 7) score += 0.1;
      
      // 路径长度（过短或过长都可疑）
      if (loop.path.length === 2) score += 0.1;
      else if (loop.path.length > 5) score += 0.2;
      
      loop.riskScore = Math.min(score, 1.0);
      
      // 确定风险等级
      if (loop.riskScore >= 0.7) loop.riskLevel = 'critical';
      else if (loop.riskScore >= 0.5) loop.riskLevel = 'high';
      else if (loop.riskScore >= 0.3) loop.riskLevel = 'medium';
      else loop.riskLevel = 'low';
      
      return loop;
    });
  }

  private generateRisks(loops: Loop[]): RiskSet {
    const risks = loops.map(loop => ({
      id: `risk_${loop.id}`,
      category: 'fund_loop',
      description: `Fund loop detected: ${loop.path.join(' → ')}, amount: ${loop.totalAmount.toLocaleString()}, return ratio: ${(loop.returnRatio * 100).toFixed(1)}%`,
      severity: loop.riskLevel,
      score: loop.riskScore * 100,
      evidence: loop.flows.map(f => f.id),
      relatedData: { path: loop.path, flows: loop.flows.map(f => f.id) },
      suggestedActions: ['Investigate fund circulation', 'Review transaction purposes', 'Verify parties involved'],
      detectedBy: 'fund_loop_detect',
      detectedAt: new Date()
    }));
    
    return {
      type: 'RiskSet',
      risks,
      summary: {
        total: risks.length,
        bySeverity: {
          critical: risks.filter(r => r.severity === 'critical').length,
          high: risks.filter(r => r.severity === 'high').length,
          medium: risks.filter(r => r.severity === 'medium').length,
          low: risks.filter(r => r.severity === 'low').length
        },
        byCategory: {
          fund_loop: risks.length
        }
      },
      metadata: this.createMetadata('', '', 'fund_loop_detect')
    };
  }

  private generateEvidence(
    loops: Loop[],
    flows: Records,
    context: NodeExecutionContext
  ): Evidence {
    const evidenceItem: any = {
      id: `evidence_${context.executionId}`,
      type: 'analysis' as const,
      title: 'Fund Loop Detection Evidence',
      content: {
        totalFlows: flows.rowCount,
        loopsDetected: loops.length,
        criticalLoops: loops.filter(l => l.riskLevel === 'critical').length,
        highRiskLoops: loops.filter(l => l.riskLevel === 'high').length,
        totalLoopAmount: loops.reduce((sum, l) => sum + l.totalAmount, 0),
        averageReturnRatio: loops.length > 0 
          ? loops.reduce((sum, l) => sum + l.returnRatio, 0) / loops.length 
          : 0
      },
      source: 'fund_loop_detect',
      collectedBy: 'fund_loop_detect',
      collectedAt: new Date(),
      relatedRisks: loops.map(l => `risk_${l.id}`),
      attachments: [],
      verified: false
    };
    
    return {
      type: 'Evidence',
      items: [evidenceItem],
      traceId: context.executionId,
      workflow: {
        graphId: context.graphId,
        version: '1.0.0',
        nodes: [],
        connections: [],
        timestamp: new Date()
      },
      chain: [],
      metadata: this.createMetadata(context.nodeId, context.executionId, 'fund_loop_evidence')
    };
  }

  private exportGraphData(
    graph: Map<string, Map<string, FundFlow[]>>,
    loops: Loop[]
  ): Array<Record<string, any>> {
    const data: Array<Record<string, any>> = [];
    const loopAccounts = new Set<string>();
    const loopEdges = new Set<string>();
    
    // 收集循环中的账户和边
    for (const loop of loops) {
      for (const account of loop.path) {
        loopAccounts.add(account);
      }
      for (const flow of loop.flows) {
        loopEdges.add(`${flow.from}-${flow.to}`);
      }
    }
    
    // 导出节点
    const allAccounts = new Set<string>();
    for (const [from, edges] of graph.entries()) {
      allAccounts.add(from);
      for (const to of edges.keys()) {
        allAccounts.add(to);
      }
    }
    
    for (const account of allAccounts) {
      data.push({
        type: 'node',
        id: account,
        in_loop: loopAccounts.has(account)
      });
    }
    
    // 导出边
    for (const [from, edges] of graph.entries()) {
      for (const [to, flows] of edges.entries()) {
        const totalAmount = flows.reduce((sum, f) => sum + f.amount, 0);
        data.push({
          type: 'edge',
          id: `${from}-${to}`,
          from,
          to,
          amount: totalAmount,
          in_loop: loopEdges.has(`${from}-${to}`)
        });
      }
    }
    
    return data;
  }
}
