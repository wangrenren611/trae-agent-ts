import { HybridAgent } from './src/agent/hybrid-agent.js';
import { LLMClientFactory } from './src/utils/llm_clients/factory.js';
import { ToolFactory } from './src/tools/factory.js';
import { ConfigFactory } from './src/utils/config/config.js';
import { Logger } from './src/utils/logging/logger.js';
import { randomUUID } from 'crypto';

async function testHybridAgent() {
  console.log('🧪 开始测试混合Agent...');

  try {
    // 初始化配置
    const config = ConfigFactory.create({
      llm: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        api_key: process.env.OPENAI_API_KEY,
        base_url: process.env.OPENAI_BASE_URL,
        temperature: 0.7,
      },
      agent: {
        max_steps: 20,
        working_directory: './test-workspace',
        enable_trajectory_recording: true,
        tools: ['planner_tool', 'sequential_thinking', 'edit_tool', 'bash_tool', 'complete_task'],
      },
      logging: {
        level: 'info',
        format: 'pretty',
      },
    });

    // 创建日志记录器
    const logger = new Logger(config);

    // 创建LLM客户端
    const llmClient = LLMClientFactory.create(config.llm);

    // 创建工具集合
    const tools = ToolFactory.createTools(
      config.agent.tools,
      config
    );

    // 创建混合Agent
    const hybridAgent = new HybridAgent(
      `test-hybrid-${randomUUID().slice(0, 8)}`,
      llmClient,
      tools,
      config,
      logger,
      config.agent.working_directory,
      {
        planningOptions: {
          maxDecompositionDepth: 3,
          optimizeParallel: true,
          autoEstimateTime: true,
          strategy: 'balanced',
        },
        executionConfig: {
          maxSteps: 15,
          enableAutoRetry: true,
          continueOnError: false,
        },
      }
    );

    console.log('✅ 混合Agent初始化完成');

    // 测试任务：创建一个简单的项目结构
    const testTask = '创建一个名为"my-project"的目录，在其中创建一个README.md文件，文件内容包含项目标题和简介，然后创建一个src目录和基本的index.js文件';

    console.log(`🚀 开始执行测试任务: ${testTask}`);

    // 执行任务
    const trajectory = await hybridAgent.execute(testTask);

    // 输出结果
    console.log('\n📊 执行结果:');
    console.log(`- 任务完成: ${trajectory.completed}`);
    console.log(`- 执行成功: ${trajectory.success}`);
    console.log(`- 总步骤数: ${trajectory.steps.length}`);
    console.log(`- 执行时间: ${trajectory.start_time} -> ${trajectory.end_time}`);

    // 获取执行摘要
    const summary = hybridAgent.getExecutionSummary();
    console.log('\n📋 执行摘要:');
    console.log(`- 计划ID: ${summary.planId}`);
    console.log(`- 任务总数: ${summary.totalTasks}`);
    console.log(`- 当前阶段: ${summary.currentPhase}`);
    console.log(`- 有计划: ${summary.hasPlan}`);

    // 获取当前计划
    const currentPlan = hybridAgent.getCurrentPlan();
    if (currentPlan) {
      console.log('\n📝 当前计划详情:');
      console.log(`- 计划标题: ${currentPlan.title}`);
      console.log(`- 计划描述: ${currentPlan.description}`);
      console.log(`- 计划目标: ${currentPlan.objective}`);
      console.log(`- 任务列表:`);
      currentPlan.tasks.forEach((task, index) => {
        console.log(`  ${index + 1}. ${task.title} (${task.priority || 'medium'})`);
      });
    }

    console.log('\n✅ 混合Agent测试完成！');

    return trajectory;

  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testHybridAgent()
    .then(() => {
      console.log('测试成功完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('测试失败:', error);
      process.exit(1);
    });
}

export { testHybridAgent };