import { EditTool } from '../dist/tools/edit-tool.js';
import { BashTool } from '../dist/tools/bash-tool.js';
import { ToolExecutionContext } from '../dist/types/index.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Tools', () => {
  let testDir: string;
  let context: ToolExecutionContext;

  beforeEach(async () => {
    testDir = join(tmpdir(), `trae-agent-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    context = {
      workingDirectory: testDir,
      environment: Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]),
    };
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('EditTool', () => {
    it('should create a file', async () => {
      const tool = new EditTool();
      const result = await tool.execute({
        command: 'create',
        path: 'test.txt',
        file_text: 'Hello, World!',
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toMatchObject({
        path: expect.stringContaining('test.txt'),
        created: true,
        size: 13,
      });
    });

    it('should view a file', async () => {
      const testFile = join(testDir, 'view-test.txt');
      await writeFile(testFile, 'Test content');

      const tool = new EditTool();
      const result = await tool.execute({
        command: 'view',
        path: 'view-test.txt',
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toMatchObject({
        content: 'Test content',
        line_count: 1,
      });
    });

    it('should handle missing required parameters', async () => {
      const tool = new EditTool();
      const result = await tool.execute({
        command: 'create',
        // missing file_text
        path: 'test.txt',
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('BashTool', () => {
    it('should execute a simple command', async () => {
      const tool = new BashTool();
      const result = await tool.execute({
        command: 'echo "Hello, World!"',
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toMatchObject({
        stdout: 'Hello, World!',
        exit_code: 0,
      });
    });

    it('should handle command failure', async () => {
      const tool = new BashTool();
      const result = await tool.execute({
        command: 'false',
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Command failed');
    });

    it('should respect timeout', async () => {
      const tool = new BashTool();
      const result = await tool.execute({
        command: 'sleep 2',
        timeout: 1,
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});