import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext } from '../types/index.js';

export class TaskDoneTool extends ToolExecutor {
  constructor() {
    super('task_done', {
      name: 'task_done',
      description: `Mark task completion status and provide result summary.

When to use:
- After completing the main task requested by the user
- After implementing all requirements and verifying the solution
- When you need to provide the user with task completion status and result summary

Important notes:
- Before calling this tool, you must verify that your solution is correct
- You can verify your solution by writing test scripts, running code, or other methods
- Only mark a task as completed when all requirements have been met
- If the task is not completed, set task_completed to false and explain why

Usage examples:
1. Successfully completed task:
   {
     "task_completed": true,
     "result": "Successfully created user registration functionality, including form validation and data storage",
     "summary": "Implemented user registration feature, added necessary validations, and ensured data is stored correctly"
   }

2. Incomplete task:
   {
     "task_completed": false,
     "result": "User registration functionality partially implemented, but data storage failed",
     "summary": "Completed form UI and validation, but database connection has issues that need further debugging"
   }`,
      parameters: {
        type: 'object',
        properties: {
          task_completed: {
            type: 'boolean',
            description: 'Whether the task has been successfully completed. Only set to true when all requirements have been met and the solution has been verified',
          },
          result: {
            type: 'string',
            description: 'The final result or output of the task. Should describe in detail what was completed, or if not completed, explain the current status and issues encountered',
          },
          summary: {
            type: 'string',
            description: 'A brief summary of the work completed. Should include main implementation points, problems solved, and any points of note',
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
      // Validate parameters as they are required
      this.validateParams(params);

      // Extract parameters
      const taskCompleted = params.task_completed as boolean;
      const result = params.result as string;
      const summary = params.summary as string;

      // Create completion result
      const completionResult = {
        task_completed: taskCompleted,
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