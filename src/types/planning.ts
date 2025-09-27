/**
 * 规划相关的类型定义
 * 支持复杂任务分解、依赖管理和动态调整
 */

/**
 * 任务阶段枚举
 */
export type TaskPhase = 'research_setup' | 'planning' | 'implementation' | 'testing' | 'completion';

/**
 * 推理技术枚举
 */
export type ReasoningTechnique = 'few_shot' | 'cot' | 'tot' | 'maieutic' | 'least_to_most' | 'react';

/**
 * 风险等级
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * 复杂度等级
 */
export type ComplexityLevel = 'low' | 'medium' | 'high';

/**
 * 推理路径信息
 */
export interface ReasoningPath {
  selectedApproach: string;
  alternativePaths: string[];
  decisionRationale: string;
}

/**
 * 质量指标
 */
export interface QualityMetrics {
  completenessScore: number; // 完整性评分 (0-100)
  feasibilityScore: number;  // 可行性评分 (0-100)
  efficiencyScore: number;   // 效率评分 (0-100)
}

/**
 * 规划元数据
 */
export interface PlanningMetadata {
  complexityLevel: ComplexityLevel;
  estimatedDuration: string;
  riskLevel: RiskLevel;
  techniquesUsed: ReasoningTechnique[];
  createdAt: Date;
}

/**
 * 任务状态枚举
 */
export type TaskStatus = 
  | 'pending'     // 待执行
  | 'in_progress' // 执行中
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'blocked'     // 被阻塞
  | 'cancelled';  // 已取消

/**
 * 任务优先级枚举
 */
export type TaskPriority = 'high' | 'medium' | 'low';

/**
 * 任务类型枚举
 */
export type TaskType = 
  | 'analysis'    // 分析任务
  | 'development' // 开发任务
  | 'testing'     // 测试任务
  | 'deployment'  // 部署任务
  | 'research'    // 研究任务
  | 'review'      // 审查任务
  | 'other';      // 其他任务

/**
 * 任务执行结果
 */
export interface TaskResult {
  success: boolean;
  result?: any;
  error?: string;
  output?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * 单个任务定义
 */
export interface Task {
  /** 任务唯一标识符 */
  id: string;
  
  /** 任务标题 */
  title: string;
  
  /** 任务详细描述 */
  description: string;
  
  /** 任务类型 */
  type: TaskType;
  
  /** 任务状态 */
  status: TaskStatus;
  
  /** 任务优先级 */
  priority: TaskPriority;
  
  /** 任务阶段 */
  phase: TaskPhase;
  
  /** 依赖的任务ID列表 */
  dependencies: string[];
  
  /** 可以并行执行的任务ID列表 */
  parallelWith?: string[];
  
  /** 估算执行时间（分钟） */
  estimatedDuration?: number;
  
  /** 实际执行时间（分钟） */
  actualDuration?: number;
  
  /** 任务创建时间 */
  createdAt: Date;
  
  /** 任务开始时间 */
  startedAt?: Date;
  
  /** 任务完成时间 */
  completedAt?: Date;
  
  /** 任务执行结果 */
  result?: TaskResult;
  
  /** 子任务列表 */
  subTasks?: Task[];
  
  /** 任务参数 */
  parameters?: Record<string, any>;
  
  /** 执行上下文 */
  context?: Record<string, any>;
  
  /** 重试次数 */
  retryCount?: number;
  
  /** 最大重试次数 */
  maxRetries?: number;
  
  /** 任务备注 */
  notes?: string[];
  
  // === 新增字段：智能规划支持 ===
  
  /** 推理依据 */
  reasoning?: string;
  
  /** 所需输入 */
  inputs?: string;
  
  /** 预期输出 */
  outputs?: string;
  
  /** 风险评估 */
  riskAssessment?: string;
  
  /** 风险等级 */
  riskLevel?: RiskLevel;
  
  /** 异常回滚步骤 */
  rollback?: string;
  
  /** 验证标准 */
  validationCriteria?: string;
  
  /** 是否为原子操作 */
  isAtomic?: boolean;
  
  /** 幂等性保证 */
  idempotencyKey?: string;
}

/**
 * 执行计划状态
 */
export type PlanStatus = 
  | 'planning'   // 规划中
  | 'ready'      // 准备执行
  | 'executing'  // 执行中
  | 'paused'     // 暂停
  | 'completed'  // 已完成
  | 'failed'     // 失败
  | 'cancelled'; // 已取消

/**
 * 执行计划
 */
export interface ExecutionPlan {
  /** 计划唯一标识符 */
  id: string;
  
  /** 计划标题 */
  title: string;
  
  /** 计划描述 */
  description: string;
  
  /** 原始目标 */
  objective: string;
  
  /** 计划状态 */
  status: PlanStatus;
  
  /** 任务列表 */
  tasks: Task[];
  
  /** 任务依赖图 */
  dependencyGraph?: Record<string, string[]>;
  
  /** 执行策略 */
  strategy: ExecutionStrategy;
  
  /** 计划创建时间 */
  createdAt: Date;
  
  /** 计划更新时间 */
  updatedAt: Date;
  
  /** 计划开始时间 */
  startedAt?: Date;
  
  /** 计划完成时间 */
  completedAt?: Date;
  
  /** 总估算时间 */
  totalEstimatedDuration?: number;
  
  /** 总实际时间 */
  totalActualDuration?: number;
  
  /** 计划执行进度 (0-1) */
  progress: number;
  
  /** 执行历史 */
  executionHistory: PlanExecutionEvent[];
  
  /** 计划元数据 */
  metadata?: Record<string, any>;
  
  // === 新增字段：智能规划支持 ===
  
  /** 规划元数据 */
  planningMetadata?: PlanningMetadata;
  
  /** 推理路径 */
  reasoningPath?: ReasoningPath;
  
  /** 质量指标 */
  qualityMetrics?: QualityMetrics;
  
  /** 使用的推理技术 */
  reasoningTechniques?: ReasoningTechnique[];
  
  /** 智能分析结果 */
  intelligentAnalysis?: string;
  
  /** 自我反思结果 */
  selfReflection?: string[];
  
  /** 动态优化历史 */
  optimizationHistory?: string[];
}

/**
 * 执行策略
 */
export interface ExecutionStrategy {
  /** 是否支持并行执行 */
  allowParallel: boolean;
  
  /** 最大并行任务数 */
  maxParallelTasks: number;
  
  /** 失败时的处理策略 */
  failureHandling: 'stop' | 'continue' | 'retry' | 'skip';
  
  /** 超时处理（分钟） */
  timeout?: number;
  
  /** 是否自动重试 */
  autoRetry: boolean;
  
  /** 最大重试次数 */
  maxRetries: number;
  
  /** 重试间隔（秒） */
  retryInterval: number;
}

/**
 * 计划执行事件
 */
export interface PlanExecutionEvent {
  /** 事件ID */
  id: string;
  
  /** 事件类型 */
  type: 'task_started' | 'task_completed' | 'task_failed' | 'plan_paused' | 'plan_resumed' | 'plan_adjusted';
  
  /** 相关任务ID */
  taskId?: string;
  
  /** 事件时间 */
  timestamp: Date;
  
  /** 事件描述 */
  description: string;
  
  /** 事件数据 */
  data?: any;
}

/**
 * 规划选项
 */
export interface PlanningOptions {
  /** 最大任务分解深度 */
  maxDecompositionDepth: number;
  
  /** 是否优化并行执行 */
  optimizeParallel: boolean;
  
  /** 是否自动估算时间 */
  autoEstimateTime: boolean;
  
  /** 规划策略 */
  strategy: 'comprehensive' | 'minimal' | 'balanced';
  
  /** 任务细粒度 */
  granularity: 'fine' | 'medium' | 'coarse';
  
  /** 额外约束 */
  constraints?: Record<string, any>;
}

/**
 * 计划调整选项
 */
export interface PlanAdjustmentOptions {
  /** 调整原因 */
  reason: string;
  
  /** 失败的任务ID */
  failedTaskId?: string;
  
  /** 新的约束 */
  newConstraints?: Record<string, any>;
  
  /** 是否重新优化整个计划 */
  reoptimize: boolean;
  
  /** 调整策略 */
  strategy: 'minimal' | 'comprehensive';
}

/**
 * 任务执行上下文
 */
export interface TaskExecutionContext {
  /** 当前计划 */
  plan: ExecutionPlan;
  
  /** 当前任务 */
  task: Task;
  
  /** 已完成的任务 */
  completedTasks: Task[];
  
  /** 执行环境 */
  environment: Record<string, any>;
  
  /** 工作目录 */
  workingDirectory: string;
  
  /** 全局参数 */
  globalParameters: Record<string, any>;
}

/**
 * 规划分析结果
 */
export interface PlanningAnalysis {
  /** 复杂度评估 */
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  
  /** 估算总时间（分钟） */
  estimatedTotalTime: number;
  
  /** 关键路径任务ID */
  criticalPath: string[];
  
  /** 可并行执行的任务组 */
  parallelGroups: string[][];
  
  /** 潜在风险 */
  risks: string[];
  
  /** 优化建议 */
  suggestions: string[];
  
  /** 资源需求 */
  resourceRequirements: Record<string, any>;
}