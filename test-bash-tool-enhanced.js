import { BashTool } from './lib/tools/bash-tool.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function testBashTool() {
  console.log('Testing enhanced BashTool...\n');
  
  // Create a new bash tool instance
  const bashTool = new BashTool({
    timeout: 30,
    bannedCommands: ['rm -rf', 'format'],
    maxBufferSize: 1024 * 1024, // 1MB
  });

  try {
    // Test 1: Basic command execution
    console.log('Test 1: Basic command execution');
    const result1 = await bashTool.execute(
      { command: 'echo "Hello from enhanced bash tool!"' },
      { workingDirectory: process.cwd(), environment: {} }
    );
    console.log('Result:', result1);
    console.log();

    // Test 2: Session persistence (directory change)
    console.log('Test 2: Testing session persistence');
    const result2 = await bashTool.execute(
      { command: 'cd test-workspace', persistent: true },
      { workingDirectory: process.cwd(), environment: {} }
    );
    console.log('CD Result:', result2);

    const result3 = await bashTool.execute(
      { command: 'pwd', persistent: true },
      { workingDirectory: process.cwd(), environment: {} }
    );
    console.log('PWD Result:', result3);
    console.log();

    // Test 3: Session info
    console.log('Test 3: Session info');
    const sessionInfo = bashTool.getSessionInfo();
    console.log('Session Info:', sessionInfo);
    console.log('Session Alive:', bashTool.isSessionAlive());
    console.log();

    // Test 4: Security - banned command
    console.log('Test 4: Testing security (banned command)');
    const result4 = await bashTool.execute(
      { command: 'rm -rf /some/path' },
      { workingDirectory: process.cwd(), environment: {} }
    );
    console.log('Banned Command Result:', result4);
    console.log();

    // Test 5: One-time execution
    console.log('Test 5: One-time execution (non-persistent)');
    const result5 = await bashTool.execute(
      { command: 'echo "One-time command"', persistent: false },
      { workingDirectory: process.cwd(), environment: {} }
    );
    console.log('One-time Result:', result5);
    console.log();

    // Test 6: Session restart
    console.log('Test 6: Session restart');
    const result6 = await bashTool.execute(
      { restart: true },
      { workingDirectory: process.cwd(), environment: {} }
    );
    console.log('Restart Result:', result6);
    console.log();

    // Clean up
    await bashTool.close();
    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
(async () => {
  try {
    await testBashTool();
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
})();