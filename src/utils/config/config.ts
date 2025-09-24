import { readFile, access } from 'fs/promises';
import { resolve, join } from 'path';
import yaml from 'js-yaml';
import { Config, ConfigSchema, DeepPartial } from '../../types/index.js';

export { Config };

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor(config: Config) {
    this.config = config;
  }

  static async create(configPath?: string): Promise<ConfigManager> {
    const config = await ConfigManager.loadConfig(configPath);
    return new ConfigManager(config);
  }

  static async getInstance(configPath?: string): Promise<ConfigManager> {
    if (!ConfigManager.instance) {
      ConfigManager.instance = await ConfigManager.create(configPath);
    }
    return ConfigManager.instance;
  }

  getConfig(): Config {
    return this.config;
  }

  updateConfig(updates: DeepPartial<Config>): void {
    this.config = ConfigSchema.parse({
      ...this.config,
      ...updates,
      llm: {
        ...this.config.llm,
        ...updates.llm,
      },
      agent: {
        ...this.config.agent,
        ...updates.agent,
      },
    });
  }

  private static async loadConfig(configPath?: string): Promise<Config> {
    // Try to find config file if path not provided
    if (!configPath) {
      configPath = await ConfigManager.findConfigFile();
    }
    console.log(`Using config file ${configPath}`);
    let configData: DeepPartial<Config> = {};

    // Load from file if it exists
    if (configPath) {
      try {
        const configContent = await readFile(configPath, 'utf-8');
        const parsed = yaml.load(configContent) as DeepPartial<Config>;
        configData = { ...configData, ...parsed };
      } catch (error) {
        console.warn(`Failed to load config file ${configPath}:`, error);
      }
    }

    // Override with environment variables
    configData = ConfigManager.applyEnvironmentOverrides(configData);

    // Merge with defaults
    const defaultConfig: Config = {
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
      },
      agent: {
        max_steps: 30,
        working_directory: '.',
        enable_docker: false,
        enable_trajectory_recording: true,
        tools: ['edit_tool', 'bash_tool', 'json_edit_tool', 'sequential_thinking_tool', 'task_done_tool'],
      },
      logging: {
        level: 'info',
        format: 'json',
      },
    };

    const mergedConfig = ConfigManager.deepMerge(defaultConfig, configData);
    return ConfigSchema.parse(mergedConfig);
  }

  private static async findConfigFile(): Promise<string | undefined> {
    const possiblePaths = [
      'trae_config.yaml',
      'trae_config.yml',
      '.trae_config.yaml',
      '.trae_config.yml',
      join(process.cwd(), 'trae_config.yaml'),
      join(process.cwd(), 'trae_config.yml'),
      join(process.cwd(), '.trae_config.yaml'),
      join(process.cwd(), '.trae_config.yml'),
      join(process.env.HOME || '', '.trae', 'trae_config.yaml'),
      join(process.env.HOME || '', '.trae', 'trae_config.yml'),
    ];

    for (const path of possiblePaths) {
      try {
        await access(path);
        return resolve(path);
      } catch {
        // File doesn't exist, continue
      }
    }

    return undefined;
  }

  private static applyEnvironmentOverrides(config: DeepPartial<Config>): DeepPartial<Config> {
    const overrides: DeepPartial<Config> = { ...config };

    // LLM configuration
    if (process.env.TRAELLM_PROVIDER) {
      overrides.llm = { ...overrides.llm, provider: process.env.TRAELLM_PROVIDER };
    }
    if (process.env.TRAELLM_MODEL) {
      overrides.llm = { ...overrides.llm, model: process.env.TRAELLM_MODEL };
    }
    if (process.env.TRAELLM_API_KEY) {
      overrides.llm = { ...overrides.llm, api_key: process.env.TRAELLM_API_KEY };
    }
    if (process.env.TRAELLM_BASE_URL) {
      overrides.llm = { ...overrides.llm, base_url: process.env.TRAELLM_BASE_URL };
    }
    if (process.env.TRAELLM_MAX_TOKENS) {
      overrides.llm = { ...overrides.llm, max_tokens: parseInt(process.env.TRAELLM_MAX_TOKENS, 10) };
    }
    if (process.env.TRAELLM_TEMPERATURE) {
      overrides.llm = { ...overrides.llm, temperature: parseFloat(process.env.TRAELLM_TEMPERATURE) };
    }
    if (process.env.TRAELLM_TOP_P) {
      overrides.llm = { ...overrides.llm, top_p: parseFloat(process.env.TRAELLM_TOP_P) };
    }

    // Agent configuration
    if (process.env.TRAE_MAX_STEPS) {
      overrides.agent = { ...overrides.agent, max_steps: parseInt(process.env.TRAE_MAX_STEPS, 10) };
    }
    if (process.env.TRAE_WORKING_DIRECTORY) {
      overrides.agent = { ...overrides.agent, working_directory: process.env.TRAE_WORKING_DIRECTORY };
    }
    if (process.env.TRAE_ENABLE_DOCKER) {
      overrides.agent = { ...overrides.agent, enable_docker: process.env.TRAE_ENABLE_DOCKER === 'true' };
    }
    if (process.env.TRAE_ENABLE_TRAJECTORY_RECORDING) {
      overrides.agent = { ...overrides.agent, enable_trajectory_recording: process.env.TRAE_ENABLE_TRAJECTORY_RECORDING === 'true' };
    }

    // Logging configuration
    if (process.env.TRAE_LOG_LEVEL) {
      overrides.logging = { ...overrides.logging, level: process.env.TRAE_LOG_LEVEL as any };
    }
    if (process.env.TRAE_LOG_FILE) {
      overrides.logging = { ...overrides.logging, file: process.env.TRAE_LOG_FILE };
    }
    if (process.env.TRAE_LOG_FORMAT) {
      overrides.logging = { ...overrides.logging, format: process.env.TRAE_LOG_FORMAT as any };
    }

    return overrides;
  }

  private static deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] === null || source[key] === undefined) {
        continue;
      }

      if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  static generateExampleConfig(): string {
    const exampleConfig = {
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        api_key: '${ANTHROPIC_API_KEY}',
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 0.9,
      },
      agent: {
        max_steps: 30,
        working_directory: '.',
        enable_docker: false,
        enable_trajectory_recording: true,
        tools: [
          'edit_tool',
          'bash_tool',
          'json_edit_tool',
          'sequential_thinking_tool',
          'task_done_tool',
        ],
      },
      docker: {
        image: 'node:18-alpine',
        volumes: ['./workspace:/workspace'],
        environment: {
          NODE_ENV: 'development',
        },
      },
      mcp: {
        servers: [
          {
            name: 'example-server',
            command: 'node',
            args: ['server.js'],
            env: {
              PORT: '3000',
            },
          },
        ],
      },
      logging: {
        level: 'info',
        file: 'trae_agent.log',
        format: 'json',
      },
    };

    return yaml.dump(exampleConfig, { indent: 2 });
  }
}

