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
    const task = "Create a simple Node.js script that prints 'Hello, World!'";
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