// Main exports
export { Agent } from './agent/agent.js';
export { TraeAgent } from './agent/trae-agent.js';
export { BaseAgent } from './agent/base-agent.js';

// Tools
export { ToolExecutor, ToolRegistry, ToolCallExecutor, globalToolRegistry } from './tools/base.js';
export { EditTool } from './tools/edit-tool.js';
export { BashTool } from './tools/bash-tool.js';
export { JSONEditTool } from './tools/json-edit-tool.js';
export { SequentialThinkingTool } from './tools/sequential-thinking-tool.js';
export { TaskDoneTool } from './tools/task-done-tool.js';
export { CKGTool } from './tools/ckg-tool.js';
export { MCPTool } from './tools/mcp-tool.js';

// LLM Clients
export { LLMClient } from './utils/llm_clients/llm-client.js';
export { AnthropicClient } from './utils/llm_clients/anthropic-client.js';
export { OpenAIClient } from './utils/llm_clients/openai-client.js';
export { GoogleClient } from './utils/llm_clients/google-client.js';
export { createLLMClient } from './utils/llm_clients/factory.js';

// Configuration
export { ConfigManager } from './utils/config/config.js';

// Logging
export { Logger } from './utils/logging/logger.js';

// Trajectory
export { TrajectoryRecorder, Lakeview } from './utils/trajectory/recorder.js';

// Docker
export { DockerManager } from './utils/docker/docker-manager.js';

// Types
export type {
  Message,
  ToolCall,
  ToolResult,
  ToolDefinition,
  ToolParameter,
  ToolExecutionContext,
  Config,
  LLMProvider,
  LLMMessage,
  LLMResponse,
  AgentStep,
  AgentTrajectory,
  DockerConfig,
  MCPServer,
  LakeviewStep,
} from './types/index.js';