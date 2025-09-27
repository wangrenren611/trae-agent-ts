/**
 * 纯规划智能体示例
 * 展示PlannerAgent专门负责制定计划，其他智能体负责执行的协作模式
 */

const { PlannerAgent, TraeAgent, ConfigManager, Logger, createLLMClient, createTools } = require('./dist/index.js');
const { randomUUID } = require('crypto');

async function purePlannerExample() {
  console.log('🧠 纯规划智能体协作示例');
  console.log('='.repeat(50));

  try {
    // 1. 准备配置和组件
    console.log('📋 步骤1：准备配置和组件');
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    
    config.agent.tools = [
      'sequential_thinking_tool',
      'planner_tool', 
      'edit_tool',
      'bash_tool',
      'complete_task_tool'
    ];
    
    const logger = Logger.create({ level: 'info', format: 'pretty' });
    const llmClient = createLLMClient({
      name: config.llm.provider,
      api_key: config.llm.api_key,
      model: config.llm.model
    });
    const tools = await createTools(config, logger);
    
    console.log('✅ 配置和组件准备完成');

    // 2. 创建PlannerAgent（纯规划）
    console.log('\n🧠 步骤2：创建PlannerAgent（纯规划智能体）');
    const plannerAgent = new PlannerAgent(
      'planner-001',
      llmClient,
      tools,
      config,
      logger,
      process.cwd(),
      {
        maxDecompositionDepth: 3,
        strategy: 'balanced',
        granularity: 'medium'
      }
    );
    
    console.log('✅ PlannerAgent创建完成');

    // 3. 制定计划
    console.log('\n📋 步骤3：制定计划');
    const objective = '将代码/Users/wrr/work/trea/manual-test.js,拷贝到/Users/wrr/work/trea/workspace，并改写成rust代码';
    
    console.log(`目标：${objective}`);
    console.log('开始规划...');
    
    const planningResult = await plannerAgent.execute(objective);
    console.log(`✅ 规划完成！成功：${planningResult.success}`);
    
    // 4. 获取制定的计划
    const plan = plannerAgent.getCurrentPlan();


    if (plan) {
      console.log('\n📊 规划结果：');
      console.log(`计划ID：${plan.id}`);
      console.log(`状态：${plan.status}`);
      console.log(`任务总数：${plan.tasks.length}`);
      
      console.log('\n📝 任务列表：');
      plan.tasks.forEach((task, index) => {
        console.log(`  ${index + 1}. ${task.title}`);
        console.log(`     描述：${task.description}`);
        console.log(`     状态：${task.status} | 优先级：${task.priority}`);
        console.log(`     预计时间：${task.estimatedDuration}分钟`);
        console.log('');
      });
    }

    // 5. 模拟执行智能体通过planner-tool协作
    console.log('🤖 步骤4：模拟执行智能体协作');
    
    // 5.1 获取第一个待执行任务
    const plannerTool = tools.find(t => t.name === 'planner_tool');
    if (plannerTool) {
      const context = { workingDirectory: process.cwd(), environment: {} };
      
      const nextTaskResult = await plannerTool.execute({
        action: 'get_next_task'
      }, context);
      
      if (nextTaskResult.success && nextTaskResult.result.next_task) {
        const nextTask = nextTaskResult.result.next_task;
        console.log(`📋 获取到下一个任务：${nextTask.title}`);
        
        // 5.2 模拟执行智能体更新任务状态
        console.log('🔄 模拟执行智能体开始执行任务...');
        
        // 更新为执行中
        await plannerTool.execute({
          action: 'update_task',
          task_data: {
            id: nextTask.id,
            status: 'in_progress'
          }
        }, context);
        
        console.log('✅ 任务状态已更新为执行中');
        
        // 模拟执行完成
        setTimeout(async () => {
          await plannerTool.execute({
            action: 'update_task',
            task_data: {
              id: nextTask.id,
              status: 'completed'
            }
          }, context);
          
          console.log('🎉 任务执行完成！');
          
          // 通过planner-tool查询计划状态（符合规划与执行分离原则）
          const planStatusResult = await plannerTool.execute({
            action: 'get_plan'
          }, context);
          
          if (planStatusResult.success && planStatusResult.result.plan) {
            const plan = planStatusResult.result.plan;
            console.log(`📊 计划进度更新：${(plan.progress * 100).toFixed(1)}%`);
            console.log(`✅ 已完成任务：${plan.tasks.filter(t => t.status === 'completed').length}/${plan.task_count}`);
          }
        }, 1000);
      }
    }

    console.log('\n🌟 纯规划智能体协作示例完成！');
    console.log('\n💡 协作模式总结：');
    console.log('1. PlannerAgent专门负责制定计划，不执行具体任务');
    console.log('2. 执行智能体通过planner-tool获取任务');
    console.log('3. 执行智能体通过planner-tool更新执行进度');
    console.log('4. PlannerAgent监控进度并可动态调整计划');
    console.log('5. 实现了规划与执行的专业分工');

    return true;

  } catch (error) {
    console.error('❌ 示例执行失败：', error);
    return false;
  }
}

async function demonstratePlannerToolUsage() {
  console.log('\n🛠️ PlannerTool使用演示');
  console.log('='.repeat(30));

  try {
    const { PlannerTool } = require('./dist/index.js');
    const plannerTool = new PlannerTool();
    const context = { workingDirectory: process.cwd(), environment: {} };

    // 1. 创建计划
    console.log('1️⃣ 创建计划');
    const createResult = await plannerTool.execute({
      action: 'create_plan',
      objective: '设置开发环境'
    }, context);
    
    console.log(`创建结果：${createResult.success}`);
    if (createResult.success) {
      console.log(`生成任务数：${createResult.result.plan.task_count}`);
    }

    // 2. 获取下一个任务
    console.log('\n2️⃣ 获取下一个任务');
    const nextTaskResult = await plannerTool.execute({
      action: 'get_next_task'
    }, context);
    
    console.log(`获取结果：${nextTaskResult.success}`);
    if (nextTaskResult.success && nextTaskResult.result.next_task) {
      console.log(`任务标题：${nextTaskResult.result.next_task.title}`);
      
      // 3. 更新任务状态
      console.log('\n3️⃣ 更新任务状态');
      const updateResult = await plannerTool.execute({
        action: 'update_task',
        task_data: {
          id: nextTaskResult.result.next_task.id,
          status: 'completed'
        }
      }, context);
      
      console.log(`更新结果：${updateResult.success}`);
    }

    // 4. 获取计划状态
    console.log('\n4️⃣ 获取计划状态');
    const planResult = await plannerTool.execute({
      action: 'get_plan'
    }, context);
    
    if (planResult.success) {
      console.log(`计划进度：${(planResult.result.plan.progress * 100).toFixed(1)}%`);
      console.log(`完成任务：${planResult.result.plan.tasks.filter(t => t.status === 'completed').length}/${planResult.result.plan.task_count}`);
    }

    console.log('\n✅ PlannerTool演示完成！');
    return true;

  } catch (error) {
    console.error('❌ 演示失败：', error);
    return false;
  }
}

// 主函数
async function main() {
  console.log('🚀 纯规划智能体完整演示');
  console.log('展示规划与执行分离的协作模式');
  console.log('='.repeat(60));

  const results = {
    plannerExample: false,
    toolDemo: false
  };

  // 运行纯规划示例
  results.plannerExample = await purePlannerExample();
  
  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 运行工具演示
  results.toolDemo = await demonstratePlannerToolUsage();
  
  console.log('\n📊 演示总结：');
  console.log('='.repeat(30));
  console.log(`纯规划示例：${results.plannerExample ? '✅ 成功' : '❌ 失败'}`);
  console.log(`工具演示：${results.toolDemo ? '✅ 成功' : '❌ 失败'}`);
  
  const allSuccess = Object.values(results).every(r => r);
  console.log(`\n🎯 总体结果：${allSuccess ? '🌟 演示成功！' : '⚠️ 部分失败'}`);
  
  if (allSuccess) {
    console.log('\n🎊 恭喜！纯规划智能体系统演示成功！');
    console.log('\n🌟 核心优势：');
    console.log('✨ 专业分工：规划与执行分离，各司其职');
    console.log('✨ 协作高效：通过planner-tool实现无缝协作');
    console.log('✨ 动态调整：支持基于执行反馈的计划优化');
    console.log('✨ 状态同步：实时监控和更新任务执行状态');
    console.log('✨ 可扩展性：支持多个执行智能体并行工作');
  }
  
  return allSuccess;
}

if (require.main === module) {
  main()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 演示运行失败：', error);
      process.exit(1);
    });
}

module.exports = {
  purePlannerExample,
  demonstratePlannerToolUsage,
  main
};