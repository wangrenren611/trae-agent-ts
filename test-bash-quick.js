// Quick test for enhanced bash-tool key features
const { BashTool } = require('./dist/tools/bash-tool.js');

async function quickTest() {
  console.log('🚀 Quick Enhanced Bash Tool Test\n');
  
  const bashTool = new BashTool({
    timeout: 10,
    bannedCommands: ['rm -rf'],
  });

  const context = {
    workingDirectory: process.cwd(),
    environment: {}
  };

  try {
    // Test 1: Basic execution
    console.log('Test 1: Basic command');
    const result1 = await bashTool.execute(
      { command: 'echo "Enhanced bash tool works!"', persistent: false },
      context
    );
    console.log('✅', result1.success ? 'Success' : 'Failed');
    if (result1.data) {
      console.log('   Output:', result1.data.stdout);
    }

    // Test 2: Security
    console.log('\nTest 2: Security check');
    const result2 = await bashTool.execute(
      { command: 'rm -rf /dangerous' },
      context
    );
    console.log('✅', !result2.success ? 'Blocked correctly' : 'Security failed');

    // Test 3: Session info
    console.log('\nTest 3: Session info');
    const info = bashTool.getSessionInfo();
    console.log('✅', info ? 'Session info available' : 'No session info');
    if (info) {
      console.log('   Platform:', info.platform);
      console.log('   Started:', info.started);
    }

    await bashTool.close();
    console.log('\n🎉 Quick test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await bashTool.close().catch(() => {});
  }
}

quickTest();