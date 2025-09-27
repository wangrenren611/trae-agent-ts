/**
 * PlannerAgent 使用示例
 * 演示如何使用基于高级智能体的规划器处理复杂任务
 */

const { PlannerAgent, ConfigManager, Logger, createLLMClient, createTools } = require('../dist/index.js');
const { randomUUID } = require('crypto');

async function plannerAgentExample() {
  console.log('🚀 PlannerAgent 高级规划智能体示例');
  console.log('═'.repeat(50));

  try {
    // 1. 加载配置
    console.log('📋 步骤1：加载配置');
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    
    // 确保包含planner工具
    if (!config.agent.tools.includes('planner_tool')) {
      config.agent.tools.push('planner_tool');
    }
    if (!config.agent.tools.includes('sequential_thinking_tool')) {
      config.agent.tools.push('sequential_thinking_tool');
    }
    
    console.log('✅ 配置加载完成');

    // 2. 创建Logger
    const logger = Logger.create({
      level: 'info',
      format: 'pretty'
    });

    // 3. 创建PlannerAgent
    console.log('🤖 步骤2：创建PlannerAgent');
    
    // 创建LLM客户端
    const llmClient = createLLMClient({
      name: config.llm.provider,
      api_key: config.llm.api_key,
      base_url: config.llm.base_url,
      model: config.llm.model,
      max_tokens: config.llm.max_tokens,
      temperature: config.llm.temperature,
      top_p: config.llm.top_p,
    });
    
    // 创建工具
    const tools = await createTools(config, logger);
    
    // 创建PlannerAgent实例
    const agentId = randomUUID();
    const plannerAgent = new PlannerAgent(
      agentId,
      llmClient,
      tools,
      config,
      logger,
      process.cwd(),
      {
        maxDecompositionDepth: 3,
        optimizeParallel: true,
        autoEstimateTime: true,
        strategy: 'balanced',
        granularity: 'medium'
      }
    );
    
    console.log('✅ PlannerAgent创建完成');

    // 4. 定义复杂任务
    const complexObjective = `
创建一个完整的Node.js Web应用程序，具备以下功能：
1. 用户注册和登录系统
2. RESTful API接口
3. 数据库集成
4. 前端界面
5. 单元测试
6. 部署配置
7. API文档
    `.trim();

    console.log('🎯 步骤3：执行复杂规划任务');
    console.log(`目标：${complexObjective}`);
    console.log('─'.repeat(50));

    // 5. 执行规划任务
    const startTime = Date.now();
    const trajectory = await plannerAgent.execute(complexObjective, 30);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // 6. 显示执行结果
    console.log('📊 步骤4：执行结果分析');
    console.log('═'.repeat(50));
    
    console.log(`✅ 执行状态：${trajectory.success ? '成功' : '失败'}`);
    console.log(`⏱️  执行时间：${duration.toFixed(2)}秒`);
    console.log(`📈 执行步骤：${trajectory.steps.length}步`);
    
    // 7. 获取当前计划信息
    const currentPlan = plannerAgent.getCurrentPlan();
    if (currentPlan) {
      console.log('\n🗂️  计划详情：');
      console.log(`计划ID：${currentPlan.id}`);
      console.log(`计划状态：${currentPlan.status}`);
      console.log(`任务总数：${currentPlan.tasks.length}`);
      console.log(`执行进度：${(currentPlan.progress * 100).toFixed(1)}%`);
      
      // 显示任务列表
      console.log('\n📋 任务列表：');
      currentPlan.tasks.forEach((task, index) => {
        const statusIcon = task.status === 'completed' ? '✅' : 
                          task.status === 'in_progress' ? '🔄' : 
                          task.status === 'failed' ? '❌' : '⏳';
        console.log(`  ${index + 1}. ${statusIcon} ${task.title}`);
        console.log(`     状态：${task.status} | 优先级：${task.priority} | 预计：${task.estimatedDuration}分钟`);
      });
    }

    // 8. 显示轨迹信息
    if (trajectory.steps.length > 0) {
      console.log('\n🛤️  执行轨迹：');
      trajectory.steps.forEach((step, index) => {
        console.log(`步骤 ${index + 1}：`);
        console.log(`  工具调用：${step.tool_calls?.length || 0}个`);
        console.log(`  执行结果：${step.tool_results?.filter(r => r.success).length || 0}成功，${step.tool_results?.filter(r => !r.success).length || 0}失败`);
      });
    }

    console.log('\n🎉 PlannerAgent示例执行完成！');

  } catch (error) {
    console.error('❌ 示例执行失败：', error);
    if (error instanceof Error) {
      console.error('错误详情：', error.message);
      console.error('错误堆栈：', error.stack);
    }
  }
}

async function simplePlanningExample() {
  console.log('\n🔧 简单规划示例');
  console.log('═'.repeat(30));

  try {
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    
    // 确保包含必要工具
    config.agent.tools = ['edit_tool', 'bash_tool', 'planner_tool', 'complete_task_tool'];
    
    const logger = Logger.create({ level: 'info', format: 'pretty' });
    
    // 创建LLM客户端
    const llmClient = createLLMClient({
      name: config.llm.provider,
      api_key: config.llm.api_key,
      model: config.llm.model
    });
    
    // 创建工具
    const tools = await createTools(config, logger);
    
    const plannerAgent = new PlannerAgent(
      randomUUID(),
      llmClient,
      tools,
      config,
      logger,
      process.cwd(),
      {
        maxDecompositionDepth: 2,
        strategy: 'minimal',
        granularity: 'coarse'
      }
    );

    const simpleTask = '创建一个简单的Python计算器程序，包含基本的四则运算功能';
    
    console.log(`🎯 任务：${simpleTask}`);
    
    const result = await plannerAgent.execute(simpleTask, 15);
    
    console.log(`✅ 结果：${result.success ? '成功' : '失败'}`);
    console.log(`📊 步骤：${result.steps.length}`);
    
    const plan = plannerAgent.getCurrentPlan();
    if (plan) {
      console.log(`📋 任务数：${plan.tasks.length}`);
      plan.tasks.forEach((task, i) => {
        console.log(`  ${i+1}. ${task.title} (${task.status})`);
      });
    }

  } catch (error) {
    console.error('❌ 简单示例失败：', error);
  }
}

// 主函数
async function main() {
  console.log('🌟 PlannerAgent 综合示例');
  console.log('展示基于高级智能体的复杂任务规划与执行能力');
  console.log('═'.repeat(60));

  // 运行复杂规划示例
  await plannerAgentExample();
  
  // 等待一会儿
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 运行简单规划示例
  await simplePlanningExample();
  
  console.log('\n🏁 所有示例执行完成！');
  console.log('\n📚 总结：');
  console.log('• PlannerAgent具备强大的任务分解和规划能力');
  console.log('• 支持复杂任务的系统化管理和执行');
  console.log('• 提供灵活的配置选项和执行策略');
  console.log('• 集成了ReAct模式，确保推理-行动-观察的完整循环');
  console.log('• 支持动态计划调整和执行监控');
}

// 执行示例
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  plannerAgentExample,
  simplePlanningExample,
  main
};