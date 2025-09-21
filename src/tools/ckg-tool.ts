import { spawn } from 'child_process';
import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext } from '../types/index.js';

export class CKGTool extends ToolExecutor {
  private logger: Logger;
  private ckgPath: string;

  constructor(logger: Logger) {
    super('ckg_tool', {
      name: 'ckg_tool',
      description: 'Code Knowledge Graph tool for codebase analysis and querying',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'CKG command: query, analyze, visualize, or index',
          },
          query: {
            type: 'string',
            description: 'Query string for query command',
          },
          path: {
            type: 'string',
            description: 'Codebase path for analyze/index commands',
          },
          format: {
            type: 'string',
            description: 'Output format: json, markdown, or graph',
            default: 'json',
          },
          depth: {
            type: 'number',
            description: 'Analysis depth for analyze command',
            default: 2,
          },
        },
        required: ['command'],
      },
    });

    this.logger = logger.child({ component: 'CKGTool' });
    this.ckgPath = this.findCKGBinary();
  }

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParams(params);

      const { command, query, path, format = 'json', depth = 2 } = params;

      if (!this.ckgPath) {
        return this.createErrorResult('CKG tool not found. Please ensure ckg-tool is installed and available in PATH.');
      }

      const workingPath = (path as string) || context.workingDirectory;

      switch (command) {
        case 'query':
          return await this.executeQuery(query as string, format as string);
        case 'analyze':
          return await this.executeAnalyze(workingPath, format as string, depth as number);
        case 'visualize':
          return await this.executeVisualize(workingPath, format as string);
        case 'index':
          return await this.executeIndex(workingPath);
        default:
          return this.createErrorResult(`Unknown CKG command: ${command}`);
      }
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private findCKGBinary(): string {
    // Try to find ckg-tool binary in common locations
    const possiblePaths = [
      'ckg-tool',
      './node_modules/.bin/ckg-tool',
      '../ckg-tool/dist/index.js',
      '/usr/local/bin/ckg-tool',
    ];

    // For now, we'll use a mock implementation
    // In a real implementation, you would check if the binary exists
    return 'ckg-tool';
  }

  private async executeQuery(query: string, format: string): Promise<ToolResult> {
    if (!query) {
      return this.createErrorResult('Query is required for query command');
    }

    try {
      this.logger.debug(`Executing CKG query: ${query}`);

      // Mock implementation - in reality, this would spawn ckg-tool
      const mockResult = {
        query,
        results: [
          {
            type: 'function',
            name: 'calculateTotal',
            file: 'src/utils/calculator.ts',
            line: 42,
            description: 'Calculates the total of an array of numbers',
          },
          {
            type: 'class',
            name: 'Calculator',
            file: 'src/utils/calculator.ts',
            line: 15,
            description: 'A utility class for mathematical operations',
          },
        ],
        format,
      };

      return this.createSuccessResult(mockResult);
    } catch (error) {
      return this.createErrorResult(`CKG query failed: ${error}`);
    }
  }

  private async executeAnalyze(path: string, format: string, depth: number): Promise<ToolResult> {
    try {
      this.logger.debug(`Analyzing codebase at: ${path} (depth: ${depth})`);

      // Mock implementation
      const mockAnalysis = {
        path,
        depth,
        format,
        summary: {
          total_files: 127,
          total_functions: 342,
          total_classes: 89,
          total_lines: 15420,
          languages: {
            typescript: 89,
            javascript: 23,
            json: 15,
          },
        },
        dependencies: [
          { name: 'express', version: '^4.18.0', type: 'production' },
          { name: 'typescript', version: '^5.0.0', type: 'development' },
        ],
        complexity: {
          average_complexity: 8.5,
          most_complex_files: [
            { file: 'src/agent/base-agent.ts', complexity: 23 },
            { file: 'src/tools/edit-tool.ts', complexity: 18 },
          ],
        },
      };

      return this.createSuccessResult(mockAnalysis);
    } catch (error) {
      return this.createErrorResult(`CKG analysis failed: ${error}`);
    }
  }

  private async executeVisualize(path: string, format: string): Promise<ToolResult> {
    try {
      this.logger.debug(`Visualizing codebase at: ${path}`);

      // Mock implementation - would generate graph visualization
      const mockVisualization = {
        path,
        format,
        nodes: [
          { id: 'src/index.ts', type: 'file', label: 'index.ts', size: 15 },
          { id: 'src/agent', type: 'directory', label: 'agent', size: 45 },
          { id: 'src/tools', type: 'directory', label: 'tools', size: 67 },
        ],
        edges: [
          { from: 'src/index.ts', to: 'src/agent', type: 'imports' },
          { from: 'src/index.ts', to: 'src/tools', type: 'imports' },
          { from: 'src/agent', to: 'src/tools', type: 'dependency' },
        ],
        metadata: {
          generated_at: new Date().toISOString(),
          tool: 'ckg-tool',
          version: '1.0.0',
        },
      };

      return this.createSuccessResult(mockVisualization);
    } catch (error) {
      return this.createErrorResult(`CKG visualization failed: ${error}`);
    }
  }

  private async executeIndex(path: string): Promise<ToolResult> {
    try {
      this.logger.debug(`Indexing codebase at: ${path}`);

      // Mock implementation - would create search index
      const mockIndex = {
        path,
        indexed_files: 127,
        index_size: '2.3MB',
        tokens: 15420,
        symbols: 431,
        duration: '3.2s',
        status: 'completed',
      };

      return this.createSuccessResult(mockIndex);
    } catch (error) {
      return this.createErrorResult(`CKG indexing failed: ${error}`);
    }
  }

  private async runCKGCommand(args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.ckgPath!, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            resolve({ output: stdout });
          }
        } else {
          reject(new Error(`CKG command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }
}

// Register the tool
import { globalToolRegistry } from './base.js';
import { Logger } from '../utils/logging/logger.js';

const logger = Logger.create({ level: 'info', format: 'json' });
globalToolRegistry.register(new CKGTool(logger));