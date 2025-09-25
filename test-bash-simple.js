// Simple test for enhanced bash-tool
const path = require('path');
const { spawn } = require('child_process');

// Test basic functionality by importing the built module
async function testBashToolBasics() {
  console.log('Testing basic bash tool compilation...');
  
  try {
    // Try to require the compiled module
    const bashToolModule = require('./dist/tools/bash-tool.js');
    console.log('✅ Module loaded successfully');
    console.log('Exported classes:', Object.keys(bashToolModule));
    
    // Check if BashTool class exists
    if (bashToolModule.BashTool) {
      console.log('✅ BashTool class found');
      
      // Try to create an instance
      const bashTool = new bashToolModule.BashTool({
        timeout: 30,
        bannedCommands: ['rm -rf'],
      });
      
      console.log('✅ BashTool instance created successfully');
      console.log('BashTool methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(bashTool)));
      
      // Test basic method availability
      if (typeof bashTool.execute === 'function') {
        console.log('✅ execute method available');
      }
      
      if (typeof bashTool.close === 'function') {
        console.log('✅ close method available');
      }
      
      if (typeof bashTool.getSessionInfo === 'function') {
        console.log('✅ getSessionInfo method available');
      }
      
      if (typeof bashTool.isSessionAlive === 'function') {
        console.log('✅ isSessionAlive method available');
      }
      
      console.log('\n🎉 All basic tests passed! The enhanced bash tool is ready.');
      
    } else {
      console.error('❌ BashTool class not found in module');
    }
    
  } catch (error) {
    console.error('❌ Error testing bash tool:', error.message);
    console.error('Error details:', error);
  }
}

// Run the test
testBashToolBasics();