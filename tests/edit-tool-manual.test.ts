import { EditTool } from '../src/tools/edit-tool';
import { ToolExecutionContext } from '../src/types';
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

describe('EditTool 功能测试', () => {
  let editTool: EditTool;
  let testDir: string;
  let testFile: string;
  let context: ToolExecutionContext;

  beforeAll(async () => {
    // 创建测试目录和文件
    testDir = path.join(tmpdir(), 'edit-tool-test-' + Date.now());
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
      snippetLines: 3
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

  describe('view命令测试', () => {
    test('应该能够查看整个文件', async () => {
      const result = await editTool.execute({
        command: 'view',
        path: testFile
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('content');
      expect(result.result).toHaveProperty('line_count');
      expect(result.result).toHaveProperty('size');
      expect((result.result as any).line_count).toBe(5);
    });

    test('应该能够查看指定行范围', async () => {
      const result = await editTool.execute({
        command: 'view',
        path: testFile,
        view_range: [2, 4]
      }, context);

      expect(result.success).toBe(true);
      expect((result.result as any).line_count).toBe(3); // 行2-4共3行
      expect((result.result as any).view_range).toEqual([2, 4]);
    });

    test('应该能够查看目录', async () => {
      const result = await editTool.execute({
        command: 'view',
        path: testDir
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('type', 'directory');
      expect(result.result).toHaveProperty('entry_count');
    });

    test('无效的view_range应该返回错误', async () => {
      const result = await editTool.execute({
        command: 'view',
        path: testFile,
        view_range: [10, 20] // 超出文件范围
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid view_range');
    });
  });

  describe('create命令测试', () => {
    test('应该能够创建新文件', async () => {
      const newFile = path.join(testDir, 'new-file.txt');
      const content = 'This is a new file\\nWith multiple lines';
      
      const result = await editTool.execute({
        command: 'create',
        path: newFile,
        file_text: content
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('created', true);
      expect(result.result).toHaveProperty('size', content.length);
      
      // 验证文件确实被创建
      const fileExists = await fs.access(newFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('尝试创建已存在的文件应该返回错误', async () => {
      const result = await editTool.execute({
        command: 'create',
        path: testFile, // 已存在的文件
        file_text: 'Some content'
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File already exists');
    });
  });

  describe('str_replace命令测试', () => {
    test('应该能够替换唯一的字符串', async () => {
      const result = await editTool.execute({
        command: 'str_replace',
        path: testFile,
        old_str: 'Line 2: This is a test file',
        new_str: 'Line 2: This is a MODIFIED test file'
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('replaced', true);
      expect(result.result).toHaveProperty('occurrences', 1);
      expect(result.result).toHaveProperty('snippet');
    });

    test('替换不存在的字符串应该返回错误', async () => {
      const result = await editTool.execute({
        command: 'str_replace',
        path: testFile,
        old_str: 'This string does not exist',
        new_str: 'replacement'
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('did not appear verbatim');
    });

    test('替换非唯一字符串应该返回错误', async () => {
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
  });

  describe('insert命令测试', () => {
    test('应该能够在指定位置插入文本', async () => {
      const result = await editTool.execute({
        command: 'insert',
        path: testFile,
        insert_line: 2,
        insert_text: 'Inserted line after line 2'
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('inserted', true);
      expect(result.result).toHaveProperty('line', 2);
      expect(result.result).toHaveProperty('lines_inserted', 1);
      expect(result.result).toHaveProperty('snippet');
    });

    test('无效的插入位置应该返回错误', async () => {
      const result = await editTool.execute({
        command: 'insert',
        path: testFile,
        insert_line: 100, // 超出范围
        insert_text: 'Some text'
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid insert_line');
    });
  });

  describe('diff_edit命令测试', () => {
    test('应该能够应用diff格式的编辑', async () => {
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
      expect(result.result).toHaveProperty('diff_applied', true);
      expect(result.result).toHaveProperty('changes_applied');
      expect((result.result as any).changes_applied).toBeGreaterThan(0);
    });

    test('无效的diff格式应该返回错误', async () => {
      const result = await editTool.execute({
        command: 'diff_edit',
        path: testFile,
        diff: 'Invalid diff format'
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid diff blocks found');
    });
  });

  describe('错误处理测试', () => {
    test('访问不存在的文件应该返回错误', async () => {
      const result = await editTool.execute({
        command: 'view',
        path: path.join(testDir, 'nonexistent.txt')
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path does not exist');
    });

    test('使用无效命令应该返回错误', async () => {
      const result = await editTool.execute({
        command: 'invalid_command',
        path: testFile
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
    });

    test('缺少必需参数应该返回错误', async () => {
      const result = await editTool.execute({
        command: 'str_replace',
        path: testFile
        // 缺少old_str和new_str
      }, context);

      expect(result.success).toBe(false);
      // 这个错误应该在参数验证阶段被捕获
    });
  });

  describe('资源管理测试', () => {
    test('close方法应该能够成功执行', async () => {
      const newEditTool = new EditTool();
      await expect(newEditTool.close()).resolves.not.toThrow();
    });
  });
});