import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext } from '../types/index.js';

export class TaskDoneTool extends ToolExecutor {
  constructor() {
    super('task_done', {
      name: 'task_done',
      description: 'Report the completion of the task. Note that you cannot call this tool before any verification is done. You can write reproduce / test script to verify your solution.',
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
      } = params;

      // Create completion result
      const completionResult = {
        task_completed,
        result,
        summary,
        timestamp: new Date().toISOString(),
      };

      return this.createSuccessResult(completionResult);
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