import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { LLMClient } from '../utils/llm_clients/llm-client.js';
import { ToolExecutor, ToolCallExecutor } from '../tools/base.js';
import { Config } from '../utils/config/config.js';
import { Logger } from '../utils/logging/logger.js';
import {
  Message,
  ToolCall,
  ToolResult,
  AgentStep,
  AgentTrajectory,
  ToolExecutionContext,
  LLMMessage,
  LLMResponse
} from '../types/index.js';

export abstract class BaseAgent {
  protected readonly agentId: string;
  protected readonly llmClient: LLMClient;
  protected readonly tools: Map<string, ToolExecutor>;
  protected readonly toolCallExecutor: ToolCallExecutor;
  protected readonly config: Config;
  protected readonly logger: Logger;
  protected trajectory: AgentTrajectory;
  protected workingDirectory: string;
  protected isRunning = false;

  constructor(
    agentId: string,
    llmClient: LLMClient,
    tools: ToolExecutor[],
    config: Config,
    logger: Logger,
    workingDirectory: string
  ) {
    this.agentId = agentId;
    this.llmClient = llmClient;
    this.tools = new Map(tools.map(tool => [tool.name, tool]));
    this.toolCallExecutor = new ToolCallExecutor(tools);
    this.config = config;
    this.logger = logger;
    this.workingDirectory = workingDirectory;

    this.trajectory = {
      agent_id: agentId,
      task: '',
      steps: [],
      completed: false,
      success: false,
      start_time: new Date().toISOString(),
    };
  }

  async execute(task: string, maxSteps: number = 30): Promise<AgentTrajectory> {
    this.logger.info(`Starting ReAct agent execution for task: ${task}`);
    this.trajectory.task = task;
    this.isRunning = true;

    try {
      const messages: Message[] = [
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
        {
          role: 'user',
          content: task,
        },
      ];

      let stepCount = 0;

      // ReAct循环：Reasoning -> Acting -> Observation
      while (this.isRunning && stepCount < maxSteps) {
        stepCount++;
        this.logger.info(`执行ReAct循环第 ${stepCount}/${maxSteps} 轮`);

        // 1. Reasoning阶段 - 让Agent思考和规划
        const reasoningResponse = await this.reasoning(messages, stepCount);
        
        // 检查是否有工具调用
        if (reasoningResponse.tool_calls && reasoningResponse.tool_calls.length > 0) {
          // 2. Acting阶段 - 执行工具调用
          const observations = await this.acting(reasoningResponse.tool_calls, stepCount);
          this.logger.info(`执行工具调用完成`);
          // 3. Observation阶段 - 处理观察结果
          const stepCompleted = await this.observation(observations, messages, reasoningResponse);
          this.logger.info(`观察阶段完成`);
          if (stepCompleted) {
            this.logger.info(`任务在第 ${stepCount} 步完成`);
            this.trajectory.completed = true;
            this.trajectory.success = true;
            this.trajectory.end_time = new Date().toISOString();
            break;
          }
        } else {
          // 没有工具调用，可能是纯文本回复，结束循环
          this.logger.info(`Agent提供了最终回复，在第 ${stepCount} 步结束`);
          
          // 创建最终步骤
          const finalStep: AgentStep = {
            step_id: randomUUID(),
            task: this.trajectory.task,
            messages: [...messages],
            tool_calls: [],
            tool_results: [],
            completed: true,
            timestamp: new Date().getTime(),
          };
          
          // 存储LLM响应内容
          (finalStep as any).llm_response_content = reasoningResponse.content || '';
          
          this.trajectory.steps.push(finalStep);
          this.trajectory.completed = true;
          this.trajectory.success = true;
          this.trajectory.end_time = new Date().toISOString();
          break;
        }
        
        // 写入轨迹用于调试
        writeFileSync('./trajectory.json', JSON.stringify(this.trajectory, null, 2));
      }

      if (!this.trajectory.completed) {
        this.logger.warn(`任务在 ${maxSteps} 步后未完成`);
        this.trajectory.completed = true;
        this.trajectory.success = false;
        this.trajectory.end_time = new Date().toISOString();
      }

      return this.trajectory;
    } catch (error) {
      this.logger.error(`Agent执行失败: ${error}`);
      this.trajectory.completed = true;
      this.trajectory.success = false;
      this.trajectory.end_time = new Date().toISOString();
      throw error;
    } finally {
      this.isRunning = false;
      // 清理工具资源
      await this.toolCallExecutor.closeTools();
      this.logger.info(`Agent执行完成。成功: ${this.trajectory.success}`);
    }
  }

  /**
   * ReAct循环的推理阶段
   * 让LLM分析当前情况并决定下一步行动
   */
  protected async reasoning(messages: Message[], stepNumber: number): Promise<LLMResponse> {
    this.logger.debug(`开始推理阶段 - 步骤 ${stepNumber}`);
    
    // 转换消息格式
    const llmMessages = this.convertToLLMMessages(messages);
    
    // 获取可用工具
    const availableTools = Array.from(this.tools.values()).map(tool => tool.definition);
    console.log("workingDirectory====>",this.workingDirectory)
 
 
    
    // 调用LLM进行推理
    const response = await this.llmClient.chat(
      llmMessages,
      availableTools.length > 0 ? availableTools : undefined
    );
    
    this.logger.debug(`推理阶段完成`, {
      hasContent: !!response.content,
      hasToolCalls: !!(response.tool_calls && response.tool_calls.length > 0),
      toolCallCount: response.tool_calls?.length || 0
    });
    
    return response;
  }

  /**
   * ReAct循环的行动阶段
   * 执行推理阶段决定的工具调用
   */
  protected async acting(toolCalls: ToolCall[], stepNumber: number): Promise<ToolResult[]> {
    this.logger.debug(`开始行动阶段 - 步骤 ${stepNumber}`, {
      toolCallCount: toolCalls.length
    });
    
    // 创建执行上下文
    const context: ToolExecutionContext = {
      workingDirectory: this.workingDirectory,
      environment: Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]),
    };
    
    // 并行执行所有工具调用
    const toolResults = await this.toolCallExecutor.parallelToolCall(toolCalls, context);
    
    this.logger.debug(`行动阶段完成`, {
      successCount: toolResults.filter(r => r.success).length,
      errorCount: toolResults.filter(r => !r.success).length
    });
    
    return toolResults;
  }

  /**
   * ReAct循环的观察阶段
   * 处理工具执行结果，更新消息历史，判断是否完成任务
   */
  protected async observation(
    toolResults: ToolResult[], 
    messages: Message[], 
    reasoningResponse: LLMResponse
  ): Promise<boolean> {
    this.logger.debug('开始观察阶段');
    
    // 检查是否有complete_task工具被成功调用
    const hasCompleteTask = toolResults.some(result => {
      // 查找对应的工具调用
      const toolCallIndex = toolResults.indexOf(result);
      const toolCall = reasoningResponse.tool_calls?.[toolCallIndex];
      
      return result.success && 
             toolCall?.function.name === 'complete_task' &&
             result.result &&
             typeof result.result === 'object' &&
             'task_completed' in result.result && 
             result.result.task_completed === true;
    });
    
    if (hasCompleteTask) {
      this.logger.info('检测到complete_task工具调用，任务完成');
      
      // 创建最终步骤记录
      const finalStep: AgentStep = {
        step_id: randomUUID(),
        task: this.trajectory.task,
        messages: [...messages],
        tool_calls: reasoningResponse.tool_calls || [],
        tool_results: toolResults,
        completed: true,
        timestamp: new Date().getTime(),
      };
      
      // 存储推理响应内容
      (finalStep as any).llm_response_content = reasoningResponse.content || '';
      
      this.trajectory.steps.push(finalStep);
      return true;
    }
    
   //当前步骤记录
    const currentStep: AgentStep = {
      step_id: randomUUID(),
      task: this.trajectory.task,
      messages: [...messages],
      tool_calls: reasoningResponse.tool_calls || [],
      tool_results: toolResults,
      completed: false,
      timestamp: new Date().getTime(),
    };
    
    // 存储推理响应内容
    (currentStep as any).llm_response_content = reasoningResponse.content || '';
    
    this.trajectory.steps.push(currentStep);
    
    // 将助手消息添加到对话历史
    if (reasoningResponse.content || (reasoningResponse.tool_calls && reasoningResponse.tool_calls.length > 0)) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: reasoningResponse.content || '',
        tool_calls: reasoningResponse.tool_calls && reasoningResponse.tool_calls.length > 0 ? reasoningResponse.tool_calls : undefined,
      };
      
      messages.push(assistantMessage);
    }
    
    // 将工具结果添加到对话历史
    for (let i = 0; i < toolResults.length; i++) {
      const result = toolResults[i];
      const toolCall = reasoningResponse.tool_calls?.[i];
      
      if (toolCall) {
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      }
    }

    
    this.logger.debug('观察阶段完成，继续下一轮ReAct循环', {
      toolResultsCount: toolResults.length
    });
    return false;
  }

  protected convertToLLMMessages(messages: Message[]): LLMMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
      tool_calls: msg.tool_calls,
      tool_call_id: msg.tool_call_id,
    }));
  }



  protected abstract getSystemPrompt(): string;

  public getTrajectory(): AgentTrajectory {
    return this.trajectory;
  }

  public stop(): void {
    this.isRunning = false;
    this.logger.info('Agent execution stopped by user');
  }

  public getCurrentStep(): AgentStep | null {
    // 返回最后一个步骤，如果没有则返回null
    return this.trajectory.steps.length > 0 ? this.trajectory.steps[this.trajectory.steps.length - 1] : null;
  }

  public isAgentRunning(): boolean {
    return this.isRunning;
  }
}