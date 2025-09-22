const { Agent, ConfigManager } = require('../dist/index.js');

async function basicExample() {
  console.log('🚀 Starting Trae Agent TypeScript Example');

  try {
    // Load configuration
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();

    // Create agent
    const agent = await Agent.create({
      config,
      workingDirectory: './workspace',
    });

    console.log('🤖 Agent created successfully');

    // Execute a simple task
    const task = "D:\trae-agent-ts\src\tools\ckg-tool.ts代码是D:\trae-agent\trae_agent ts版本实现，请根据代码实现一个ckg-tool工具，并给出实现代码";
    console.log(`📋 Executing task: ${task}`);

    const trajectory = await agent.execute(task, 10);

    console.log('\n📊 Results:');
    console.log(`✅ Success: ${trajectory.success}`);
    console.log(`📈 Steps taken: ${trajectory.steps.length}`);
    console.log(`⏱️ Duration: ${trajectory.end_time ? new Date(trajectory.end_time).getTime() - new Date(trajectory.start_time).getTime() : 'N/A'}ms`);

    if (trajectory.success) {
      console.log('\n🎉 Task completed successfully!');
      console.log('Check your workspace directory for the created files.');
    } else {
      console.log('\n❌ Task failed. Check the trajectory for details.');
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