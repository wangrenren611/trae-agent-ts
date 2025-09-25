import { EditTool } from '../dist/tools/edit-tool.js';
import { BashTool } from '../dist/tools/bash-tool.js';
import { SequentialThinkingTool } from '../dist/tools/sequential-thinking-tool.js';
import { TaskDoneTool } from '../dist/tools/task-done-tool.js';
import { ToolCallExecutor } from '../dist/tools/base.js';
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

  describe('ToolCallExecutor', () => {
    it('should execute a tool call successfully', async () => {
      const tools = [new TaskDoneTool()];
      const executor = new ToolCallExecutor(tools);
      
      const toolCall = {
        id: 'call_1',
        type: 'function' as const,
        function: {
          name: 'task_done',
          arguments: JSON.stringify({
            task_completed: true,
            result: 'Task completed successfully',
            summary: 'File created'
          }),
        },
      };
      
      const result = await executor.executeToolCall(toolCall, context);
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      
      const resultData = result.result as { task_completed: boolean; result: string; summary: string };
      expect(resultData.task_completed).toBe(true);
      expect(resultData.result).toBe('Task completed successfully');
      expect(resultData.summary).toBe('File created');
    });

    it('should handle tool not found error', async () => {
      const tools = [new TaskDoneTool()];
      const executor = new ToolCallExecutor(tools);
      
      const toolCall = {
        id: 'call_1',
        type: 'function' as const,
        function: {
          name: 'non_existent_tool',
          arguments: '{}',
        },
      };
      
      const result = await executor.executeToolCall(toolCall, context);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should execute tool calls in parallel', async () => {
      const tools = [new TaskDoneTool()];
      const executor = new ToolCallExecutor(tools);
      
      const toolCalls = [
        {
          id: 'call_1',
          type: 'function' as const,
          function: {
            name: 'task_done',
            arguments: JSON.stringify({
              task_completed: true,
              result: 'Task 1 completed',
              summary: 'First task'
            }),
          },
        },
        {
          id: 'call_2',
          type: 'function' as const,
          function: {
            name: 'task_done',
            arguments: JSON.stringify({
              task_completed: true,
              result: 'Task 2 completed',
              summary: 'Second task'
            }),
          },
        },
      ];
      
      const results = await executor.parallelToolCall(toolCalls, context);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should execute tool calls sequentially', async () => {
      const tools = [new TaskDoneTool()];
      const executor = new ToolCallExecutor(tools);
      
      const toolCalls = [
        {
          id: 'call_1',
          type: 'function' as const,
          function: {
            name: 'task_done',
            arguments: JSON.stringify({
              task_completed: true,
              result: 'Task 1 completed',
              summary: 'First task'
            }),
          },
        },
        {
          id: 'call_2',
          type: 'function' as const,
          function: {
            name: 'task_done',
            arguments: JSON.stringify({
              task_completed: true,
              result: 'Task 2 completed',
              summary: 'Second task'
            }),
          },
        },
      ];
      
      const results = await executor.sequentialToolCall(toolCalls, context);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should normalize tool names', async () => {
      const tools = [new TaskDoneTool()]; // Registered as 'task_done'
      const executor = new ToolCallExecutor(tools);
      
      // Try with different naming conventions
      const toolCall = {
        id: 'call_1',
        type: 'function' as const,
        function: {
          name: 'TASK_DONE', // Uppercase
          arguments: JSON.stringify({
            task_completed: true,
            result: 'Task completed',
            summary: 'Test task'
          }),
        },
      };
      
      const result = await executor.executeToolCall(toolCall, context);
      
      expect(result.success).toBe(true);
    });
  });

  describe('TaskDoneTool', () => {
    it('should mark task as done', async () => {
      const tool = new TaskDoneTool();
      const result = await tool.execute({
        task_completed: true,
        result: 'Task completed successfully',
        summary: 'File created'
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      
      const resultData = result.result as { task_completed: boolean; result: string; summary: string };
      expect(resultData.task_completed).toBe(true);
      expect(resultData.result).toBe('Task completed successfully');
      expect(resultData.summary).toBe('File created');
    });
    
    it('should validate required parameters', async () => {
      const tool = new TaskDoneTool();
      const result = await tool.execute({
        task_completed: true,
        // Missing required parameters
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('SequentialThinkingTool', () => {
    it('should process a thought correctly', async () => {
      const tool = new SequentialThinkingTool();
      const result = await tool.execute({
        thought: 'This is my first thought',
        next_thought_needed: true,
        thought_number: 1,
        total_thoughts: 3,
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      
      const resultData = result.result as { status: { thought_number: number; total_thoughts: number } };
      expect(resultData.status.thought_number).toBe(1);
      expect(resultData.status.total_thoughts).toBe(3);
    });

    it('should handle revision thoughts', async () => {
      const tool = new SequentialThinkingTool();
      
      // First thought
      await tool.execute({
        thought: 'Initial approach',
        next_thought_needed: true,
        thought_number: 1,
        total_thoughts: 3,
      }, context);
      
      // Revision thought
      const result = await tool.execute({
        thought: 'Revised approach',
        next_thought_needed: true,
        thought_number: 2,
        total_thoughts: 3,
        is_revision: true,
        revises_thought: 1,
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as { status: { thought_history_length: number } };
      expect(resultData.status.thought_history_length).toBe(2);
    });

    it('should handle branching thoughts', async () => {
      const tool = new SequentialThinkingTool();
      
      // First thought
      await tool.execute({
        thought: 'Main approach',
        next_thought_needed: true,
        thought_number: 1,
        total_thoughts: 3,
      }, context);
      
      // Branching thought
      const result = await tool.execute({
        thought: 'Alternative approach',
        next_thought_needed: true,
        thought_number: 2,
        total_thoughts: 3,
        branch_from_thought: 1,
        branch_id: 'alternative-branch',
      }, context);

      expect(result.success).toBe(true);
      const resultData = result.result as { status: { branches: string[] } };
      expect(resultData.status.branches).toContain('alternative-branch');
    });

    it('should validate required parameters', async () => {
      const tool = new SequentialThinkingTool();
      const result = await tool.execute({
        thought: 'This is my thought',
        // Missing required parameters
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate parameter types', async () => {
      const tool = new SequentialThinkingTool();
      const result = await tool.execute({
        thought: 123, // Should be string
        next_thought_needed: 'true', // Should be boolean
        thought_number: '1', // Should be number
        total_thoughts: '3', // Should be number
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('EditTool', () => {
    it('should create a file', async () => {
      const tool = new EditTool();
      const testFile = join(testDir, 'test.txt');
      const result = await tool.execute({
        command: 'create',
        path: testFile,
        file_text: 'Hello, World!',
      }, context);

      if (!result.success) {
        console.log('Create file error:', result.error);
      }
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
        path: testFile,
      }, context);

      if (!result.success) {
        console.log('View file error:', result.error);
      }
      expect(result.success).toBe(true);
      expect(result.result).toMatchObject({
        content: expect.stringContaining('Test content'),
        line_count: 1,
      });
    });

    it('should handle missing required parameters', async () => {
      const tool = new EditTool();
      const testFile = join(testDir, 'test.txt');
      const result = await tool.execute({
        command: 'create',
        // missing file_text
        path: testFile,
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('BashTool', () => {
    it('should execute a simple command', async () => {
      const tool = new BashTool();
      const result = await tool.execute({
        command: 'echo Hello, World!',
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toMatchObject({
        stdout: expect.stringContaining('Hello, World!'),
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