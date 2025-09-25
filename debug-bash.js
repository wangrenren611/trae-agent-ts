// Debug tool to understand bash-tool behavior
const { BashTool } = require('./dist/tools/bash-tool.js');

async function debugBashTool() {
  console.log('🔍 Debugging Bash Tool Output');
  console.log(`📍 Platform: ${process.platform}`);
  console.log();

  const bashTool = new BashTool({
    timeout: 10,
    outputDelay: 50,
  });

  const context = {
    workingDirectory: process.cwd(),
    environment: {}
  };

  try {
    console.log('Testing simple dir command...');
    
    // Override the waitForCompletion to log more details
    const originalExecute = bashTool.execute.bind(bashTool);
    bashTool.execute = async function(params, context) {
      console.log(`🔨 Executing command: ${params.command}`);
      const result = await originalExecute(params, context);
      console.log(`📊 Raw result:`, {
        success: result.success,
        result: result.result, // 修正：使用 result.result 而不是 result.data
        error: result.error
      });
      return result;
    };

    // Test 1: Basic dir
    console.log('\n📋 Test 1: Basic dir command');
    const result1 = await bashTool.execute(
      { command: 'dir', persistent: true },
      context
    );
    
    if (result1.success && result1.result) {
      console.log('✅ Command executed successfully');
      console.log(`📄 Stdout length: ${result1.result.stdout.length}`);
      console.log(`📄 Stdout content: "${result1.result.stdout}"`);
      console.log(`❌ Stderr: "${result1.result.stderr}"`);
      console.log(`🔢 Exit code: ${result1.result.exit_code}`);
      console.log(`⏱️ Execution time: ${result1.result.execution_time}ms`);
    }

    // Test 2: Simple echo
    console.log('\n📋 Test 2: Simple echo command');
    const result2 = await bashTool.execute(
      { command: 'echo "Hello World"', persistent: true },
      context
    );
    
    if (result2.success && result2.result) {
      console.log('✅ Echo executed successfully');
      console.log(`📄 Stdout: "${result2.result.stdout}"`);
      console.log(`🔢 Exit code: ${result2.result.exit_code}`);
    }

    // Test 3: Non-persistent command
    console.log('\n📋 Test 3: Non-persistent dir');
    const result3 = await bashTool.execute(
      { command: 'dir', persistent: false },
      context
    );
    
    if (result3.success && result3.result) {
      console.log('✅ Non-persistent executed successfully');
      console.log(`📄 Stdout preview: "${result3.result.stdout.substring(0, 100)}..."`);
      console.log(`🔢 Exit code: ${result3.result.exit_code}`);
    }

    await bashTool.close();
    console.log('\n🧹 Cleanup completed');

  } catch (error) {
    console.error('❌ Debug failed:', error);
    await bashTool.close().catch(() => {});
  }
}

debugBashTool();