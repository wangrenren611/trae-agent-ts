import { LLMProvider } from '../../types/index.js';
import { LLMClient } from './llm-client.js';
import { AnthropicClient } from './anthropic-client.js';
import { OpenAIClient } from './openai-client.js';
import { GoogleClient } from './google-client.js';

export function createLLMClient(provider: LLMProvider): LLMClient {
  const {
    name,
    api_key,
    base_url,
    model,
    max_tokens,
    temperature,
    top_p,
  } = provider;

  if (!api_key) {
    throw new Error(`API key is required for ${name} provider`);
  }

  switch (name.toLowerCase()) {
    case 'anthropic':
      return new AnthropicClient(
        api_key,
        model || 'claude-3-5-sonnet-20241022',
        max_tokens,
        temperature,
        top_p,
        base_url
      );

    case 'openai':
      return new OpenAIClient(
        api_key,
        model || 'gpt-4o',
        max_tokens,
        temperature,
        top_p,
        base_url
      );

    case 'google':
      return new GoogleClient(
        api_key,
        model || 'gemini-1.5-flash',
        max_tokens,
        temperature,
        top_p
      );

    default:
      throw new Error(`Unsupported LLM provider: ${name}`);
  }
}

export { AnthropicClient, OpenAIClient, GoogleClient };