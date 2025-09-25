// 测试 EditTool 的各项功能
import { EditTool } from './src/tools/edit-tool.js';
import * as path from 'path';
import { promises as fs } from 'fs';

async function createTestFiles() {
  // 创建测试目录
  const testDir = path.join(__dirname, 'test-workspace');
  await fs.mkdir(testDir, { recursive: true });
  
  // 创建测试文件
  const testFile1 = path.join(testDir, 'test1.txt');
  const testContent1 = `Line 1: Hello World
Line 2: This is a test file
Line 3: With multiple lines
Line 4: For testing purposes
Line 5: End of file`;
  
  await fs.writeFile(testFile1, testContent1);
  
  return { testDir, testFile1 };
}

async function runTests() {
  console.log('🧪 开始测试 EditTool...\n');
  
  const { testDir, testFile1 } = await createTestFiles();
  const editTool = new EditTool({
    backupEnabled: true,
    snippetLines: 3
  });
  
  const context = {
    workingDirectory: testDir,
    environment: process.env
  };
  
  console.log('📁 测试目录:', testDir);
  console.log('📄 测试文件:', testFile1);
  console.log();
  
  // 测试1: view命令 - 查看整个文件
  console.log('🔍 测试1: 查看整个文件');
  try {
    const result1 = await editTool.execute({
      command: 'view',
      path: testFile1
    }, context);
    
    console.log('✅ 成功:', result1.success);
    if (result1.success) {
      console.log('📄 内容预览:', result1.result.content.substring(0, 200) + '...');
      console.log('📊 行数:', result1.result.line_count);
      console.log('📏 文件大小:', result1.result.size);
    } else {
      console.log('❌ 错误:', result1.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试2: view命令 - 查看指定行范围
  console.log('🔍 测试2: 查看行范围 [2, 4]');
  try {
    const result2 = await editTool.execute({
      command: 'view',
      path: testFile1,
      view_range: [2, 4]
    }, context);
    
    console.log('✅ 成功:', result2.success);
    if (result2.success) {
      console.log('📄 内容:', result2.result.content);
    } else {
      console.log('❌ 错误:', result2.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试3: str_replace命令
  console.log('🔄 测试3: 字符串替换');
  try {
    const result3 = await editTool.execute({
      command: 'str_replace',
      path: testFile1,
      old_str: 'Line 2: This is a test file',
      new_str: 'Line 2: This is a MODIFIED test file'
    }, context);
    
    console.log('✅ 成功:', result3.success);
    if (result3.success) {
      console.log('🔄 替换完成');
      console.log('📝 代码片段:', result3.result.snippet.substring(0, 300) + '...');
    } else {
      console.log('❌ 错误:', result3.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试4: insert命令
  console.log('➕ 测试4: 插入文本');
  try {
    const result4 = await editTool.execute({
      command: 'insert',
      path: testFile1,
      insert_line: 2,
      insert_text: 'Line 2.5: Inserted line'
    }, context);
    
    console.log('✅ 成功:', result4.success);
    if (result4.success) {
      console.log('➕ 插入完成');
      console.log('📝 代码片段:', result4.result.snippet.substring(0, 300) + '...');
    } else {
      console.log('❌ 错误:', result4.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试5: create命令
  console.log('📝 测试5: 创建新文件');
  const newFile = path.join(testDir, 'new-file.txt');
  try {
    const result5 = await editTool.execute({
      command: 'create',
      path: newFile,
      file_text: 'This is a new file\nCreated by EditTool\nWith multiple lines'
    }, context);
    
    console.log('✅ 成功:', result5.success);
    if (result5.success) {
      console.log('📝 文件已创建:', newFile);
      console.log('📏 文件大小:', result5.result.size);
    } else {
      console.log('❌ 错误:', result5.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试6: view命令 - 查看目录
  console.log('📁 测试6: 查看目录');
  try {
    const result6 = await editTool.execute({
      command: 'view',
      path: testDir
    }, context);
    
    console.log('✅ 成功:', result6.success);
    if (result6.success) {
      console.log('📁 目录内容:', result6.result.content);
      console.log('📊 文件数量:', result6.result.entry_count);
    } else {
      console.log('❌ 错误:', result6.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试7: diff_edit命令
  console.log('🔄 测试7: Diff编辑');
  const diffContent = `<<<<<<< SEARCH
Line 1: Hello World
=======
Line 1: Hello Beautiful World
>>>>>>> REPLACE`;
  
  try {
    const result7 = await editTool.execute({
      command: 'diff_edit',
      path: testFile1,
      diff: diffContent
    }, context);
    
    console.log('✅ 成功:', result7.success);
    if (result7.success) {
      console.log('🔄 Diff编辑完成');
      console.log('📊 应用的更改:', result7.result.changes_applied);
      console.log('📝 摘要:', result7.result.summary);
    } else {
      console.log('❌ 错误:', result7.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试8: 错误情况 - 不存在的文件
  console.log('⚠️  测试8: 错误处理 - 不存在的文件');
  try {
    const result8 = await editTool.execute({
      command: 'view',
      path: path.join(testDir, 'nonexistent.txt')
    }, context);
    
    console.log('✅ 成功:', result8.success);
    if (!result8.success) {
      console.log('❌ 预期错误:', result8.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试9: 错误情况 - 重复字符串
  console.log('⚠️  测试9: 错误处理 - 字符串不唯一');
  try {
    const result9 = await editTool.execute({
      command: 'str_replace',
      path: testFile1,
      old_str: 'Line',
      new_str: 'ROW'
    }, context);
    
    console.log('✅ 成功:', result9.success);
    if (!result9.success) {
      console.log('❌ 预期错误:', result9.error);
    }
  } catch (error) {
    console.log('💥 异常:', error.message);
  }
  console.log();
  
  // 测试资源清理
  console.log('🧹 测试10: 资源清理');
  try {
    await editTool.close();
    console.log('✅ 资源清理完成');
  } catch (error) {
    console.log('💥 清理异常:', error.message);
  }
  
  // 显示最终文件状态
  console.log('\n📄 最终文件内容:');
  try {
    const finalContent = await fs.readFile(testFile1, 'utf-8');
    console.log(finalContent);
  } catch (error) {
    console.log('💥 读取文件异常:', error.message);
  }
  
  console.log('\n🎯 测试完成！');
}

// 运行测试
runTests().catch(console.error);