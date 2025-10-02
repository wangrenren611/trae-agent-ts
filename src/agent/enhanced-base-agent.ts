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
import { HookManager, HookContext, AgentHookTypes } from './hooks.js';
import { StateManager } from './state.js';
import { InterruptionManager, InterruptionError } from './interruption.js';
import { ResilienceManager } from './resilience.js';

export abstract class EnhancedBaseAgent {
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

  // Enhanced systems
  protected readonly hooks: HookManager;
  protected readonly state: StateManager;
  protected readonly interruption: InterruptionManager;
  protected readonly resilience: ResilienceManager;

  // Execution tracking
  private currentTaskId?: string;
  private stepCount = 0;

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

    // Initialize enhanced systems
    this.hooks = new HookManager();
    this.state = new StateManager();
    this.interruption = new InterruptionManager();
    this.resilience = new ResilienceManager();

    // Register basic state
    this.registerBasicState();

    // Register interrupt handlers
    this.registerInterruptHandlers();

    this.trajectory = {
      agent_id: agentId,
      task: '',
      steps: [],
      completed: false,
      success: false,
      start_time: new Date().toISOString(),
    };

    this.logger.info(`Enhanced agent ${agentId} initialized with hooks, state management, and resilience features`);
  }

  /**
   * Register basic state variables
   */
  private registerBasicState(): void {
    this.state.register('agentId', this.agentId);
    this.state.register('workingDirectory', this.workingDirectory);
    this.state.register('isRunning', false);
    this.state.register('stepCount', 0);
    this.state.register('startTime');
    this.state.register('lastActivity');
  }

  /**
   * Register interrupt handlers
   */
  private registerInterruptHandlers(): void {
    this.interruption.registerHandler(async (reason?: string) => {
      this.logger.warn(`Agent ${this.agentId} interrupted: ${reason}`);
      this.state.set('isRunning', false);
      await this.onInterruption(reason);
    });
  }

  /**
   * Override this method to handle interruptions
   */
  protected async onInterruption(reason?: string): Promise<void> {
    // Default implementation - can be overridden by subclasses
  }

  /**
   * Add a hook
   */
  addHook(hookType: AgentHookTypes, name: string, hook: Function): void {
    this.hooks.register(hookType, name, hook);
  }

  /**
   * Remove a hook
   */
  removeHook(hookType: AgentHookTypes, name: string): void {
    this.hooks.remove(hookType, name);
  }

  /**
   * Enhanced execute method with hooks, state management, and resilience
   */
  async execute(task: string, maxSteps: number = 30): Promise<AgentTrajectory> {
    this.currentTaskId = randomUUID();
    this.interruption.startTask(this.currentTaskId);

    try {
      // Create hook context
      const context: HookContext = {
        agentId: this.agentId,
        task,
        stepNumber: 0,
        maxSteps
      };

      // Execute pre-reply hooks
      await this.hooks.execute('pre_reply', context, task, maxSteps);

      this.logger.info(`Starting enhanced agent execution for task: ${task}`);
      this.trajectory.task = task;
      this.isRunning = true;
      this.stepCount = 0;

      // Update state
      this.state.set('isRunning', true);
      this.state.set('startTime', new Date().toISOString());
      this.state.set('lastActivity', new Date().toISOString());

      // Save initial state snapshot
      this.state.saveSnapshot();

      const messages: Message[] = [
        {
          role: 'system',
          content: await this.getSystemPrompt(),
        },
        {
          role: 'user',
          content: task,
        },
      ];

      // Execute with resilience
      await this.resilience.withRetry(async () => {
        await this.executeReActLoop(messages, maxSteps, context);
      }, {
        maxAttempts: 2,
        baseDelayMs: 1000,
        retryCondition: (error) => {
          // Only retry on network-related errors
          return error.message.includes('network') ||
                 error.message.includes('timeout') ||
                 error instanceof InterruptionError === false;
        }
      });

      // Execute post-reply hooks
      await this.hooks.execute('post_reply', context, this.trajectory);

      return this.trajectory;

    } catch (error) {
      if (error instanceof InterruptionError) {
        this.logger.info(`Agent execution interrupted: ${error.reason}`);
        this.trajectory.completed = true;
        this.trajectory.success = false;
        this.trajectory.end_time = new Date().toISOString();
        return this.trajectory;
      }

      this.logger.error(`Agent execution failed: ${error}`);
      this.trajectory.completed = true;
      this.trajectory.success = false;
      this.trajectory.end_time = new Date().toISOString();
      throw error;

    } finally {
      this.isRunning = false;
      this.state.set('isRunning', false);

      if (this.currentTaskId) {
        this.interruption.endTask(this.currentTaskId);
        this.currentTaskId = undefined;
      }

      // Ensure final trajectory is written
      await this.flushTrajectory();

      // Clean up tools resources
      await this.toolCallExecutor.closeTools();

      this.logger.info(`Enhanced agent execution completed. Success: ${this.trajectory.success}`);
    }
  }

  /**
   * Enhanced ReAct loop with hooks and better error handling
   */
  private async executeReActLoop(
    messages: Message[],
    maxSteps: number,
    context: HookContext
  ): Promise<void> {
    while (this.isRunning && this.stepCount < maxSteps) {
      this.interruption.checkInterrupted();

      this.stepCount++;
      context.stepNumber = this.stepCount;
      this.state.set('stepCount', this.stepCount);
      this.state.set('lastActivity', new Date().toISOString());

      this.logger.info(`执行增强ReAct循环第 ${this.stepCount}/${maxSteps} 轮`);

      // Execute pre-reasoning hooks
      await this.hooks.execute('pre_reasoning', context, messages);

      // 1. Reasoning阶段 - 让Agent思考和规划
      const reasoningResponse = await this.reasoning(messages, this.stepCount);

      // Execute post-reasoning hooks
      await this.hooks.execute('post_reasoning', context, reasoningResponse);

      // Check for tool calls
      if (reasoningResponse.tool_calls && reasoningResponse.tool_calls.length > 0) {
        // Execute pre-acting hooks
        await this.hooks.execute('pre_acting', context, reasoningResponse.tool_calls);

        // 2. Acting阶段 - 执行工具调用
        const observations = await this.acting(reasoningResponse.tool_calls, this.stepCount);

        // Execute post-acting hooks
        await this.hooks.execute('post_acting', context, observations);

        this.logger.info(`执行工具调用完成`);

        // Execute pre-observation hooks
        await this.hooks.execute('pre_observation', context, observations, messages, reasoningResponse);

        // 3. Observation阶段 - 处理观察结果
        const stepCompleted = await this.observation(observations, messages, reasoningResponse);

        // Execute post-observation hooks
        await this.hooks.execute('post_observation', context, stepCompleted);

        this.logger.info(`观察阶段完成`);

        if (stepCompleted) {
          this.logger.info(`任务在第 ${this.stepCount} 步完成`);
          this.trajectory.completed = true;
          this.trajectory.success = true;
          this.trajectory.end_time = new Date().toISOString();
          break;
        }
      } else {
        // 没有工具调用，可能是纯文本回复，结束循环
        this.logger.info(`Agent提供了最终回复，在第 ${this.stepCount} 步结束`);

        await this.handleFinalResponse(reasoningResponse, messages);
        break;
      }

      // 异步写入轨迹用于调试（防抖处理）
      this.scheduleTrajectoryWrite();
    }

    if (!this.trajectory.completed) {
      this.logger.warn(`任务在 ${maxSteps} 步后未完成`);
      this.trajectory.completed = true;
      this.trajectory.success = false;
      this.trajectory.end_time = new Date().toISOString();
    }
  }

  /**
   * Handle final response when no tool calls are made
   */
  private async handleFinalResponse(reasoningResponse: LLMResponse, messages: Message[]): Promise<void> {
    const finalStep: AgentStep = {
      step_id: randomUUID(),
      task: this.trajectory.task,
      messages: [...messages],
      tool_calls: [],
      tool_results: [],
      completed: true,
      timestamp: new Date().getTime(),
    };

    (finalStep as any).llm_response_content = reasoningResponse.content || '';

    this.trajectory.steps.push(finalStep);
    this.trajectory.completed = true;
    this.trajectory.success = true;
    this.trajectory.end_time = new Date().toISOString();
  }

  /**
   * Enhanced reasoning with interruption support
   */
  protected async reasoning(messages: Message[], stepNumber: number): Promise<LLMResponse> {
    this.interruption.checkInterrupted();

    const taskId = `reasoning-${stepNumber}`;
    return this.interruption.createCancellablePromise(
      this.performReasoning(messages, stepNumber),
      taskId
    );
  }

  /**
   * Actual reasoning implementation - override this for custom reasoning
   */
  protected async performReasoning(messages: Message[], stepNumber: number): Promise<LLMResponse> {
    this.logger.debug(`开始推理阶段 - 步骤 ${stepNumber}`);

    const llmMessages = this.convertToLLMMessages(messages);
    const availableTools = Array.from(this.tools.values()).map(tool => tool.definition);

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
   * Enhanced acting with parallel execution and resilience
   */
  protected async acting(toolCalls: ToolCall[], stepNumber: number): Promise<ToolResult[]> {
    this.interruption.checkInterrupted();

    this.logger.debug(`开始行动阶段 - 步骤 ${stepNumber}`, {
      toolCallCount: toolCalls.length
    });

    const context: ToolExecutionContext = {
      workingDirectory: this.workingDirectory,
      environment: Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]),
    };

    // Execute with resilience and parallel processing
    const toolResults = await this.resilience.withRetry(async () => {
      return await this.toolCallExecutor.parallelToolCall(toolCalls, context);
    }, {
      maxAttempts: 3,
      baseDelayMs: 500,
      retryCondition: (error) => {
        // Retry on tool execution failures
        return error.message.includes('timeout') ||
               error.message.includes('connection') ||
               error.message.includes('ECONNRESET');
      }
    });

    this.logger.debug(`行动阶段完成`, {
      successCount: toolResults.filter(r => r.success).length,
      errorCount: toolResults.filter(r => !r.success).length
    });

    return toolResults;
  }

  /**
   * Enhanced observation with better state tracking
   */
  protected async observation(
    toolResults: ToolResult[],
    messages: Message[],
    reasoningResponse: LLMResponse
  ): Promise<boolean> {
    this.interruption.checkInterrupted();

    this.logger.debug('开始观察阶段');

    const hasCompleteTask = this.checkForCompleteTask(toolResults, reasoningResponse.tool_calls || []);

    if (hasCompleteTask) {
      this.logger.info('检测到complete_task工具调用，任务完成');

      const finalStep: AgentStep = {
        step_id: randomUUID(),
        task: this.trajectory.task,
        messages: [...messages],
        tool_calls: reasoningResponse.tool_calls || [],
        tool_results: toolResults,
        completed: true,
        timestamp: new Date().getTime(),
      };

      (finalStep as any).llm_response_content = reasoningResponse.content || '';
      this.trajectory.steps.push(finalStep);

      // Save final state
      this.state.saveSnapshot();
      return true;
    }

    const currentStep: AgentStep = {
      step_id: randomUUID(),
      task: this.trajectory.task,
      messages: [...messages],
      tool_calls: reasoningResponse.tool_calls || [],
      tool_results: toolResults,
      completed: false,
      timestamp: new Date().getTime(),
    };

    (currentStep as any).llm_response_content = reasoningResponse.content || '';
    this.trajectory.steps.push(currentStep);

    this.addAssistantMessage(messages, reasoningResponse);
    this.addToolResultsToMessages(messages, toolResults, reasoningResponse.tool_calls || []);

    this.logger.debug('观察阶段完成，继续下一轮ReAct循环', {
      toolResultsCount: toolResults.length
    });

    return false;
  }

  /**
   * Enhanced interruption handling
   */
  public async interrupt(reason?: string): Promise<void> {
    await this.interruption.interrupt(reason);
  }

  /**
   * Get agent status and statistics
   */
  public getStatus(): {
    isRunning: boolean;
    stepCount: number;
    currentTask?: string;
    state: Record<string, any>;
    interruptionStatus: any;
    circuitBreakerStats: any;
  } {
    return {
      isRunning: this.isRunning,
      stepCount: this.stepCount,
      currentTask: this.trajectory.task,
      state: this.state.getAll(),
      interruptionStatus: this.interruption.getStatus(),
      circuitBreakerStats: this.resilience.getCircuitBreakerStats()
    };
  }

  // Keep existing methods from BaseAgent
  private checkForCompleteTask(toolResults: ToolResult[], toolCalls: ToolCall[]): boolean {
    return toolResults.some(result => {
      if (!result.success || !result.result) {
        return false;
      }

      const toolCall = this.findToolCallForResult(result, toolCalls);

      if (toolCall?.function.name !== 'complete_task') {
        return false;
      }

      const completeResult = result.result as CompleteTaskResult;
      return completeResult.task_completed === true;
    });
  }

  private findToolCallForResult(result: ToolResult, toolCalls: ToolCall[]): ToolCall | undefined {
    if ((result as any).tool_call_id) {
      return toolCalls.find(call => call.id === (result as any).tool_call_id);
    }

    this.logger.warn('工具结果缺少tool_call_id，使用备用匹配方案');
    return toolCalls.length > 0 ? toolCalls[0] : undefined;
  }

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

  protected abstract getSystemPrompt(): string | Promise<string>;

  public getTrajectory(): AgentTrajectory {
    return this.trajectory;
  }

  public stop(): void {
    this.isRunning = false;
    this.interruption.interrupt('Stopped by user');
    this.logger.info('Enhanced agent execution stopped by user');
  }

  public getCurrentStep(): AgentStep | null {
    return this.trajectory.steps.length > 0 ? this.trajectory.steps[this.trajectory.steps.length - 1] : null;
  }

  public isAgentRunning(): boolean {
    return this.isRunning;
  }

  // Trajectory writing methods (same as BaseAgent)
  private scheduleTrajectoryWrite(): void {
    if (this.trajectoryWriteTimer) {
      clearTimeout(this.trajectoryWriteTimer);
    }

    this.trajectoryWritePending = true;

    this.trajectoryWriteTimer = setTimeout(async () => {
      if (this.trajectoryWritePending) {
        try {
          await this.writeTrajectoryToFile();
          this.trajectoryWritePending = false;
        } catch (error) {
          this.logger.warn(`轨迹写入失败: ${error}`);
        }
      }
    }, 500);
  }

  private async writeTrajectoryToFile(): Promise<void> {
    try {
      const { mkdir } = await import('fs/promises');
      const trajectoryPath = `${this.workingDirectory}/trajectory.json`;

      try {
        await mkdir(this.workingDirectory, { recursive: true });
      } catch (mkdirError) {
        if ((mkdirError as any).code !== 'EEXIST') {
          throw mkdirError;
        }
      }

      await writeFile(trajectoryPath, JSON.stringify(this.trajectory, null, 2));
      this.logger.debug(`轨迹已写入: ${trajectoryPath}`);
    } catch (error) {
      this.logger.error(`轨迹写入失败: ${error}`);
    }
  }

  private async flushTrajectory(): Promise<void> {
    if (this.trajectoryWriteTimer) {
      clearTimeout(this.trajectoryWriteTimer);
      this.trajectoryWriteTimer = null;
    }

    if (this.trajectoryWritePending) {
      await this.writeTrajectoryToFile();
      this.trajectoryWritePending = false;
    }
  }
}