import { ToolExecutor } from './base.js';
import { ToolDefinition, ToolExecutionContext, ToolResult } from '../types/index.js';
import { Logger } from '../utils/logging/logger.js';

export interface CompleteTaskInput {
  task_completed: boolean;
  result: string;
  summary: string;
}

/**
 * 任务完成工具
 * 用于Agent主动声明任务已经完成，并提供完成结果和总结
 */
export class CompleteTaskTool extends ToolExecutor {
  private logger: Logger;

  constructor(logger: Logger) {
    const definition: ToolDefinition = {
      name: 'complete_task',
      description: '声明任务已完成并提供结果总结。当你认为已经完成了用户的任务时，使用此工具来正式完成任务。',
      parameters: {
        type: 'object',
        properties: {
          task_completed: {
            type: 'boolean',
            description: '任务是否已完成',
            default: true
          },
          result: {
            type: 'string',
            description: '任务完成的主要结果或输出内容'
          },
          summary: {
            type: 'string',
            description: '任务完成的总结，包括执行的主要步骤和达成的目标'
          }
        },
        required: ['result', 'summary']
      }
    };
    
    super('complete_task', definition);
    this.logger = logger;
  }
  override async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const input = params as unknown as CompleteTaskInput;
    try {
      this.logger.info(`任务完成工具被调用`, {
        task_completed: input.task_completed,
        result_length: input.result?.length || 0,
        summary_length: input.summary?.length || 0
      });

      // 验证输入
      if (!input.result || !input.summary) {
        return {
          success: false,
          result: {
            error: '必须提供result和summary参数',
            task_completed: false
          }
        };
      }

      // 标记任务完成
      const result = {
        task_completed: input.task_completed !== false, // 默认为true
        result: input.result,
        summary: input.summary,
        completion_time: new Date().toISOString()
      };

      this.logger.info(`任务已完成`, {
        result: input.result.substring(0, 100) + (input.result.length > 100 ? '...' : ''),
        summary: input.summary.substring(0, 100) + (input.summary.length > 100 ? '...' : '')
      });

      return {
        success: true,
        result
      };
    } catch (error) {
      this.logger.error(`任务完成工具执行失败: ${error}`);
      return {
        success: false,
        result: {
          error: `任务完成工具执行失败: ${error}`,
          task_completed: false
        }
      };
    }
  }

  override async close(): Promise<void> {
    // 没有需要清理的资源
  }
}