import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMClient } from './llm-client.js';
import { LLMMessage, LLMResponse, ToolDefinition, LLMError } from '../../types/index.js';

export class GoogleClient extends LLMClient {
  private genAI: GoogleGenerativeAI;
  private geminiModel: any;

  constructor(
    apiKey: string,
    model: string = 'gemini-1.5-flash',
    maxTokens?: number,
    temperature?: number,
    topP?: number
  ) {
    super('google', model, maxTokens, temperature, topP);

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.geminiModel = this.genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        maxOutputTokens: this.maxTokens,
        temperature: this.temperature,
        topP: this.topP,
      },
    });
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    try {
      // Convert messages to Google format
      const googleMessages = this.convertToGoogleMessages(messages);

      // Prepare request
      const request: any = {
        contents: googleMessages,
      };

      if (tools && tools.length > 0) {
        request.tools = this.formatTools(tools);
      }

      // Make API call
      const result = await this.geminiModel.generateContent(request);
      const response = await result.response;

      // Extract content and function calls
      const content = response.text() || '';
      const functionCalls = response.functionCalls();

      const toolCalls = functionCalls?.map((call: any) => ({
        id: call.name,
        type: 'function' as const,
        function: {
          name: call.name,
          arguments: JSON.stringify(call.args),
        },
      }));

      return {
        content,
        tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        usage: result.response.usageMetadata ? {
          prompt_tokens: result.response.usageMetadata.promptTokenCount || 0,
          completion_tokens: result.response.usageMetadata.candidatesTokenCount || 0,
          total_tokens: result.response.usageMetadata.totalTokenCount || 0,
        } : undefined,
        model: this.getModel(),
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  override async *stream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<string, void, unknown> {
    try {
      const googleMessages = this.convertToGoogleMessages(messages);
      const request: any = {
        contents: googleMessages,
      };

      if (tools && tools.length > 0) {
        request.tools = this.formatTools(tools);
      }

      const result = await this.geminiModel.generateContentStream(request);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private convertToGoogleMessages(messages: LLMMessage[]): any[] {
    const googleMessages: any[] = [];
    let currentContent: any[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Google uses systemInstruction parameter, not system message
        continue;
      }

      if (message.role === 'tool') {
        // Convert tool result to Google format
        currentContent.push({
          functionResponse: {
            name: message.tool_call_id || '',
            response: { result: message.content },
          },
        });
      } else if (message.role === 'assistant' && message.tool_calls) {
        // Convert tool calls to Google format
        const functionCalls = message.tool_calls.map(call => ({
          functionCall: {
            name: call.function.name,
            args: JSON.parse(call.function.arguments),
          },
        }));

        if (message.content) {
          currentContent.push({ text: message.content });
        }
        currentContent.push(...functionCalls);

        googleMessages.push({
          role: 'model',
          parts: currentContent,
        });
        currentContent = [];
      } else {
        if (currentContent.length > 0) {
          googleMessages.push({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: currentContent,
          });
          currentContent = [];
        }

        currentContent.push({ text: message.content });
      }
    }

    if (currentContent.length > 0) {
      googleMessages.push({
        role: 'user',
        parts: currentContent,
      });
    }

    return googleMessages;
  }

  protected override formatTools(tools: ToolDefinition[]): any[] {
    return tools.map(tool => ({
      functionDeclarations: [{
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }],
    }));
  }
}