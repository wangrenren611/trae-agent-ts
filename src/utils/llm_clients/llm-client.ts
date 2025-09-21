import { LLMMessage, LLMResponse, ToolDefinition, LLMError } from '../../types/index.js';

export abstract class LLMClient {
  protected readonly provider: string;
  protected readonly model: string;
  protected readonly maxTokens?: number;
  protected readonly temperature?: number;
  protected readonly topP?: number;

  constructor(
    provider: string,
    model: string,
    maxTokens?: number,
    temperature?: number,
    topP?: number
  ) {
    this.provider = provider;
    this.model = model;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.topP = topP;
  }

  abstract chat(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): Promise<LLMResponse>;

  abstract stream(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<string, void, unknown>;

  protected handleError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    throw new LLMError(`[${this.provider}] ${message}`, this.provider);
  }

  protected formatMessages(messages: LLMMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
      ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
    }));
  }

  protected formatTools(tools: ToolDefinition[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  getProvider(): string {
    return this.provider;
  }

  getModel(): string {
    return this.model;
  }
}