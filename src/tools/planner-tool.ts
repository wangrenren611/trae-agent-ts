import { ToolExecutor } from './base.js';
import { ToolDefinition, ToolResult, ToolExecutionContext } from '../types/index.js';
import {
  ExecutionPlan,
  Task,
  PlanStatus,
  TaskStatus,
  TaskPriority
} from '../types/planning.js';
import { randomUUID } from 'crypto';

/**
 * 专业的任务规划和管理工具 - 精简版
 * 
 * 核心理念：简单而强大
 * - 专注于计划的CRUD操作（创建、查询、更新、删除）
 * - 支持多智能体协作的基础设施
 * - 提供清晰的计划管理接口
 * - 去除复杂的分析和优化逻辑，让LLM自主决策
 */
export class PlannerTool extends ToolExecutor {
  override name = 'planner_tool';
  private currentPlan: ExecutionPlan | null = null;

  constructor() {
    super('planner_tool', {} as ToolDefinition);
  }

  override definition: ToolDefinition = {
    name: this.name,
    description: `专业的任务规划和管理工具，支持多智能体协作。

核心功能：
- create_plan: 创建新的执行计划
- get_plan: 获取当前计划详情
- update_plan: 更新计划信息
- delete_plan: 删除当前计划
- add_task: 向计划添加新任务
- update_task: 更新任务状态和信息
- get_next_task: 获取下一个待执行任务

协作模式：
- 执行智能体通过get_next_task获取待执行任务
- 执行智能体通过update_task更新任务状态和结果
- PlannerAgent通过此工具监控和调整整体计划`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: '要执行的操作类型',
          required: true
        },
        objective: {
          type: 'string',
          description: '要规划的目标或任务描述（create_plan时必需）'
        },
        plan_data: {
          type: 'object',
          description: '计划数据（update_plan时使用）',
          properties: {
            title: { type: 'string', description: '计划标题' },
            description: { type: 'string', description: '计划描述' },
            status: { type: 'string', description: '计划状态' }
          }
        },
        task_data: {
          type: 'object',
          description: '任务数据（add_task或update_task时使用）',
          properties: {
            id: { type: 'string', description: '任务ID（更新时必需）' },
            title: { type: 'string', description: '任务标题' },
            description: { type: 'string', description: '任务描述' },
            priority: { 
              type: 'string', 
              description: '任务优先级' 
            },
            status: {
              type: 'string',
              description: '任务状态'
            },
            dependencies: {
              type: 'array',
              description: '依赖的任务ID列表'
            },
            estimated_duration: {
              type: 'number',
              description: '估算执行时间（分钟）'
            }
          }
        }
      },
      required: ['action']
    }
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const { action } = params;

    try {
      switch (action) {
        case 'create_plan':
          return await this.createPlan(params, context);
        case 'get_plan':
          return await this.getPlan(params, context);
        case 'update_plan':
          return await this.updatePlan(params, context);
        case 'delete_plan':
          return await this.deletePlan(params, context);
        case 'add_task':
          return await this.addTask(params, context);
        case 'update_task':
          return await this.updateTask(params, context);
        case 'get_next_task':
          return await this.getNextTask(params, context);
        default:
          return this.createErrorResult(`不支持的操作: ${action}`);
      }
    } catch (error) {
      return this.createErrorResult(`执行操作失败: ${error}`);
    }
  }

  /**
   * 创建执行计划
   */
  private async createPlan(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const { objective } = params;
    
    if (!objective || typeof objective !== 'string') {
      return this.createErrorResult('创建计划需要提供目标描述');
    }

    // 创建基础计划结构
    this.currentPlan = {
      id: randomUUID(),
      title: `执行计划：${objective}`,
      description: `针对目标"${objective}"制定的执行计划`,
      objective: objective as string,
      status: 'planning',
      tasks: [],
      strategy: {
        allowParallel: true,
        maxParallelTasks: 3,
        failureHandling: 'retry',
        autoRetry: true,
        maxRetries: 2,
        retryInterval: 30,
        timeout: 60
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: 0,
      executionHistory: []
    };

    return this.createSuccessResult({
      message: '计划创建成功',
      plan: {
        id: this.currentPlan.id,
        title: this.currentPlan.title,
        objective: this.currentPlan.objective,
        status: this.currentPlan.status,
        created_at: this.currentPlan.createdAt,
        task_count: this.currentPlan.tasks.length
      }
    });
  }

  /**
   * 获取当前计划
   */
  private async getPlan(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的执行计划');
    }

    return this.createSuccessResult({
      plan: {
        id: this.currentPlan.id,
        title: this.currentPlan.title,
        objective: this.currentPlan.objective,
        description: this.currentPlan.description,
        status: this.currentPlan.status,
        progress: this.currentPlan.progress,
        created_at: this.currentPlan.createdAt,
        updated_at: this.currentPlan.updatedAt,
        task_count: this.currentPlan.tasks.length,
        tasks: this.currentPlan.tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          type: task.type,
          status: task.status,
          priority: task.priority,
          phase: task.phase,
          dependencies: task.dependencies,
          estimated_duration: task.estimatedDuration,
          created_at: task.createdAt,
          started_at: task.startedAt,
          completed_at: task.completedAt
        }))
      }
    });
  }

  /**
   * 更新计划信息
   */
  private async updatePlan(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的执行计划');
    }

    const { plan_data } = params;
    if (!plan_data || typeof plan_data !== 'object') {
      return this.createErrorResult('更新计划需要提供计划数据');
    }

    const planInfo = plan_data as any;
    
    // 更新计划属性
    if (planInfo.title) this.currentPlan.title = planInfo.title;
    if (planInfo.description) this.currentPlan.description = planInfo.description;
    if (planInfo.status) this.currentPlan.status = planInfo.status;
    
    this.currentPlan.updatedAt = new Date();

    return this.createSuccessResult({
      message: '计划更新成功',
      plan: {
        id: this.currentPlan.id,
        title: this.currentPlan.title,
        status: this.currentPlan.status,
        updated_at: this.currentPlan.updatedAt
      }
    });
  }

  /**
   * 删除当前计划
   */
  private async deletePlan(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的执行计划');
    }

    const planId = this.currentPlan.id;
    this.currentPlan = null;

    return this.createSuccessResult({
      message: '计划删除成功',
      deleted_plan_id: planId
    });
  }

  /**
   * 添加任务
   */
  private async addTask(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的执行计划');
    }

    const { task_data } = params;
    if (!task_data || typeof task_data !== 'object') {
      return this.createErrorResult('添加任务需要提供任务数据');
    }

    const taskInfo = task_data as any;
    
    const newTask: Task = {
      id: randomUUID(),
      title: taskInfo.title || '新任务',
      description: taskInfo.description || '',
      type: 'other',
      status: 'pending',
      phase: 'planning',
      priority: taskInfo.priority || 'medium',
      dependencies: taskInfo.dependencies || [],
      estimatedDuration: taskInfo.estimated_duration || 15,
      createdAt: new Date()
    };

    this.currentPlan.tasks.push(newTask);
    this.currentPlan.updatedAt = new Date();

    return this.createSuccessResult({
      message: '任务添加成功',
      task: {
        id: newTask.id,
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        status: newTask.status
      },
      plan_summary: {
        total_tasks: this.currentPlan.tasks.length,
        pending_tasks: this.currentPlan.tasks.filter(t => t.status === 'pending').length
      }
    });
  }

  /**
   * 更新任务状态
   */
  private async updateTask(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的执行计划');
    }

    const { task_data } = params;
    if (!task_data || typeof task_data !== 'object') {
      return this.createErrorResult('更新任务需要提供任务数据');
    }

    const taskInfo = task_data as any;
    const taskId = taskInfo.id;
    
    if (!taskId) {
      return this.createErrorResult('更新任务需要提供任务ID');
    }

    const task = this.currentPlan.tasks.find(t => t.id === taskId);
    if (!task) {
      return this.createErrorResult(`未找到ID为 ${taskId} 的任务`);
    }

    // 更新任务属性
    if (taskInfo.title) task.title = taskInfo.title;
    if (taskInfo.description) task.description = taskInfo.description;
    if (taskInfo.priority) task.priority = taskInfo.priority;
    if (taskInfo.status) {
      task.status = taskInfo.status;
      if (taskInfo.status === 'in_progress') {
        task.startedAt = new Date();
      } else if (taskInfo.status === 'completed') {
        task.completedAt = new Date();
      }
    }
    if (taskInfo.dependencies) task.dependencies = taskInfo.dependencies;
    if (taskInfo.estimated_duration) task.estimatedDuration = taskInfo.estimated_duration;

    this.currentPlan.updatedAt = new Date();
    
    // 更新计划进度
    this.updatePlanProgress();

    return this.createSuccessResult({
      message: '任务更新成功',
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority
      },
      plan_progress: this.currentPlan.progress
    });
  }

  /**
   * 获取下一个可执行任务
   */
  private async getNextTask(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的执行计划');
    }

    // 查找下一个待执行的任务
    const nextTask = this.currentPlan.tasks.find(task => 
      task.status === 'pending' && 
      this.areTaskDependenciesCompleted(task)
    );
    
    if (!nextTask) {
      return this.createSuccessResult({
        message: '没有更多可执行的任务',
        next_task: null,
        plan_status: this.currentPlan.status,
        progress: this.currentPlan.progress
      });
    }

    return this.createSuccessResult({
      message: '找到下一个可执行任务',
      next_task: {
        id: nextTask.id,
        title: nextTask.title,
        description: nextTask.description,
        priority: nextTask.priority,
        estimated_duration: nextTask.estimatedDuration,
        dependencies: nextTask.dependencies
      },
      remaining_tasks: this.currentPlan.tasks.filter(t => t.status === 'pending').length
    });
  }

  /**
   * 检查任务依赖是否完成
   */
  private areTaskDependenciesCompleted(task: Task): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every(depId => {
      const depTask = this.currentPlan!.tasks.find(t => t.id === depId);
      return depTask && depTask.status === 'completed';
    });
  }

  /**
   * 更新计划进度
   */
  private updatePlanProgress(): void {
    if (!this.currentPlan) return;
    
    const totalTasks = this.currentPlan.tasks.length;
    const completedTasks = this.currentPlan.tasks.filter(t => t.status === 'completed').length;
    
    this.currentPlan.progress = totalTasks > 0 ? completedTasks / totalTasks : 0;
  }
}