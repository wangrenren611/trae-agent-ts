/**
 * 简单的HybridAgent测试脚本
 */

import { HybridAgent } from './src/agent/hybrid-agent.js';
import { LLMClientFactory } from './src/utils/llm_clients/factory.js';
import { ToolFactory } from './src/tools/factory.js';
import { ConfigFactory } from './src/utils/config/config.js';
import { Logger } from './src/utils/logging/logger.js';
import { randomUUID } from 'crypto';

async function testHybridAgentSimple() {
  console.log('🧪 开始简单测试HybridAgent...');

  try {
    // 配置
    const config = ConfigFactory.create({
      llm: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        api_key: process.env.OPENAI_API_KEY,
        temperature: 0.7,
      },
      agent: {
        max_steps: 15,
        working_directory: './test-workspace',
        tools: ['planner_tool', 'sequential_thinking', 'edit_tool', 'bash_tool', 'complete_task'],
      },
      logging: {
        level: 'info',
        format: 'pretty',
      },
    });

    const logger = new Logger(config);
    const llmClient = LLMClientFactory.create(config.llm);
    const tools = ToolFactory.createTools(config.agent.tools, config);

    // 创建HybridAgent
    const hybridAgent = new HybridAgent(
      `test-${randomUUID().slice(0, 8)}`,
      llmClient,
      tools,
      config,
      logger,
      config.agent.working_directory
    );

    console.log('✅ HybridAgent创建成功');

    // 简单测试任务
    const testTask = '创建一个名为test.txt的文件，内容为"Hello HybridAgent!"';

    console.log(`🚀 执行测试任务: ${testTask}`);

    const trajectory = await hybridAgent.execute(testTask);

    console.log('\n📊 测试结果:');
    console.log(`- 任务完成: ${trajectory.completed}`);
    console.log(`- 执行成功: ${trajectory.success}`);
    console.log(`- 步骤数: ${trajectory.steps.length}`);

    // 显示执行摘要
    const summary = hybridAgent.getExecutionSummary();
    console.log('\n📋 执行摘要:');
    console.log(`- 计划ID: ${summary.planId}`);
    console.log(`- 任务总数: ${summary.totalTasks}`);
    console.log(`- 当前阶段: ${summary.currentPhase}`);
    console.log(`- 有计划: ${summary.hasPlan}`);

    // 显示计划详情
    const plan = hybridAgent.getCurrentPlan();
    if (plan) {
      console.log('\n📝 计划详情:');
      console.log(`- 标题: ${plan.title}`);
      console.log(`- 描述: ${plan.description}`);
      console.log(`- 任务列表:`);
      plan.tasks.forEach((task, index) => {
        console.log(`  ${index + 1}. ${task.title}`);
      });
    }

    console.log('\n✅ 测试完成！');

    return trajectory;

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testHybridAgentSimple()
    .then(() => {
      console.log('测试成功完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('测试失败:', error);
      process.exit(1);
    });
}

export { testHybridAgentSimple };