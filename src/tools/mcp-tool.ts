import { spawn, ChildProcess } from 'child_process';
import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext, MCPServer, ToolDefinition } from '../types/index.js';
import { Logger } from '../utils/logging/logger.js';

export class MCPTool extends ToolExecutor {
  private server: MCPServer;
  private process: ChildProcess | null = null;
  private logger: Logger;
  private isInitialized = false;
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

  constructor(server: MCPServer, logger: Logger) {
    super(`mcp_${server.name}`, {
      name: `mcp_${server.name}`,
      description: `MCP tool from server: ${server.name}`,
      parameters: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            description: 'Name of the MCP tool to execute',
          },
          parameters: {
            type: 'object',
            description: 'Parameters for the MCP tool',
            additionalProperties: true,
          },
        },
        required: ['tool_name', 'parameters'],
      },
    });

    this.server = server;
    this.logger = logger.child({ component: `MCPTool-${server.name}` });
  }

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParams(params);

      const { tool_name, parameters } = params;

      // Initialize MCP server if not already done
      if (!this.isInitialized) {
        await this.initializeServer();
      }

      // Execute MCP tool
      const result = await this.executeMCPTool(
        tool_name as string,
        parameters as Record<string, unknown>
      );

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async initializeServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.info(`Initializing MCP server: ${this.server.name}`);

      // Spawn the MCP server process
      this.process = spawn(this.server.command, this.server.args, {
        env: { ...process.env, ...this.server.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.process) {
        reject(new Error(`Failed to spawn MCP server: ${this.server.name}`));
        return;
      }

      // Handle process events
      this.process.on('error', (error) => {
        this.logger.error('MCP server process error', { error });
        reject(error);
      });

      this.process.on('exit', (code, signal) => {
        this.logger.info('MCP server process exited', { code, signal });
        this.isInitialized = false;
        this.process = null;
      });

      // Handle stderr
      this.process.stderr?.on('data', (data) => {
        this.logger.warn('MCP server stderr', { data: data.toString() });
      });

      // Handle stdout (JSON-RPC messages)
      this.process.stdout?.on('data', (data) => {
        this.handleServerMessage(data.toString());
      });

      // Initialize connection
      this.sendMessage({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
        },
        id: ++this.messageId,
      })
        .then(() => {
          this.isInitialized = true;
          this.logger.info(`MCP server initialized: ${this.server.name}`);
          resolve();
        })
        .catch(reject);
    });
  }

  private handleServerMessage(data: string): void {
    try {
      // Parse JSON-RPC message
      const lines = data.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const message = JSON.parse(line);

        if (message.id !== undefined) {
          // Response to a request
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            this.pendingRequests.delete(message.id);
            if (message.error) {
              pending.reject(new Error(message.error.message));
            } else {
              pending.resolve(message.result);
            }
          }
        } else if (message.method) {
          // Notification from server
          this.handleNotification(message);
        }
      }
    } catch (error) {
      this.logger.error('Failed to parse server message', { error, data });
    }
  }

  private handleNotification(message: any): void {
    this.logger.debug('Received notification from MCP server', { method: message.method });
    // Handle notifications as needed
  }

  private async sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        reject(new Error('MCP server process not available'));
        return;
      }

      this.pendingRequests.set(message.id, { resolve, reject });

      try {
        this.process.stdin.write(JSON.stringify(message) + '\n');
      } catch (error) {
        this.pendingRequests.delete(message.id);
        reject(error);
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(message.id)) {
          this.pendingRequests.delete(message.id);
          reject(new Error(`Request timeout for message ${message.id}`));
        }
      }, 30000);
    });
  }

  private async executeMCPTool(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<any> {
    const result = await this.sendMessage({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: parameters,
      },
      id: ++this.messageId,
    });

    return result;
  }

  async getAvailableTools(): Promise<ToolDefinition[]> {
    if (!this.isInitialized) {
      await this.initializeServer();
    }

    const result = await this.sendMessage({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: ++this.messageId,
    });

    return result.tools || [];
  }

  cleanup(): void {
    if (this.process) {
      this.logger.info(`Cleaning up MCP server: ${this.server.name}`);
      this.process.kill();
      this.process = null;
      this.isInitialized = false;
    }

    // Reject any pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('MCP server cleanup'));
    }
    this.pendingRequests.clear();
  }
}

