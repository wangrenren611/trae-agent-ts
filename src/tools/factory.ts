import { Config } from '../types/index.js';
import { Logger } from '../utils/logging/logger.js';
import { ToolExecutor } from './base.js';

// Import tool classes
import { EditTool } from './edit-tool.js';
import { BashTool } from './bash-tool.js';
import { JSONEditTool } from './json-edit-tool.js';
import { SequentialThinkingTool } from './sequential-thinking-tool.js';
import { TaskDoneTool } from './task-done-tool.js';
import { CKGTool } from './ckg-tool.js';
import { CompleteTaskTool } from './complete-task-tool.js';
import { PlannerTool } from './planner-tool.js';
import { TravelPlannerTool } from './travel-planner-tool.js';
import { TravelExecutorTool } from './travel-executor-tool.js';

/**
 * 创建规划专用工具集合
 */
/**
 * 创建旅游专用工具集合
 */
export async function createTravelTools(config: Config, logger: Logger): Promise<ToolExecutor[]> {
  const tools: ToolExecutor[] = [];

  // Create tool instances directly
  const toolMap: Record<string, () => ToolExecutor> = {
    'travel_planner': () => new TravelPlannerTool(),
    'travel_executor': () => new TravelExecutorTool(),
    'sequential_thinking_tool': () => new SequentialThinkingTool(),
    'sequentialthinking': () => new SequentialThinkingTool(),
    'complete_task_tool': () => new CompleteTaskTool(logger),
    'complete_task': () => new CompleteTaskTool(logger),
  };

  const travelToolNames = ['travel_planner', 'travel_executor', 'sequential_thinking_tool', 'complete_task'];

  for (const toolName of travelToolNames) {
    const toolFactory = toolMap[toolName];
    if (toolFactory) {
      const tool = toolFactory();
      tools.push(tool);
      logger.debug(`Loaded travel tool: ${toolName}`);
    } else {
      logger.warn(`Travel tool not found: ${toolName}`);
    }
  }

  logger.info(`Created ${tools.length} travel tools`);
  return tools;
}

export async function createPlanningTools(config: Config, logger: Logger): Promise<ToolExecutor[]> {
  const tools: ToolExecutor[] = [];

  // Create tool instances directly
  const toolMap: Record<string, () => ToolExecutor> = {
    'planner_tool': () => new PlannerTool(),
    'sequential_thinking_tool': () => new SequentialThinkingTool(),
    'sequentialthinking': () => new SequentialThinkingTool(),
    'complete_task_tool': () => new CompleteTaskTool(logger),
    'complete_task': () => new CompleteTaskTool(logger),
  };

  const planningToolNames = ['planner_tool', 'sequential_thinking_tool', 'complete_task'];

  for (const toolName of planningToolNames) {
    const toolFactory = toolMap[toolName];
    if (toolFactory) {
      const tool = toolFactory();
      tools.push(tool);
      logger.debug(`Loaded planning tool: ${toolName}`);
    } else {
      logger.warn(`Planning tool not found: ${toolName}`);
    }
  }

  logger.info(`Created ${tools.length} planning tools`);
  return tools;
}

/**
 * 创建执行专用工具集合
 */
export async function createExecutionTools(config: Config, logger: Logger): Promise<ToolExecutor[]> {
  const tools: ToolExecutor[] = [];

  // Create tool instances directly
  const toolMap: Record<string, () => ToolExecutor> = {
    'edit_tool': () => new EditTool(),
    'bash_tool': () => new BashTool(),
    'json_edit_tool': () => new JSONEditTool(),
    'complete_task_tool': () => new CompleteTaskTool(logger),
    'complete_task': () => new CompleteTaskTool(logger),
    'ckg_tool': () => new CKGTool(logger),
    'ckg': () => new CKGTool(logger),
  };

  const executionToolNames = ['edit_tool', 'bash_tool', 'json_edit_tool', 'complete_task'];

  for (const toolName of executionToolNames) {
    const toolFactory = toolMap[toolName];
    if (toolFactory) {
      const tool = toolFactory();
      tools.push(tool);
      logger.debug(`Loaded execution tool: ${toolName}`);
    } else {
      logger.warn(`Execution tool not found: ${toolName}`);
    }
  }

  logger.info(`Created ${tools.length} execution tools`);
  return tools;
}

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
    'planner_tool': () => new PlannerTool(),
    'planner': () => new PlannerTool(),
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