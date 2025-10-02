import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';
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
  LLMResponse,
  CompleteTaskResult
} from '../types/index.js';

// 扩展AgentStep类型以支持LLM响应内容
interface ExtendedAgentStep extends AgentStep {
  llm_response_content?: string;
}

// 扩展ToolResult类型以支持tool_call_id
interface ExtendedToolResult extends ToolResult {
  tool_call_id?: string;
}

// 钩子函数类型定义
export interface AgentHooks {
  onStepStart?: (stepNumber: number) => void;
  onStepComplete?: (stepNumber: number, step: ExtendedAgentStep) => void;
  onReasoningStart?: (messages: Message[]) => void;
  onReasoningComplete?: (response: LLMResponse) => void;
  onActingStart?: (toolCalls: ToolCall[]) => void;
  onActingComplete?: (results: ToolResult[]) => void;
  onObservationStart?: (toolResults: ToolResult[]) => void;
  onObservationComplete?: (completed: boolean) => void;
  onTaskComplete?: (trajectory: AgentTrajectory) => void;
  onError?: (error: Error, context: string) => void;
}

// 性能指标接口
export interface PerformanceMetrics {
  totalSteps: number;
  totalExecutionTime: number;
  averageStepTime: number;
  llmCallCount: number;
  toolCallCount: number;
  successRate: number;
  errorCount: number;
}

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
  private trajectoryWritePending = false;
  private trajectoryWriteTimer: NodeJS.Timeout | null = null;
  
  // 缓存可用工具定义，避免重复计算
  private cachedToolDefinitions: any[] | null = null;
  
  // 配置参数
  private readonly maxSteps: number;
  private readonly trajectoryWriteDelay: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly maxMessageHistory: number;
  
  // 钩子和性能监控
  private hooks: AgentHooks = {};
  private performanceMetrics: PerformanceMetrics = {
    totalSteps: 0,
    totalExecutionTime: 0,
    averageStepTime: 0,
    llmCallCount: 0,
    toolCallCount: 0,
    successRate: 0,
    errorCount: 0
  };
  private executionStartTime: number = 0;

  constructor(
    agentId: string,
    llmClient: LLMClient,
    tools: ToolExecutor[],
    config: Config,
    logger: Logger,
    workingDirectory: string,
    options: {
      maxSteps?: number;
      trajectoryWriteDelay?: number;
      maxRetries?: number;
      retryDelay?: number;
      maxMessageHistory?: number;
    } = {}
  ) {
    this.agentId = agentId;
    this.llmClient = llmClient;
    this.tools = new Map(tools.map(tool => [tool.name, tool]));
    this.toolCallExecutor = new ToolCallExecutor(tools);
    this.config = config;
    this.logger = logger;
    this.workingDirectory = workingDirectory;

    // 设置配置参数，提供默认值
    this.maxSteps = options.maxSteps ?? 30;
    this.trajectoryWriteDelay = options.trajectoryWriteDelay ?? 300; // 减少到300ms
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.maxMessageHistory = options.maxMessageHistory ?? 100; // 限制消息历史长度

    this.trajectory = {
      agent_id: agentId,
      task: '',
      steps: [],
      completed: false,
      success: false,
      start_time: new Date().toISOString(),
    };
  }

  async execute(task: string, maxSteps?: number): Promise<AgentTrajectory> {
    const actualMaxSteps = maxSteps ?? this.maxSteps;
    this.logger.info(`Starting ReAct agent execution for task: ${task}`);
    this.trajectory.task = task;
    this.isRunning = true;
    this.executionStartTime = Date.now();
    
    // 重置性能指标
    this.performanceMetrics = {
      totalSteps: 0,
      totalExecutionTime: 0,
      averageStepTime: 0,
      llmCallCount: 0,
      toolCallCount: 0,
      successRate: 0,
      errorCount: 0
    };

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
      while (this.isRunning && stepCount < actualMaxSteps) {
        stepCount++;
        this.logger.info(`执行ReAct循环第 ${stepCount}/${actualMaxSteps} 轮`);
        
        // 触发步骤开始钩子
        this.triggerHook('onStepStart', stepCount);

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
          const finalStep = this.createAgentStep(
            messages,
            [],
            [],
            true,
            reasoningResponse.content || ''
          );
          
          this.trajectory.steps.push(finalStep);
          this.trajectory.completed = true;
          this.trajectory.success = true;
          this.trajectory.end_time = new Date().toISOString();
          
          // 更新性能指标
          this.updatePerformanceMetrics();
          
          // 触发任务完成钩子
          this.triggerHook('onTaskComplete', this.trajectory);
          break;
        }

        // 异步写入轨迹用于调试（防抖处理）
        this.scheduleTrajectoryWrite();
      }

      if (!this.trajectory.completed) {
        this.logger.warn(`任务在 ${actualMaxSteps} 步后未完成`);
        this.trajectory.completed = true;
        this.trajectory.success = false;
        this.trajectory.end_time = new Date().toISOString();
        
        // 更新性能指标
        this.updatePerformanceMetrics();
        
        // 触发任务完成钩子
        this.triggerHook('onTaskComplete', this.trajectory);
      }

      return this.trajectory;
    } catch (error) {
      this.logger.error(`Agent执行失败: ${error}`);
      this.trajectory.completed = true;
      this.trajectory.success = false;
      this.trajectory.end_time = new Date().toISOString();
      
      // 更新性能指标
      this.updatePerformanceMetrics();
      
      // 触发错误钩子
      this.triggerHook('onError', error as Error, 'execute');
      throw error;
    } finally {
      this.isRunning = false;
      // 确保最终轨迹被写入
      await this.flushTrajectory();
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
    
    // 触发推理开始钩子
    this.triggerHook('onReasoningStart', messages);
    
    // 转换消息格式
    const llmMessages = this.convertToLLMMessages(messages);
    
    // 获取可用工具（使用缓存）
    const availableTools = this.getAvailableTools();
    
    // 调用LLM进行推理，添加重试机制
    const response = await this.retryWithBackoff(
      () => this.llmClient.chat(
        llmMessages,
        availableTools.length > 0 ? availableTools : undefined
      ),
      'LLM推理调用'
    );
    
    // 更新性能指标
    this.performanceMetrics.llmCallCount++;
    
    // 触发推理完成钩子
    this.triggerHook('onReasoningComplete', response);
    
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
    
    // 触发行动开始钩子
    this.triggerHook('onActingStart', toolCalls);
    
    // 创建执行上下文
    const context: ToolExecutionContext = {
      workingDirectory: this.workingDirectory,
      environment: Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]),
    };
    
    // 并行执行所有工具调用，添加重试机制
    const toolResults = await this.retryWithBackoff(
      () => this.toolCallExecutor.parallelToolCall(toolCalls, context),
      '工具调用执行'
    );
    
    // 更新性能指标
    this.performanceMetrics.toolCallCount += toolCalls.length;
    
    // 触发行动完成钩子
    this.triggerHook('onActingComplete', toolResults);
    
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

    // 触发观察开始钩子
    this.triggerHook('onObservationStart', toolResults);

    // 检查是否有complete_task工具被成功调用
    const hasCompleteTask = this.checkForCompleteTask(toolResults, reasoningResponse.tool_calls || []);

    if (hasCompleteTask) {
      this.logger.info('检测到complete_task工具调用，任务完成');

      // 创建最终步骤记录
      const finalStep = this.createAgentStep(
        messages,
        reasoningResponse.tool_calls || [],
        toolResults,
        true,
        reasoningResponse.content || ''
      );

      this.trajectory.steps.push(finalStep);
      
      // 触发观察完成钩子
      this.triggerHook('onObservationComplete', true);
      return true;
    }

    // 当前步骤记录
    const currentStep = this.createAgentStep(
      messages,
      reasoningResponse.tool_calls || [],
      toolResults,
      false,
      reasoningResponse.content || ''
    );

    this.trajectory.steps.push(currentStep);

    // 将助手消息添加到对话历史
    this.addAssistantMessage(messages, reasoningResponse);

    // 将工具结果添加到对话历史（使用精确匹配）
    this.addToolResultsToMessages(messages, toolResults, reasoningResponse.tool_calls || []);
    
    // 限制消息历史长度，防止内存泄漏
    this.limitMessageHistory(messages);

    // 触发观察完成钩子
    this.triggerHook('onObservationComplete', false);
    
    // 触发步骤完成钩子
    this.triggerHook('onStepComplete', this.trajectory.steps.length, currentStep);

    this.logger.debug('观察阶段完成，继续下一轮ReAct循环', {
      toolResultsCount: toolResults.length
    });
    return false;
  }

  /**
   * 检查是否有complete_task工具被成功调用
   */
  private checkForCompleteTask(toolResults: ToolResult[], toolCalls: ToolCall[]): boolean {
    return toolResults.some(result => {
      if (!result.success || !result.result) {
        return false;
      }

      // 查找对应的工具调用（通过精确匹配）
      const toolCall = this.findToolCallForResult(result, toolCalls);

      if (toolCall?.function.name !== 'complete_task') {
        return false;
      }

      // 类型安全的检查
      const completeResult = result.result as CompleteTaskResult;
      return completeResult.task_completed === true;
    });
  }

  /**
   * 通过tool_call_id找到对应的工具调用
   */
  private findToolCallForResult(result: ToolResult, toolCalls: ToolCall[]): ToolCall | undefined {
    // 首先尝试通过结果中的tool_call_id匹配
    const extendedResult = result as ExtendedToolResult;
    if (extendedResult.tool_call_id) {
      return toolCalls.find(call => call.id === extendedResult.tool_call_id);
    }

    // 备用方案：如果没有tool_call_id，返回第一个匹配的工具调用
    // 这种情况不应该在正常工作流程中出现，只作为降级处理
    this.logger.warn('工具结果缺少tool_call_id，使用备用匹配方案');
    return toolCalls.length > 0 ? toolCalls[0] : undefined;
  }

  /**
   * 将助手消息添加到对话历史
   */
  private addAssistantMessage(messages: Message[], reasoningResponse: LLMResponse): void {
    if (reasoningResponse.content || (reasoningResponse.tool_calls && reasoningResponse.tool_calls.length > 0)) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: reasoningResponse.content || '',
        tool_calls: reasoningResponse.tool_calls && reasoningResponse.tool_calls.length > 0 ? reasoningResponse.tool_calls : undefined,
      };

      messages.push(assistantMessage);
    }
  }

  /**
   * 将工具结果添加到对话历史（使用精确匹配）
   */
  private addToolResultsToMessages(messages: Message[], toolResults: ToolResult[], toolCalls: ToolCall[]): void {
    for (const result of toolResults) {
      const toolCall = this.findToolCallForResult(result, toolCalls);

      if (toolCall) {
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      } else {
        this.logger.warn('无法找到工具结果对应的工具调用', {
          resultKeys: Object.keys(result)
        });
      }
    }
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



  /**
   * 获取可用工具定义（使用缓存）
   */
  private getAvailableTools(): any[] {
    if (this.cachedToolDefinitions === null) {
      this.cachedToolDefinitions = Array.from(this.tools.values()).map(tool => tool.definition);
    }
    return this.cachedToolDefinitions;
  }

  /**
   * 带重试机制的异步操作执行
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`${operationName} 第 ${attempt} 次尝试失败: ${lastError.message}`);
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // 指数退避
          this.logger.debug(`等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    this.logger.error(`${operationName} 在 ${this.maxRetries} 次尝试后仍然失败`);
    throw lastError || new Error(`${operationName} 执行失败`);
  }

  /**
   * 创建AgentStep的辅助方法
   */
  private createAgentStep(
    messages: Message[],
    toolCalls: ToolCall[],
    toolResults: ToolResult[],
    completed: boolean,
    llmResponseContent?: string
  ): ExtendedAgentStep {
    const step: ExtendedAgentStep = {
      step_id: randomUUID(),
      task: this.trajectory.task,
      messages: [...messages],
      tool_calls: toolCalls,
      tool_results: toolResults,
      completed,
      timestamp: new Date().getTime(),
    };

    if (llmResponseContent) {
      step.llm_response_content = llmResponseContent;
    }

    return step;
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

  /**
   * 设置钩子函数
   */
  public setHooks(hooks: AgentHooks): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  /**
   * 获取性能指标
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * 触发钩子函数
   */
  private triggerHook<K extends keyof AgentHooks>(
    hookName: K,
    ...args: Parameters<NonNullable<AgentHooks[K]>>
  ): void {
    try {
      const hook = this.hooks[hookName];
      if (hook) {
        (hook as any)(...args);
      }
    } catch (error) {
      this.logger.warn(`钩子函数 ${hookName} 执行失败: ${error}`);
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(): void {
    const currentTime = Date.now();
    this.performanceMetrics.totalSteps = this.trajectory.steps.length;
    this.performanceMetrics.totalExecutionTime = currentTime - this.executionStartTime;
    this.performanceMetrics.averageStepTime = this.performanceMetrics.totalSteps > 0 
      ? this.performanceMetrics.totalExecutionTime / this.performanceMetrics.totalSteps 
      : 0;
    this.performanceMetrics.successRate = this.trajectory.success ? 1 : 0;
  }

  /**
   * 限制消息历史长度，防止内存泄漏
   */
  private limitMessageHistory(messages: Message[]): void {
    if (messages.length > this.maxMessageHistory) {
      // 保留系统消息和最近的用户/助手消息
      const systemMessages = messages.filter(msg => msg.role === 'system');
      const recentMessages = messages.slice(-(this.maxMessageHistory - systemMessages.length));
      messages.splice(0, messages.length, ...systemMessages, ...recentMessages);
      
      this.logger.debug(`消息历史已限制到 ${messages.length} 条消息`);
    }
  }

  /**
   * 优化轨迹写入：使用防抖机制避免频繁写入
   */
  private scheduleTrajectoryWrite(): void {
    // 清除之前的定时器
    if (this.trajectoryWriteTimer) {
      clearTimeout(this.trajectoryWriteTimer);
    }

    // 标记需要写入
    this.trajectoryWritePending = true;

    // 设置新的定时器，使用配置的延迟时间
    this.trajectoryWriteTimer = setTimeout(async () => {
      if (this.trajectoryWritePending) {
        try {
          await this.writeTrajectoryToFile();
          this.trajectoryWritePending = false;
        } catch (error) {
          this.logger.warn(`轨迹写入失败: ${error}`);
        }
      }
    }, this.trajectoryWriteDelay);
  }

  /**
   * 异步写入轨迹到文件
   */
  private async writeTrajectoryToFile(): Promise<void> {
    try {
      const { mkdir } = await import('fs/promises');
      const trajectoryPath = `${this.workingDirectory}/trajectory.json`;

      // 确保工作目录存在
      try {
        await mkdir(this.workingDirectory, { recursive: true });
      } catch (mkdirError) {
        // 目录可能已存在，忽略错误
        if ((mkdirError as any).code !== 'EEXIST') {
          throw mkdirError;
        }
      }

      await writeFile(trajectoryPath, JSON.stringify(this.trajectory, null, 2));
      this.logger.debug(`轨迹已写入: ${trajectoryPath}`);
    } catch (error) {
      this.logger.error(`轨迹写入失败: ${error}`);
      // 不抛出错误，避免中断Agent执行
    }
  }

  /**
   * 确保在agent结束时写入最终轨迹
   */
  private async flushTrajectory(): Promise<void> {
    // 清除防抖定时器
    if (this.trajectoryWriteTimer) {
      clearTimeout(this.trajectoryWriteTimer);
      this.trajectoryWriteTimer = null;
    }

    // 如果有待写入的轨迹，立即写入
    if (this.trajectoryWritePending) {
      await this.writeTrajectoryToFile();
      this.trajectoryWritePending = false;
    }
  }
}