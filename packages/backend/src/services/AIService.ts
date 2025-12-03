/**
 * AI服务统一接口层
 * 支持多个AI服务提供商，可动态切换
 * 
 * 支持的提供商：
 * - 阿里云通义千问 (qwen) - 推荐，限时免费
 * - 百度文心一言 (ernie)
 * - OpenAI ChatGPT (openai)
 * - 腾讯混元 (hunyuan)
 */

import axios, { AxiosInstance } from 'axios';

// ============================================================================
// 类型定义
// ============================================================================

export type AIProvider = 'qwen' | 'ernie' | 'openai' | 'hunyuan';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  apiSecret?: string; // 某些服务商需要
  endpoint: string;
  model: string;
  timeout?: number;
  maxRetries?: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AICompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

// ============================================================================
// AI服务基类
// ============================================================================

abstract class BaseAIProvider {
  protected client: AxiosInstance;
  protected config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.endpoint,
      timeout: config.timeout || 30000,
      headers: this.getHeaders(),
    });
  }

  abstract getHeaders(): Record<string, string>;
  abstract chat(options: AICompletionOptions): Promise<AICompletionResponse>;
  abstract checkConnection(): Promise<boolean>;
}

// ============================================================================
// 阿里云通义千问实现
// ============================================================================

class QwenProvider extends BaseAIProvider {
  getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async chat(options: AICompletionOptions): Promise<AICompletionResponse> {
    try {
      const response = await this.client.post('/services/aigc/text-generation/generation', {
        model: this.config.model,
        input: {
          messages: options.messages,
        },
        parameters: {
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 2000,
          result_format: 'message',
        },
      });

      const data = response.data;
      
      if (data.code && data.code !== '200') {
        throw new Error(`Qwen API Error: ${data.message}`);
      }

      return {
        content: data.output.choices[0].message.content,
        model: this.config.model,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        finishReason: data.output.choices[0].finish_reason,
      };
    } catch (error: any) {
      console.error('Qwen API Error:', error.response?.data || error.message);
      throw new Error(`通义千问调用失败: ${error.message}`);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.chat({
        messages: [{ role: 'user', content: '你好' }],
        maxTokens: 10,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// ============================================================================
// 百度文心一言实现
// ============================================================================

class ErnieProvider extends BaseAIProvider {
  private accessToken?: string;
  private tokenExpiry?: number;

  getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  private async getAccessToken(): Promise<string> {
    // 检查token是否有效
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // 获取新token
    try {
      const response = await axios.post(
        `${this.config.endpoint}/oauth/2.0/token`,
        null,
        {
          params: {
            grant_type: 'client_credentials',
            client_id: this.config.apiKey,
            client_secret: this.config.apiSecret,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
      
      return this.accessToken;
    } catch (error: any) {
      throw new Error(`获取百度AI访问令牌失败: ${error.message}`);
    }
  }

  async chat(options: AICompletionOptions): Promise<AICompletionResponse> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await this.client.post(
        `/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${this.config.model}?access_token=${accessToken}`,
        {
          messages: options.messages,
          temperature: options.temperature || 0.7,
          max_output_tokens: options.maxTokens || 2000,
        }
      );

      const data = response.data;

      if (data.error_code) {
        throw new Error(`Ernie API Error: ${data.error_msg}`);
      }

      return {
        content: data.result,
        model: this.config.model,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        finishReason: data.finish_reason,
      };
    } catch (error: any) {
      console.error('Ernie API Error:', error.response?.data || error.message);
      throw new Error(`文心一言调用失败: ${error.message}`);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// ============================================================================
// OpenAI实现
// ============================================================================

class OpenAIProvider extends BaseAIProvider {
  getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async chat(options: AICompletionOptions): Promise<AICompletionResponse> {
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages: options.messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
      });

      const data = response.data;

      return {
        content: data.choices[0].message.content,
        model: data.model,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        finishReason: data.choices[0].finish_reason,
      };
    } catch (error: any) {
      console.error('OpenAI API Error:', error.response?.data || error.message);
      throw new Error(`OpenAI调用失败: ${error.message}`);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        maxTokens: 10,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// ============================================================================
// AI服务管理器
// ============================================================================

export class AIService {
  private provider?: BaseAIProvider;
  private config: AIConfig;
  private static instance?: AIService;

  private constructor() {
    this.config = this.loadConfig();
    this.initProvider();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * 从环境变量加载配置
   */
  private loadConfig(): AIConfig {
    const provider = (process.env.AI_PROVIDER || 'qwen') as AIProvider;

    switch (provider) {
      case 'qwen':
        return {
          provider: 'qwen',
          apiKey: process.env.QWEN_API_KEY || '',
          endpoint: process.env.QWEN_API_ENDPOINT || 'https://dashscope.aliyuncs.com/api/v1',
          model: process.env.QWEN_MODEL || 'qwen-plus',
        };

      case 'ernie':
        return {
          provider: 'ernie',
          apiKey: process.env.ERNIE_API_KEY || '',
          apiSecret: process.env.ERNIE_SECRET_KEY || '',
          endpoint: process.env.ERNIE_API_ENDPOINT || 'https://aip.baidubce.com',
          model: process.env.ERNIE_MODEL || 'ernie-bot-3.5',
        };

      case 'openai':
        return {
          provider: 'openai',
          apiKey: process.env.OPENAI_API_KEY || '',
          endpoint: process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1',
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        };

      case 'hunyuan':
        return {
          provider: 'hunyuan',
          apiKey: process.env.HUNYUAN_SECRET_ID || '',
          apiSecret: process.env.HUNYUAN_SECRET_KEY || '',
          endpoint: process.env.HUNYUAN_API_ENDPOINT || 'https://hunyuan.tencentcloudapi.com',
          model: process.env.HUNYUAN_MODEL || 'hunyuan-standard',
        };

      default:
        throw new Error(`不支持的AI服务提供商: ${provider}`);
    }
  }

  /**
   * 初始化提供商
   */
  private initProvider(): void {
    switch (this.config.provider) {
      case 'qwen':
        this.provider = new QwenProvider(this.config);
        break;
      case 'ernie':
        this.provider = new ErnieProvider(this.config);
        break;
      case 'openai':
        this.provider = new OpenAIProvider(this.config);
        break;
      default:
        throw new Error(`未实现的AI服务提供商: ${this.config.provider}`);
    }
  }

  /**
   * 切换AI服务提供商
   */
  public switchProvider(newConfig: Partial<AIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initProvider();
    console.log(`已切换到AI提供商: ${this.config.provider}, 模型: ${this.config.model}`);
  }

  /**
   * 获取当前配置
   */
  public getConfig(): AIConfig {
    return { ...this.config };
  }

  /**
   * 聊天完成
   */
  public async chat(options: AICompletionOptions): Promise<AICompletionResponse> {
    if (!this.provider) {
      throw new Error('AI服务提供商未初始化');
    }

    if (!this.config.apiKey) {
      throw new Error('AI API密钥未配置，请检查环境变量');
    }

    return this.provider.chat(options);
  }

  /**
   * 检查连接
   */
  public async checkConnection(): Promise<boolean> {
    if (!this.provider) {
      return false;
    }

    try {
      return await this.provider.checkConnection();
    } catch (error) {
      return false;
    }
  }

  /**
   * 发票真伪识别
   */
  public async verifyInvoice(invoiceData: any): Promise<any> {
    const prompt = `请分析以下发票数据，判断其真伪：
${JSON.stringify(invoiceData, null, 2)}

请从以下维度分析：
1. 发票号码格式是否正确
2. 发票代码是否有效
3. 开票日期是否合理
4. 金额是否异常
5. 购买方和销售方信息是否完整

返回JSON格式：
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "risks": ["风险点1", "风险点2"],
  "reason": "判断理由"
}`;

    const response = await this.chat({
      messages: [
        { role: 'system', content: '你是一个专业的审计AI助手，擅长发票真伪识别。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3, // 降低温度，提高准确性
    });

    try {
      return JSON.parse(response.content);
    } catch (error) {
      return {
        isValid: false,
        confidence: 0,
        risks: ['AI分析失败'],
        reason: response.content,
      };
    }
  }

  /**
   * 舞弊风险评分
   */
  public async detectFraud(transactionData: any): Promise<any> {
    const prompt = `请分析以下交易数据，评估舞弊风险：
${JSON.stringify(transactionData, null, 2)}

请从以下维度评估：
1. 交易金额是否异常
2. 交易频率是否可疑
3. 交易对手是否为关联方
4. 资金流向是否合理
5. 是否存在循环交易

返回JSON格式：
{
  "riskScore": 0-100,
  "riskLevel": "低/中/高",
  "indicators": ["风险指标1", "风险指标2"],
  "recommendation": "建议措施"
}`;

    const response = await this.chat({
      messages: [
        { role: 'system', content: '你是一个专业的审计AI助手，擅长舞弊检测。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });

    try {
      return JSON.parse(response.content);
    } catch (error) {
      return {
        riskScore: 0,
        riskLevel: '未知',
        indicators: [],
        recommendation: response.content,
      };
    }
  }
}

// ============================================================================
// 导出
// ============================================================================

export default AIService;

// 使用示例：
// const aiService = AIService.getInstance();
// const response = await aiService.chat({
//   messages: [{ role: 'user', content: '你好' }]
// });
