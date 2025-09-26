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
    
        // Check if task should be completed (but hasn't called task_done yet)
        const shouldComplete = this.shouldAutoCompleteTask(step);
        
        if (step.completed) {
          this.logger.info(`Task completed successfully after ${stepCount} steps`);
          this.trajectory.completed = true;
          this.trajectory.success = true;
          this.trajectory.end_time = new Date().toISOString();
        } else if (shouldComplete && !this.hasTaskDoneCall(step)) {
          // Auto-call task_done if task should be completed but hasn't called it yet
          this.logger.info(`Auto-calling task_done after ${stepCount} steps`);
          const taskDoneStep = await this.executeTaskDoneCall(messages, stepCount + 1, step);
          this.trajectory.steps.push(taskDoneStep);
          
          if (taskDoneStep.completed) {
            this.trajectory.completed = true;
            this.trajectory.success = true;
            this.trajectory.end_time = new Date().toISOString();
          }
        }
        
        // Write trajectory to file for debugging (after status update)
        writeFileSync('./trajectory.json', JSON.stringify(this.trajectory, null, 2));

        if (step.completed || (shouldComplete && this.trajectory.completed)) {
          break;
        }

        // Always add assistant message if LLM provided content
        const llmResponseContent = (step as any).llm_response_content || '';
        if (llmResponseContent.trim() || step.tool_calls.length > 0) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: llmResponseContent,
            tool_calls: step.tool_calls.length > 0 ? step.tool_calls : undefined,
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
      timestamp: new Date().getTime(),
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
        
        // After executing tools, get LLM response to process the results
        const toolMessages = [...llmMessages];
        
        // Add the assistant message with tool calls
        toolMessages.push({
          role: 'assistant',
          content: response.content || '',
          tool_calls: response.tool_calls,
        });
        
        // Add tool results
        for (let i = 0; i < toolResults.length; i++) {
          toolMessages.push({
            role: 'tool',
            content: JSON.stringify(toolResults[i]),
            tool_call_id: response.tool_calls[i].id,
          });
        }
        
        // Get LLM response to analyze tool results
        const followUpResponse = await this.llmClient.chat(toolMessages);
        
        // Store the follow-up response content
        (this.currentStep as any).llm_response_content = followUpResponse.content || '';
        
        // Check if task is completed based on follow-up response
        this.currentStep.completed = this.isTaskCompleted(followUpResponse, this.currentStep.tool_results);
      } else {
        // No tool calls, just store the response content
        (this.currentStep as any).llm_response_content = response.content || '';
        
        // Check if task is completed
        this.currentStep.completed = this.isTaskCompleted(response, this.currentStep.tool_results);
      }

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
    // Check if any tool result indicates task completion via task_done tool
    const hasTaskDone = toolResults.some(result =>
      result.success && result.result &&
      typeof result.result === 'object' &&
      'task_completed' in result.result && 
      result.result.task_completed === true
    );

    if (hasTaskDone) {
      return true;
    }

    // Don't auto-complete here, let the main loop handle auto task_done calls
    return false;
  }

  // Add recent message to track for loops
  private addRecentMessage(content: string): void {
    this.recentAssistantMessages.push(content);
    if (this.recentAssistantMessages.length > this.maxRecentMessages) {
      this.recentAssistantMessages.shift();
    }
  }

  // Check if task should be auto-completed
  private shouldAutoCompleteTask(step: AgentStep): boolean {
    // Only auto-complete if step has substantial response and no tool calls
    const llmResponse = (step as any).llm_response_content || '';
    return llmResponse.trim().length > 10 && step.tool_calls.length === 0;
  }

  // Check if step already contains task_done call
  private hasTaskDoneCall(step: AgentStep): boolean {
    return step.tool_calls.some(call => call.function.name === 'task_done');
  }

  // Execute task_done call automatically
  private async executeTaskDoneCall(messages: Message[], stepNumber: number, previousStep: AgentStep): Promise<AgentStep> {
    const taskDoneStep: AgentStep = {
      step_id: randomUUID(),
      task: this.trajectory.task,
      messages: [...messages],
      tool_calls: [{
        id: randomUUID(),
        type: 'function',
        function: {
          name: 'task_done',
          arguments: JSON.stringify({
            task_completed: true,
            result: (previousStep as any).llm_response_content || 'Task completed successfully',
            summary: `Completed task: ${this.trajectory.task}`
          })
        }
      }],
      tool_results: [],
      completed: false,
      timestamp: new Date().getTime(),
    };

    try {
      // Execute the task_done tool
      const context: ToolExecutionContext = {
        workingDirectory: this.workingDirectory,
        environment: Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]),
      };

      const toolResults = await this.toolCallExecutor.parallelToolCall(taskDoneStep.tool_calls, context);
      taskDoneStep.tool_results = toolResults;
      
      // Check if task_done was successful
      taskDoneStep.completed = toolResults.some(result =>
        result.success && result.result &&
        typeof result.result === 'object' &&
        'task_completed' in result.result && 
        result.result.task_completed === true
      );

      return taskDoneStep;
    } catch (error) {
      this.logger.error(`Failed to execute task_done: ${error}`);
      taskDoneStep.completed = false;
      return taskDoneStep;
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