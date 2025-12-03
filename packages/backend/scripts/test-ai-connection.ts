/**
 * AI服务连接测试脚本
 * 用于验证AI API配置是否正确
 * 
 * 运行方式：
 * npm run test:ai-connection
 * 
 * 或者直接运行：
 * ts-node scripts/test-ai-connection.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import AIService, { AIProvider } from '../src/services/AIService';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env.ai-services') });

// ============================================================================
// 测试函数
// ============================================================================

async function testAIConnection() {
  console.log('========================================');
  console.log('🤖 AI服务连接测试');
  console.log('========================================\n');

  const aiService = AIService.getInstance();
  const config = aiService.getConfig();

  // 显示当前配置
  console.log('📋 当前配置:');
  console.log(`   提供商: ${config.provider}`);
  console.log(`   模型: ${config.model}`);
  console.log(`   端点: ${config.endpoint}`);
  console.log(`   API密钥: ${config.apiKey ? `${config.apiKey.substring(0, 10)}...` : '❌ 未配置'}`);
  console.log('');

  // 检查API密钥
  if (!config.apiKey) {
    console.error('❌ 错误: API密钥未配置');
    console.log('\n请按照以下步骤配置:');
    console.log('1. 复制 .env.ai-services.example 为 .env.ai-services');
    console.log('2. 在 .env.ai-services 中填写真实的API密钥');
    console.log('3. 重新运行此测试脚本\n');
    process.exit(1);
  }

  // 测试1: 检查连接
  console.log('🔍 测试1: 检查API连接...');
  try {
    const isConnected = await aiService.checkConnection();
    if (isConnected) {
      console.log('✅ API连接成功!\n');
    } else {
      console.log('❌ API连接失败\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`❌ 连接测试失败: ${error.message}\n`);
    process.exit(1);
  }

  // 测试2: 简单对话
  console.log('🔍 测试2: 简单对话...');
  try {
    const response = await aiService.chat({
      messages: [
        { role: 'user', content: '请用一句话介绍你自己' },
      ],
      maxTokens: 100,
    });

    console.log('✅ 对话成功!');
    console.log(`   回复: ${response.content}`);
    if (response.usage) {
      console.log(`   Token使用: ${response.usage.totalTokens} (输入: ${response.usage.promptTokens}, 输出: ${response.usage.completionTokens})`);
    }
    console.log('');
  } catch (error: any) {
    console.error(`❌ 对话失败: ${error.message}\n`);
    process.exit(1);
  }

  // 测试3: 发票真伪识别
  console.log('🔍 测试3: 发票真伪识别...');
  try {
    const testInvoice = {
      invoiceCode: '1100204130',
      invoiceNumber: '12345678',
      date: '2024-01-15',
      amount: 10000,
      seller: '测试公司A',
      buyer: '测试公司B',
    };

    const result = await aiService.verifyInvoice(testInvoice);
    console.log('✅ 发票识别成功!');
    console.log(`   结果: ${JSON.stringify(result, null, 2)}`);
    console.log('');
  } catch (error: any) {
    console.error(`❌ 发票识别失败: ${error.message}\n`);
  }

  // 测试4: 舞弊风险评分
  console.log('🔍 测试4: 舞弊风险评分...');
  try {
    const testTransaction = {
      transactionId: 'T001',
      amount: 1000000,
      date: '2024-01-15',
      from: '公司A',
      to: '公司B',
      frequency: '一天内3次大额转账',
    };

    const result = await aiService.detectFraud(testTransaction);
    console.log('✅ 舞弊检测成功!');
    console.log(`   结果: ${JSON.stringify(result, null, 2)}`);
    console.log('');
  } catch (error: any) {
    console.error(`❌ 舞弊检测失败: ${error.message}\n`);
  }

  // 总结
  console.log('========================================');
  console.log('✅ 所有测试完成!');
  console.log('========================================\n');
  
  console.log('💡 提示:');
  console.log('   - 如需切换AI提供商，修改 .env.ai-services 中的 AI_PROVIDER');
  console.log('   - 支持的提供商: qwen (通义千问), ernie (文心一言), openai, hunyuan (混元)');
  console.log('   - 通义千问限时免费，推荐使用\n');
}

// ============================================================================
// 测试所有配置的提供商
// ============================================================================

async function testAllProviders() {
  console.log('========================================');
  console.log('🔬 测试所有配置的AI提供商');
  console.log('========================================\n');

  const providers: AIProvider[] = ['qwen', 'ernie', 'openai', 'hunyuan'];
  const aiService = AIService.getInstance();

  for (const provider of providers) {
    console.log(`\n📦 测试提供商: ${provider}`);
    console.log('----------------------------------------');

    // 检查是否配置了API密钥
    const envKey = `${provider.toUpperCase()}_API_KEY`;
    if (!process.env[envKey]) {
      console.log(`⚠️  跳过 ${provider}: API密钥未配置\n`);
      continue;
    }

    try {
      // 切换提供商
      aiService.switchProvider({ provider });
      
      // 测试连接
      const isConnected = await aiService.checkConnection();
      if (isConnected) {
        console.log(`✅ ${provider} 连接成功!`);
        
        // 简单对话测试
        const response = await aiService.chat({
          messages: [{ role: 'user', content: '你好' }],
          maxTokens: 20,
        });
        console.log(`   回复: ${response.content}`);
      } else {
        console.log(`❌ ${provider} 连接失败`);
      }
    } catch (error: any) {
      console.error(`❌ ${provider} 测试失败: ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================\n');
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    await testAllProviders();
  } else {
    await testAIConnection();
  }
}

// 运行
main().catch((error) => {
  console.error('❌ 测试脚本执行失败:', error);
  process.exit(1);
});

// 使用说明
console.log('💡 使用说明:');
console.log('   npm run test:ai-connection        - 测试当前配置的AI提供商');
console.log('   npm run test:ai-connection --all  - 测试所有配置的AI提供商\n');
