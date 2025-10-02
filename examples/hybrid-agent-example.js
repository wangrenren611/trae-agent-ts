/**
 * 混合Agent使用示例
 *
 * 这个示例展示了如何使用HybridAgent来执行复杂任务，
 * 先进行智能规划，然后逐步执行。
 */

import { HybridAgent } from '../dist/agent/hybrid-agent.js';
import { createLLMClient } from '../dist/utils/llm_clients/factory.js';
import { createTools } from '../dist/tools/factory.js';
import { ConfigManager } from '../dist/utils/config/config.js';
import { Logger } from '../dist/utils/logging/logger.js';
import { randomUUID } from 'crypto';

async function runHybridAgentExample() {
  console.log('🎯 混合Agent使用示例');
  const configManager = await ConfigManager.getInstance();
  const config = configManager.getConfig();

  const logger = Logger.create(config.logging);

  const llmClient = createLLMClient(config.llm);
  const tools = await createTools(config, logger);

  // 2. 创建混合Agent
  const hybridAgent = new HybridAgent(
    `example-hybrid-${randomUUID().slice(0, 8)}`,
    llmClient,
    tools,
    config,
    logger,
    config.agent.working_directory,
    {
      // 规划选项
      planningOptions: {
        maxDecompositionDepth: 3,
        optimizeParallel: false, // 顺序执行更容易理解
        autoEstimateTime: true,
        strategy: 'balanced',
      },
      // 执行配置
      executionConfig: {
        maxSteps: 10, // 减少每个任务的步数
        enableAutoRetry: false, // 禁用自动重试
        continueOnError: true, // 遇到错误继续执行
      },
    }
  );

  // 3. 定义示例任务
  const exampleTasks = [
    {
      name: '创建Node.js项目结构',
      description: '创建一个完整的Node.js项目，包括package.json、src目录、测试目录和基础文件'
    },
  ];

  // 4. 执行示例任务
  for (const task of exampleTasks) {
    console.log(`\n🚀 执行任务: ${task.name}`);
    console.log(`📝 任务描述: ${task.description}`);

    try {
      const trajectory = await hybridAgent.execute(task.description);

      // 输出执行结果
      console.log(`✅ 任务完成: ${trajectory.completed ? '是' : '否'}`);
      console.log(`🎯 执行成功: ${trajectory.success ? '是' : '否'}`);
      console.log(`📊 执行步骤: ${trajectory.steps.length}`);

      // 显示计划信息
      const summary = hybridAgent.getExecutionSummary();
      console.log(`📋 计划信息: ${summary.totalTasks} 个任务`);

      if (summary.hasPlan) {
        const plan = hybridAgent.getCurrentPlan();
        console.log(`📝 计划标题: ${plan?.title}`);

        // 显示任务列表
        console.log('📝 任务列表:');
        plan?.tasks.forEach((task, index) => {
          const status = task.status || 'pending';
          const priority = task.priority || 'medium';
          console.log(`  ${index + 1}. [${status.toUpperCase()}] ${task.title} (${priority})`);
        });
      }

      console.log('─'.repeat(50));

      // 等待一下再执行下一个任务
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ 任务执行失败: ${error.message}`);
    }
  }

  console.log('\n🎉 所有示例任务执行完成！');
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  runHybridAgentExample()
    .then(() => {
      console.log('示例运行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('示例运行失败:', error);
      process.exit(1);
    });
}

export { runHybridAgentExample };