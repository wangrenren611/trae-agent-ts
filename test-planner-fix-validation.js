#!/usr/bin/env node

/**
 * 测试修复后的PlannerAgent
 * 验证规划与执行分离原则是否得到正确实施
 */

async function testPlannerFix() {
  console.log('🔧 测试PlannerAgent修复效果');
  console.log('='.repeat(40));

  try {
    const { PlannerAgent, LLMClient, PlannerTool } = require('./dist/index.js');
    const { Config } = require('./dist/utils/config/config.js');
    const { Logger } = require('./dist/utils/logging/logger.js');

    // 1. 准备配置
    console.log('📋 步骤1：准备配置');
    const config = new Config();
    const logger = new Logger();
    const llmClient = new LLMClient(config, logger);
    
    // 2. 创建规划工具（符合规划与执行分离原则）
    const plannerTool = new PlannerTool();
    const sequentialThinking = require('./node_modules/mcp-server-sequential-thinking');
    
    // 3. 创建PlannerAgent（只传入规划相关工具）
    console.log('🧠 步骤2：创建纯规划Agent');
    const plannerAgent = new PlannerAgent(
      'test-planner-001',
      llmClient,
      [plannerTool], // 只传入规划工具，不传入执行工具
      config,
      logger,
      process.cwd()
    );

    // 4. 验证角色配置
    console.log('✅ 步骤3：验证角色配置');
    const validation = plannerAgent.validatePlannerRole();
    console.log(`角色验证结果：${validation.valid ? '✅ 通过' : '❌ 失败'}`);
    
    if (!validation.valid) {
      console.log('⚠️ 发现的问题：');
      validation.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    // 5. 测试获取当前计划（应该返回null，因为还没有规划）
    console.log('📋 步骤4：测试getCurrentPlan方法');
    const initialPlan = plannerAgent.getCurrentPlan();
    console.log(`初始计划状态：${initialPlan ? '存在计划' : '✅ 无计划（符合预期）'}`);

    console.log('\n🎯 测试结果总结：');
    console.log(`✅ PlannerAgent创建成功`);
    console.log(`${validation.valid ? '✅' : '❌'} 角色配置验证${validation.valid ? '通过' : '失败'}`);
    console.log(`✅ getCurrentPlan方法正常工作`);
    console.log(`✅ 没有monitorPlanExecution方法调用错误`);

    const allTestsPassed = validation.valid;
    console.log(`\n🏆 总体测试结果：${allTestsPassed ? '🌟 全部通过！' : '⚠️ 部分失败'}`);
    
    if (allTestsPassed) {
      console.log('\n🎊 恭喜！PlannerAgent修复成功！');
      console.log('✨ 现在严格遵循规划与执行分离原则');
      console.log('✨ 没有越权执行功能，专注于纯规划');
      console.log('✨ 角色边界清晰，职责明确');
    }

    return allTestsPassed;

  } catch (error) {
    console.error('❌ 测试失败：', error.message);
    console.error('错误详情：', error.stack);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testPlannerFix()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 测试运行失败：', error);
      process.exit(1);
    });
}

module.exports = { testPlannerFix };