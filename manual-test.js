// 手动测试脚本 - 验证 EditTool 功能
const { globalToolRegistry } = require('./dist/tools/base.js');
const path = require('path');

async function testEditTool() {
  console.log('🧪 开始手动测试 EditTool 优化功能...\n');
  
  const editTool = globalToolRegistry.get('edit_tool');
  if (!editTool) {
    console.log('❌ EditTool 未找到');
    return;
  }
  
  const testDir = path.resolve(__dirname, 'test-workspace');
  const testFile = path.join(testDir, 'manual-test.txt');
  
  const context = {
    workingDirectory: testDir,
    environment: process.env
  };
  
  console.log('📁 测试目录:', testDir);
  console.log('📄 测试文件:', testFile);
  console.log();
  
  // 测试1: 查看文件
  console.log('🔍 测试1: 查看文件内容');
  try {
    const result = await editTool.execute({
      command: 'view',
      path: testFile
    }, context);
    
    console.log('✅ 成功:', result.success);
    if (result.success) {
      console.log('📄 内容:');
      console.log(result.result.content);
    } else {
      console.log('❌ 错误:', result.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试2: 查看指定行范围
  console.log('🔍 测试2: 查看行范围 [2, 4]');
  try {
    const result = await editTool.execute({
      command: 'view',
      path: testFile,
      view_range: [2, 4]
    }, context);
    
    console.log('✅ 成功:', result.success);
    if (result.success) {
      console.log('📄 指定范围内容:');
      console.log(result.result.content);
    } else {
      console.log('❌ 错误:', result.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试3: 字符串替换
  console.log('🔄 测试3: 字符串替换');
  try {
    const result = await editTool.execute({
      command: 'str_replace',
      path: testFile,
      old_str: '第二行',
      new_str: '第二行（已修改）'
    }, context);
    
    console.log('✅ 成功:', result.success);
    if (result.success) {
      console.log('🔄 替换完成，代码片段:');
      console.log(result.result.snippet.substring(0, 500));
    } else {
      console.log('❌ 错误:', result.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试4: 测试非唯一字符串错误
  console.log('⚠️  测试4: 非唯一字符串替换（应该失败）');
  try {
    const result = await editTool.execute({
      command: 'str_replace',
      path: testFile,
      old_str: '第',
      new_str: 'LINE'
    }, context);
    
    console.log('✅ 成功:', result.success);
    if (!result.success) {
      console.log('❌ 预期错误:', result.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试5: 插入文本
  console.log('➕ 测试5: 插入文本');
  try {
    const result = await editTool.execute({
      command: 'insert',
      path: testFile,
      insert_line: 2,
      insert_text: '新插入的行'
    }, context);
    
    console.log('✅ 成功:', result.success);
    if (result.success) {
      console.log('➕ 插入完成，代码片段:');
      console.log(result.result.snippet.substring(0, 500));
    } else {
      console.log('❌ 错误:', result.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试6: Diff编辑
  console.log('🔄 测试6: Diff编辑');
  const diffContent = `<<<<<<< SEARCH
最后一行
=======
最后一行（通过diff修改）
>>>>>>> REPLACE`;
  
  try {
    const result = await editTool.execute({
      command: 'diff_edit',
      path: testFile,
      diff: diffContent
    }, context);
    
    console.log('✅ 成功:', result.success);
    if (result.success) {
      console.log('🔄 Diff编辑完成');
      console.log('📊 应用的更改:', result.result.changes_applied);
    } else {
      console.log('❌ 错误:', result.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试7: 查看目录
  console.log('📁 测试7: 查看目录');
  try {
    const result = await editTool.execute({
      command: 'view',
      path: testDir
    }, context);
    
    console.log('✅ 成功:', result.success);
    if (result.success) {
      console.log('📁 目录内容:');
      console.log(result.result.content);
    } else {
      console.log('❌ 错误:', result.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试资源清理
  console.log('🧹 测试8: 资源清理');
  try {
    await editTool.close();
    console.log('✅ 资源清理完成');
  } catch (error) {
    console.log('💥 清理异常:', error.message);
  }
  
  console.log('\n🎯 手动测试完成！');
}

// 运行测试
testEditTool().catch(console.error);