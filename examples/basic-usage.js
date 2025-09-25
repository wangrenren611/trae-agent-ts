const { Agent, ConfigManager } = require('../dist/index.js');

async function basicExample() {
  console.log('🚀 Starting Trae Agent TypeScript Example');

  try {
    // Load configuration
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    console.log('🔧 Configuration loaded successfully', config);
    
    // Create agent
    const agent = await Agent.create({
      config,
      workingDirectory: '/Users/wrr/work/forex-kybc/src/components/custom-upload',
    });

    console.log('🤖 Agent created successfully');

    // Execute a simple task
    const task = "分析代码是否存在逻辑问题，代码是否可优化，是否有bug，帮我优化代码";
    console.log(`📋 Executing task: ${task}`);

    const trajectory = await agent.execute(task,30);

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