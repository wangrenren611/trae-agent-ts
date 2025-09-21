import { Agent } from '../dist/agent/agent.js';
import { ConfigManager } from '../dist/utils/config/config.js';
import { Logger } from '../dist/utils/logging/logger.js';

describe('Agent', () => {
  let mockConfig: any;
  let mockLogger: any;

  beforeEach(() => {
    mockConfig = {
      llm: {
        provider: 'anthropic',
        model: 'kimi-k2-0905-preview',
        api_key: 'sk-Tia7TNkp976yLvpzC41VagzdjASXc4zRLFUKF0tWdDPHyX5k',
      },
      agent: {
        max_steps: 10,
        working_directory: '.',
        enable_docker: false,
        enable_trajectory_recording: false,
        tools: ['edit_tool', 'bash_tool'],
      },
      logging: {
        level: 'info',
        format: 'json',
      },
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn().mockReturnThis(),
    };

    jest.spyOn(Logger, 'create').mockReturnValue(mockLogger);
    jest.spyOn(ConfigManager, 'getInstance').mockResolvedValue({
      getConfig: () => mockConfig,
    } as any);
  });

  it('should create an agent successfully', async () => {
    const agent = await Agent.create({
      config: mockConfig,
      logger: mockLogger,
    });

    expect(agent).toBeDefined();
    expect(agent.getTrajectory).toBeDefined();
  });

  it('should validate configuration', async () => {
    const invalidConfig = { ...mockConfig, llm: { provider: 'invalid' } };

    await expect(Agent.create({ config: invalidConfig })).rejects.toThrow();
  });
});