#!/usr/bin/env node

import { Agent } from './dist/index.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testOptimizedReActAgent() {
  console.log('🚀 测试优化后的ReAct Agent...\n');
  
  const config = {
    llm: {
      provider: 'deepseek',
      model: 'deepseek-chat',
      api_key: process.env.DEEPSEEK_API_KEY || 'sk-1f23acc3f51a429e90dc75eeb83831cc',
      base_url: 'https://api.deepseek.com',
      max_tokens: 4000,
      temperature: 0.1
    },
    agent: {
      max_steps: 8, // 减少最大步数以测试效率
      working_directory: resolve(__dirname, 'test-workspace'),
      enable_docker: false,
      enable_trajectory_recording: true,
      tools: ['edit_tool', 'bash_tool', 'complete_task_tool'] // 使用新的complete_task工具
    },
    logging: {
      level: 'info',
      format: 'pretty'
    }
  };

  try {
    console.log('🏗️  创建优化后的Agent...');
    const agent = await Agent.create({ 
      config,
      workingDirectory: resolve(__dirname, 'test-workspace')
    });

    console.log('✅ Agent创建成功\n');

    // 测试更复杂的任务来验证优化效果
    const task = `请创建一个名为optimized_test.js的文件，内容包含一个简单的"Hello Optimized Agent!"字符串，然后验证文件内容是否正确。完成后调用complete_task工具结束任务。
    
    注意：请充分利用上下文信息和错误提示中的路径建议，避免重复的文件系统浏览操作。`;
    
    console.log(`📋 执行优化测试任务:`);
    console.log(`${task}\n`);
    console.log('🔄 开始优化的ReAct循环...\n');

    const startTime = Date.now();
    const trajectory = await agent.execute(task);
    const endTime = Date.now();
    const executionTime = (endTime - startTime) / 1000;

    console.log('\n📊 优化后的执行结果:');
    console.log(`✅ 任务完成: ${trajectory.completed}`);
    console.log(`🎯 执行成功: ${trajectory.success}`);
    console.log(`📈 执行步数: ${trajectory.steps.length}`);
    console.log(`⏱️  执行时间: ${executionTime.toFixed(2)}秒`);
    console.log(`⚡ 平均每步时间: ${(executionTime / trajectory.steps.length).toFixed(2)}秒`);
    console.log(`⏱️  开始时间: ${trajectory.start_time}`);
    console.log(`⏱️  结束时间: ${trajectory.end_time}`);

    if (trajectory.steps.length > 0) {
      console.log('\n📝 执行步骤详情:');
      trajectory.steps.forEach((step, index) => {
        console.log(`  步骤 ${index + 1}:`);
        console.log(`    🔧 工具调用: ${step.tool_calls.map(tc => tc.function.name).join(', ') || '无'}`);
        console.log(`    ✅ 是否完成: ${step.completed}`);
        if (step.tool_calls.length > 0) {
          console.log(`    📊 工具结果: ${step.tool_results.map(tr => tr.success ? '成功' : '失败').join(', ')}`);
        }
        // 检查是否有重复检测
        if (step.repetition_detected) {
          console.log(`    🔄 重复检测: 是`);
        }
      });
    }

    // 性能分析
    console.log('\n📈 性能分析:');
    const failedSteps = trajectory.steps.filter(step => 
      step.tool_results.some(result => !result.success)
    ).length;
    
    const toolCallCount = trajectory.steps.reduce((total, step) => 
      total + step.tool_calls.length, 0
    );

    console.log(`❌ 失败步骤: ${failedSteps}/${trajectory.steps.length}`);
    console.log(`🔧 总工具调用: ${toolCallCount}`);
    console.log(`📊 成功率: ${((trajectory.steps.length - failedSteps) / trajectory.steps.length * 100).toFixed(1)}%`);

    return trajectory.success;
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

// 运行优化测试
testOptimizedReActAgent()
  .then(success => {
    console.log(`\n🏁 优化测试${success ? '成功' : '失败'}`);
    if (success) {
      console.log('🎉 ReAct Agent优化效果显著！');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 测试出现错误:', error);
    process.exit(1);
  });