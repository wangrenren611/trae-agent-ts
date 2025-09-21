import Anthropic from '@anthropic-ai/sdk';
import { LLMClient } from './llm-client.js';
import { LLMMessage, LLMResponse, ToolDefinition, LLMError } from '../../types/index.js';

export class AnthropicClient extends LLMClient {
  private client: Anthropic;

  constructor(
    apiKey: string,
    model: string = 'claude-3-5-sonnet-20241022',
    maxTokens?: number,
    temperature?: number,
    topP?: number,
    baseURL?: string
  ) {
    super('anthropic', model, maxTokens, temperature, topP);

    this.client = new Anthropic({
      apiKey,
      baseURL,
    });
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    try {
      // Convert messages to Anthropic format
      const anthropicMessages = this.convertToAnthropicMessages(messages);

      // Prepare request
      const request: any = {
        model: this.model,
        max_tokens: this.maxTokens || 4096,
        messages: anthropicMessages,
      };

      if (this.temperature !== undefined) {
        request.temperature = this.temperature;
      }

      if (this.topP !== undefined) {
        request.top_p = this.topP;
      }

      if (tools && tools.length > 0) {
        request.tools = this.formatTools(tools);
      }

      // Make API call
      const response = await this.client.messages.create(request);

      // Extract content and tool calls
      const content = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('\n');

      const toolCalls = response.content
        .filter(block => block.type === 'tool_use')
        .map(block => ({
          id: block.id,
          type: 'function' as const,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        }));

      return {
        content,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: response.usage ? {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        } : undefined,
        model: this.model,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  async *stream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<string, void, unknown> {
    try {
      const anthropicMessages = this.convertToAnthropicMessages(messages);

      const request: any = {
        model: this.model,
        max_tokens: this.maxTokens || 4096,
        messages: anthropicMessages,
        stream: true,
      };

      if (this.temperature !== undefined) {
        request.temperature = this.temperature;
      }

      if (this.topP !== undefined) {
        request.top_p = this.topP;
      }

      if (tools && tools.length > 0) {
        request.tools = this.formatTools(tools);
      }

      const stream = await this.client.messages.stream(request);

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield chunk.delta.text;
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private convertToAnthropicMessages(messages: LLMMessage[]): any[] {
    const anthropicMessages: any[] = [];
    let currentMessage: any = null;

    for (const message of messages) {
      if (message.role === 'system') {
        // Anthropic uses system parameter, not system message
        continue;
      }

      if (message.role === 'tool') {
        // Convert tool result to Anthropic format
        const toolResult = {
          type: 'tool_result',
          tool_use_id: message.tool_call_id || '',
          content: message.content,
        };

        if (currentMessage && currentMessage.role === 'user') {
          currentMessage.content.push(toolResult);
        } else {
          currentMessage = {
            role: 'user',
            content: [toolResult],
          };
        }
      } else if (message.role === 'assistant' && message.tool_calls) {
        // Convert tool calls to Anthropic format
        const toolUses = message.tool_calls.map(call => ({
          type: 'tool_use',
          id: call.id,
          name: call.function.name,
          input: JSON.parse(call.function.arguments),
        }));

        if (currentMessage && currentMessage.role === 'assistant') {
          currentMessage.content.push(...toolUses);
        } else {
          anthropicMessages.push(currentMessage);
          currentMessage = {
            role: 'assistant',
            content: [...toolUses],
          };
        }
      } else {
        // Regular message
        if (currentMessage) {
          anthropicMessages.push(currentMessage);
        }

        currentMessage = {
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: [{ type: 'text', text: message.content }],
        };
      }
    }

    if (currentMessage) {
      anthropicMessages.push(currentMessage);
    }

    return anthropicMessages;
  }
}