import { EditTool } from '../src/tools/edit-tool';
import { ToolExecutionContext } from '../src/types';
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

describe('EditTool 高级功能测试', () => {
  let editTool: EditTool;
  let testDir: string;
  let testFile: string;
  let context: ToolExecutionContext;

  beforeAll(async () => {
    // 创建测试目录和文件
    testDir = path.join(tmpdir(), 'edit-tool-advanced-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    testFile = path.join(testDir, 'test.txt');
    const testContent = `Line 1: Hello World
Line 2: This is a test file  
Line 3: With multiple lines
Line 4: For testing purposes
Line 5: End of file`;
    
    await fs.writeFile(testFile, testContent);
    
    editTool = new EditTool({
      backupEnabled: true,
      snippetLines: 2,
      maxFileSize: 1024 * 1024 // 1MB
    });
    
    context = {
      workingDirectory: testDir,
      environment: process.env as Record<string, string>
    };
  });

  afterAll(async () => {
    // 清理资源
    await editTool.close();
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('清理测试目录失败:', error);
    }
  });

  describe('view_range 功能测试', () => {
    test('应该能够查看指定行范围', async () => {
      const result = await editTool.execute({
        command: 'view',
        path: testFile,
        view_range: [2, 4]
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as any;
      expect(resultData.line_count).toBe(3); // 行2-4共3行
      expect(resultData.view_range).toEqual([2, 4]);
      expect(resultData.content).toContain('Line 2: This is a test file');
      expect(resultData.content).toContain('Line 4: For testing purposes');
    });

    test('应该支持查看到文件末尾（使用-1）', async () => {
      const result = await editTool.execute({
        command: 'view',
        path: testFile,
        view_range: [4, -1]
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as any;
      expect(resultData.content).toContain('Line 4: For testing purposes');
      expect(resultData.content).toContain('Line 5: End of file');
    });

    test('无效范围应该返回错误', async () => {
      const result = await editTool.execute({
        command: 'view',
        path: testFile,
        view_range: [10, 20] // 超出文件范围
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid view_range');
    });
  });

  describe('备份功能测试', () => {
    test('修改文件时应该创建备份', async () => {
      const testFileForBackup = path.join(testDir, 'backup-test.txt');
      await fs.writeFile(testFileForBackup, 'Original content');

      // 执行替换操作（应该创建备份）
      const result = await editTool.execute({
        command: 'str_replace',
        path: testFileForBackup,
        old_str: 'Original content',
        new_str: 'Modified content'
      }, context);

      expect(result.success).toBe(true);

      // 检查是否创建了备份文件
      const files = await fs.readdir(testDir);
      const backupFiles = files.filter(f => f.includes('backup-test.txt') && f.endsWith('.bak'));
      expect(backupFiles.length).toBeGreaterThan(0);

      // 验证备份内容
      const backupContent = await fs.readFile(path.join(testDir, backupFiles[0]), 'utf-8');
      expect(backupContent).toBe('Original content');
    });
  });

  describe('字符串替换唯一性验证', () => {
    test('应该拒绝非唯一的字符串替换', async () => {
      const result = await editTool.execute({
        command: 'str_replace',
        path: testFile,
        old_str: 'Line', // 出现在多行中
        new_str: 'ROW'
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Multiple occurrences');
      expect(result.error).toContain('Please ensure the string is unique');
    });

    test('应该显示所有匹配行号', async () => {
      const result = await editTool.execute({
        command: 'str_replace',
        path: testFile,
        old_str: 'Line',
        new_str: 'ROW'
      }, context);

      expect(result.success).toBe(false);
      // 应该显示行号1, 2, 3, 4, 5
      expect(result.error).toMatch(/lines?: .*1.*2.*3.*4.*5/);
    });
  });

  describe('diff_edit 功能测试', () => {
    test('应该能够应用有效的diff编辑', async () => {
      const diffContent = `<<<<<<< SEARCH
Line 1: Hello World
=======
Line 1: Hello Beautiful World
>>>>>>> REPLACE`;

      const result = await editTool.execute({
        command: 'diff_edit',
        path: testFile,
        diff: diffContent
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as any;
      expect(resultData.diff_applied).toBe(true);
      expect(resultData.changes_applied).toBe(1);
      expect(resultData.total_blocks).toBe(1);

      // 验证文件内容是否正确修改
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('Line 1: Hello Beautiful World');
    });

    test('应该能够应用多个diff块', async () => {
      const diffContent = `<<<<<<< SEARCH
Line 2: This is a test file
=======
Line 2: This is a MODIFIED test file
>>>>>>> REPLACE

<<<<<<< SEARCH
Line 5: End of file
=======
Line 5: End of MODIFIED file
>>>>>>> REPLACE`;

      const result = await editTool.execute({
        command: 'diff_edit',
        path: testFile,
        diff: diffContent
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as any;
      expect(resultData.changes_applied).toBe(2);
      expect(resultData.total_blocks).toBe(2);
    });

    test('无效的diff格式应该返回错误', async () => {
      const result = await editTool.execute({
        command: 'diff_edit',
        path: testFile,
        diff: 'Invalid diff format without proper markers'
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid diff blocks found');
    });
  });

  describe('目录查看功能', () => {
    test('应该能够查看目录内容', async () => {
      // 创建一些测试文件
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.js'), 'content2');
      await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });

      const result = await editTool.execute({
        command: 'view',
        path: testDir
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as any;
      expect(resultData.type).toBe('directory');
      expect(resultData.content).toContain('FILE');
      expect(resultData.content).toContain('DIR');
      expect(resultData.content).toContain('file1.txt');
      expect(resultData.content).toContain('subdir');
    });

    test('目录查看不应该支持view_range', async () => {
      const result = await editTool.execute({
        command: 'view',
        path: testDir,
        view_range: [1, 5]
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('view_range parameter is not allowed when path points to a directory');
    });
  });

  describe('Tab展开功能', () => {
    test('应该正确处理Tab字符', async () => {
      const testFileWithTabs = path.join(testDir, 'tabs-test.txt');
      await fs.writeFile(testFileWithTabs, 'Line with\ttabs\there');

      const result = await editTool.execute({
        command: 'view',
        path: testFileWithTabs
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as any;
      expect(resultData.content).toContain('    '); // Tab应该被展开为4个空格
    });
  });

  describe('插入功能增强', () => {
    test('应该支持多行插入', async () => {
      const multiLineText = 'First inserted line\nSecond inserted line\nThird inserted line';
      
      const result = await editTool.execute({
        command: 'insert',
        path: testFile,
        insert_line: 2,
        insert_text: multiLineText
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as any;
      expect(resultData.inserted).toBe(true);
      expect(resultData.lines_inserted).toBe(3);
      expect(resultData.snippet).toBeTruthy();
    });

    test('应该显示插入后的代码片段', async () => {
      const result = await editTool.execute({
        command: 'insert',
        path: testFile,
        insert_line: 1,
        insert_text: 'Inserted at line 1'
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as any;
      expect(resultData.snippet).toContain('Inserted at line 1');
      expect(resultData.snippet).toContain('cat -n'); // 应该包含格式化输出
    });
  });

  describe('错误处理和边界情况', () => {
    test('不存在的文件路径应该返回详细错误', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt');
      
      const result = await editTool.execute({
        command: 'view',
        path: nonExistentFile
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path does not exist');
      expect(result.error).toContain(nonExistentFile);
    });

    test('相对路径应该被拒绝', async () => {
      const result = await editTool.execute({
        command: 'view',
        path: 'relative-path.txt' // 相对路径
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path must be absolute');
    });

    test('目录上的非view操作应该被拒绝', async () => {
      const result = await editTool.execute({
        command: 'str_replace',
        path: testDir, // 目录路径
        old_str: 'something',
        new_str: 'else'
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('is a directory. Only the \'view\' command can be used on directories');
    });
  });

  describe('输出格式化功能', () => {
    test('输出应该包含行号', async () => {
      const result = await editTool.execute({
        command: 'view',
        path: testFile
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as any;
      expect(resultData.content).toContain('cat -n'); // 格式化提示
      expect(resultData.content).toMatch(/\s+1\s+/); // 行号格式
      expect(resultData.content).toMatch(/\s+2\s+/);
    });

    test('长输出应该被截断', async () => {
      // 创建一个很长的文件来测试截断
      const longContent = 'A'.repeat(25000); // 超过20000字符限制
      const longFile = path.join(testDir, 'long-file.txt');
      await fs.writeFile(longFile, longContent);

      const result = await editTool.execute({
        command: 'view',
        path: longFile
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as any;
      expect(resultData.content).toContain('response clipped');
    });
  });

  describe('资源管理', () => {
    test('close方法应该清理资源', async () => {
      const newEditTool = new EditTool({ backupEnabled: true });
      
      // 执行一些操作来创建资源
      await newEditTool.execute({
        command: 'str_replace',
        path: testFile,
        old_str: 'Line 3: With multiple lines',
        new_str: 'Line 3: With MODIFIED multiple lines'
      }, context);

      // 关闭应该成功
      await expect(newEditTool.close()).resolves.not.toThrow();
    });
  });
});