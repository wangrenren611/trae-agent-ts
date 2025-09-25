import { readFile, writeFile, stat, mkdir, readdir, copyFile } from 'fs/promises';
import { dirname, resolve, isAbsolute, join } from 'path';
import { ToolExecutor } from './base';
import { ToolResult, ToolExecutionContext } from '../types/index';

// Configuration interface for the edit tool
interface EditToolConfig {
  backupEnabled?: boolean;
  defaultEncoding?: BufferEncoding;
  maxFileSize?: number;
  snippetLines?: number;
}

// Type for view range parameter
type ViewRange = [number, number];

// Constants
const DEFAULT_CONFIG: Required<EditToolConfig> = {
  backupEnabled: true,
  defaultEncoding: 'utf-8',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  snippetLines: 5,
};

export class EditTool extends ToolExecutor {
  private config: Required<EditToolConfig>;
  private backupPaths: Set<string> = new Set();

  constructor(config: EditToolConfig = {}) {
    super('edit_tool', {
      name: 'edit_tool',
      description: `Advanced file editing tool with backup, validation, and enhanced viewing capabilities.
* State is persistent across command calls
* If path is a file, view displays content with line numbers. If path is a directory, view lists contents
* The create command cannot be used if the specified path already exists as a file
* Automatic backup creation before modifications (configurable)
* Support for viewing specific line ranges to handle large files
* Enhanced string replacement with uniqueness validation
* Tab expansion and proper whitespace handling`,
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The operation to perform: view, create, str_replace, insert, diff_edit',
          },
          path: {
            type: 'string',
            description: 'The absolute file path to operate on',
          },
          file_text: {
            type: 'string',
            description: 'For create command: the content to write to the file',
          },
          old_str: {
            type: 'string',
            description: 'For str_replace command: the exact string to replace (must be unique)',
          },
          new_str: {
            type: 'string',
            description: 'For str_replace command: the replacement string',
          },
          insert_line: {
            type: 'number',
            description: 'For insert command: the line number to insert after (0-based)',
          },
          insert_text: {
            type: 'string',
            description: 'For insert command: the text to insert',
          },
          view_range: {
            type: 'array',
            description: 'For view command: [start_line, end_line] to view specific range (1-based). Use -1 for end_line to view to end of file',
            items: { 
              type: 'number',
              description: 'Line number'
            },
          },
          diff: {
            type: 'string',
            description: 'For diff_edit command: diff format with SEARCH/REPLACE blocks',
          },
        },
        required: ['command', 'path'],
      },
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParams(params);

      const { command, path } = params;
      const validatedPath = await this._validateAndResolvePath(
        path as string, 
        context.workingDirectory, 
        command as string
      );

      switch (command) {
        case 'view':
          const viewRange = params['view_range'] as ViewRange | undefined;
          return await this._viewFile(validatedPath, viewRange);
        case 'create':
          return await this._createFile(validatedPath, params['file_text'] as string);
        case 'str_replace':
          return await this._strReplace(
            validatedPath,
            params['old_str'] as string,
            params['new_str'] as string
          );
        case 'insert':
          return await this._insert(
            validatedPath,
            params['insert_line'] as number,
            params['insert_text'] as string
          );
        case 'diff_edit':
          return await this._diffEdit(validatedPath, params['diff'] as string);
        default:
          return this.createErrorResult(`Unknown command: ${command}. Allowed commands: view, create, str_replace, insert, diff_edit`);
      }
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Resource cleanup method as per memory requirements
  override async close(): Promise<void> {
    // Clean up any temporary backup files if needed
    // In a more advanced implementation, this could clean up old backups
    this.backupPaths.clear();
  }

  // Validate and resolve file path
  private async _validateAndResolvePath(
    path: string, 
    workingDirectory: string, 
    command: string
  ): Promise<string> {
    if (!isAbsolute(path)) {
      throw new Error(`Path must be absolute: ${path}. Consider using: ${resolve(workingDirectory, path)}`);
    }

    const fullPath = resolve(path);
    
    // Check if path exists for operations that require existing files
    if (!['create'].includes(command)) {
      try {
        await stat(fullPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error(`Path does not exist: ${fullPath}`);
        }
        throw error;
      }
    }

    // Check if file already exists for create command
    if (command === 'create') {
      try {
        await stat(fullPath);
        throw new Error(`File already exists at: ${fullPath}. Cannot overwrite files using create command.`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist, which is what we want for create
      }
    }

    // Check if path is directory for non-view commands
    try {
      const stats = await stat(fullPath);
      if (stats.isDirectory() && command !== 'view') {
        throw new Error(`Path ${fullPath} is a directory. Only the 'view' command can be used on directories.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return fullPath;
  }

  // Create backup of file before modification
  private async _createBackup(filePath: string): Promise<void> {
    if (!this.config.backupEnabled) {
      return;
    }

    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${filePath}.${timestamp}.bak`;
      
      await copyFile(filePath, backupPath);
      this.backupPaths.add(backupPath);
    } catch (error) {
      // If backup fails, we continue but log the error
      console.warn(`Failed to create backup for ${filePath}:`, error);
    }
  }

  // Format output with line numbers (similar to cat -n)
  private _formatOutput(content: string, filePath: string, startLine: number = 1): string {
    const lines = content.split('\n');
    const formattedLines = lines.map((line, index) => {
      const lineNumber = index + startLine;
      return `${lineNumber.toString().padStart(6)}\t${line}`;
    });
    
    return `Here's the result of running \`cat -n\` on ${filePath}:\n${formattedLines.join('\n')}\n`;
  }

  // Extract code snippet around a specific line
  private _extractSnippet(content: string, centerLine: number, contextLines: number = this.config.snippetLines): string {
    const lines = content.split('\n');
    const startLine = Math.max(0, centerLine - contextLines);
    const endLine = Math.min(lines.length, centerLine + contextLines + 1);
    
    return lines.slice(startLine, endLine).join('\n');
  }

  // Truncate long output
  private _truncateOutput(output: string, maxLength: number = 20000): string {
    if (output.length > maxLength) {
      return output.substring(0, maxLength) + '\n<... response clipped ...>\n';
    }
    return output;
  }

  // Enhanced view method with range support and directory listing
  private async _viewFile(path: string, viewRange?: ViewRange): Promise<ToolResult> {
    try {
      const stats = await stat(path);

      // Handle directory viewing
      if (stats.isDirectory()) {
        if (viewRange) {
          return this.createErrorResult(
            'The view_range parameter is not allowed when path points to a directory.'
          );
        }
        return await this._viewDirectory(path);
      }

      // Handle file viewing
      if (!stats.isFile()) {
        return this.createErrorResult(`Path is not a file: ${path}`);
      }

      // Check file size
      if (stats.size > this.config.maxFileSize) {
        return this.createErrorResult(
          `File is too large (${stats.size} bytes). Maximum allowed size is ${this.config.maxFileSize} bytes. Use view_range to view specific lines.`
        );
      }

      const content = await readFile(path, this.config.defaultEncoding);
      const expandedContent = content.replace(/\t/g, '    '); // Expand tabs
      
      let displayContent = expandedContent;
      let startLine = 1;

      if (viewRange) {
        const [start, end] = viewRange;
        const lines = expandedContent.split('\n');
        const totalLines = lines.length;

        if (start < 1 || start > totalLines) {
          return this.createErrorResult(
            `Invalid view_range: start line ${start} should be within range [1, ${totalLines}]`
          );
        }

        let endLine = end;
        if (end === -1) {
          endLine = totalLines;
        } else if (end > totalLines) {
          return this.createErrorResult(
            `Invalid view_range: end line ${end} should be smaller than or equal to ${totalLines}`
          );
        } else if (end < start && end !== -1) {
          return this.createErrorResult(
            `Invalid view_range: end line ${end} should be greater than or equal to start line ${start}`
          );
        }

        displayContent = lines.slice(start - 1, endLine).join('\n');
        startLine = start;
      }

      const formattedOutput = this._formatOutput(displayContent, path, startLine);
      const truncatedOutput = this._truncateOutput(formattedOutput);

      return this.createSuccessResult({
        path,
        content: truncatedOutput,
        line_count: displayContent.split('\n').length,
        total_lines: expandedContent.split('\n').length,
        size: stats.size,
        view_range: viewRange || null,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createErrorResult(`File not found: ${path}`);
      }
      throw error;
    }
  }

  // View directory contents (similar to ls)
  private async _viewDirectory(path: string): Promise<ToolResult> {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      const formattedEntries = entries
        .filter(entry => !entry.name.startsWith('.')) // Hide hidden files
        .map(entry => {
          const type = entry.isDirectory() ? 'DIR' : 'FILE';
          return `${type.padEnd(4)} ${entry.name}`;
        })
        .join('\n');

      const output = `Here's the files and directories in ${path}, excluding hidden items:\n${formattedEntries}\n`;
      
      return this.createSuccessResult({
        path,
        content: output,
        entry_count: entries.length,
        type: 'directory',
      });
    } catch (error) {
      return this.createErrorResult(
        `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Enhanced create method with backup support
  private async _createFile(path: string, content: string): Promise<ToolResult> {
    try {
      // Create directory if it doesn't exist
      const dir = dirname(path);
      await mkdir(dir, { recursive: true });

      await writeFile(path, content, this.config.defaultEncoding);

      return this.createSuccessResult({
        path,
        created: true,
        size: content.length,
        encoding: this.config.defaultEncoding,
      });
    } catch (error) {
      return this.createErrorResult(
        `Failed to create file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Enhanced string replace with uniqueness validation
  private async _strReplace(
    path: string,
    oldStr: string,
    newStr: string
  ): Promise<ToolResult> {
    try {
      await this._createBackup(path);
      
      const content = await readFile(path, this.config.defaultEncoding);
      const expandedContent = content.replace(/\t/g, '    ');
      const expandedOldStr = oldStr.replace(/\t/g, '    ');
      const expandedNewStr = newStr.replace(/\t/g, '    ');

      // Check if old string exists
      const occurrences = (expandedContent.match(new RegExp(this._escapeRegex(expandedOldStr), 'g')) || []).length;
      if (occurrences === 0) {
        return this.createErrorResult(
          `No replacement was performed. The string "${oldStr}" did not appear verbatim in ${path}.`
        );
      }

      // Check for uniqueness
      if (occurrences > 1) {
        const lines = expandedContent.split('\n');
        const matchingLines = lines
          .map((line, index) => ({ line: line, number: index + 1 }))
          .filter(({ line }) => line.includes(expandedOldStr))
          .map(({ number }) => number);
        
        return this.createErrorResult(
          `No replacement was performed. Multiple occurrences of "${oldStr}" found on lines: ${matchingLines.join(', ')}. Please ensure the string is unique.`
        );
      }

      // Perform replacement
      const newContent = expandedContent.replace(expandedOldStr, expandedNewStr);
      await writeFile(path, newContent, this.config.defaultEncoding);

      // Create snippet showing the change
      const replacementLineIndex = expandedContent.split(expandedOldStr)[0].split('\n').length - 1;
      const snippet = this._extractSnippet(newContent, replacementLineIndex);
      const formattedSnippet = this._formatOutput(snippet, `a snippet of ${path}`, Math.max(1, replacementLineIndex - this.config.snippetLines + 1));

      const successMsg = `The file ${path} has been edited. ${formattedSnippet}Review the changes and make sure they are as expected. Edit the file again if necessary.`;

      return this.createSuccessResult({
        path,
        replaced: true,
        old_length: oldStr.length,
        new_length: newStr.length,
        occurrences: 1,
        snippet: this._truncateOutput(successMsg),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createErrorResult(`File not found: ${path}`);
      }
      throw error;
    }
  }

  // Enhanced insert method with validation and snippet display
  private async _insert(
    path: string,
    insertLine: number,
    insertText: string
  ): Promise<ToolResult> {
    try {
      await this._createBackup(path);
      
      const content = await readFile(path, this.config.defaultEncoding);
      const expandedContent = content.replace(/\t/g, '    ');
      const expandedInsertText = insertText.replace(/\t/g, '    ');
      const lines = expandedContent.split('\n');
      const totalLines = lines.length;

      if (insertLine < 0 || insertLine > totalLines) {
        return this.createErrorResult(
          `Invalid insert_line: ${insertLine}. It should be within range [0, ${totalLines}].`
        );
      }

      const insertLines = expandedInsertText.split('\n');
      lines.splice(insertLine, 0, ...insertLines);
      const newContent = lines.join('\n');

      await writeFile(path, newContent, this.config.defaultEncoding);

      // Create snippet showing the insertion
      const snippetLines = [
        ...lines.slice(Math.max(0, insertLine - this.config.snippetLines), insertLine),
        ...insertLines,
        ...lines.slice(insertLine + insertLines.length, insertLine + insertLines.length + this.config.snippetLines)
      ];
      const snippet = snippetLines.join('\n');
      const formattedSnippet = this._formatOutput(
        snippet, 
        'a snippet of the edited file', 
        Math.max(1, insertLine - this.config.snippetLines + 1)
      );

      const successMsg = `The file ${path} has been edited. ${formattedSnippet}Review the changes and make sure they are as expected (correct indentation, no duplicate lines, etc). Edit the file again if necessary.`;

      return this.createSuccessResult({
        path,
        inserted: true,
        line: insertLine,
        text_length: insertText.length,
        lines_inserted: insertLines.length,
        snippet: this._truncateOutput(successMsg),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createErrorResult(`File not found: ${path}`);
      }
      throw error;
    }
  }

  // New diff edit method (SEARCH/REPLACE format)
  private async _diffEdit(path: string, diff: string): Promise<ToolResult> {
    try {
      await this._createBackup(path);
      
      const content = await readFile(path, this.config.defaultEncoding);
      let modifiedContent = content;
      
      // Parse SEARCH/REPLACE blocks using string-based parsing to avoid regex issues
      const searchPattern = '<<<<<<< SEARCH\n';
      const separatorPattern = '\n=======\n';
      const replacePattern = '\n>>>>>>> REPLACE';
      
      const blocks: Array<{search: string, replace: string}> = [];
      let currentPos = 0;
      
      while (true) {
        const searchStart = diff.indexOf(searchPattern, currentPos);
        if (searchStart === -1) break;
        
        const contentStart = searchStart + searchPattern.length;
        const separatorStart = diff.indexOf(separatorPattern, contentStart);
        if (separatorStart === -1) break;
        
        const replaceStart = separatorStart + separatorPattern.length;
        const replaceEnd = diff.indexOf(replacePattern, replaceStart);
        if (replaceEnd === -1) break;
        
        const searchText = diff.substring(contentStart, separatorStart);
        const replaceText = diff.substring(replaceStart, replaceEnd);
        
        blocks.push({ search: searchText, replace: replaceText });
        currentPos = replaceEnd + replacePattern.length;
      }
      
      if (blocks.length === 0) {
        return this.createErrorResult(
          'Error! No valid diff blocks found. Use format:\n<<<<<<< SEARCH\n[content to find]\n=======\n[replacement content]\n>>>>>>> REPLACE'
        );
      }

      let appliedChanges = 0;
      const changesSummary: string[] = [];

      // Apply each search/replace pair
      for (const block of blocks) {
        if (modifiedContent.includes(block.search)) {
          modifiedContent = modifiedContent.replace(block.search, block.replace);
          appliedChanges++;
          changesSummary.push(`Applied replacement: "${block.search.substring(0, 50)}..." -> "${block.replace.substring(0, 50)}..."`);
        } else {
          changesSummary.push(`Warning: Search text not found: "${block.search.substring(0, 50)}..."`);
        }
      }

      if (appliedChanges === 0) {
        return this.createErrorResult(
          `No changes were applied. None of the search texts were found in the file.\n${changesSummary.join('\n')}`
        );
      }

      await writeFile(path, modifiedContent, this.config.defaultEncoding);

      return this.createSuccessResult({
        path,
        diff_applied: true,
        changes_applied: appliedChanges,
        total_blocks: blocks.length,
        summary: changesSummary.join('\n'),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createErrorResult(`File not found: ${path}`);
      }
      throw error;
    }
  }

  // Utility method to escape regex special characters
  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Register the tool
import { globalToolRegistry } from './base';
globalToolRegistry.register(new EditTool());