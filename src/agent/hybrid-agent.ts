import { EnhancedBaseAgent } from './enhanced-base-agent.js';
import { PlannerAgent } from './planner-agent.js';
import { LLMClient } from '../utils/llm_clients/llm-client.js';
import { ToolExecutor } from '../tools/base.js';
import { Config, AgentTrajectory } from '../types/index.js';
import { ExecutionPlan } from '../types/planning.js';
import { Logger } from '../utils/logging/logger.js';
import { randomUUID } from 'crypto';

/**
 * 混合Agent - 先规划再执行
 *
 * 核心特性：
 * - 两阶段执行：先使用PlannerAgent制定计划，再使用BaseAgent执行任务
 * - 智能工具管理：动态分配规划工具和执行工具
 * - 状态跟踪：跟踪规划和执行两个阶段的完整状态
 * - 灵活配置：可以自定义规划参数和执行参数
 */
export class HybridAgent extends EnhancedBaseAgent {
  /** 规划阶段Agent */
  private plannerAgent: PlannerAgent;

  /** 执行阶段配置 */
  private executionConfig: {
    maxSteps: number;
    enableAutoRetry: boolean;
    continueOnError: boolean;
  };

  /** 当前执行计划 */
  private currentPlan: ExecutionPlan | null = null;

  /** 执行阶段 */
  private currentExecutionPhase: 'planning' | 'executing' | 'completed' = 'planning';

  constructor(
    agentId: string,
    llmClient: LLMClient,
    tools: ToolExecutor[],
    config: Config,
    logger: Logger,
    workingDirectory: string,
    options: {
      planningOptions?: any;
      executionConfig?: {
        maxSteps?: number;
        enableAutoRetry?: boolean;
        continueOnError?: boolean;
      };
    } = {}
  ) {
    super(agentId, llmClient, tools, config, logger, workingDirectory);

    // 分离规划工具和执行工具
    const { planningTools, executionTools } = this.separateTools(tools);

    // 创建规划Agent
    this.plannerAgent = new PlannerAgent(
      `${agentId}_planner`,
      llmClient,
      planningTools,
      config,
      logger,
      workingDirectory,
      options.planningOptions
    );

    // 配置执行参数
    this.executionConfig = {
      maxSteps: options.executionConfig?.maxSteps || 30,
      enableAutoRetry: options.executionConfig?.enableAutoRetry ?? true,
      continueOnError: options.executionConfig?.continueOnError ?? false,
    };

    this.logger.info(`混合Agent初始化完成 - 规划工具: ${planningTools.length}, 执行工具: ${executionTools.length}`);
  }

  /**
   * 分离规划工具和执行工具
   */
  private separateTools(tools: ToolExecutor[]): {
    planningTools: ToolExecutor[];
    executionTools: ToolExecutor[];
  } {
    const planningTools: ToolExecutor[] = [];
    const executionTools: ToolExecutor[] = [];

    const planningToolNames = ['planner_tool', 'planner', 'sequential_thinking_tool', 'sequentialthinking', 'complete_task_tool', 'complete_task'];
    const executionToolNames = ['edit_tool', 'bash_tool', 'file_tool', 'json_edit_tool', 'search_tool'];

    tools.forEach(tool => {
      const toolName = tool.name.toLowerCase();

      if (planningToolNames.some(name => toolName.includes(name))) {
        planningTools.push(tool);
      } else if (executionToolNames.some(name => toolName.includes(name))) {
        executionTools.push(tool);
      } else {
        // 默认归类为执行工具
        executionTools.push(tool);
      }
    });

    return { planningTools, executionTools };
  }

  /**
   * 获取系统提示词
   */
  protected getSystemPrompt(): string {
    const currentTime = new Date().toISOString();

    return `你是一个智能混合Agent，能够先进行任务规划，然后执行具体任务。

## 核心工作流程
1. **规划阶段**：使用内置的规划Agent制定详细执行计划
2. **执行阶段**：根据计划逐步执行具体任务
3. **总结阶段**：汇总执行结果并提供完整报告

## 执行原则
- 严格按照计划执行，确保任务完成的系统性
- 遇到错误时智能处理，可以重试或调整策略
- 保持详细的工作记录，便于追踪和调试
- 在执行过程中发现计划问题时，可以动态调整

## 当前时间
${currentTime}

请以专业、高效的方式完成规划到执行的完整流程。`;
  }

  /**
   * 重写执行方法 - 实现两阶段执行
   */
  override async execute(objective: string, maxSteps?: number): Promise<AgentTrajectory> {
    this.logger.info(`🚀 混合Agent开始执行任务: ${objective}`);
    this.trajectory.task = objective;
    this.currentExecutionPhase = 'planning';

    try {
      // 第一阶段：规划
      this.logger.info(`📋 第一阶段：任务规划`);
      const planningTrajectory = await this.planningPhase(objective);
      console.log(JSON.stringify(this.currentPlan, null, 2));
      // 第二阶段：执行
      if (this.currentPlan && this.currentPlan.tasks.length > 0) {
        this.logger.info(`⚡ 第二阶段：任务执行`);
        this.currentExecutionPhase = 'executing';
        const executionTrajectory = await this.performExecutionPhase();

        // 合并轨迹
        this.mergeTrajectories(planningTrajectory, executionTrajectory);
      } else {
        this.logger.warn(`没有生成有效的执行计划，跳过执行阶段`);
      }

      // 完成处理
      this.currentExecutionPhase = 'completed';
      this.trajectory.completed = true;
      this.trajectory.success = true;
      this.trajectory.end_time = new Date().toISOString();

      this.logger.info(`✅ 混合Agent任务完成！`);
      return this.trajectory;

    } catch (error) {
      this.logger.error(`混合Agent执行失败: ${error}`);
      this.trajectory.completed = true;
      this.trajectory.success = false;
      this.trajectory.end_time = new Date().toISOString();
      throw error;
    }
  }

  /**
   * 规划阶段
   */
  private async planningPhase(objective: string): Promise<AgentTrajectory> {
    this.logger.info(`开始规划阶段，目标: ${objective}`);

    // 使用规划Agent生成计划
    const planningTrajectory = await this.plannerAgent.execute(objective, 12);

    // 获取生成的计划
    this.currentPlan = this.plannerAgent.getCurrentPlan();

    if (this.currentPlan) {
      this.logger.info(`✅ 规划完成，生成 ${this.currentPlan.tasks.length} 个任务`);
      this.logger.info(`计划摘要: ${this.currentPlan.title}`);

      // 记录计划到轨迹
      const planningStep: any = {
        step_id: randomUUID(),
        task: objective,
        phase: 'planning',
        plan: this.currentPlan,
        completed: true,
        timestamp: new Date().getTime(),
      };

      this.trajectory.steps.push(planningStep);
    } else {
      throw new Error('规划阶段未能生成有效的执行计划');
    }

    return planningTrajectory;
  }

  /**
   * 执行阶段
   */
  private async performExecutionPhase(): Promise<AgentTrajectory> {
    if (!this.currentPlan || this.currentPlan.tasks.length === 0) {
      throw new Error('没有可执行的计划');
    }

    this.logger.info(`开始执行阶段，共 ${this.currentPlan.tasks.length} 个任务`);

    const executionTrajectory: AgentTrajectory = {
      agent_id: `${this.agentId}_execution`,
      task: this.trajectory.task,
      steps: [],
      completed: false,
      success: false,
      start_time: new Date().toISOString(),
    };

    let completedTasks = 0;
    let failedTasks = 0;

    // 逐步执行计划中的任务
    for (let i = 0; i < this.currentPlan.tasks.length; i++) {
      const task = this.currentPlan.tasks[i];
      this.logger.info(`执行任务 ${i + 1}/${this.currentPlan.tasks.length}: ${task.title}`);

      try {
        // 构建任务执行提示
        const taskPrompt = this.buildTaskExecutionPrompt(task, i);

        // 执行任务
        const taskResult = await this.executeTask(taskPrompt, task);

        if (taskResult.success) {
          completedTasks++;
          this.logger.info(`✅ 任务完成: ${task.title} (${taskResult.steps} 步)`);
        } else {
          failedTasks++;
          this.logger.error(`❌ 任务失败: ${task.title} - ${taskResult.error}`);

          if (!this.executionConfig.continueOnError) {
            throw new Error(`任务执行失败: ${task.title}`);
          }
        }

        // 记录任务执行步骤
        const executionStep: any = {
          step_id: randomUUID(),
          task: task.title,
          phase: 'execution',
          task_index: i,
          task_data: task,
          result: taskResult,
          completed: taskResult.success,
          timestamp: new Date().getTime(),
        };

        this.trajectory.steps.push(executionStep);
        executionTrajectory.steps.push(executionStep);

        // 简单的任务间隔，避免过快执行
        if (i < this.currentPlan.tasks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        failedTasks++;
        this.logger.error(`任务执行异常: ${task.title} - ${error}`);

        // 即使异常也记录执行步骤
        const errorStep: any = {
          step_id: randomUUID(),
          task: task.title,
          phase: 'execution',
          task_index: i,
          task_data: task,
          result: { success: false, error: String(error) },
          completed: false,
          timestamp: new Date().getTime(),
          error: String(error)
        };

        this.trajectory.steps.push(errorStep);
        executionTrajectory.steps.push(errorStep);

        if (!this.executionConfig.continueOnError) {
          throw error;
        }
      }
    }

    // 更新执行状态
    executionTrajectory.completed = true;
    executionTrajectory.success = failedTasks === 0;
    executionTrajectory.end_time = new Date().toISOString();

    this.logger.info(`执行阶段完成 - 成功: ${completedTasks}, 失败: ${failedTasks}`);

    return executionTrajectory;
  }

  /**
   * 构建任务执行提示
   */
  private buildTaskExecutionPrompt(task: any, taskIndex: number): string {
    const context = {
      currentTask: task,
      taskIndex: taskIndex + 1,
      totalTasks: this.currentPlan?.tasks.length || 0,
      planTitle: this.currentPlan?.title,
      planObjective: this.currentPlan?.objective,
    };

    return `请执行以下任务（第 ${context.taskIndex}/${context.totalTasks} 个）：

**任务标题**: ${task.title}
**任务描述**: ${task.description || '无描述'}
**优先级**: ${task.priority || 'medium'}
**预计时间**: ${task.estimated_duration || 5} 分钟

**计划背景**:
- 计划标题: ${context.planTitle}
- 总体目标: ${context.planObjective}

**执行原则**：
- 分析任务需求并选择合适的工具
- 按照任务的优先级和描述要求执行
- 确保执行结果的准确性和完整性
- 完成后使用 complete_task 工具标记任务完成

**工作目录**：当前工作目录是 ${this.workingDirectory}

请根据任务的具体要求选择合适的工具和方法来完成这个任务。`;
  }

  
  /**
   * 执行单个任务
   */
  private async executeTask(taskPrompt: string, task: any): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    steps?: number;
  }> {
    try {
      // 设置合理的步数限制
      const maxTaskSteps = Math.min(8, this.executionConfig.maxSteps);
      this.logger.info(`开始执行任务，最大步数: ${maxTaskSteps}`);

      // 使用BaseAgent的执行逻辑
      const taskTrajectory = await super.execute(taskPrompt, maxTaskSteps);

      const result = {
        success: taskTrajectory.success,
        result: taskTrajectory.final_result || '任务执行完成',
        error: taskTrajectory.success ? undefined : '任务执行失败',
        steps: taskTrajectory.steps.length
      };

      this.logger.info(`任务执行完成，成功: ${result.success}, 步数: ${result.steps}`);

      return result;

    } catch (error) {
      this.logger.error(`任务执行异常: ${error}`);
      return {
        success: false,
        error: String(error),
        steps: 0
      };
    }
  }

  /**
   * 合并轨迹信息
   */
  private mergeTrajectories(planningTrajectory: AgentTrajectory, executionTrajectory: AgentTrajectory): void {
    // 保留当前轨迹的基础信息
    // 执行步骤已经在executionPhase中添加到this.trajectory

    // 可以在这里添加额外的合并逻辑，比如统计信息等
    this.trajectory.final_result = `规划完成并执行 ${this.currentPlan?.tasks.length || 0} 个任务`;
  }

  /**
   * 获取当前计划
   */
  getCurrentPlan(): ExecutionPlan | null {
    return this.currentPlan;
  }

  /**
   * 获取执行阶段
   */
  getExecutionPhase(): 'planning' | 'executing' | 'completed' {
    return this.currentExecutionPhase;
  }

  /**
   * 获取执行摘要
   */
  getExecutionSummary(): {
    planId: string;
    totalTasks: number;
    currentPhase: string;
    hasPlan: boolean;
  } {
    return {
      planId: this.currentPlan?.id || 'no-plan',
      totalTasks: this.currentPlan?.tasks.length || 0,
      currentPhase: this.currentExecutionPhase,
      hasPlan: !!this.currentPlan,
    };
  }

  /**
   * 重写stop方法，同时停止规划Agent
   */
  override stop(): void {
    super.stop();
    this.plannerAgent.stop();
    this.logger.info('混合Agent已停止');
  }
}