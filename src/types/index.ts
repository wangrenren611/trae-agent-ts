import { z } from 'zod';

// Message types
export const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  name: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
  tool_call_id: z.string().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// Tool types
export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

export interface ToolParameter {
  type?: string;
  description: string;
  required?: boolean;
  properties?: Record<string, ToolParameter>;
  default?: unknown;
  additionalProperties?: boolean | { type: string };
  items?: ToolParameter;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
  stdout?: string;
  stderr?: string;
  tool_call_id?: string; // 添加工具调用ID用于精确匹配
  execution_time?: number; // 添加执行时间信息
}

export interface ToolExecutionContext {
  workingDirectory: string;
  environment: Record<string, string>;
  dockerContainer?: string;
}

// Agent types
export interface AgentStep {
  step_id: string;
  task: string;
  messages: Message[];
  tool_calls: ToolCall[];
  tool_results: ToolResult[];
  completed: boolean;
  timestamp: number;
  llm_response_content?: string; // 添加LLM响应内容
  step_duration?: number; // 添加步骤执行时间
  error?: string; // 添加步骤错误信息
}

export interface AgentTrajectory {
  agent_id: string;
  task: string;
  steps: AgentStep[];
  completed: boolean;
  success: boolean;
  final_result?: string;
  start_time: string;
  end_time?: string;
}

// LLM types
export interface LLMProvider {
  provider: string;  // 统一使用 provider 而不是 name
  api_key?: string;
  base_url?: string;
  model: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface LLMResponse {
  content: string;
  tool_calls?: ToolCall[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

// Configuration types
export const ConfigSchema = z.object({
  llm: z.object({
    provider: z.string(),
    model: z.string(),
    api_key: z.string().optional(),
    base_url: z.string().optional(),
    max_tokens: z.number().optional(),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
  }),
  agent: z.object({
    max_steps: z.number().default(30),
    working_directory: z.string().default('.'),
    enable_docker: z.boolean().default(false),
    enable_trajectory_recording: z.boolean().default(true),
    tools: z.array(z.string()).default(['edit_tool', 'bash_tool', 'json_edit_tool', 'sequential_thinking_tool', 'task_done_tool']),
  }),
  docker: z.object({
    image: z.string().default('node:18-alpine'),
    container_name: z.string().optional(),
    volumes: z.array(z.string()).default([]),
    environment: z.record(z.string()).default({}),
  }).optional(),
  mcp: z.object({
    servers: z.array(z.object({
      name: z.string(),
      command: z.string(),
      args: z.array(z.string()).default([]),
      env: z.record(z.string()).default({}),
    })).default([]),
  }).optional(),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    file: z.string().optional(),
    format: z.enum(['json', 'pretty']).default('json'),
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

// Tool execution types
export interface ToolExecutor {
  name: string;
  definition: ToolDefinition;
  execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
}

// Docker types
export interface DockerConfig {
  image: string;
  container_name?: string;
  volumes: string[];
  environment: Record<string, string>;
  working_dir?: string;
}

// MCP types
export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

// Error types
export class ToolError extends Error {
  constructor(message: string, public readonly toolName: string) {
    super(message);
    this.name = 'ToolError';
  }
}

export class LLMError extends Error {
  constructor(message: string, public readonly provider: string) {
    super(message);
    this.name = 'LLMError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// 特定工具结果类型
export interface CompleteTaskResult {
  task_completed: boolean;
  result: string;
  summary: string;
  completion_time: string;
}

export interface PlannerToolResult {
  message: string;
  plan?: {
    id: string;
    title: string;
    objective: string;
    status: string;
    created_at: Date;
    task_count: number;
    [key: string]: any;
  };
  task?: {
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    [key: string]: any;
  };
  tasks?: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    estimated_duration?: number;
    [key: string]: any;
  }>;
  plan_summary?: {
    total_tasks: number;
    pending_tasks: number;
    [key: string]: any;
  };
}

export interface SequentialThinkingResult {
  thoughts: Array<{
    thought: string;
    thought_number: number;
    total_thoughts: number;
  }>;
  conclusion?: string;
  next_action?: string;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type MaybePromise<T> = T | Promise<T>;

export interface LakeviewStep {
  step_id: string;
  task: string;
  summary: string;
  timestamp: string;
  tools_used: string[];
  success: boolean;
}