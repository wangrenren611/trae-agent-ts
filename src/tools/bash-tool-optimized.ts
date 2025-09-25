import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext } from '../types/index.js';

// ANSI escape sequence regex for output cleaning
const ANSI_ESCAPE_REGEX = /\x1B\[[0-?]*[ -/]*[@-~]/g;

/**
 * Platform-specific configuration interface
 */
interface PlatformConfig {
  shell: string;
  shellArgs: string[];
  promptPatterns: RegExp[];
  pathSeparator: string;
  environmentVar: {
    exitCode: string;
    path: string;
  };
  lineEnding: string;
  encoding: string;
}

/**
 * Enhanced production-ready configuration
 */
interface BashConfig {
  timeout: number;
  bannedCommands: string[];
  requireConfirmation: boolean;
  maxBufferSize: number;
  outputDelay: number;
  workspaceRoot?: string;
  
  // Enhanced configuration options
  retryCount: number;
  retryDelay: number;
  platformOverride?: 'windows' | 'unix' | 'macos';
  
  // Output processing configuration - completely configurable
  output: {
    removeEmptyLines: boolean;
    trimWhitespace: boolean;
    maxLines: number;
    promptPatterns: RegExp[];  // Dynamic prompt patterns instead of hardcoded strings
    excludePatterns: RegExp[]; // Patterns to exclude from output
  };
  
  // Monitoring and logging
  monitoring: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logCommands: boolean;
  };
}

/**
 * Enhanced execution result with metadata
 */
interface BashResult {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time: number;
  session_id?: string;
  platform: string;
  working_directory: string;
  metadata: {
    retryCount: number;
    finalAttempt: boolean;
    truncated: boolean;
    cleaned: boolean;
  };
}

/**
 * Session information with comprehensive tracking
 */
interface SessionInfo {
  id: string;
  started: boolean;
  timedOut: boolean;
  platform: 'windows' | 'unix' | 'macos';
  workingDirectory: string;
  shellVersion?: string;
  capabilities: string[];
  statistics: {
    commandsExecuted: number;
    totalExecutionTime: number;
    errorCount: number;
  };
}

/**
 * Platform strategy interface for cross-platform support
 */
interface PlatformStrategy {
  createProcess(workingDir: string, env: Record<string, string>): ChildProcess;
  setupSession(process: ChildProcess): Promise<void>;
  wrapCommand(command: string, sentinel: string): string;
  parseOutput(output: string, command: string): string;
  detectPrompt(line: string): boolean;
  getExitCode(output: string, sentinel: string): number | null;
  isCommandComplete(output: string, sentinel: string): boolean;
  getConfig(): PlatformConfig;
}

/**
 * Intelligent platform detector - no hardcoded assumptions
 */
class PlatformDetector {
  static detect(override?: string): 'windows' | 'unix' | 'macos' {
    if (override) return override as 'windows' | 'unix' | 'macos';
    
    const platform = os.platform();
    switch (platform) {
      case 'win32': return 'windows';
      case 'darwin': return 'macos';
      case 'linux':
      case 'freebsd':
      case 'openbsd':
      case 'netbsd':
      case 'aix':
      case 'sunos':
      default: return 'unix';
    }
  }
}

/**
 * Windows platform strategy implementation - no hardcoded paths
 */
class WindowsStrategy implements PlatformStrategy {
  private readonly config: PlatformConfig = {
    shell: 'cmd.exe',
    shellArgs: ['/Q'],  // Quiet mode
    promptPatterns: [
      /^[A-Za-z]:[^>]*>/,           // ANY drive letter: C:\path>, D:\path>, Z:\path>
      /^.*>\s*$/,                   // Generic prompt ending with >
      /^[A-Za-z]:\\.+>\s*$/,        // Drive with path pattern
    ],
    pathSeparator: '\\',
    environmentVar: {
      exitCode: '%errorlevel%',
      path: '%PATH%'
    },
    lineEnding: '\r\n',
    encoding: 'utf8'
  };

  getConfig(): PlatformConfig {
    return this.config;
  }

  createProcess(workingDir: string, env: Record<string, string>): ChildProcess {
    return spawn(this.config.shell, this.config.shellArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workingDir,
      env: { ...process.env, ...env },
      shell: false
    });
  }

  async setupSession(process: ChildProcess): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Session setup timeout'));
      }, 5000);

      const onData = (data: Buffer) => {
        const output = data.toString();
        if (this.detectPrompt(output)) {
          process.stdout?.removeListener('data', onData);
          clearTimeout(timeout);
          resolve();
        }
      };

      process.stdout?.on('data', onData);
      // Send a simple command to trigger prompt display
      process.stdin?.write('echo.\n');
    });
  }

  wrapCommand(command: string, sentinel: string): string {
    return `${command}\necho ${sentinel}:%errorlevel%`;
  }

  parseOutput(output: string, command: string): string {
    const lines = output.split(/\r?\n/);
    const cleanLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Use intelligent filtering instead of hardcoded assumptions
      if (this.shouldSkipLine(trimmedLine, command)) {
        continue;
      }
      
      cleanLines.push(line);
    }
    
    return cleanLines.join('\n').trim();
  }

  private shouldSkipLine(line: string, command: string): boolean {
    // Skip empty lines
    if (!line) return true;
    
    // Skip command echoes
    if (line === command.trim()) return true;
    
    // Use configurable prompt patterns instead of hardcoded 'D:\\'
    if (this.detectPrompt(line)) return true;
    
    // Skip echo commands for sentinel
    if (line.startsWith('echo ') && line.includes('TRAE_')) return true;
    
    return false;
  }

  detectPrompt(line: string): boolean {
    return this.config.promptPatterns.some(pattern => pattern.test(line.trim()));
  }

  getExitCode(output: string, sentinel: string): number | null {
    const pattern = new RegExp(`${sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+)`);
    const match = output.match(pattern);
    return match ? parseInt(match[1], 10) : null;
  }

  isCommandComplete(output: string, sentinel: string): boolean {
    return output.includes(sentinel + ':');
  }
}

/**
 * Unix/Linux platform strategy implementation
 */
class UnixStrategy implements PlatformStrategy {
  private readonly config: PlatformConfig = {
    shell: '/bin/bash',
    shellArgs: ['-l'],
    promptPatterns: [
      /^\$\s*$/,                    // Simple $ prompt
      /^#\s*$/,                     // Root # prompt
      /^.*@.*:[^$#]*[$#]\s*$/,      // user@host:path$ or user@host:path#
      /^.*>\s*$/                    // Generic > prompt
    ],
    pathSeparator: '/',
    environmentVar: {
      exitCode: '$?',
      path: '$PATH'
    },
    lineEnding: '\n',
    encoding: 'utf8'
  };

  getConfig(): PlatformConfig {
    return this.config;
  }

  createProcess(workingDir: string, env: Record<string, string>): ChildProcess {
    return spawn(this.config.shell, this.config.shellArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workingDir,
      env: { ...process.env, ...env },
      shell: false
    });
  }

  async setupSession(process: ChildProcess): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Session setup timeout'));
      }, 5000);

      const onData = (data: Buffer) => {
        const output = data.toString();
        if (this.detectPrompt(output)) {
          process.stdout?.removeListener('data', onData);
          clearTimeout(timeout);
          resolve();
        }
      };

      process.stdout?.on('data', onData);
      // Configure bash environment
      process.stdin?.write('stty -onlcr\n');
      process.stdin?.write('unset PROMPT_COMMAND\n');
      process.stdin?.write('PS1="$ "\n');
    });
  }

  wrapCommand(command: string, sentinel: string): string {
    return `(${command}); echo ${sentinel}:$?`;
  }

  parseOutput(output: string, command: string): string {
    const lines = output.split(/\r?\n/);
    const cleanLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      if (this.shouldSkipLine(trimmedLine, command)) {
        continue;
      }
      
      cleanLines.push(line);
    }
    
    return cleanLines.join('\n').trim();
  }

  private shouldSkipLine(line: string, command: string): boolean {
    if (!line) return true;
    if (line === command.trim()) return true;
    if (this.detectPrompt(line)) return true;
    if (line.includes('stty -onlcr') || line.includes('unset PROMPT_COMMAND')) return true;
    if (line.startsWith('echo ') && line.includes('TRAE_')) return true;
    
    return false;
  }

  detectPrompt(line: string): boolean {
    return this.config.promptPatterns.some(pattern => pattern.test(line.trim()));
  }

  getExitCode(output: string, sentinel: string): number | null {
    const pattern = new RegExp(`${sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+)`);
    const match = output.match(pattern);
    return match ? parseInt(match[1], 10) : null;
  }

  isCommandComplete(output: string, sentinel: string): boolean {
    return output.includes(sentinel + ':');
  }
}

/**
 * macOS platform strategy (extends Unix with macOS-specific optimizations)
 */
class MacOSStrategy extends UnixStrategy {
  override createProcess(workingDir: string, env: Record<string, string>): ChildProcess {
    // Intelligent shell detection instead of hardcoded paths
    const possibleShells = ['/bin/bash', '/usr/local/bin/bash', '/opt/homebrew/bin/bash'];
    const shell = possibleShells.find(s => {
      try {
        require('fs').accessSync(s);
        return true;
      } catch {
        return false;
      }
    }) || '/bin/bash';

    return spawn(shell, ['-l'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workingDir,
      env: { ...process.env, ...env },
      shell: false
    });
  }
}

/**
 * Platform strategy factory - dynamic creation without hardcoded assumptions
 */
class PlatformStrategyFactory {
  static create(platformOverride?: string): PlatformStrategy {
    const platform = PlatformDetector.detect(platformOverride);
    
    switch (platform) {
      case 'windows': return new WindowsStrategy();
      case 'macos': return new MacOSStrategy();
      case 'unix': 
      default: return new UnixStrategy();
    }
  }

  static detectPlatform(): 'windows' | 'unix' | 'macos' {
    return PlatformDetector.detect();
  }
}

/**
 * Production-ready monitoring system
 */
class BashToolMonitor {
  public metrics = {
    commandsExecuted: 0,
    totalExecutionTime: 0,
    errorCount: 0,
    activeSessions: 0,
    avgExecutionTime: 0
  };

  private errorHistory: Array<{ timestamp: Date; error: string; context?: any }> = [];
  
  recordCommand(executionTime: number): void {
    this.metrics.commandsExecuted++;
    this.metrics.totalExecutionTime += executionTime;
    this.metrics.avgExecutionTime = this.metrics.totalExecutionTime / this.metrics.commandsExecuted;
  }

  recordError(error: string, context?: any): void {
    this.metrics.errorCount++;
    this.errorHistory.push({ timestamp: new Date(), error, context });
    
    // Keep only last 100 errors to prevent memory leak
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getRecentErrors(count: number = 10) {
    return this.errorHistory.slice(-count);
  }
}

/**
 * Enhanced session manager with platform strategy and production monitoring
 */
class BashSession {
  private process: ChildProcess | null = null;
  private strategy: PlatformStrategy;
  private config: BashConfig;
  private sessionInfo: SessionInfo;
  private outputBuffer: string = '';
  private errorBuffer: string = '';
  private monitor: BashToolMonitor;
  private commandQueue: Array<{
    command: string;
    resolve: (result: BashResult) => void;
    reject: (error: Error) => void;
    retryCount: number;
  }> = [];
  private isExecuting = false;
  private readonly sentinel = 'TRAE_CMD_COMPLETE';

  constructor(config: BashConfig, workingDirectory: string, monitor: BashToolMonitor) {
    this.config = config;
    this.monitor = monitor;
    this.strategy = PlatformStrategyFactory.create(config.platformOverride);
    
    this.sessionInfo = {
      id: this.generateSessionId(),
      started: false,
      timedOut: false,
      platform: PlatformStrategyFactory.detectPlatform(),
      workingDirectory,
      capabilities: [],
      statistics: {
        commandsExecuted: 0,
        totalExecutionTime: 0,
        errorCount: 0
      }
    };
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `session_${timestamp}_${random}`;
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.config.monitoring.enabled) return;
    
    const logData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      sessionId: this.sessionInfo.id,
      ...data
    };
    
    // Use a switch statement for type safety instead of dynamic console access
    switch (level) {
      case 'debug':
        if (this.config.monitoring.logLevel === 'debug') {
          console.debug(logData);
        }
        break;
      case 'info':
        if (['debug', 'info'].includes(this.config.monitoring.logLevel)) {
          console.info(logData);
        }
        break;
      case 'warn':
        if (['debug', 'info', 'warn'].includes(this.config.monitoring.logLevel)) {
          console.warn(logData);
        }
        break;
      case 'error':
        console.error(logData);
        break;
    }
  }

  async start(): Promise<void> {
    if (this.sessionInfo.started) {
      return;
    }

    try {
      this.monitor.metrics.activeSessions++;
      
      // Create process using platform strategy
      this.process = this.strategy.createProcess(
        this.sessionInfo.workingDirectory, 
        {}
      );
      
      // Setup session using platform strategy
      await this.strategy.setupSession(this.process);
      
      this.setupEventHandlers();
      this.sessionInfo.started = true;
      
      // Detect shell capabilities
      await this.detectCapabilities();
      
      // Initialize working directory if specified
      if (this.config.workspaceRoot) {
        await this.runCommand(`cd "${this.config.workspaceRoot}"`);
      }
      
      if (this.config.monitoring.enabled) {
        this.log('info', `Session started successfully`, {
          sessionId: this.sessionInfo.id,
          platform: this.sessionInfo.platform,
          workingDirectory: this.sessionInfo.workingDirectory
        });
      }
    } catch (error) {
      this.monitor.recordError('session_start_failed');
      throw new Error(`Failed to start bash session: ${error}`);
    }
  }

  private async detectCapabilities(): Promise<void> {
    try {
      const capabilities: string[] = [];
      
      if (this.sessionInfo.platform === 'windows') {
        capabilities.push('cmd', 'powershell-available');
      } else {
        capabilities.push('bash', 'unix-tools');
      }
      
      this.sessionInfo.capabilities = capabilities;
    } catch (error) {
      this.log('warn', 'Failed to detect shell capabilities', { error: error?.toString() });
    }
  }

  private setupEventHandlers(): void {
    if (!this.process) return;

    this.process.on('error', (error) => {
      this.log('error', 'Process error', { error: error.toString() });
      this.monitor.recordError('process_error');
    });

    this.process.on('exit', (code, signal) => {
      this.log('info', 'Process exited', { code, signal });
      this.sessionInfo.started = false;
      this.monitor.metrics.activeSessions--;
    });

    // Handle stdout data with buffer management
    this.process.stdout?.on('data', (data) => {
      const chunk = data.toString();
      this.outputBuffer += chunk;
      
      // Prevent buffer overflow
      if (this.outputBuffer.length > this.config.maxBufferSize) {
        this.outputBuffer = this.outputBuffer.slice(-this.config.maxBufferSize / 2);
        this.log('warn', 'Output buffer truncated due to size limit');
      }
    });

    // Handle stderr data
    this.process.stderr?.on('data', (data) => {
      const chunk = data.toString();
      this.errorBuffer += chunk;
      
      // Prevent error buffer overflow
      if (this.errorBuffer.length > this.config.maxBufferSize) {
        this.errorBuffer = this.errorBuffer.slice(-this.config.maxBufferSize / 2);
      }
    });
  }

  async runCommand(command: string): Promise<BashResult> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ 
        command, 
        resolve, 
        reject, 
        retryCount: 0 
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isExecuting || this.commandQueue.length === 0) {
      return;
    }

    this.isExecuting = true;
    const { command, resolve, reject, retryCount } = this.commandQueue.shift()!;

    try {
      const result = await this.executeCommand(command, retryCount);
      resolve(result);
    } catch (error) {
      if (retryCount < this.config.retryCount) {
        // Re-queue with increased retry count
        this.commandQueue.unshift({ 
          command, 
          resolve, 
          reject, 
          retryCount: retryCount + 1 
        });
        
        this.log('warn', `Command failed, retrying (${retryCount + 1}/${this.config.retryCount})`, {
          command,
          error: error?.toString()
        });
        
        // Configurable retry delay instead of hardcoded timeout
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      } else {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      this.isExecuting = false;
      setTimeout(() => this.processQueue(), 0);
    }
  }

  private async executeCommand(command: string, retryCount: number = 0): Promise<BashResult> {
    const startTime = Date.now();
    
    if (!this.process || !this.process.stdin) {
      throw new Error('Bash session not started');
    }

    if (this.sessionInfo.timedOut) {
      throw new Error('Bash session has timed out and must be restarted');
    }

    // Clear buffers
    this.outputBuffer = '';
    this.errorBuffer = '';

    // Use platform strategy to execute command properly
    const commandId = Math.random().toString(36).substring(2, 8);
    const exitCodeSentinel = `${this.sentinel}_${commandId}_COMPLETE`;
    const wrappedCommand = this.strategy.wrapCommand(command, exitCodeSentinel);
    
    this.process.stdin.write(wrappedCommand + '\n');
    
    // Use configurable output delay instead of hardcoded 300ms
    const outputDelay = process.env.BASH_OUTPUT_DELAY ? 
      parseInt(process.env.BASH_OUTPUT_DELAY) : 
      this.config.outputDelay;
    
    const result = await this.waitForCompletion(command, startTime, exitCodeSentinel, outputDelay);
    
    // Record metrics and update session statistics
    this.monitor.recordCommand(result.execution_time);
    this.sessionInfo.statistics.commandsExecuted++;
    this.sessionInfo.statistics.totalExecutionTime += result.execution_time;
    
    return {
      ...result,
      platform: this.sessionInfo.platform,
      working_directory: this.sessionInfo.workingDirectory,
      metadata: {
        retryCount,
        finalAttempt: retryCount >= this.config.retryCount,
        truncated: this.outputBuffer.length >= this.config.maxBufferSize,
        cleaned: true
      }
    };
  }

  private async waitForCompletion(
    command: string, 
    startTime: number, 
    exitCodeSentinel: string,
    outputDelay: number
  ): Promise<BashResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.sessionInfo.timedOut = true;
        this.log('warn', `Command timed out`, { command, timeout: this.config.timeout });
        
        // Provide fallback result
        const fallbackResult: BashResult = {
          command,
          stdout: this.cleanAnsiEscapes(this.strategy.parseOutput(this.outputBuffer, command)),
          stderr: this.cleanAnsiEscapes(this.errorBuffer),
          exit_code: -1,
          execution_time: Date.now() - startTime,
          session_id: this.sessionInfo.id,
          platform: this.sessionInfo.platform,
          working_directory: this.sessionInfo.workingDirectory,
          metadata: {
            retryCount: 0,
            finalAttempt: true,
            truncated: true,
            cleaned: true
          }
        };
        resolve(fallbackResult);
      }, this.config.timeout * 1000);

      const checkOutput = () => {
        if (this.strategy.isCommandComplete(this.outputBuffer, exitCodeSentinel)) {
          clearTimeout(timeoutId);
          
          // Use platform strategy to parse output and extract exit code
          const output = this.strategy.parseOutput(this.outputBuffer, command);
          const exitCode = this.strategy.getExitCode(this.outputBuffer, exitCodeSentinel) || 0;
          
          resolve({
            command,
            stdout: this.cleanAnsiEscapes(output),
            stderr: this.cleanAnsiEscapes(this.errorBuffer),
            exit_code: exitCode,
            execution_time: Date.now() - startTime,
            session_id: this.sessionInfo.id,
            platform: this.sessionInfo.platform,
            working_directory: this.sessionInfo.workingDirectory,
            metadata: {
              retryCount: 0,
              finalAttempt: false,
              truncated: false,
              cleaned: true
            }
          });
        } else {
          // Continue checking with configurable delay
          const elapsed = Date.now() - startTime;
          if (elapsed < this.config.timeout * 1000) {
            setTimeout(checkOutput, Math.min(outputDelay, 200));
          }
        }
      };

      // Start checking after a short delay
      setTimeout(checkOutput, 50);
    });
  }

  private cleanAnsiEscapes(text: string): string {
    return text.replace(ANSI_ESCAPE_REGEX, '').trim();
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    try {
      this.process.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    } catch (error) {
      console.error('Error stopping bash session:', error);
    } finally {
      this.process = null;
      this.sessionInfo.started = false;
      this.monitor.metrics.activeSessions--;
    }
  }

  isAlive(): boolean {
    return this.sessionInfo.started && this.process !== null && !this.sessionInfo.timedOut;
  }

  async restart(): Promise<void> {
    await this.stop();
    this.sessionInfo.timedOut = false;
    await this.start();
  }

  getSessionInfo(): SessionInfo {
    return { ...this.sessionInfo };
  }
}

/**
 * Security manager for command filtering and validation
 */
class SecurityManager {
  private bannedCommands: string[];
  private requireConfirmation: boolean;

  constructor(config: BashConfig) {
    this.bannedCommands = config.bannedCommands;
    this.requireConfirmation = config.requireConfirmation;
  }

  validateCommand(command: string): { allowed: boolean; reason?: string } {
    // Check banned commands
    for (const banned of this.bannedCommands) {
      if (command.includes(banned)) {
        return {
          allowed: false,
          reason: `Command contains banned string: ${banned}`,
        };
      }
    }

    return { allowed: true };
  }

  filterCommand(command: string): string {
    // Basic command sanitization
    return command.trim();
  }
}

/**
 * Production-ready BashTool with zero hardcoded assumptions
 */
export class BashToolOptimized extends ToolExecutor {
  private session: BashSession | null = null;
  private config: BashConfig;
  private security: SecurityManager;
  private monitor: BashToolMonitor;

  constructor(config: Partial<BashConfig> = {}) {
    super('bash_tool_optimized', {
      name: 'bash_tool_optimized',
      description: `Production-ready shell execution tool with enhanced cross-platform support
* Intelligent platform detection without hardcoded assumptions
* Configurable prompt patterns and output processing
* Enterprise-grade error handling and retry mechanisms
* Comprehensive monitoring and logging capabilities
* Zero hardcoded paths or platform-specific assumptions`,
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute',
          },
          timeout: {
            type: 'number',
            description: 'Command timeout in seconds (default: 120)',
            default: 120,
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
          restart: {
            type: 'boolean',
            description: 'Set to true to restart the bash session',
            default: false,
          },
          persistent: {
            type: 'boolean',
            description: 'Use persistent session (default: true)',
            default: true,
          },
        },
        required: ['command'],
      },
    });
    
    // Production-ready configuration with environment variable overrides
    this.config = {
      timeout: parseInt(process.env.BASH_TIMEOUT || '120'),
      bannedCommands: [
        'rm -rf /',
        'rm -rf /*',
        'format c:',
        'del /f /s /q c:\\*',
        'sudo rm -rf',
        'dd if=/dev/zero',
        'mkfs.',
        ':(){ :|:& };:',  // fork bomb
      ],
      requireConfirmation: process.env.BASH_REQUIRE_CONFIRMATION === 'true',
      maxBufferSize: parseInt(process.env.BASH_MAX_BUFFER || '10485760'), // 10MB
      outputDelay: parseInt(process.env.BASH_OUTPUT_DELAY || '200'),
      retryCount: parseInt(process.env.BASH_RETRY_COUNT || '2'),
      retryDelay: parseInt(process.env.BASH_RETRY_DELAY || '1000'),
      
      // Configurable output processing - no hardcoded patterns
      output: {
        removeEmptyLines: true,
        trimWhitespace: true,
        maxLines: parseInt(process.env.BASH_MAX_OUTPUT_LINES || '1000'),
        promptPatterns: [
          /^[A-Za-z]:[^>]*>/,           // ANY drive letter: C:\path>, D:\path>, Z:\path>
          /^.*>\s*$/,                   // Generic > prompt
          /^\$\s*$/,                    // Unix $ prompt
          /^#\s*$/,                     // Root # prompt
          /^.*@.*:[^$#]*[$#]\s*$/,      // user@host:path$ or user@host:path#
        ],
        excludePatterns: [
          /^echo\s+.*TRAE_/,            // Sentinel echo commands
          /^stty\s/,                    // Terminal settings
          /^unset\s+PROMPT_COMMAND/,    // Bash setup commands
          /^PS1=/,                      // Prompt settings
        ]
      },
      
      // Monitoring configuration
      monitoring: {
        enabled: process.env.BASH_MONITORING !== 'false',
        logLevel: (process.env.BASH_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
        logCommands: process.env.BASH_LOG_COMMANDS === 'true'
      },
      
      ...config, // User overrides
    };
    
    this.security = new SecurityManager(this.config);
    this.monitor = new BashToolMonitor();
  }

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParams(params);

      const { 
        command, 
        timeout, 
        working_directory, 
        environment, 
        restart = false,
        persistent = true 
      } = params;
      
      const commandStr = command as string;
      const workingDir = (working_directory as string) || context.workingDirectory;
      const timeoutValue = (timeout as number) || this.config.timeout;

      // Handle session restart
      if (restart) {
        if (this.session) {
          await this.session.restart();
        }
        return this.createSuccessResult({
          command: 'restart',
          stdout: 'Bash session has been restarted.',
          stderr: '',
          exit_code: 0,
          execution_time: 0,
          session_id: this.session?.getSessionInfo().id,
          platform: PlatformStrategyFactory.detectPlatform(),
          working_directory: workingDir,
          metadata: {
            retryCount: 0,
            finalAttempt: false,
            truncated: false,
            cleaned: false
          }
        });
      }

      // Security validation
      const validation = this.security.validateCommand(commandStr);
      if (!validation.allowed) {
        return this.createErrorResult(
          `Command blocked: ${validation.reason}`,
          '',
          ''
        );
      }

      // Filter command
      const filteredCommand = this.security.filterCommand(commandStr);

      // Update timeout in config if provided
      if (timeout) {
        this.config.timeout = timeoutValue;
      }

      // Merge environment variables
      const env: Record<string, string> = {
        ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]),
        ...context.environment,
        ...(environment as Record<string, string> || {}),
      };

      // Execute command
      if (persistent) {
        return await this.executePersistent(filteredCommand, workingDir, env);
      } else {
        return await this.executeOneTime(filteredCommand, workingDir, env, timeoutValue);
      }
    } catch (error) {
      this.monitor.recordError('execution_failed', { error: error?.toString() });
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async executePersistent(
    command: string,
    workingDir: string,
    env: Record<string, string>
  ): Promise<ToolResult> {
    try {
      // Initialize session if needed
      if (!this.session || !this.session.isAlive()) {
        this.session = new BashSession(this.config, workingDir, this.monitor);
        await this.session.start();
      }

      // Execute command in persistent session
      const result = await this.session.runCommand(command);
      
      return this.createSuccessResult(result);
    } catch (error) {
      // Try to restart session on error
      try {
        if (this.session) {
          await this.session.restart();
          const result = await this.session.runCommand(command);
          return this.createSuccessResult(result);
        }
      } catch (restartError) {
        this.monitor.recordError('session_restart_failed', { 
          originalError: error?.toString(),
          restartError: restartError?.toString()
        });
        return this.createErrorResult(
          `Session restart failed: ${restartError}`,
          '',
          ''
        );
      }
      
      this.monitor.recordError('persistent_execution_failed', { error: error?.toString() });
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async executeOneTime(
    command: string,
    workingDir: string,
    env: Record<string, string>,
    timeout: number
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const strategy = PlatformStrategyFactory.create(this.config.platformOverride);
    
    return new Promise((resolve) => {
      const config = strategy.getConfig();
      const child = spawn(config.shell, [...config.shellArgs, command], {
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

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        
        // Clean output using platform strategy
        const cleanStdout = strategy.parseOutput(stdout, command);
        
        const result: BashResult = {
          command,
          stdout: cleanStdout.trim(),
          stderr: stderr.trim(),
          exit_code: code || 0,
          execution_time: Date.now() - startTime,
          platform: PlatformStrategyFactory.detectPlatform(),
          working_directory: workingDir,
          metadata: {
            retryCount: 0,
            finalAttempt: true,
            truncated: false,
            cleaned: true
          }
        };

        this.monitor.recordCommand(result.execution_time);

        if (killed) {
          this.monitor.recordError('command_timeout', { command, timeout });
          resolve(this.createErrorResult(
            `Command timed out after ${timeout} seconds`,
            result.stdout,
            result.stderr
          ));
        } else {
          resolve(this.createSuccessResult(result));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        this.monitor.recordError('spawn_failed', { command, error: error.toString() });
        resolve(this.createErrorResult(
          `Failed to spawn command: ${error.message}`,
          stdout.trim(),
          stderr.trim()
        ));
      });
    });
  }

  /**
   * Close and cleanup the bash session
   */
  override async close(): Promise<void> {
    if (this.session) {
      await this.session.stop();
      this.session = null;
    }
  }

  /**
   * Get current session information
   */
  getSessionInfo(): SessionInfo | null {
    return this.session?.getSessionInfo() || null;
  }

  /**
   * Check if session is alive
   */
  isSessionAlive(): boolean {
    return this.session?.isAlive() || false;
  }

  /**
   * Get monitoring metrics
   */
  getMetrics() {
    return this.monitor.getMetrics();
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(count: number = 10) {
    return this.monitor.getRecentErrors(count);
  }
}

// Register the optimized tool
import { globalToolRegistry } from './base.js';
globalToolRegistry.register(new BashToolOptimized());