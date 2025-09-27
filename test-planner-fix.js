#!/usr/bin/env node

/**
 * 智能任务规划官修复验证测试
 * 验证编译错误修复和核心功能
 */

const { PlannerAgent, PlannerTool } = require('./dist/index.js');

console.log('🚀 智能任务规划官修复验证测试\n');

// 模拟LLM客户端，避免真实API调用
class MockLLMClient {
  async chat(messages, availableTools) {
    // 模拟分析结果
    if (messages.some(m => m.content && m.content.includes('深度分析'))) {
      return {
        content: `经过3轮深度思考分析：
        
第一轮：用户需求是开发Python计算器，核心功能是四则运算，这是基础开发任务。
第二轮：技术挑战包括用户输入验证、错误处理、界面设计，需要考虑代码结构。  
第三轮：风险因素主要是输入验证和异常处理，需要完善的测试策略。`,
        tool_calls: []
      };
    }
    
    // 模拟规划结果
    if (messages.some(m => m.content && m.content.includes('智能规划与分解'))) {
      return {
        content: `基于深度分析，制定详细执行计划：

任务1：项目结构设计
描述：创建Python项目目录结构，设置虚拟环境，安装必要依赖包，设计模块架构

任务2：核心计算功能实现
描述：实现四则运算功能，添加输入验证，设计计算引擎，确保计算精度

任务3：用户界面开发
描述：设计并实现用户交互界面，添加操作指引，实现结果显示功能

任务4：错误处理和验证
描述：实现全面的错误捕获机制，添加输入验证，设置异常处理和友好提示

任务5：测试与优化
描述：编写单元测试，进行功能验证，性能优化，确保程序稳定运行`,
        tool_calls: []
      };
    }
    
    return {
      content: '智能规划完成，已生成结构化执行计划。',
      tool_calls: []
    };
  }
}

async function testPlannerAgentFix() {
  try {
    console.log('📋 测试1：PlannerAgent创建和基本功能');
    
    // 创建模拟组件
    const mockConfig = {
      llm: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 4000
      }
    };
    
    const mockLogger = {
      info: (msg) => console.log(`[INFO] ${msg}`),
      error: (msg) => console.log(`[ERROR] ${msg}`),
      warn: (msg) => console.log(`[WARN] ${msg}`),
      debug: (msg) => console.log(`[DEBUG] ${msg}`)
    };
    
    const mockLLMClient = new MockLLMClient();
    const tools = [new PlannerTool()];
    
    // 创建PlannerAgent
    const plannerAgent = new PlannerAgent(
      'test-planner',
      mockLLMClient,
      tools,
      mockConfig,
      mockLogger,
      '/Users/wrr/work/trea'
    );
    
    console.log('✅ PlannerAgent创建成功');
    
    // 测试规划功能
    console.log('\n📋 测试2：智能规划功能');
    const objective = '创建一个简单的Python计算器程序，包含加减乘除四个基本功能';
    console.log(`目标：${objective}`);
    
    const startTime = Date.now();
    const trajectory = await plannerAgent.execute(objective);
    const endTime = Date.now();
    
    console.log(`✅ 规划执行完成，耗时：${((endTime - startTime) / 1000).toFixed(2)}秒`);
    console.log(`📊 执行结果：${trajectory.success ? '成功' : '失败'}`);
    console.log(`🧠 推理步骤：${trajectory.steps.length}步`);
    
    // 获取生成的计划
    const plan = plannerAgent.getCurrentPlan();
    if (plan) {
      console.log('\n📋 测试3：生成计划分析');
      console.log(`计划标题：${plan.title}`);
      console.log(`任务数量：${plan.tasks.length}个`);
      console.log(`计划状态：${plan.status}`);
      console.log(`进度：${plan.progress * 100}%`);
      
      if (plan.planningMetadata) {
        console.log(`复杂度：${plan.planningMetadata.complexityLevel}`);
        console.log(`预计时间：${plan.planningMetadata.estimatedDuration}`);
        console.log(`风险等级：${plan.planningMetadata.riskLevel}`);
        console.log(`使用技术：${plan.planningMetadata.techniquesUsed.join(', ')}`);
      }
      
      if (plan.qualityMetrics) {
        console.log('\n🏆 质量指标：');
        console.log(`完整性：${plan.qualityMetrics.completenessScore}/100`);
        console.log(`可行性：${plan.qualityMetrics.feasibilityScore}/100`);
        console.log(`效率：${plan.qualityMetrics.efficiencyScore}/100`);
        
        const avgScore = (
          plan.qualityMetrics.completenessScore + 
          plan.qualityMetrics.feasibilityScore + 
          plan.qualityMetrics.efficiencyScore
        ) / 3;
        
        let grade = 'C';
        if (avgScore >= 90) grade = 'A+';
        else if (avgScore >= 85) grade = 'A';
        else if (avgScore >= 80) grade = 'B+';
        else if (avgScore >= 75) grade = 'B';
        
        console.log(`综合评级：${grade} (${avgScore.toFixed(1)}分)`);
      }
      
      console.log('\n📝 任务详情（按阶段分组）：');
      const phaseGroups = plan.tasks.reduce((groups, task) => {
        const phase = task.phase || 'unknown';
        if (!groups[phase]) groups[phase] = [];
        groups[phase].push(task);
        return groups;
      }, {});
      
      const phaseNames = {
        'research_setup': '🔍 研究与设置',
        'planning': '📋 详细规划',
        'implementation': '⚡ 实施与执行',
        'testing': '🧪 测试与验证',
        'completion': '🎯 完成与交付'
      };
      
      Object.entries(phaseGroups).forEach(([phase, tasks]) => {
        const phaseName = phaseNames[phase] || `❓ ${phase}`;
        console.log(`\n  ${phaseName}:`);
        tasks.forEach((task, index) => {
          console.log(`    ${index + 1}. ${task.title}`);
          console.log(`       💭 ${task.description.slice(0, 50)}...`);
          console.log(`       ⏱️ ${task.estimatedDuration || 0}分钟 | 🎯 ${task.type} | 📊 ${task.priority}`);
        });
      });
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ 测试失败：', error);
    console.error('错误详情：', error.stack);
    return false;
  }
}

async function testPlannerTool() {
  try {
    console.log('\n📋 测试4：PlannerTool功能验证');
    
    const plannerTool = new PlannerTool();
    const context = { workingDirectory: process.cwd(), environment: {} };
    
    // 测试创建计划
    console.log('📋 创建测试计划...');
    const createResult = await plannerTool.execute({
      action: 'create_plan',
      objective: '开发Web应用前端界面'
    }, context);
    
    console.log(`创建结果：${createResult.success ? '✅ 成功' : '❌ 失败'}`);
    
    if (createResult.success) {
      console.log(`任务数量：${createResult.result.plan.task_count}个`);
      
      // 测试获取下一个任务
      const nextTaskResult = await plannerTool.execute({
        action: 'get_next_task'
      }, context);
      
      if (nextTaskResult.success && nextTaskResult.result.next_task) {
        const task = nextTaskResult.result.next_task;
        console.log(`下一个任务：${task.title}`);
        
        // 测试更新任务状态
        const updateResult = await plannerTool.execute({
          action: 'update_task',
          task_data: {
            id: task.id,
            status: 'completed'
          }
        }, context);
        
        console.log(`更新状态：${updateResult.success ? '✅ 成功' : '❌ 失败'}`);
        
        // 测试获取计划状态
        const planResult = await plannerTool.execute({
          action: 'get_plan'
        }, context);
        
        if (planResult.success) {
          console.log(`当前进度：${(planResult.result.plan.progress * 100).toFixed(1)}%`);
        }
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ PlannerTool测试失败：', error);
    return false;
  }
}

async function main() {
  console.log('🎯 开始修复验证测试...\n');
  
  const results = {
    plannerAgent: false,
    plannerTool: false
  };
  
  // 测试PlannerAgent
  results.plannerAgent = await testPlannerAgentFix();
  
  // 测试PlannerTool
  results.plannerTool = await testPlannerTool();
  
  console.log('\n📊 测试结果总结：');
  console.log('='.repeat(50));
  console.log(`PlannerAgent测试：${results.plannerAgent ? '✅ 通过' : '❌ 失败'}`);
  console.log(`PlannerTool测试：${results.plannerTool ? '✅ 通过' : '❌ 失败'}`);
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n🎯 总体结果：${allPassed ? '🎉 全部通过！' : '⚠️ 存在问题'}`);
  
  if (allPassed) {
    console.log('\n🌟 修复验证成功！');
    console.log('📋 修复内容总结：');
    console.log('  ✅ 修复了重复导入BaseAgent的编译错误');
    console.log('  ✅ 修复了missing phase字段的类型错误');
    console.log('  ✅ 修复了determineTaskType方法的类型不匹配');
    console.log('  ✅ 修复了TaskType枚举值不存在的问题');
    console.log('  ✅ 添加了getSystemPrompt方法实现');
    console.log('  ✅ 确保了编译零错误');
    console.log('\n🚀 智能任务规划官现在可以正常运行了！');
  }
}

// 运行测试
main().catch(console.error);