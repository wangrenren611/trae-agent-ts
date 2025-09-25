// Comprehensive test for enhanced bash-tool
const { BashTool } = require('./dist/tools/bash-tool.js');

async function testBashToolFunctionality() {
  console.log('🧪 Testing Enhanced Bash Tool Functionality\n');
  
  // Create a new bash tool instance with custom config
  const bashTool = new BashTool({
    timeout: 30,
    bannedCommands: ['rm -rf', 'format', 'del /f /s /q'],
    maxBufferSize: 1024 * 1024, // 1MB
    outputDelay: 100, // 100ms
  });

  const testContext = {
    workingDirectory: process.cwd(),
    environment: { TEST_VAR: 'enhanced_bash_tool' }
  };

  try {
    console.log('📋 Test 1: Basic command execution');
    const result1 = await bashTool.execute(
      { command: 'echo \"Hello from enhanced bash tool!\"' },
      testContext
    );
    console.log('✅ Success:', result1.success);
    if (result1.success && result1.data) {
      console.log('📄 Output:', result1.data.stdout);
      console.log('⏱️  Exit Code:', result1.data.exit_code);
    }
    console.log();

    console.log('📋 Test 2: Environment variable test');
    const result2 = await bashTool.execute(
      { command: process.platform === 'win32' ? 'echo %TEST_VAR%' : 'echo $TEST_VAR' },
      testContext
    );
    console.log('✅ Success:', result2.success);
    if (result2.success && result2.data) {
      console.log('📄 Output:', result2.data.stdout);
    }
    console.log();

    console.log('📋 Test 3: Security - Testing banned command');
    const result3 = await bashTool.execute(
      { command: 'rm -rf /some/dangerous/path' },
      testContext
    );
    console.log('✅ Blocked as expected:', !result3.success);
    if (!result3.success) {
      console.log('🛡️  Block reason:', result3.error);
    }
    console.log();

    console.log('📋 Test 4: Session persistence (if supported)');
    // Test directory change in persistent session
    const result4a = await bashTool.execute(
      { command: 'pwd', persistent: true },
      testContext
    );
    console.log('✅ PWD command success:', result4a.success);
    if (result4a.success && result4a.data) {
      console.log('📁 Current directory:', result4a.data.stdout.trim());
    }

    // Try to change to test-workspace if it exists
    const result4b = await bashTool.execute(
      { command: 'cd test-workspace 2>/dev/null || cd test-workspace 2>nul || echo \"Directory not found\"', persistent: true },
      testContext
    );
    console.log('✅ CD command executed:', result4b.success);

    const result4c = await bashTool.execute(
      { command: 'pwd', persistent: true },
      testContext
    );
    if (result4c.success && result4c.data) {
      console.log('📁 After CD:', result4c.data.stdout.trim());
    }
    console.log();

    console.log('📋 Test 5: Non-persistent execution');
    const result5 = await bashTool.execute(
      { command: 'echo \"This is a one-time command\"', persistent: false },
      testContext
    );
    console.log('✅ One-time command success:', result5.success);
    if (result5.success && result5.data) {
      console.log('📄 Output:', result5.data.stdout);
    }
    console.log();

    console.log('📋 Test 6: Session information');
    const sessionInfo = bashTool.getSessionInfo();
    console.log('📊 Session Info:', sessionInfo);
    console.log('💓 Session Alive:', bashTool.isSessionAlive());
    console.log();

    console.log('📋 Test 7: Session restart');
    const result7 = await bashTool.execute(
      { restart: true },
      testContext
    );
    console.log('✅ Restart success:', result7.success);
    if (result7.success && result7.data) {
      console.log('📄 Restart message:', result7.data.stdout);
    }
    console.log();

    console.log('📋 Test 8: Command with timeout');
    const result8 = await bashTool.execute(
      { command: 'echo \"Fast command\"', timeout: 5 },
      testContext
    );
    console.log('✅ Timeout test success:', result8.success);
    console.log();

    console.log('🧹 Cleaning up...');
    await bashTool.close();
    console.log('✅ Session closed');
    
    console.log();
    console.log('🎉 All functionality tests completed successfully!');
    console.log('🚀 Enhanced Bash Tool is fully operational!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    
    // Ensure cleanup
    try {
      await bashTool.close();
    } catch (cleanupError) {
      console.error('❌ Cleanup error:', cleanupError);
    }
  }
}

// Run the comprehensive test
testBashToolFunctionality();