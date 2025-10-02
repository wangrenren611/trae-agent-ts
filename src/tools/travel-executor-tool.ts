import { ToolExecutor } from './base.js';
import { ToolDefinition, ToolResult, ToolExecutionContext } from '../types/index.js';
import {
  TravelPlan,
  TravelActivity,
  TravelBookingResult,
  TravelPlanExecutionStatus,
  TravelPlanningError
} from '../types/travel-planning.js';
import { randomUUID } from 'crypto';

/**
 * 旅游执行工具
 * 专门用于执行旅游计划中的具体任务
 */
export class TravelExecutorTool extends ToolExecutor {
  private currentPlan: TravelPlan | null = null;
  private executionStatus: TravelPlanExecutionStatus | null = null;
  private completedActivities: Set<string> = new Set();

  constructor() {
    const definition: ToolDefinition = {
      name: 'travel_executor',
      description: `专业的旅游执行工具，帮助用户执行旅游计划中的具体任务。

主要功能：
- load_plan: 加载旅游计划开始执行
- execute_activity: 执行具体活动
- book_accommodation: 预订住宿
- book_transportation: 预订交通工具
- book_activity: 预订活动门票
- check_weather: 检查天气情况
- get_next_activity: 获取下一个待执行活动
- update_execution_status: 更新执行状态
- handle_issues: 处理执行中的问题

执行特点：
- 智能调度活动顺序
- 实时监控执行状态
- 自动处理预订和确认
- 提供问题解决方案`,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: '要执行的操作类型'
          },
          plan_id: {
            type: 'string',
            description: '旅游计划ID（load_plan时必需）'
          },
          activity_id: {
            type: 'string',
            description: '活动ID（execute_activity时必需）'
          },
          booking_data: {
            type: 'object',
            description: '预订数据（book_* 操作时使用）',
            properties: {
              accommodation_id: { type: 'string', description: '住宿ID' },
              transportation_id: { type: 'string', description: '交通ID' },
              activity_id: { type: 'string', description: '活动ID' },
              quantity: { type: 'number', description: '数量' },
              special_requirements: { type: 'string', description: '特殊要求' }
            }
          },
          execution_data: {
            type: 'object',
            description: '执行状态更新数据',
            properties: {
              current_day: { type: 'number', description: '当前天数' },
              current_activity: { type: 'string', description: '当前活动' },
              spent_amount: { type: 'number', description: '已花费金额' },
              issues: {
                type: 'array',
                items: { type: 'string', description: '问题描述' },
                description: '问题列表'
              }
            }
          },
          location: {
            type: 'string',
            description: '位置信息（check_weather时使用）'
          },
          date: {
            type: 'string',
            description: '日期（check_weather时使用，格式：YYYY-MM-DD）'
          }
        },
        required: ['action']
      }
    };

    super('travel_executor', definition);
  }

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const { action } = params;

    try {
      switch (action) {
        case 'load_plan':
          return await this.loadPlan(params, context);
        case 'execute_activity':
          return await this.executeActivity(params, context);
        case 'book_accommodation':
          return await this.bookAccommodation(params, context);
        case 'book_transportation':
          return await this.bookTransportation(params, context);
        case 'book_activity':
          return await this.bookActivity(params, context);
        case 'check_weather':
          return await this.checkWeather(params, context);
        case 'get_next_activity':
          return await this.getNextActivity(params, context);
        case 'update_execution_status':
          return await this.updateExecutionStatus(params, context);
        case 'handle_issues':
          return await this.handleIssues(params, context);
        default:
          return this.createErrorResult(`不支持的操作: ${action}`);
      }
    } catch (error) {
      return this.createErrorResult(`执行旅游任务失败: ${error}`);
    }
  }

  /**
   * 加载旅游计划
   */
  private async loadPlan(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const { plan_id } = params as { plan_id: string };

    if (!plan_id) {
      return this.createErrorResult('缺少计划ID');
    }

    // 这里应该从存储中加载计划，简化处理
    this.currentPlan = this.mockLoadPlan(plan_id);

    if (!this.currentPlan) {
      return this.createErrorResult(`未找到计划: ${plan_id}`);
    }

    // 初始化执行状态
    this.executionStatus = {
      planId: plan_id,
      currentDay: 1,
      completedActivities: [],
      upcomingActivities: this.getAllActivityIds(this.currentPlan),
      totalSpent: 0,
      remainingBudget: this.currentPlan.budget.total,
      issues: [],
      recommendations: []
    };

    return this.createSuccessResult({
      message: '旅游计划加载成功',
      plan: {
        id: this.currentPlan.id,
        title: this.currentPlan.title,
        destination: this.currentPlan.destination.name,
        duration: this.currentPlan.duration,
        current_day: this.executionStatus.currentDay,
        total_activities: this.executionStatus.upcomingActivities.length
      }
    });
  }

  /**
   * 执行活动
   */
  private async executeActivity(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan || !this.executionStatus) {
      return this.createErrorResult('请先加载旅游计划');
    }

    const { activity_id } = params as { activity_id: string };

    const activity = this.findActivity(activity_id);
    if (!activity) {
      return this.createErrorResult(`未找到活动: ${activity_id}`);
    }

    // 检查活动是否已完成
    if (this.completedActivities.has(activity_id)) {
      return this.createErrorResult(`活动已完成: ${activity_id}`);
    }

    // 模拟执行活动
    const executionResult = await this.simulateActivityExecution(activity);

    // 更新状态
    this.completedActivities.add(activity_id);
    this.executionStatus.completedActivities.push(activity_id);
    this.executionStatus.upcomingActivities = this.executionStatus.upcomingActivities.filter(id => id !== activity_id);

    if (activity.cost) {
      this.executionStatus.totalSpent += activity.cost.amount;
      this.executionStatus.remainingBudget -= activity.cost.amount;
    }

    return this.createSuccessResult({
      message: '活动执行成功',
      activity: {
        id: activity.id,
        title: activity.title,
        duration: executionResult.actualDuration,
        cost: activity.cost,
        status: 'completed'
      },
      updated_status: {
        completed_count: this.executionStatus.completedActivities.length,
        remaining_count: this.executionStatus.upcomingActivities.length,
        total_spent: this.executionStatus.totalSpent,
        remaining_budget: this.executionStatus.remainingBudget
      }
    });
  }

  /**
   * 预订住宿
   */
  private async bookAccommodation(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('请先加载旅游计划');
    }

    const bookingData = params.booking_data as any;
    if (!bookingData || !bookingData.accommodation_id) {
      return this.createErrorResult('缺少住宿预订数据');
    }

    // 模拟预订过程
    const bookingResult = await this.simulateAccommodationBooking(bookingData);

    if (bookingResult.success) {
      // 更新计划中的住宿信息
      this.currentPlan.accommodation = {
        id: bookingData.accommodation_id,
        name: `酒店 ${bookingData.accommodation_id}`,
        type: 'hotel',
        rating: 4.0,
        pricePerNight: {
          budget: 50,
          mid: 100,
          luxury: 200,
          currency: this.currentPlan.currency
        },
        location: {
          address: `${this.currentPlan.destination.name}市中心`
        },
        amenities: ['WiFi', '早餐', '空调'],
        checkInTime: '15:00',
        checkOutTime: '11:00'
      };

      return this.createSuccessResult({
        message: '住宿预订成功',
        booking: bookingResult
      });
    } else {
      return this.createErrorResult(bookingResult.error || '住宿预订失败');
    }
  }

  /**
   * 预订交通工具
   */
  private async bookTransportation(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('请先加载旅游计划');
    }

    const bookingData = params.booking_data as any;
    if (!bookingData || !bookingData.transportation_id) {
      return this.createErrorResult('缺少交通预订数据');
    }

    // 模拟预订过程
    const bookingResult = await this.simulateTransportationBooking(bookingData);

    if (bookingResult.success) {
      return this.createSuccessResult({
        message: '交通预订成功',
        booking: bookingResult
      });
    } else {
      return this.createErrorResult(bookingResult.error || '交通预订失败');
    }
  }

  /**
   * 预订活动门票
   */
  private async bookActivity(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('请先加载旅游计划');
    }

    const bookingData = params.booking_data as any;
    if (!bookingData || !bookingData.activity_id) {
      return this.createErrorResult('缺少活动预订数据');
    }

    // 模拟预订过程
    const bookingResult = await this.simulateActivityBooking(bookingData);

    if (bookingResult.success) {
      return this.createSuccessResult({
        message: '活动门票预订成功',
        booking: bookingResult
      });
    } else {
      return this.createErrorResult(bookingResult.error || '活动门票预订失败');
    }
  }

  /**
   * 检查天气
   */
  private async checkWeather(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const { location, date } = params as { location: string; date: string };

    if (!location) {
      return this.createErrorResult('缺少位置信息');
    }

    // 模拟天气检查
    const weatherData = await this.simulateWeatherCheck(location, date);

    return this.createSuccessResult({
      message: '天气信息获取成功',
      weather: weatherData
    });
  }

  /**
   * 获取下一个待执行活动
   */
  private async getNextActivity(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan || !this.executionStatus) {
      return this.createErrorResult('请先加载旅游计划');
    }

    const nextActivityId = this.executionStatus.upcomingActivities[0];
    if (!nextActivityId) {
      return this.createSuccessResult({
        message: '所有活动已完成',
        next_activity: null
      });
    }

    const nextActivity = this.findActivity(nextActivityId);
    if (!nextActivity) {
      return this.createErrorResult(`找不到下一个活动: ${nextActivityId}`);
    }

    return this.createSuccessResult({
      message: '获取下一个活动成功',
      next_activity: {
        id: nextActivity.id,
        title: nextActivity.title,
        time: nextActivity.time,
        duration: nextActivity.duration,
        location: nextActivity.location,
        type: nextActivity.type,
        booking_required: nextActivity.bookingRequired,
        weather_dependent: nextActivity.weatherDependent
      }
    });
  }

  /**
   * 更新执行状态
   */
  private async updateExecutionStatus(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.executionStatus) {
      return this.createErrorResult('请先加载旅游计划');
    }

    const executionData = params.execution_data as any;
    if (executionData) {
      if (executionData.current_day) {
        this.executionStatus.currentDay = executionData.current_day;
      }
      if (executionData.current_activity) {
        this.executionStatus.currentActivity = executionData.current_activity;
      }
      if (executionData.spent_amount) {
        this.executionStatus.totalSpent = executionData.spent_amount;
        this.executionStatus.remainingBudget = this.currentPlan!.budget.total - executionData.spent_amount;
      }
      if (executionData.issues) {
        this.executionStatus.issues.push(...executionData.issues);
      }
    }

    return this.createSuccessResult({
      message: '执行状态更新成功',
      status: this.executionStatus
    });
  }

  /**
   * 处理问题
   */
  private async handleIssues(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.executionStatus) {
      return this.createErrorResult('请先加载旅游计划');
    }

    const { issues } = params as { issues: string[] };

    if (!issues || issues.length === 0) {
      return this.createErrorResult('缺少问题描述');
    }

    // 生成解决方案
    const solutions = this.generateSolutions(issues);

    // 更新状态
    this.executionStatus.issues.push(...issues);
    this.executionStatus.recommendations.push(...solutions);

    return this.createSuccessResult({
      message: '问题处理方案生成成功',
      issues,
      solutions,
      updated_status: {
        issues_count: this.executionStatus.issues.length,
        recommendations_count: this.executionStatus.recommendations.length
      }
    });
  }

  // 辅助方法
  private mockLoadPlan(planId: string): TravelPlan | null {
    // 简化的模拟计划加载
    return {
      id: planId,
      title: '巴黎5日游',
      destination: {
        name: 'Paris, France',
        country: 'France',
        region: 'Île-de-France',
        bestSeasons: ['春季', '秋季'],
        averageCost: { budget: 50, mid: 100, luxury: 200 }
      },
      startDate: '2024-06-01',
      endDate: '2024-06-05',
      duration: 5,
      travelers: { adults: 2, children: 0, infants: 0 },
      budget: {
        total: 2000,
        currency: 'EUR',
        breakdown: {
          accommodation: 700,
          transportation: 500,
          food: 500,
          activities: 200,
          shopping: 60,
          miscellaneous: 40
        }
      },
      preferences: {
        travelStyle: 'mid',
        interests: ['culture', 'food', 'art'],
        dietaryRestrictions: [],
        mobilityRequirements: [],
        language: ['zh', 'en']
      },
      itinerary: [],
      transportation: [],
      totalCost: 0,
      currency: 'EUR',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft'
    };
  }

  private getAllActivityIds(plan: TravelPlan): string[] {
    const ids: string[] = [];
    for (const day of plan.itinerary) {
      for (const activity of day.activities) {
        ids.push(activity.id);
      }
    }
    return ids;
  }

  private findActivity(activityId: string): TravelActivity | null {
    if (!this.currentPlan) return null;

    for (const day of this.currentPlan.itinerary) {
      for (const activity of day.activities) {
        if (activity.id === activityId) {
          return activity;
        }
      }
    }
    return null;
  }

  private async simulateActivityExecution(activity: TravelActivity): Promise<{ actualDuration: number; success: boolean }> {
    // 模拟活动执行
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      actualDuration: activity.duration + Math.floor(Math.random() * 30 - 15), // 实际时间可能有偏差
      success: true
    };
  }

  private async simulateAccommodationBooking(bookingData: any): Promise<TravelBookingResult> {
    // 模拟住宿预订
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      success: true,
      bookingId: randomUUID(),
      confirmation: `HTL-${Date.now()}`,
      totalCost: 100 * this.currentPlan!.duration,
      currency: this.currentPlan!.currency,
      status: 'confirmed'
    };
  }

  private async simulateTransportationBooking(bookingData: any): Promise<TravelBookingResult> {
    // 模拟交通预订
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      success: true,
      bookingId: randomUUID(),
      confirmation: `TRN-${Date.now()}`,
      totalCost: 50,
      currency: this.currentPlan!.currency,
      status: 'confirmed'
    };
  }

  private async simulateActivityBooking(bookingData: any): Promise<TravelBookingResult> {
    // 模拟活动预订
    await new Promise(resolve => setTimeout(resolve, 150));

    return {
      success: true,
      bookingId: randomUUID(),
      confirmation: `ACT-${Date.now()}`,
      totalCost: 25,
      currency: this.currentPlan!.currency,
      status: 'confirmed'
    };
  }

  private async simulateWeatherCheck(location: string, date?: string): Promise<any> {
    // 模拟天气检查
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      location,
      date: date || new Date().toISOString().split('T')[0],
      temperature: Math.floor(Math.random() * 20 + 15), // 15-35度
      condition: ['晴朗', '多云', '小雨', '阴天'][Math.floor(Math.random() * 4)],
      humidity: Math.floor(Math.random() * 40 + 40), // 40-80%
      windSpeed: Math.floor(Math.random() * 20 + 5), // 5-25 km/h
      recommendations: ['适合户外活动', '建议携带防晒霜', '适合拍照']
    };
  }

  private generateSolutions(issues: string[]): string[] {
    const solutions: string[] = [];

    for (const issue of issues) {
      if (issue.includes('天气')) {
        solutions.push('准备室内备用活动，如博物馆参观');
        solutions.push('携带雨具，关注天气预报更新');
      } else if (issue.includes('交通')) {
        solutions.push('考虑使用公共交通或打车服务');
        solutions.push('预留额外时间应对交通延误');
      } else if (issue.includes('预订')) {
        solutions.push('联系客服确认预订状态');
        solutions.push('准备备选方案或其他选择');
      } else if (issue.includes('预算')) {
        solutions.push('寻找免费或低价的替代活动');
        solutions.push('调整后续活动的预算分配');
      } else {
        solutions.push('联系当地旅游信息中心寻求帮助');
        solutions.push('保持灵活，准备调整行程');
      }
    }

    return [...new Set(solutions)]; // 去重
  }
}