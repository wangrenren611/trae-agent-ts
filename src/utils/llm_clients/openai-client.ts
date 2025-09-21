import OpenAI from 'openai';
import { LLMClient } from './llm-client.js';
import { LLMMessage, LLMResponse, ToolDefinition, LLMError } from '../../types/index.js';

export class OpenAIClient extends LLMClient {
  private client: OpenAI;

  constructor(
    apiKey: string,
    model: string = 'gpt-4o',
    maxTokens?: number,
    temperature?: number,
    topP?: number,
    baseURL?: string
  ) {
    super('openai', model, maxTokens, temperature, topP);

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    try {
      const request: any = {
        model: this.model,
        messages: this.formatMessages(messages),
      };

      if (this.maxTokens !== undefined) {
        request.max_tokens = this.maxTokens;
      }

      if (this.temperature !== undefined) {
        request.temperature = this.temperature;
      }

      if (this.topP !== undefined) {
        request.top_p = this.topP;
      }

      if (tools && tools.length > 0) {
        request.tools = this.formatTools(tools);
      }

      const response = await this.client.chat.completions.create(request);
      const choice = response.choices[0];

      if (!choice) {
        throw new Error('No response from OpenAI');
      }

      const content = choice.message.content || '';
      const toolCalls = choice.message.tool_calls?.map(call => ({
        id: call.id,
        type: 'function' as const,
        function: {
          name: call.function.name,
          arguments: call.function.arguments,
        },
      }));

      return {
        content,
        tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
        model: this.model,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  async *stream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<string, void, unknown> {
    try {
      const request: any = {
        model: this.model,
        messages: this.formatMessages(messages),
        stream: true,
      };

      if (this.maxTokens !== undefined) {
        request.max_tokens = this.maxTokens;
      }

      if (this.temperature !== undefined) {
        request.temperature = this.temperature;
      }

      if (this.topP !== undefined) {
        request.top_p = this.topP;
      }

      if (tools && tools.length > 0) {
        request.tools = this.formatTools(tools);
      }

      const stream = await this.client.chat.completions.create(request);

      // Handle the stream properly
      for await (const chunk of stream as any) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }
}