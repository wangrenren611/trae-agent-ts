import {
  ToolDefinition,
  ToolResult,
  ToolExecutionContext,
  ToolCall,
  ToolError,
} from '../types/index.js';

export abstract class ToolExecutor {
  public readonly name: string;
  public readonly definition: ToolDefinition;

  constructor(name: string, definition: ToolDefinition) {
    this.name = name;
    this.definition = definition;
  }

  abstract execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult>;

  protected validateParams(params: Record<string, unknown>): void {
    const requiredParams = this.definition.parameters.required || [];

    for (const param of requiredParams) {
      if (!(param in params)) {
        throw new ToolError(
          `Missing required parameter: ${param}`,
          this.name
        );
      }
    }

    // Validate parameter types
    for (const [paramName, paramValue] of Object.entries(params)) {
      const paramDef = this.definition.parameters.properties[paramName];
      if (paramDef && paramDef.type) {
        this.validateParamType(paramName, paramValue, paramDef.type);
      }
    }
  }

  private validateParamType(
    paramName: string,
    value: unknown,
    expectedType: string
  ): void {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (actualType !== expectedType) {
      throw new ToolError(
        `Parameter ${paramName} must be of type ${expectedType}, got ${actualType}`,
        this.name
      );
    }
  }

  protected createSuccessResult(result: unknown): ToolResult {
    return {
      success: true,
      result,
    };
  }

  protected createErrorResult(error: string, stdout?: string, stderr?: string): ToolResult {
    return {
      success: false,
      error,
      stdout,
      stderr,
    };
  }
}

export class ToolRegistry {
  private tools: Map<string, ToolExecutor> = new Map();

  register(tool: ToolExecutor): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolExecutor | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolExecutor[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(tool => tool.definition);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  clear(): void {
    this.tools.clear();
  }
}

// Global tool registry
export const globalToolRegistry = new ToolRegistry();