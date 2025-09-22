import { randomUUID } from 'crypto';
import { LLMClient } from '../utils/llm_clients/llm-client.js';
import { ToolExecutor } from '../tools/base.js';
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
  protected readonly config: Config;
  protected readonly logger: Logger;
  protected trajectory: AgentTrajectory;
  protected workingDirectory: string;
  protected currentStep: AgentStep | null = null;
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

        if (step.completed) {
          this.logger.info(`Task completed successfully after ${stepCount} steps`);
          this.trajectory.completed = true;
          this.trajectory.success = true;
          this.trajectory.end_time = new Date().toISOString();
          break;
        }

        // Add tool results to messages
        for (const result of step.tool_results) {
          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: step.tool_calls.find(call =>
              call.function.name === this.getToolNameFromResult(result)
            )?.id || '',
          });
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
      console.log('llmMessages', llmMessages);
      const availableTools = Array.from(this.tools.values()).map(tool => tool.definition);

      this.logger.debug('Calling LLM with messages and tools', {
        messageCount: messages.length,
        toolCount: availableTools.length,
      });

      const response = await this.llmClient.chat(
        llmMessages,
        availableTools.length > 0 ? availableTools : undefined
      );
      console.log('response', response);
      // Process tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        this.currentStep.tool_calls = response.tool_calls;

        // Execute tool calls in parallel
        const toolResults = await Promise.all(
          response.tool_calls.map(call => this.executeTool(call))
        );

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

  protected async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const toolName = toolCall.function.name;
    const tool = this.tools.get(toolName);

    if (!tool) {
      this.logger.error(`Tool not found: ${toolName}`);
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
      };
    }

    try {
      this.logger.info(`Executing tool: ${toolName}`);

      const params = JSON.parse(toolCall.function.arguments);
      const context: ToolExecutionContext = {
        workingDirectory: this.workingDirectory,
        environment: Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]),
      };

      const result = await tool.execute(params, context);
      this.logger.debug(`Tool ${toolName} executed successfully`, { success: result.success });

      return result;
    } catch (error) {
      this.logger.error(`Tool execution failed: ${toolName}`, { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
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
    // This is a simplified implementation - in practice, you'd need to track the mapping
    return 'unknown';
  }

  protected isTaskCompleted(response: LLMResponse, toolResults: ToolResult[]): boolean {
    // Check if any tool result indicates task completion
    const hasTaskDone = toolResults.some(result =>
      result.success && result.result &&
      typeof result.result === 'object' &&
      'task_completed' in result.result &&
      result.result.task_completed === true
    );

    if (hasTaskDone) {
      return true;
    }

    // Check if LLM response indicates completion
    const completionKeywords = ['task completed', 'done', 'finished', 'completed'];
    const content = response.content.toLowerCase();

    return completionKeywords.some(keyword => content.includes(keyword));
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