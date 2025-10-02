import { BaseAgent } from './base-agent.js';
import { LLMClient } from '../utils/llm_clients/llm-client.js';
import { ToolExecutor } from '../tools/base.js';
import { Config, AgentTrajectory } from '../types/index.js';
import { Logger } from '../utils/logging/logger.js';
import {
  TravelPlan,
  TravelPlanningRequest,
  TravelPlanExecutionStatus
} from '../types/travel-planning.js';
import { randomUUID } from 'crypto';

/**
 * 智能旅游计划Agent
 *
 * 核心功能：
 * 1. 规划阶段：根据用户需求创建详细的旅游计划
 * 2. 执行阶段：按计划执行每个步骤，处理预订和问题
 * 3. 智能调度：根据实际情况调整计划
 * 4. 实时监控：跟踪预算、时间和活动状态
 */
export class TravelAgent extends BaseAgent {
  private currentPlan: TravelPlan | null = null;
  private executionStatus: TravelPlanExecutionStatus | null = null;
  private currentPhase: 'planning' | 'execution' | 'completed' = 'planning';

  constructor(
    agentId: string,
    llmClient: LLMClient,
    tools: ToolExecutor[],
    config: Config,
    logger: Logger,
    workingDirectory: string
  ) {
    super(agentId, llmClient, tools, config, logger, workingDirectory);
  }

  /**
   * 旅游计划的主要执行方法
   */
  async executeTravelPlanning(request: TravelPlanningRequest): Promise<TravelPlan> {
    this.logger.info(`🌍 开始旅游规划: ${request.destination}`);
    this.currentPhase = 'planning';

    try {
      // 第一阶段：规划
      await this.planningPhase(request);

      // 第二阶段：执行（可选）
      if (this.currentPlan) {
        await this.executionPhase();
      }

      return this.currentPlan!;

    } catch (error) {
      this.logger.error(`旅游规划失败: ${error}`);
      throw error;
    }
  }

  /**
   * 规划阶段：创建详细的旅游计划
   */
  private async planningPhase(request: TravelPlanningRequest): Promise<void> {
    this.logger.info('📋 进入规划阶段');

    const planningPrompt = `作为专业的旅游规划师，请根据用户需求制定详细的旅游计划。

用户需求：
- 目的地：${request.destination}
- 日期：${request.startDate} 至 ${request.endDate} (${this.calculateDuration(request.startDate, request.endDate)}天)
- 旅行者：${request.travelers.adults}成人${request.travelers.children > 0 ? ` + ${request.travelers.children}儿童` : ''}${request.travelers.infants > 0 ? ` + ${request.travelers.infants}婴儿` : ''}
- 预算：${request.budget.total} ${request.budget.currency}
- 旅行风格：${request.preferences.travelStyle}
- 兴趣爱好：${request.preferences.interests.join(', ')}

请严格按照以下步骤操作：

1. **第一步**：使用 travel_planner 工具创建旅游计划
   - action: "create_travel_plan"
   - request_data: 包含完整的用户需求信息

2. **第二步**：根据创建的计划，使用 travel_planner 工具添加具体活动
   - action: "add_activity"
   - 为每一天添加合适的活动

3. **第三步**：使用 travel_planner 工具获取费用估算
   - action: "estimate_costs"

4. **第四步**：使用 complete_task 工具结束规划阶段
   - result: 提供规划结果的简要总结
   - summary: 描述规划过程和主要成果

**重要提示**：
- 必须使用工具来完成规划任务
- 每个工具调用都要包含正确的参数
- 确保完成所有步骤后再调用 complete_tool

现在开始规划吧！`;

    await super.execute(planningPrompt, 20);

    // 提取生成的计划
    this.currentPlan = this.extractTravelPlanFromTrajectory();

    if (!this.currentPlan) {
      throw new Error('未能生成旅游计划');
    }

    this.logger.info(`✅ 旅游规划完成：${this.currentPlan.title}`);
  }

  /**
   * 执行阶段：按照计划执行具体任务
   */
  private async executionPhase(): Promise<void> {
    this.logger.info('🚀 进入执行阶段');
    this.currentPhase = 'execution';

    const executionPrompt = `作为专业的旅游执行助手，现在开始执行旅游计划。

当前计划：
- 计划ID：${this.currentPlan!.id}
- 目的地：${this.currentPlan!.destination.name}
- 日期：${this.currentPlan!.startDate} 至 ${this.currentPlan!.endDate}

请按照以下步骤执行：
1. 使用 travel_executor 工具加载计划
2. 依次执行每个活动
3. 处理预订和确认
4. 监控预算和时间
5. 处理突发情况

注意事项：
- 确保所有预订都已确认
- 关注天气和交通状况
- 控制预算不超支
- 保持灵活应对变化

完成所有任务后使用 complete_task 工具结束执行阶段。`;

    await super.execute(executionPrompt, 30);

    this.currentPhase = 'completed';
    this.logger.info('✅ 旅游执行完成');
  }

  /**
   * 获取当前旅游计划
   */
  getCurrentPlan(): TravelPlan | null {
    return this.currentPlan;
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(): TravelPlanExecutionStatus | null {
    return this.executionStatus;
  }

  /**
   * 获取当前阶段
   */
  getCurrentPhase(): 'planning' | 'execution' | 'completed' {
    return this.currentPhase;
  }

  /**
   * 更新计划
   */
  async updatePlan(updates: Partial<TravelPlan>): Promise<void> {
    if (!this.currentPlan) {
      throw new Error('没有活动的旅游计划');
    }

    Object.assign(this.currentPlan, updates);
    this.currentPlan.updatedAt = new Date();

    this.logger.info(`📝 旅游计划已更新`);
  }

  /**
   * 获取计划摘要
   */
  getPlanSummary(): {
    id: string;
    title: string;
    destination: string;
    duration: number;
    totalCost: number;
    currency: string;
    status: string;
    phase: string;
  } | null {
    if (!this.currentPlan) {
      return null;
    }

    return {
      id: this.currentPlan.id,
      title: this.currentPlan.title,
      destination: this.currentPlan.destination.name,
      duration: this.currentPlan.duration,
      totalCost: this.currentPlan.totalCost,
      currency: this.currentPlan.currency,
      status: this.currentPlan.status,
      phase: this.currentPhase
    };
  }

  /**
   * 从轨迹中提取旅游计划
   */
  private extractTravelPlanFromTrajectory(): TravelPlan | null {
    for (const step of this.trajectory.steps) {
      if (step.tool_calls && step.tool_results) {
        for (let i = 0; i < step.tool_calls.length; i++) {
          const toolCall = step.tool_calls[i];
          const toolResult = step.tool_results[i];

          if (toolCall.function?.name === 'travel_planner' &&
              toolResult?.success &&
              toolResult.result) {
            const plannerResult = toolResult.result as any;
            if (plannerResult.plan) {
              return this.convertToTravelPlan(plannerResult.plan);
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * 转换为标准旅游计划格式
   */
  private convertToTravelPlan(planData: any): TravelPlan {
    return {
      id: planData.id || randomUUID(),
      title: planData.title || '旅游计划',
      destination: planData.destination || { name: '未知目的地', country: '未知' },
      startDate: planData.startDate || new Date().toISOString().split('T')[0],
      endDate: planData.endDate || new Date().toISOString().split('T')[0],
      duration: planData.duration || 1,
      travelers: planData.travelers || { adults: 1, children: 0, infants: 0 },
      budget: planData.budget || { total: 0, currency: 'CNY', breakdown: {} },
      preferences: planData.preferences || {
        travelStyle: 'mid',
        interests: [],
        dietaryRestrictions: [],
        mobilityRequirements: [],
        language: ['zh']
      },
      itinerary: planData.itinerary || [],
      accommodation: planData.accommodation,
      transportation: planData.transportation || [],
      totalCost: planData.totalCost || 0,
      currency: planData.currency || 'CNY',
      createdAt: planData.created_at ? new Date(planData.created_at) : new Date(),
      updatedAt: new Date(),
      status: planData.status || 'draft'
    };
  }

  /**
   * 计算旅行天数
   */
  private calculateDuration(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * 获取系统提示词
   */
  protected getSystemPrompt(): string {
    const currentTime = new Date().toISOString();

    return `你是一个专业的智能旅游规划师和执行助手，专门帮助用户规划和管理完美的旅行体验。

## 核心职责
- **智能规划**：根据用户需求创建详细、个性化的旅游计划
- **精准执行**：按计划完成预订、安排和活动执行
- **实时监控**：跟踪预算、时间和进度
- **灵活调整**：应对突发情况，优化旅行体验

## 可用工具

### travel_planner (旅游规划工具)
用于创建和管理旅游计划，支持以下操作：
- create_travel_plan: 创建新的旅游计划
- get_travel_plan: 获取当前计划详情
- update_travel_plan: 更新计划信息
- add_activity: 向计划添加新活动
- remove_activity: 从计划中移除活动
- estimate_costs: 估算旅游总费用
- get_recommendations: 获取旅游建议和推荐

### travel_executor (旅游执行工具)
用于执行具体的旅行任务，支持以下操作：
- load_plan: 加载旅游计划开始执行
- execute_activity: 执行具体活动
- book_accommodation: 预订住宿
- book_transportation: 预订交通工具
- book_activity: 预订活动门票
- check_weather: 检查天气情况
- get_next_activity: 获取下一个待执行活动
- update_execution_status: 更新执行状态
- handle_issues: 处理执行中的问题

### complete_task (完成任务工具)
当任务完成时使用此工具：
- result: 提供任务完成的主要结果
- summary: 提供任务完成的总结

### sequential_thinking (深度分析工具)
用于复杂问题的深度分析和多方案评估

## 工具使用规则
1. **必须使用工具**：不要仅凭文本回答，一定要调用相应的工具
2. **参数完整**：确保每次工具调用都包含所有必需参数
3. **步骤清晰**：按照逻辑顺序使用工具完成复杂任务
4. **任务完成**：使用 complete_tool 标记任务完成

## 当前时间
${currentTime}

请始终保持专业、热情、细致的服务态度，为用户创造难忘的旅行体验。`;
  }

  /**
   * 验证旅游Agent配置
   */
  public validateTravelAgentSetup(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const toolNames = Array.from(this.tools.keys());

    // 检查必要的工具
    const requiredTools = ['travel_planner', 'travel_executor', 'complete_task'];
    const missingTools = requiredTools.filter(tool => !toolNames.includes(tool));

    if (missingTools.length > 0) {
      issues.push(`缺少必要工具: ${missingTools.join(', ')}`);
    }

    // 检查是否有冲突的工具
    const conflictingTools = toolNames.filter(name =>
      name.includes('bash') || name.includes('edit') || name.includes('file')
    );

    if (conflictingTools.length > 0) {
      issues.push(`发现可能冲突的工具: ${conflictingTools.join(', ')}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}