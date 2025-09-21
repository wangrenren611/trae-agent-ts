#!/usr/bin/env node

import { Command } from 'commander';
// Simple color functions to avoid chalk ESM issues
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
};

// Simple spinner implementation
class SimpleSpinner {
  text: string;
  private interval: NodeJS.Timeout | null = null;

  constructor(text: string) {
    this.text = text;
  }

  start() {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    process.stdout.write(`\r${frames[i]} ${this.text}`);
    this.interval = setInterval(() => {
      i = (i + 1) % frames.length;
      process.stdout.write(`\r${frames[i]} ${this.text}`);
    }, 100);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r\x1b[K'); // Clear the line
  }

  updateText(text: string) {
    this.text = text;
  }
}

function ora(text: string) {
  return new SimpleSpinner(text);
}
import { Agent } from './agent/agent.js';
import { ConfigManager } from './utils/config/config.js';
import { Logger } from './utils/logging/logger.js';
import { TrajectoryRecorder, Lakeview } from './utils/trajectory/recorder.js';
import { ConfigManager as ConfigManagerType } from './utils/config/config.js';

const program = new Command();

program
  .name('trae-agent')
  .description('Trae Agent - AI-powered software engineering assistant')
  .version('1.0.0');

program
  .command('run')
  .description('Run the agent with a specific task')
  .argument('<task>', 'The task to execute')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-d, --working-dir <path>', 'Working directory')
  .option('-m, --max-steps <number>', 'Maximum number of steps', '30')
  .option('--no-trajectory', 'Disable trajectory recording')
  .option('--docker', 'Enable Docker support')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (task, options) => {
    const spinner = ora('Initializing Trae Agent...');
    spinner.start();

    try {
      // Load configuration
      const configManager = await ConfigManager.getInstance(options.config);
      const config = configManager.getConfig();

      // Override config with CLI options
      if (options.workingDir) {
        config.agent.working_directory = options.workingDir;
      }
      if (options.docker) {
        config.agent.enable_docker = true;
      }
      if (options.maxSteps) {
        config.agent.max_steps = parseInt(options.maxSteps, 10);
      }
      if (options.trajectory === false) {
        config.agent.enable_trajectory_recording = false;
      }

      // Create logger
      const logger = Logger.create({
        level: options.verbose ? 'debug' : config.logging?.level,
        format: 'pretty',
      });

      spinner.text = 'Creating agent...';

      // Create agent
      const agent = await Agent.create({
        config,
        workingDirectory: config.agent.working_directory,
        logger,
      });

      spinner.text = 'Executing task...';

      // Execute task
      const trajectory = await agent.execute(task, config.agent.max_steps);

      spinner.stop();

      // Display results
      console.log(colors.green('\n✅ Task execution completed!\n'));

      const lakeview = new Lakeview(logger);
      const summary = lakeview.formatForDisplay(trajectory);
      console.log(summary);

      // Record trajectory if enabled
      if (config.agent.enable_trajectory_recording) {
        const recorder = new TrajectoryRecorder(config, logger);
        const trajectoryPath = await recorder.recordTrajectory(trajectory);
        if (trajectoryPath) {
          console.log(colors.blue(`\n📊 Trajectory recorded to: ${trajectoryPath}`));
        }
      }

      // Exit with appropriate code
      process.exit(trajectory.success ? 0 : 1);
    } catch (error) {
      spinner.stop();
      console.error(colors.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Configuration management commands')
  .addCommand(
    new Command('generate')
      .description('Generate a sample configuration file')
      .option('-o, --output <path>', 'Output file path', 'trae_config.yaml')
      .action(async (options) => {
        try {
          const { writeFile } = await import('fs/promises');
          const configContent = ConfigManager.generateExampleConfig();
          await writeFile(options.output, configContent, 'utf-8');
          console.log(colors.green(`✅ Configuration file generated: ${options.output}`));
        } catch (error) {
          console.error(colors.red('❌ Failed to generate config:'), error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('validate')
      .description('Validate configuration file')
      .argument('<config-path>', 'Configuration file path')
      .action(async (configPath) => {
        try {
          await ConfigManager.create(configPath);
          console.log(colors.green('✅ Configuration is valid'));
        } catch (error) {
          console.error(colors.red('❌ Invalid configuration:'), error);
          process.exit(1);
        }
      })
  );

program
  .command('tools')
  .description('Tool management commands')
  .addCommand(
    new Command('list')
      .description('List available tools')
      .action(async () => {
        try {
          const configManager = await ConfigManager.getInstance();
          const config = configManager.getConfig();
          const logger = Logger.create(config.logging);

          // Create a minimal agent to get tool list
          const agent = await Agent.create({
            config,
            logger,
          });

          // This would need to be implemented in the agent
          console.log(colors.blue('Available tools:'));
          console.log('• edit_tool - View, create, and edit files');
          console.log('• bash_tool - Execute shell commands');
          console.log('• json_edit_tool - Manipulate JSON files');
          console.log('• sequential_thinking_tool - Structured thinking process');
          console.log('• task_done_tool - Signal task completion');
          console.log('• ckg_tool - Code Knowledge Graph operations');
        } catch (error) {
          console.error(colors.red('❌ Failed to list tools:'), error);
          process.exit(1);
        }
      })
  );

program
  .command('interactive')
  .description('Start interactive mode')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-d, --working-dir <path>', 'Working directory')
  .action(async (options) => {
    console.log(colors.blue('🚀 Starting Trae Agent in interactive mode...'));
    console.log(colors.gray('Type your tasks and press Enter. Type "exit" to quit.\n'));

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: colors.cyan('trae-agent> '),
    });

    let configManager: ConfigManagerType;
    let logger: Logger;
    let agent: any;

    try {
      configManager = await ConfigManager.getInstance(options.config);
      const config = configManager.getConfig();
      logger = Logger.create(config.logging);

      agent = await Agent.create({
        config,
        workingDirectory: options.workingDir || config.agent.working_directory,
        logger,
      });

      rl.prompt();

      rl.on('line', async (input) => {
        const task = input.trim();

        if (task.toLowerCase() === 'exit') {
          rl.close();
          return;
        }

        if (!task) {
          rl.prompt();
          return;
        }

        try {
          console.log(colors.yellow('\n🤔 Thinking...'));

          const trajectory = await agent.execute(task, config.agent.max_steps);

          const lakeview = new Lakeview(logger);
          const summary = lakeview.generateSummary(trajectory);

          console.log(colors.green('\n✅ Task completed!'));
          console.log(summary);

          if (trajectory.success) {
            console.log(colors.green('\n🎉 Task completed successfully!'));
          } else {
            console.log(colors.red('\n❌ Task failed.'));
          }

        } catch (error) {
          console.error(colors.red('❌ Error:'), error instanceof Error ? error.message : String(error));
        }

        rl.prompt();
      });

      rl.on('close', () => {
        console.log(colors.blue('\n👋 Goodbye!'));
        process.exit(0);
      });

    } catch (error) {
      console.error(colors.red('❌ Failed to start interactive mode:'), error);
      process.exit(1);
    }
  });

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(colors.red('❌ Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(colors.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();