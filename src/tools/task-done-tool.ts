import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext } from '../types/index.js';

export class TaskDoneTool extends ToolExecutor {
  constructor() {
    super('task_done_tool', {
      name: 'task_done_tool',
      description: 'Signal task completion and provide final results',
      parameters: {
        type: 'object',
        properties: {
          task_completed: {
            type: 'boolean',
            description: 'Whether the task has been completed successfully',
          },
          result: {
            description: 'The final result or output of the task',
          },
          summary: {
            type: 'string',
            description: 'Brief summary of what was accomplished',
          },
          files_modified: {
            type: 'array',
            items: { type: 'string', description: 'File path' },
            description: 'List of files that were modified during the task',
          },
          next_steps: {
            type: 'array',
            items: { type: 'string', description: 'Next step description' },
            description: 'Suggested next steps or follow-up actions',
          },
        },
        required: ['task_completed', 'result', 'summary'],
      },
    });
  }

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParams(params);

      const {
        task_completed,
        result,
        summary,
        files_modified = [],
        next_steps = [],
      } = params;

      // Create completion result
      const completionResult = {
        task_completed,
        result,
        summary,
        files_modified: files_modified as string[],
        next_steps: next_steps as string[],
        timestamp: new Date().toISOString(),
      };

      if (task_completed) {
        return this.createSuccessResult(completionResult);
      } else {
        return this.createErrorResult(
          `Task marked as incomplete: ${summary}`,
          undefined,
          JSON.stringify(completionResult, null, 2)
        );
      }
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// Register the tool
import { globalToolRegistry } from './base.js';
globalToolRegistry.register(new TaskDoneTool());