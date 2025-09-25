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
  protected currentStep: AgentStep | null = null;
  protected isRunning = false;
  // Track recent assistant messages to detect loops
  protected recentAssistantMessages: string[] = [];
  protected maxRecentMessages = 5;

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
    this.logger.info(`Starting agent execution for task: ${task}`);
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

      while (this.isRunning && stepCount < maxSteps) {
        stepCount++;
        this.logger.debug(`Executing step ${stepCount}/${maxSteps}`);
       
        const step = await this.executeStep(messages, stepCount);
        this.trajectory.steps.push(step);
        
        // Write trajectory to file for debugging
        writeFileSync('./trajectory.json', JSON.stringify(this.trajectory, null, 2));

        if (step.completed) {
          this.logger.info(`Task completed successfully after ${stepCount} steps`);
          this.trajectory.completed = true;
          this.trajectory.success = true;
          this.trajectory.end_time = new Date().toISOString();
          break;
        }

        // Add assistant message with tool calls if there are any
        if (step.tool_calls.length > 0) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: step.messages[step.messages.length - 1]?.content || '',
            tool_calls: step.tool_calls,
          };
          
          messages.push(assistantMessage);
          this.addRecentMessage(assistantMessage.content);
        }

        // Add tool results to messages
        for (const result of step.tool_results) {
          const toolCallId = step.tool_calls.find(call =>
            call.function.name === this.getToolNameFromResult(result)
          )?.id;
          
          if (toolCallId) {
            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
              tool_call_id: toolCallId,
            });
          }
        }
      }

      if (!this.trajectory.completed) {
        this.logger.warn(`Task not completed after ${maxSteps} steps`);
        this.trajectory.completed = true;
        this.trajectory.success = false;
        this.trajectory.end_time = new Date().toISOString();
      }

      return this.trajectory;
    } catch (error) {
      this.logger.error(`Agent execution failed: ${error}`);
      this.trajectory.completed = true;
      this.trajectory.success = false;
      this.trajectory.end_time = new Date().toISOString();
      throw error;
    } finally {
      this.isRunning = false;
      // Clean up tool resources
      await this.toolCallExecutor.closeTools();
      this.logger.info(`Agent execution completed. Success: ${this.trajectory.success}`);
    }
  }

  protected async executeStep(messages: Message[], stepNumber: number): Promise<AgentStep> {
    this.currentStep = {
      step_id: randomUUID(),
      task: this.trajectory.task,
      messages: [...messages],
      tool_calls: [],
      tool_results: [],
      completed: false,
      timestamp: new Date().toISOString(),
    };

    try {
      // Get LLM response
      const llmMessages = this.convertToLLMMessages(messages);

      // this.logger.info('llmMessages', llmMessages);

      const availableTools = Array.from(this.tools.values()).map(tool => tool.definition);

      this.logger.debug('Calling LLM with messages and tools', {
        messageCount: messages.length,
        toolCount: availableTools.length,
      });

      const response = await this.llmClient.chat(
        llmMessages,
        availableTools.length > 0 ? availableTools : undefined
      );
     
      // Process tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        this.currentStep.tool_calls = response.tool_calls;

        // Create execution context
        const context: ToolExecutionContext = {
          workingDirectory: this.workingDirectory,
          environment: Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]),
        };

        // Execute tool calls in parallel using the new ToolCallExecutor
        const toolResults = await this.toolCallExecutor.parallelToolCall(response.tool_calls, context);

        this.currentStep.tool_results = toolResults;
      }

      // Check if task is completed
      this.currentStep.completed = this.isTaskCompleted(response, this.currentStep.tool_results);

      return this.currentStep;
    } catch (error) {
      this.logger.error(`Step execution failed: ${error}`);
      this.currentStep.completed = true;
      throw error;
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

  protected getToolNameFromResult(result: ToolResult): string {
    // Try to extract tool name from result metadata or use a more sophisticated mapping
    if (result.result && typeof result.result === 'object' && 'tool_name' in result.result) {
      return (result.result as any).tool_name;
    }
    
    // For now, we'll use a simple approach - match by index
    // This assumes tool results are in the same order as tool calls
    const resultIndex = this.currentStep?.tool_results.indexOf(result) ?? -1;
    if (resultIndex >= 0 && this.currentStep?.tool_calls[resultIndex]) {
      return this.currentStep.tool_calls[resultIndex].function.name;
    }
    
    return 'unknown';
  }

  protected isTaskCompleted(response: LLMResponse, toolResults: ToolResult[]): boolean {
    // Check if any tool result indicates task completion
    // Only accept task completion if task_completed is explicitly set to true
    const hasTaskDone = toolResults.some(result =>
      result.success && result.result &&
      typeof result.result === 'object' &&
      'task_completed' in result.result && 
      result.result.task_completed === true
    );

    if (hasTaskDone) {
      return true;
    }

    // Don't consider LLM response alone as task completion
    // Task must be explicitly marked as done via the task_done tool
    return false;
  }

  // Add recent message to track for loops
  private addRecentMessage(content: string): void {
    this.recentAssistantMessages.push(content);
    if (this.recentAssistantMessages.length > this.maxRecentMessages) {
      this.recentAssistantMessages.shift();
    }
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
    return this.currentStep;
  }

  public isAgentRunning(): boolean {
    return this.isRunning;
  }
}