import { ConfigManager } from '../dist/utils/config/config.js';
import { writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigManager', () => {
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    testDir = join(tmpdir(), `trae-config-test-${Date.now()}`);
    originalEnv = { ...process.env };
  });

  afterEach(async () => {
    process.env = originalEnv;
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should load default configuration', async () => {
    const configManager = await ConfigManager.create();
    const config = configManager.getConfig();

    expect(config.llm.provider).toBe('anthropic');
    expect(config.llm.model).toBe('claude-3-5-sonnet-20241022');
    expect(config.agent.max_steps).toBe(30);
    expect(config.agent.working_directory).toBe('.');
  });

  it('should override with environment variables', async () => {
    process.env.TRAELLM_PROVIDER = 'openai';
    process.env.TRAELLM_MODEL = 'gpt-4o';
    process.env.TRAE_MAX_STEPS = '50';

    const configManager = await ConfigManager.create();
    const config = configManager.getConfig();

    expect(config.llm.provider).toBe('openai');
    expect(config.llm.model).toBe('gpt-4o');
    expect(config.agent.max_steps).toBe(50);
  });

  it('should load configuration from file', async () => {
    const configContent = `
llm:
  provider: google
  model: gemini-1.5-flash
  api_key: test-key
agent:
  max_steps: 25
  working_directory: /tmp
logging:
  level: debug
`;

    const configPath = join(testDir, 'test_config.yaml');
    await writeFile(configPath, configContent, 'utf-8');

    const configManager = await ConfigManager.create(configPath);
    const config = configManager.getConfig();

    expect(config.llm.provider).toBe('google');
    expect(config.llm.model).toBe('gemini-1.5-flash');
    expect(config.llm.api_key).toBe('test-key');
    expect(config.agent.max_steps).toBe(25);
    expect(config.agent.working_directory).toBe('/tmp');
    expect(config.logging.level).toBe('debug');
  });

  it('should validate configuration', async () => {
    const invalidConfig = `
llm:
  provider: invalid-provider
agent:
  max_steps: "not-a-number"
`;

    const configPath = join(testDir, 'invalid_config.yaml');
    await writeFile(configPath, invalidConfig, 'utf-8');

    await expect(ConfigManager.create(configPath)).rejects.toThrow();
  });

  it('should generate example configuration', () => {
    const exampleConfig = ConfigManager.generateExampleConfig();

    expect(exampleConfig).toContain('provider: anthropic');
    expect(exampleConfig).toContain('model: claude-3-5-sonnet-20241022');
    expect(exampleConfig).toContain('max_steps: 30');
  });
});