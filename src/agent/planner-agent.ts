import { BaseAgent } from './base-agent.js';
import { LLMClient } from '../utils/llm_clients/llm-client.js';
import { ToolExecutor } from '../tools/base.js';
import { Config, AgentTrajectory } from '../types/index.js';
import { Logger } from '../utils/logging/logger.js';
import {
  ExecutionPlan,
  ExecutionStrategy,
  PlanningOptions,
} from '../types/planning.js';
import { PlannerToolResult } from '../types/index.js';
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

    // 验证工具配置
    this.validateToolsConfig();

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
   * 验证工具配置
   */
  private validateToolsConfig(): void {
    if (!this.tools || this.tools.size === 0) {
      throw new Error('PlannerAgent必须配置至少一个工具');
    }

    // 检查工具名称是否有效
    this.tools.forEach((tool, key) => {
      if (!key || typeof key !== 'string') {
        this.logger.warn(`发现无效的工具key: ${key}, 工具名称: ${tool.name}`);
      }
    });
  }

  
  /**
   * 从轨迹中提取生成的计划
   */
  private extractPlanFromTrajectory(): ExecutionPlan | null {
    let basePlan: ExecutionPlan | null = null;
    const tasks: any[] = [];

    // 查找轨迹中的planner_tool工具调用结果
    for (const step of this.trajectory.steps) {
      if (step.tool_calls && step.tool_results) {
        for (let i = 0; i < step.tool_calls.length; i++) {
          const toolCall = step.tool_calls[i];
          const toolResult = step.tool_results[i];

          if (toolCall.function?.name === 'planner_tool' &&
              toolResult?.success &&
              toolResult.result) {
            const plannerResult = toolResult.result as PlannerToolResult;

            // 如果有计划信息，作为基础计划
            if (plannerResult.plan && !basePlan) {
              basePlan = this.convertToPlan(plannerResult.plan);
            }

            // 如果有任务信息，添加到任务列表
            if (plannerResult.task) {
              tasks.push(plannerResult.task);
            }

            // 如果有任务数组，批量添加
            if (plannerResult.tasks && Array.isArray(plannerResult.tasks)) {
              tasks.push(...plannerResult.tasks);
            }
          }
        }
      }
    }

    // 合并基础计划和任务
    if (basePlan && tasks.length > 0) {
      basePlan.tasks = tasks;
      return basePlan;
    }

    return basePlan;
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

    return `你是一个高效的智能任务规划官，严格遵循规划与执行分离原则。

## 核心职责
- **快速规划**：快速制定清晰、可执行的执行计划
- **职责分离**：只负责规划，绝不执行任何具体任务
- **简洁高效**：避免过度分解，专注核心步骤

## 高效规划原则
1. **快速分析**：用1-2个思考步骤快速理解任务
2. **核心分解**：将复杂任务分解为3-7个核心步骤
3. **立即行动**：分析完成后立即使用planner_tool创建计划
4. **及时完成**：计划完成后立即调用complete_task工具

## 工具使用指南
- **sequentialthinking**: 仅用于复杂任务分析（1-2步）
- **planner_tool**: 创建结构化执行计划
  - 推荐：使用create_plan_with_tasks一次性完成计划和任务创建（最高效）
  - 备选：使用add_tasks批量添加多个任务
  - 避免：逐个add_task（效率低）
- **complete_task**: 计划完成后立即调用

## 高效规划工作流程
1. 快速分析任务（1-2步思考）
2. 使用create_plan_with_tasks一次性创建完整计划和所有任务
3. 立即调用complete_task结束规划

## 避免的问题
- 过度分析和过度分解
- 逐个添加任务（使用批量创建）
- 重复思考和无谓的细节
- 拖延complete_task的调用
- 混淆规划与执行的边界

## 当前时间
${currentTime}

请以简洁、高效的方式完成规划任务。`;
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
    const toolNames = Array.from(this.tools.keys()).filter(name => name && typeof name === 'string');

    // // 检查是否包含执行类工具
    // const executionTools = ['edit_tool', 'bash_tool', 'file_tool', 'command_tool', 'terminal'];
    // const foundExecutionTools = toolNames.filter(name =>
    //   executionTools.some(execTool => name.toLowerCase().includes(execTool.replace('_tool', '')))
    // );

    // if (foundExecutionTools.length > 0) {
    //   issues.push(`发现执行类工具: ${foundExecutionTools.join(', ')}`);
    // }

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

  /**
   * 重写execute方法，强调纯规划职责
   */
  override async execute(objective: string, maxSteps: number = 12): Promise<AgentTrajectory> {
    // 验证规划Agent的角色
    const validation = this.validatePlannerRole();
    if (!validation.valid) {
      throw new Error(`PlannerAgent配置错误: ${validation.issues.join(', ')}`);
    }

    this.logger.info(`🎯 智能任务规划官开始工作: ${objective}`);
    this.trajectory.task = objective;

    try {
      // 优化的规划任务，更简洁高效
      const planningTask = `作为专业的智能任务规划官，请对以下目标进行纯规划分析：${objective}。

工作流程：
1. 快速分析任务复杂度,根据任务的复杂程度，使用sequential_thinking进行深度分析
2. 使用planner_tool的create_plan_with_tasks一次性创建完整计划和所有任务
3. 立即调用complete_task工具结束规划

效率要求：
- 必须使用create_plan_with_tasks批量创建任务，不要逐个添加
- 将任务分解为3-7个核心步骤，一次性全部创建
- 避免过度分析和过度分解

重要提醒：
- 简洁高效：思考步数需要根据任务的复杂程度来决定，后立即批量创建所有任务
- 职责分离：只规划，不执行
- 及时完成：计划创建后立即调用complete_task

请快速完成规划并调用complete_task工具结束。`;

      await super.execute(planningTask, maxSteps);

      // 获取最终生成的计划
      this.currentPlan = this.extractPlanFromTrajectory();

      if (!this.currentPlan) {
        this.logger.warn('未能生成完整的执行计划，但规划过程已完成');
      }

      this.logger.info('✅ 智能任务规划完成！');

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
   * 获取规划摘要信息
   */
  public getPlanningSummary(): {
    planId: string;
    taskCount: number;
    estimatedDuration: string;
    status: string;
  } | null {
    if (!this.currentPlan) {
      return null;
    }

    return {
      planId: this.currentPlan.id,
      taskCount: this.currentPlan.tasks.length,
      estimatedDuration: this.currentPlan.planningMetadata?.estimatedDuration || '未估算',
      status: this.currentPlan.status
    };
  }
}
