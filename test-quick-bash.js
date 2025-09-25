// Quick test for the fixed bash tool
const { BashTool } = require('./dist/tools/bash-tool.js');

async function quickTest() {
  console.log('🔍 Quick Test of Fixed Bash Tool');
  
  const bashTool = new BashTool({
    timeout: 5,
    outputDelay: 50,
  });

  const context = {
    workingDirectory: process.cwd(),
    environment: {}
  };

  try {
    console.log('Testing dir command...');
    const result = await bashTool.execute(
      { command: 'dir', persistent: true },
      context
    );
    
    console.log('✅ Result received:');
    console.log(`📄 Success: ${result.success}`);
    console.log(`📄 Stdout length: ${result.result?.stdout?.length || 0}`);
    console.log(`📄 Exit code: ${result.result?.exit_code}`);
    console.log(`📄 Stdout preview: ${result.result?.stdout?.substring(0, 200)}...`);
    
    await bashTool.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await bashTool.close().catch(() => {});
  }
}

quickTest();