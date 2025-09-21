import { readFile, writeFile, stat, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext } from '../types/index.js';

export class EditTool extends ToolExecutor {
  constructor() {
    super('edit_tool', {
      name: 'edit_tool',
      description: 'View, create, and edit files with various operations',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The operation to perform: view, create, str_replace, insert',
          },
          path: {
            type: 'string',
            description: 'The file path to operate on',
          },
          file_text: {
            type: 'string',
            description: 'For create command: the content to write to the file',
          },
          old_str: {
            type: 'string',
            description: 'For str_replace command: the string to replace',
          },
          new_str: {
            type: 'string',
            description: 'For str_replace command: the replacement string',
          },
          insert_line: {
            type: 'number',
            description: 'For insert command: the line number to insert after',
          },
          insert_text: {
            type: 'string',
            description: 'For insert command: the text to insert',
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

      const { command, path } = params;
      const fullPath = resolve(context.workingDirectory, path as string);

      switch (command) {
        case 'view':
          return await this.viewFile(fullPath);
        case 'create':
          return await this.createFile(fullPath, params['file_text'] as string);
        case 'str_replace':
          return await this.strReplace(
            fullPath,
            params['old_str'] as string,
            params['new_str'] as string
          );
        case 'insert':
          return await this.insert(
            fullPath,
            params['insert_line'] as number,
            params['insert_text'] as string
          );
        default:
          return this.createErrorResult(`Unknown command: ${command}`);
      }
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async viewFile(path: string): Promise<ToolResult> {
    try {
      const stats = await stat(path);
      if (!stats.isFile()) {
        return this.createErrorResult(`Path is not a file: ${path}`);
      }

      const content = await readFile(path, 'utf-8');
      const lines = content.split('\n');

      return this.createSuccessResult({
        path,
        content,
        line_count: lines.length,
        size: stats.size,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createErrorResult(`File not found: ${path}`);
      }
      throw error;
    }
  }

  private async createFile(path: string, content: string): Promise<ToolResult> {
    try {
      // Create directory if it doesn't exist
      const dir = dirname(path);
      await mkdir(dir, { recursive: true });

      await writeFile(path, content, 'utf-8');

      return this.createSuccessResult({
        path,
        created: true,
        size: content.length,
      });
    } catch (error) {
      return this.createErrorResult(
        `Failed to create file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async strReplace(
    path: string,
    oldStr: string,
    newStr: string
  ): Promise<ToolResult> {
    try {
      const content = await readFile(path, 'utf-8');

      if (!content.includes(oldStr)) {
        return this.createErrorResult(`String not found in file: "${oldStr}"`);
      }

      const newContent = content.replace(oldStr, newStr);
      await writeFile(path, newContent, 'utf-8');

      return this.createSuccessResult({
        path,
        replaced: true,
        old_length: oldStr.length,
        new_length: newStr.length,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createErrorResult(`File not found: ${path}`);
      }
      throw error;
    }
  }

  private async insert(
    path: string,
    insertLine: number,
    insertText: string
  ): Promise<ToolResult> {
    try {
      const content = await readFile(path, 'utf-8');
      const lines = content.split('\n');

      if (insertLine < 0 || insertLine > lines.length) {
        return this.createErrorResult(
          `Invalid insert line: ${insertLine}. File has ${lines.length} lines.`
        );
      }

      lines.splice(insertLine, 0, insertText);
      const newContent = lines.join('\n');

      await writeFile(path, newContent, 'utf-8');

      return this.createSuccessResult({
        path,
        inserted: true,
        line: insertLine,
        text_length: insertText.length,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createErrorResult(`File not found: ${path}`);
      }
      throw error;
    }
  }
}

// Register the tool
import { globalToolRegistry } from './base.js';
globalToolRegistry.register(new EditTool());