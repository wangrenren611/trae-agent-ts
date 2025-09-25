// Test the fixed bash-tool with Windows commands
const { BashTool } = require('./dist/tools/bash-tool.js');

async function testFixedBashTool() {
  console.log('🧪 Testing Fixed Bash Tool on Windows');
  console.log(`📍 Platform: ${process.platform}`);
  console.log();

  const bashTool = new BashTool({
    timeout: 15,
    outputDelay: 100,
  });

  const context = {
    workingDirectory: process.cwd(),
    environment: {}
  };

  try {
    // Test 1: Windows dir command
    console.log('Test 1: Windows dir command');
    const result1 = await bashTool.execute(
      { command: 'dir', persistent: true },
      context
    );
    console.log('✅ Success:', result1.success);
    if (result1.success && result1.data) {
      console.log('📁 Directory listing preview:', result1.data.stdout.substring(0, 200) + '...');
      console.log('🔢 Exit code:', result1.data.exit_code);
    } else {
      console.log('❌ Error:', result1.error);
    }
    console.log();

    // Test 2: Current directory
    console.log('Test 2: Current directory (cd)');
    const result2 = await bashTool.execute(
      { command: 'cd', persistent: true },
      context
    );
    console.log('✅ Success:', result2.success);
    if (result2.success && result2.data) {
      console.log('📂 Current directory:', result2.data.stdout);
    }
    console.log();

    // Test 3: Echo test
    console.log('Test 3: Echo test');
    const result3 = await bashTool.execute(
      { command: 'echo "Windows bash tool is working!"', persistent: true },
      context
    );
    console.log('✅ Success:', result3.success);
    if (result3.success && result3.data) {
      console.log('💬 Echo output:', result3.data.stdout);
    }
    console.log();

    // Test 4: Session info
    console.log('Test 4: Session information');
    const sessionInfo = bashTool.getSessionInfo();
    console.log('📊 Session info:', {
      id: sessionInfo?.id,
      platform: sessionInfo?.platform,
      started: sessionInfo?.started,
      workingDirectory: sessionInfo?.workingDirectory
    });
    console.log('💓 Session alive:', bashTool.isSessionAlive());
    console.log();

    // Cleanup
    await bashTool.close();
    console.log('🧹 Cleanup completed');
    console.log();
    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    await bashTool.close().catch(() => {});
  }
}

testFixedBashTool();