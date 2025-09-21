import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext } from '../types/index.js';

const execAsync = promisify(exec);

export class BashTool extends ToolExecutor {
  private logger?: Console;

  constructor() {
    super('bash_tool', {
      name: 'bash_tool',
      description: 'Execute shell commands with session management',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute',
          },
          timeout: {
            type: 'number',
            description: 'Command timeout in seconds (default: 30)',
            default: 30,
          },
          working_directory: {
            type: 'string',
            description: 'Working directory for the command',
          },
          environment: {
            type: 'object',
            description: 'Additional environment variables',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['command'],
      },
    });
    this.logger = console;
  }

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParams(params);

      const { command, timeout = 30, working_directory, environment } = params;
      const workingDir = working_directory || context.workingDirectory;

      // Merge environment variables
      const env: Record<string, string> = {
        ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]),
        ...context.environment,
        ...(environment as Record<string, string> || {}),
      };

      this.logger?.debug(`Executing command: ${command}`, { workingDir, timeout });

      // Use exec for simple commands, spawn for complex ones
      const isComplex = typeof command === 'string' &&
        (command.includes('&&') || command.includes('||') || command.includes(';'));

      if (isComplex) {
        return await this.executeComplex(command as string, workingDir as string, env, timeout as number);
      } else {
        return await this.executeSimple(command as string, workingDir as string, env, timeout as number);
      }
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async executeSimple(
    command: string,
    workingDir: string,
    env: Record<string, string>,
    timeout: number
  ): Promise<ToolResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        env,
        timeout: timeout * 1000,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return this.createSuccessResult({
        command,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exit_code: 0,
      });
    } catch (error) {
      const execError = error as any;
      return this.createErrorResult(
        `Command failed with exit code ${execError.code || 1}`,
        execError.stdout?.trim(),
        execError.stderr?.trim()
      );
    }
  }

  private async executeComplex(
    command: string,
    workingDir: string,
    env: Record<string, string>,
    timeout: number
  ): Promise<ToolResult> {
    return new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], {
        cwd: workingDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      // Set timeout
      const timeoutId = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout * 1000);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        if (killed) {
          resolve(this.createErrorResult(
            `Command timed out after ${timeout} seconds`,
            stdout.trim(),
            stderr.trim()
          ));
        } else if (code === 0) {
          resolve(this.createSuccessResult({
            command,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exit_code: 0,
          }));
        } else {
          resolve(this.createErrorResult(
            `Command failed with exit code ${code}`,
            stdout.trim(),
            stderr.trim()
          ));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve(this.createErrorResult(
          `Failed to spawn command: ${error.message}`,
          stdout.trim(),
          stderr.trim()
        ));
      });
    });
  }
}

// Register the tool
import { globalToolRegistry } from './base.js';
globalToolRegistry.register(new BashTool());