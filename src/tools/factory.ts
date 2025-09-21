import { Config } from '../types/index.js';
import { Logger } from '../utils/logging/logger.js';
import { ToolExecutor } from './base.js';
import { globalToolRegistry } from './base.js';

export async function createTools(config: Config, logger: Logger): Promise<ToolExecutor[]> {
  const tools: ToolExecutor[] = [];

  // Load built-in tools from the global registry
  const builtInTools = config.agent.tools || [];

  for (const toolName of builtInTools) {
    const tool = globalToolRegistry.get(toolName);
    if (tool) {
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

  // Load CKG tool if enabled
  if (config.agent.tools?.includes('ckg_tool')) {
    try {
      const { CKGTool } = await import('./ckg-tool.js');
      const ckgTool = new CKGTool(logger);
      tools.push(ckgTool);
      logger.debug('Loaded CKG tool');
    } catch (error) {
      logger.error('Failed to load CKG tool:', error);
    }
  }

  logger.info(`Created ${tools.length} tools`);
  return tools;
}