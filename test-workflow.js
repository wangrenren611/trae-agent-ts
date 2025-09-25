// Quick test to verify the full workflow
const { Agent, ConfigManager } = require('./dist/index.js');

async function quickWorkflowTest() {
  console.log('🔧 Quick Workflow Test');
  console.log(`📍 Platform: ${process.platform}`);

  try {
    // Load configuration
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    console.log('✅ Configuration loaded');
    
    // Create agent
    const agent = await Agent.create({
      config,
      workingDirectory: process.cwd()
    });
    console.log('✅ Agent created');

    // Execute simple task with shorter timeout
    const task = "What files are in the current directory?";
    console.log(`📋 Task: ${task}`);

    const trajectory = await agent.execute(task, 10); // 10 second timeout

    console.log('📊 Results:');
    console.log(`✅ Success: ${trajectory.success}`);
    console.log(`📈 Steps: ${trajectory.steps.length}`);

    if (trajectory.success) {
      console.log('🎉 Task completed successfully!');
    } else {
      console.log('❌ Task failed');
      // Show error details
      trajectory.steps.forEach((step, index) => {
        if (step.tool_results) {
          step.tool_results.forEach(result => {
            if (!result.success) {
              console.log(`  Step ${index + 1} error:`, result.error);
            }
          });
        }
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

quickWorkflowTest();