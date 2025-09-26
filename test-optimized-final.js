#!/usr/bin/env node

import { Agent } from './dist/index.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { rmSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testOptimizedAgent() {
  console.log('🧪 测试优化后的ReAct Agent...\n');
  
  // 清理测试环境
  const testWorkspace = resolve(__dirname, 'test-workspace');
  if (existsSync(testWorkspace)) {
    rmSync(testWorkspace, { recursive: true, force: true });
  }
  
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
      max_steps: 8, // 降低期望步数
      working_directory: testWorkspace,
      enable_docker: false,
      enable_trajectory_recording: true,
      tools: ['edit_tool', 'bash_tool', 'complete_task_tool']
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
      workingDirectory: testWorkspace
    });

    console.log('✅ Agent创建成功\n');

    // 记录开始时间
    const startTime = Date.now();
    
    // 测试任务
    const task = '请创建一个名为hello.txt的文件，内容是"Hello Optimized ReAct Agent!"，然后验证文件内容是否正确。完成后请调用complete_task工具来结束任务。';
    
    console.log(`📋 执行任务: ${task}\n`);
    console.log('🔄 开始优化后的ReAct循环...\n');

    const trajectory = await agent.execute(task);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;

    console.log('\n📊 优化后执行结果:');
    console.log(`✅ 任务完成: ${trajectory.completed}`);
    console.log(`🎯 执行成功: ${trajectory.success}`);
    console.log(`📈 执行步数: ${trajectory.steps.length}`);
    console.log(`⏱️  执行时间: ${(executionTime / 1000).toFixed(2)}秒`);
    console.log(`🏃‍♂️ 平均每步时间: ${(executionTime / trajectory.steps.length / 1000).toFixed(2)}秒`);

    // 统计工具成功率
    let totalToolCalls = 0;
    let successfulToolCalls = 0;
    
    trajectory.steps.forEach(step => {
      totalToolCalls += step.tool_calls.length;
      successfulToolCalls += step.tool_results.filter(r => r.success).length;
    });
    
    const successRate = totalToolCalls > 0 ? (successfulToolCalls / totalToolCalls * 100).toFixed(1) : '0';
    console.log(`📋 工具成功率: ${successRate}% (${successfulToolCalls}/${totalToolCalls})`);

    if (trajectory.steps.length > 0) {
      console.log('\n📝 优化后执行步骤概览:');
      trajectory.steps.forEach((step, index) => {
        const toolNames = step.tool_calls.map(tc => tc.function.name).join(', ') || '无';
        const results = step.tool_results.map(tr => tr.success ? '✅' : '❌').join('');
        console.log(`  步骤 ${index + 1}: ${toolNames} ${results} ${step.completed ? '🏁' : ''}`);
      });
    }

    // 性能评估
    console.log('\n🎯 性能评估:');
    if (trajectory.steps.length <= 6) {
      console.log('🟢 步数控制: 优秀 (≤6步)');
    } else if (trajectory.steps.length <= 8) {
      console.log('🟡 步数控制: 良好 (≤8步)');
    } else {
      console.log('🔴 步数控制: 需改进 (>8步)');
    }
    
    if (successRate >= 85) {
      console.log(`🟢 工具成功率: 优秀 (${successRate}%)`);
    } else if (successRate >= 70) {
      console.log(`🟡 工具成功率: 良好 (${successRate}%)`);
    } else {
      console.log(`🔴 工具成功率: 需改进 (${successRate}%)`);
    }

    return trajectory.success;
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

// 运行测试
testOptimizedAgent()
  .then(success => {
    console.log(`\n🏁 优化测试${success ? '成功' : '失败'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 测试出现错误:', error);
    process.exit(1);
  });