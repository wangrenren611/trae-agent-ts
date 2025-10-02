import { randomUUID } from 'crypto';
import { TraeAgent } from './trae-agent.js';
import { Logger } from '../utils/logging/logger.js';
import { createLLMClient } from '../utils/llm_clients/factory.js';
import { createTools } from '../tools/factory.js';
import { ConfigSchema, Config } from '../types/index.js';

export interface AgentOptions {
  agentId?: string;
  config: Config | string | Record<string, unknown>;
  workingDirectory?: string;
  logger?: Logger;
}

export class Agent {
  static async create(options: AgentOptions): Promise<TraeAgent> {
    // Load and validate configuration
    const config = await this.loadConfig(options.config);

    // Create logger
    const logger = options.logger || Logger.create(config.logging);

    // Create LLM client
    const llmClient = createLLMClient({
      provider: config.llm.provider,
      api_key: config.llm.api_key,
      base_url: config.llm.base_url,
      model: config.llm.model,
      max_tokens: config.llm.max_tokens,
      temperature: config.llm.temperature,
      top_p: config.llm.top_p,
    });

    // Create tools
    const tools = await createTools(config, logger);

    // Generate agent ID
    const agentId = options.agentId || randomUUID();

    // Set working directory
    const workingDirectory = options.workingDirectory || config.agent.working_directory;

    logger.info(`Creating TraeAgent with ID: ${agentId}`);

    return new TraeAgent(
      agentId,
      llmClient,
      tools,
      config,
      logger,
      workingDirectory
    );
  }

  private static async loadConfig(configInput: Config | string | Record<string, unknown>): Promise<Config> {
    if (typeof configInput === 'string') {
      // Load from file
      const { readFile } = await import('fs/promises');
      const yaml = await import('js-yaml');
      const configContent = await readFile(configInput, 'utf-8');
      const parsedConfig = yaml.load(configContent) as Record<string, unknown>;
      return ConfigSchema.parse(parsedConfig);
    } else if (typeof configInput === 'object' && configInput !== null) {
      // Direct config object
      return ConfigSchema.parse(configInput);
    } else {
      // Already a Config object
      return configInput as Config;
    }
  }
}