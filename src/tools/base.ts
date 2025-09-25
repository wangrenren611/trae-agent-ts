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

  // Allow tools to clean up resources
  async close(): Promise<void> {
    // Default implementation does nothing
    return Promise.resolve();
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

// Tool executor that manages tool execution
export class ToolCallExecutor {
  private tools: Map<string, ToolExecutor>;
  
  constructor(tools: ToolExecutor[]) {
    this.tools = new Map();
    for (const tool of tools) {
      this.tools.set(this.normalizeName(tool.name), tool);
    }
  }

  private normalizeName(name: string): string {
    // Normalize tool name by making it lowercase and removing underscores
    try {
      return name.toLowerCase().replace(/_/g, '');
    } catch (error) {
      console.error(`Error normalizing tool name: ${error}`);
      return name;
    }
  }

  async executeToolCall(toolCall: ToolCall, context: ToolExecutionContext): Promise<ToolResult> {
    const normalizedName = this.normalizeName(toolCall.function.name);
    
    if (!this.tools.has(normalizedName)) {
      const availableTools = Array.from(this.tools.keys());
      return {
        success: false,
        error: `Tool '${toolCall.function.name}' not found. Available tools: ${JSON.stringify(availableTools)}`,
      };
    }

    const tool = this.tools.get(normalizedName)!;
    
    try {
      let parsedArgs: Record<string, unknown> = {};
      if (toolCall.function.arguments) {
        parsedArgs = typeof toolCall.function.arguments === 'string' 
          ? JSON.parse(toolCall.function.arguments) 
          : toolCall.function.arguments;
      }
      
      const result = await tool.execute(parsedArgs, context);
      return result;
    } catch (error) {
      return {
        success: false,
        error: `Error executing tool '${toolCall.function.name}': ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async parallelToolCall(toolCalls: ToolCall[], context: ToolExecutionContext): Promise<ToolResult[]> {
    const promises = toolCalls.map(call => this.executeToolCall(call, context));
    return Promise.all(promises);
  }

  async sequentialToolCall(toolCalls: ToolCall[], context: ToolExecutionContext): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const call of toolCalls) {
      const result = await this.executeToolCall(call, context);
      results.push(result);
    }
    return results;
  }

  async closeTools(): Promise<void> {
    const closePromises = Array.from(this.tools.values()).map(tool => tool.close());
    await Promise.all(closePromises);
  }
}

// Global tool registry
export const globalToolRegistry = new ToolRegistry();