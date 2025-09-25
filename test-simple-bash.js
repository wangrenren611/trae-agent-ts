// Simple test to understand Windows command execution
const { spawn } = require('child_process');

async function testWindowsCommands() {
  console.log('🔍 Testing Windows Command Execution Patterns');
  
  // Test 1: Simple command without persistent session
  console.log('\n📋 Test 1: Direct cmd.exe execution');
  
  const child = spawn('cmd.exe', ['/c', 'dir && echo SENTINEL_12345'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  let error = '';
  
  child.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  child.stderr.on('data', (data) => {
    error += data.toString();
  });
  
  child.on('close', (code) => {
    console.log(`Exit code: ${code}`);
    console.log(`Stdout length: ${output.length}`);
    console.log(`Sentinel position: ${output.indexOf('SENTINEL_12345')}`);
    console.log(`Output preview: ${output.substring(0, 200)}...`);
    console.log(`Full output with sentinel: ${output.includes('SENTINEL_12345')}`);
    
    // Test 2: Interactive cmd session
    testInteractiveSession();
  });
}

async function testInteractiveSession() {
  console.log('\n📋 Test 2: Interactive cmd session');
  
  const child = spawn('cmd.exe', ['/v:on'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  
  child.stdout.on('data', (data) => {
    const chunk = data.toString();
    output += chunk;
    console.log(`Received chunk: ${JSON.stringify(chunk)}`);
    
    // Check for sentinel
    if (chunk.includes('SENTINEL_67890')) {
      console.log('🎯 Sentinel found in chunk!');
      console.log(`Total output length: ${output.length}`);
      console.log(`Sentinel position: ${output.indexOf('SENTINEL_67890')}`);
      console.log(`Output before sentinel: ${output.substring(0, output.indexOf('SENTINEL_67890'))}`);
      child.kill();
    }
  });
  
  child.stderr.on('data', (data) => {
    console.log(`Stderr: ${data.toString()}`);
  });
  
  // Wait a bit then send command
  setTimeout(() => {
    console.log('Sending command...');
    child.stdin.write('dir && echo SENTINEL_67890\n');
  }, 1000);
  
  child.on('close', (code) => {
    console.log(`Interactive session closed with code: ${code}`);
  });
  
  // Cleanup after timeout
  setTimeout(() => {
    if (!child.killed) {
      console.log('Timeout, killing process');
      child.kill();
    }
  }, 5000);
}

testWindowsCommands();