const { Agent, ConfigManager } = require('../dist/index.js');

async function basicExample() {
  console.log('🚀 Starting Trae Agent TypeScript Example');
  console.log(`📱 Platform: ${process.platform}`);

  try {
    // Load configuration
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    
    console.log('🔧 Configuration loaded successfully',config);
    
    // Create agent
    const agent = await Agent.create({
      config,
    });

    console.log('🤖 Agent created successfully');

    // Execute a simple task
    const task = "将代码/Users/wrr/work/trea/manual-test.js,拷贝到/Users/wrr/work/trea/workspace，并改写成rust代码";
    console.log(`📋 Executing task: ${task}`);

    const trajectory = await agent.execute(task, 30); 
    console.log('\n📊 Results:');
    console.log(`✅ Success: ${trajectory.success}`);
    console.log(`📈 Steps taken: ${trajectory.steps.length}`);
    
    if (trajectory.start_time && trajectory.end_time) {
      const duration = new Date(trajectory.end_time).getTime() - new Date(trajectory.start_time).getTime();
      console.log(`⏱️ Duration: ${duration}ms`);
    }

    if (trajectory.success) {
      console.log('\n🎉 Task completed successfully!');
      // 显示最后一个步骤的工具结果
      const lastStep = trajectory.steps[trajectory.steps.length - 1];
      if (lastStep && lastStep.tool_results && lastStep.tool_results.length > 0) {
        console.log('📄 Final result:', lastStep.tool_results[lastStep.tool_results.length - 1]);
      }
    } else {
      console.log('\n❌ Task failed. Check the trajectory for details.');
      // 显示错误信息
      const failedSteps = trajectory.steps.filter(step => 
        step.tool_results && step.tool_results.some(result => !result.success)
      );
      if (failedSteps.length > 0) {
        console.log('🔍 Failed step details:');
        failedSteps.forEach((step, index) => {
          console.log(`  Step ${index + 1}: ${step.step_id}`);
          step.tool_results?.forEach(result => {
            if (!result.success) {
              console.log(`    Error: ${result.error || 'Unknown error'}`);
            }
          });
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the example
if (require.main === module) {
  basicExample();
}

module.exports = { basicExample };