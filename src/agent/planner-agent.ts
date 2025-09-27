import { BaseAgent } from './base-agent.js';
import { LLMClient } from '../utils/llm_clients/llm-client.js';
import { ToolExecutor } from '../tools/base.js';
import { Config, AgentTrajectory } from '../types/index.js';
import { Logger } from '../utils/logging/logger.js';
import {
  Task,
  ExecutionPlan,
  TaskStatus,
  TaskPriority,
  TaskType,
  TaskPhase,
  PlanStatus,
  ExecutionStrategy,
  PlanningOptions,
  PlanAdjustmentOptions,
  TaskExecutionContext,
  PlanningAnalysis,
  PlanExecutionEvent,
  TaskResult,
  ReasoningPath,
  QualityMetrics,
  PlanningMetadata,
  ReasoningTechnique,
  RiskLevel,
  ComplexityLevel
} from '../types/planning.js';
import { randomUUID } from 'crypto';

/**
 * 智能任务规划官Agent - 精简版
 * 
 * 核心特性：
 * - 基于ReAct模式：通过LLM智能推理和工具调用实现高质量规划
 * - 精简提示词：使用清晰明确的提示词让LLM自主思考和规划
 * - 工具驱动：通过planner_tool和sequential_thinking等工具实现智能化
 * - 去除硬编码：不再依赖复杂的代码逻辑判断，完全由LLM决策
 */
export class PlannerAgent extends BaseAgent {
  /** 当前执行计划 */
  private currentPlan: ExecutionPlan | null = null;
  
  /** 规划选项 */
  private planningOptions: PlanningOptions;
  
  /** 默认执行策略 */
  private defaultStrategy: ExecutionStrategy = {
    allowParallel: true,
    maxParallelTasks: 3,
    failureHandling: 'retry',
    autoRetry: true,
    maxRetries: 2,
    retryInterval: 30,
    timeout: 60
  };

  constructor(
    agentId: string,
    llmClient: LLMClient,
    tools: ToolExecutor[],
    config: Config,
    logger: Logger,
    workingDirectory: string,
    planningOptions?: Partial<PlanningOptions>
  ) {
    super(agentId, llmClient, tools, config, logger, workingDirectory);
    
    this.planningOptions = {
      maxDecompositionDepth: 4,
      optimizeParallel: true,
      autoEstimateTime: true,
      strategy: 'balanced',
      granularity: 'medium',
      ...planningOptions
    };
  }

  /**
   * 智能任务规划官的主执行方法
   * ReAct模式：通过工具调用让LLM进行智能推理和规划
   */
  override async execute(objective: string, maxSteps: number = 50): Promise<AgentTrajectory> {
    this.logger.info(`🎯 智能任务规划官开始工作: ${objective}`);
    this.trajectory.task = objective;
    
    try {
      // 使用BaseAgent的ReAct模式进行智能规划
      await super.execute(`对以下目标进行智能任务规划：${objective}。请使用planner_tool创建计划，必要时使用sequential_thinking进行深度分析。`, maxSteps);
      
      // 获取最终生成的计划
      this.currentPlan = this.extractPlanFromTrajectory();
      
      this.logger.info('✅ 智能任务规划完成！已生成高质量执行计划');
      
      return this.trajectory;
      
    } catch (error) {
      this.logger.error(`智能规划失败: ${error}`);
      this.trajectory.completed = true;
      this.trajectory.success = false;
      this.trajectory.end_time = new Date().toISOString();
      throw error;
    }
  }

  /**
   * 从轨迹中提取生成的计划
   */
  private extractPlanFromTrajectory(): ExecutionPlan | null {
    // 查找轨迹中的planner_tool工具调用结果
    for (const step of this.trajectory.steps) {
      if (step.tool_calls) {
        for (const toolCall of step.tool_calls) {
          if (toolCall.function?.name === 'planner_tool' && 
              (toolCall as any).result?.success && 
              (toolCall as any).result?.result?.plan) {
            return this.convertToPlan((toolCall as any).result.result.plan);
          }
        }
      }
    }
    return null;
  }
  
  /**
   * 转换工具返回的计划数据为标准格式
   */
  private convertToPlan(planData: any): ExecutionPlan {
    return {
      id: planData.id || randomUUID(),
      title: planData.title || '智能执行计划',
      description: planData.description || '基于智能规划官制定的高质量执行计划',
      objective: planData.objective || this.trajectory.task || '',
      status: 'ready',
      tasks: planData.tasks || [],
      strategy: { ...this.defaultStrategy },
      createdAt: planData.created_at ? new Date(planData.created_at) : new Date(),
      updatedAt: new Date(),
      progress: planData.progress || 0,
      executionHistory: [],
      planningMetadata: {
        complexityLevel: 'medium',
        estimatedDuration: '由LLM智能评估',
        riskLevel: 'medium',
        techniquesUsed: ['react', 'cot'],
        createdAt: new Date()
      },
      reasoningPath: {
        selectedApproach: 'ReAct模式智能规划',
        alternativePaths: ['传统规划方法', '模板化分解'],
        decisionRationale: '基于LLM的深度理解和推理能力，通过ReAct模式实现精准规划'
      }
    };
  }

  /**
   * 获取系统提示词（BaseAgent要求的抽象方法实现）
   */
  protected getSystemPrompt(): string {
    const currentTime = new Date().toISOString();
    
    // 动态获取实际可用工具列表（只应该包含规划相关工具）
    const availableTools = Array.from(this.tools.keys());
    const toolsList = availableTools.map(toolName => {
      const tool = this.tools.get(toolName);
      return `- ${toolName}: ${tool?.definition?.description || '工具描述'}`;
    }).join('\n');
    
    return `你是一个专业的智能任务规划官，严格遵循规划与执行分离原则。

## 核心职责
- **纯规划职能**：只负责制定计划，绝不执行具体任务
- **智能分析**：深入理解目标的本质需求和实现路径
- **精准分解**：生成具体、可执行、按顺序排列的任务步骤
- **质量保证**：确保计划的完整性、可行性、效率性

## 工作原则
1. **专业分工**：我负责规划，执行Agent负责执行
2. **高质量输出**：每个计划都经过深度分析和结构化设计
3. **标准格式**：输出符合系统标准的计划格式
4. **职责边界**：绝不越权执行文件操作或业务逻辑

## 标准工作流程
1. 使用sequential_thinking深入分析任务目标
2. 理解任务的复杂度、依赖关系和执行顺序
3. 使用planner_tool创建结构化的执行计划
4. 确保每个任务都是原子性的、可执行的操作
5. 输出完整的计划供执行Agent使用

## 计划质量标准
- **完整性**：覆盖目标达成的所有必要步骤
- **可行性**：每个任务都是具体可执行的操作
- **效率性**：合理的执行顺序和资源利用
- **清晰性**：任务描述明确，不产生歧义

## 当前可用工具
${toolsList}

## 重要提醒
- 你只是规划官，不是执行者
- 不要尝试直接操作文件、运行命令或执行业务逻辑
- 专注于制定高质量的执行计划
- 计划制定完成后，交给执行Agent完成

## 当前时间
${currentTime}

请始终保持专业、高效、精准的规划风格，严格遵循职责边界。`;
  }

  /**
   * 获取当前计划（供外部系统查询）
   */
  getCurrentPlan(): ExecutionPlan | null {
    return this.currentPlan;
  }
  
  /**
   * 验证是否为纯规划Agent
   * 确保没有执行相关的工具
   */
  public validatePlannerRole(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const toolNames = Array.from(this.tools.keys());
    
    // 检查是否包含执行类工具
    const executionTools = ['edit_tool', 'bash_tool', 'file_tool', 'command_tool', 'terminal'];
    const foundExecutionTools = toolNames.filter(name => 
      executionTools.some(execTool => name.toLowerCase().includes(execTool.replace('_tool', '')))
    );
    
    if (foundExecutionTools.length > 0) {
      issues.push(`发现执行类工具: ${foundExecutionTools.join(', ')}`);
    }
    
    // 检查是否缺少规划工具
    const hasPlannerTool = toolNames.some(name => name.toLowerCase().includes('planner'));
    const hasThinkingTool = toolNames.some(name => name.toLowerCase().includes('thinking'));
    
    if (!hasPlannerTool) {
      issues.push('缺少planner_tool规划工具');
    }
    
    if (!hasThinkingTool) {
      issues.push('缺少sequential_thinking分析工具');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}
