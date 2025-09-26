import { Config } from '../types/index.js';
import { Logger } from '../utils/logging/logger.js';
import { ToolExecutor } from './base.js';
import { globalToolRegistry } from './base.js';

// Import tool classes
import { EditTool } from './edit-tool.js';
import { BashTool } from './bash-tool.js';
import { JSONEditTool } from './json-edit-tool.js';
import { SequentialThinkingTool } from './sequential-thinking-tool.js';
import { TaskDoneTool } from './task-done-tool.js';
import { CKGTool } from './ckg-tool.js';
import { CompleteTaskTool } from './complete-task-tool.js';

export async function createTools(config: Config, logger: Logger): Promise<ToolExecutor[]> {
  const tools: ToolExecutor[] = [];

  // Create tool instances directly
  const toolMap: Record<string, () => ToolExecutor> = {
    'edit_tool': () => new EditTool(),
    'bash_tool': () => new BashTool(),
    'json_edit_tool': () => new JSONEditTool(),
    'sequential_thinking_tool': () => new SequentialThinkingTool(),
    'sequentialthinking': () => new SequentialThinkingTool(),
    'task_done_tool': () => new TaskDoneTool(),
    'task_done': () => new TaskDoneTool(),
    'complete_task_tool': () => new CompleteTaskTool(logger),
    'complete_task': () => new CompleteTaskTool(logger),
    'ckg_tool': () => new CKGTool(logger),
    'ckg': () => new CKGTool(logger),
  };

  // Load built-in tools
  const builtInTools = config.agent.tools || [];

  for (const toolName of builtInTools) {
    const toolFactory = toolMap[toolName];
    if (toolFactory) {
      const tool = toolFactory();
      tools.push(tool);
      logger.debug(`Loaded built-in tool: ${toolName}`);
    } else {
      logger.warn(`Built-in tool not found: ${toolName}`);
    }
  }

  // Load MCP tools if configured
  if (config.mcp?.servers) {
    const { MCPTool } = await import('./mcp-tool.js');

    for (const server of config.mcp.servers) {
      try {
        const mcpTool = new MCPTool(server, logger);
        tools.push(mcpTool);
        logger.debug(`Loaded MCP tool from server: ${server.name}`);
      } catch (error) {
        logger.error(`Failed to load MCP tool from server ${server.name}:`, error);
      }
    }
  }

  // CKG tool is already loaded above in the toolMap

  logger.info(`Created ${tools.length} tools`);
  return tools;
}