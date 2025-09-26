#!/usr/bin/env node

import { Agent } from './dist/index.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testReActAgent() {
  console.log('🧪 测试ReAct Agent...\n');
  
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
      max_steps: 10,
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
    console.log('🏗️  创建Agent...');
    const agent = await Agent.create({ 
      config,
      workingDirectory: resolve(__dirname, 'test-workspace')
    });

    console.log('✅ Agent创建成功\n');

    // 测试简单的任务
    const task = '请创建一个名为hello.txt的文件，内容是"Hello ReAct Agent!"，然后用cat命令验证文件内容是否正确。完成后请调用complete_task工具来结束任务。';
    
    console.log(`📋 执行任务: ${task}\n`);
    console.log('🔄 开始ReAct循环...\n');

    const trajectory = await agent.execute(task);

    console.log('\n📊 任务执行结果:');
    console.log(`✅ 任务完成: ${trajectory.completed}`);
    console.log(`🎯 执行成功: ${trajectory.success}`);
    console.log(`📈 执行步数: ${trajectory.steps.length}`);
    console.log(`⏱️  开始时间: ${trajectory.start_time}`);
    console.log(`⏱️  结束时间: ${trajectory.end_time}`);

    if (trajectory.steps.length > 0) {
      console.log('\n📝 执行步骤概览:');
      trajectory.steps.forEach((step, index) => {
        console.log(`  步骤 ${index + 1}:`);
        console.log(`    🔧 工具调用: ${step.tool_calls.map(tc => tc.function.name).join(', ') || '无'}`);
        console.log(`    ✅ 是否完成: ${step.completed}`);
        if (step.tool_calls.length > 0) {
          console.log(`    📊 工具结果: ${step.tool_results.map(tr => tr.success ? '成功' : '失败').join(', ')}`);
        }
      });
    }

    return trajectory.success;
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

// 运行测试
testReActAgent()
  .then(success => {
    console.log(`\n🏁 测试${success ? '成功' : '失败'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 测试出现错误:', error);
    process.exit(1);
  });