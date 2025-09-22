import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext } from '../types/index.js';

export class JSONEditTool extends ToolExecutor {
  constructor() {
    super('json_edit_tool', {
      name: 'json_edit_tool',
      description: 'Manipulate JSON files with various operations',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The operation to perform: view, create, update, delete',
          },
          path: {
            type: 'string',
            description: 'The JSON file path',
          },
          key_path: {
            type: 'string',
            description: 'Dot-separated path to the JSON property (e.g., "user.name")',
          },
          value: {
            description: 'The value to set (for create/update operations)',
          },
          pretty: {
            type: 'boolean',
            description: 'Whether to format the JSON with indentation',
            default: true,
          },
        },
        required: ['command', 'path'],
      },
    });
  }

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParams(params);

      const { command, path, key_path, value, pretty = true } = params;
      const fullPath = resolve(context.workingDirectory, path as string);

      switch (command) {
        case 'view':
          return await this.viewJSON(fullPath, key_path as string);
        case 'create':
          return await this.createJSON(fullPath, value, pretty as boolean);
        case 'update':
          return await this.updateJSON(fullPath, key_path as string, value, pretty as boolean);
        case 'delete':
          return await this.deleteJSON(fullPath, key_path as string, pretty as boolean);
        default:
          return this.createErrorResult(`Unknown command: ${command}`);
      }
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async viewJSON(path: string, keyPath?: string): Promise<ToolResult> {
    try {
      const content = await readFile(path, 'utf-8');
      const jsonData = JSON.parse(content);

      let result = jsonData;
      if (keyPath) {
        result = this.getNestedValue(jsonData, keyPath);
        if (result === undefined) {
          return this.createErrorResult(`Key path not found: ${keyPath}`);
        }
      }

      return this.createSuccessResult({
        path,
        data: result,
        key_path: keyPath,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createErrorResult(`File not found: ${path}`);
      }
      if (error instanceof SyntaxError) {
        return this.createErrorResult(`Invalid JSON: ${error.message}`);
      }
      throw error;
    }
  }

  private async createJSON(path: string, value: unknown, pretty: boolean): Promise<ToolResult> {
    try {
      const jsonString = pretty
        ? JSON.stringify(value, null, 2)
        : JSON.stringify(value);

      await writeFile(path, jsonString, 'utf-8');

      return this.createSuccessResult({
        path,
        created: true,
        size: jsonString.length,
      });
    } catch (error) {
      return this.createErrorResult(
        `Failed to create JSON file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async updateJSON(
    path: string,
    keyPath: string,
    value: unknown,
    pretty: boolean
  ): Promise<ToolResult> {
    try {
      const content = await readFile(path, 'utf-8');
      const jsonData = JSON.parse(content);

      this.setNestedValue(jsonData, keyPath, value);

      const jsonString = pretty
        ? JSON.stringify(jsonData, null, 2)
        : JSON.stringify(jsonData);

      await writeFile(path, jsonString, 'utf-8');

      return this.createSuccessResult({
        path,
        updated: true,
        key_path: keyPath,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createErrorResult(`File not found: ${path}`);
      }
      if (error instanceof SyntaxError) {
        return this.createErrorResult(`Invalid JSON: ${error.message}`);
      }
      throw error;
    }
  }

  private async deleteJSON(
    path: string,
    keyPath: string,
    pretty: boolean
  ): Promise<ToolResult> {
    try {
      const content = await readFile(path, 'utf-8');
      const jsonData = JSON.parse(content);

      this.deleteNestedValue(jsonData, keyPath);

      const jsonString = pretty
        ? JSON.stringify(jsonData, null, 2)
        : JSON.stringify(jsonData);

      await writeFile(path, jsonString, 'utf-8');

      return this.createSuccessResult({
        path,
        deleted: true,
        key_path: keyPath,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createErrorResult(`File not found: ${path}`);
      }
      if (error instanceof SyntaxError) {
        return this.createErrorResult(`Invalid JSON: ${error.message}`);
      }
      throw error;
    }
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private setNestedValue(obj: unknown, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  private deleteNestedValue(obj: unknown, path: string): void {
    const keys = path.split('.');
    let current = obj as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        return;
      }
      current = current[key] as Record<string, unknown>;
    }

    delete current[keys[keys.length - 1]];
  }
}

// Register the tool
import { globalToolRegistry } from './base.js';
globalToolRegistry.register(new JSONEditTool());