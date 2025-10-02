import { ToolExecutor } from './base.js';
import { ToolDefinition, ToolResult, ToolExecutionContext } from '../types/index.js';
import {
  TravelPlan,
  TravelPlanningRequest,
  TravelDestination,
  TravelDay,
  TravelActivity,
  TravelAccommodation,
  Transportation
} from '../types/travel-planning.js';
import { randomUUID } from 'crypto';

/**
 * 旅游规划工具
 * 专门用于创建和管理旅游计划
 */
export class TravelPlannerTool extends ToolExecutor {
  private currentPlan: TravelPlan | null = null;

  constructor() {
    const definition: ToolDefinition = {
      name: 'travel_planner',
      description: `专业的旅游规划工具，帮助用户创建详细的旅游计划。

主要功能：
- create_travel_plan: 根据用户需求创建完整的旅游计划
- get_travel_plan: 获取当前旅游计划详情
- update_travel_plan: 更新旅游计划的特定部分
- add_activity: 向旅游计划添加新的活动
- remove_activity: 从旅游计划中移除活动
- estimate_costs: 估算旅游总费用
- get_recommendations: 获取旅游建议和推荐

规划特点：
- 考虑用户偏好和预算
- 优化行程安排和时间分配
- 提供详细的预算估算
- 考虑季节性和天气因素`,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: '要执行的操作类型'
          },
          request_data: {
            type: 'object',
            description: '旅游规划请求数据（create_travel_plan时必需）',
            properties: {
              destination: { type: 'string', description: '目的地' },
              startDate: { type: 'string', description: '开始日期 (YYYY-MM-DD)' },
              endDate: { type: 'string', description: '结束日期 (YYYY-MM-DD)' },
              travelers: {
                type: 'object',
                properties: {
                  adults: { type: 'number', description: '成人数量' },
                  children: { type: 'number', description: '儿童数量' },
                  infants: { type: 'number', description: '婴儿数量' }
                },
                description: '旅行者信息'
              },
              budget: {
                type: 'object',
                properties: {
                  total: { type: 'number', description: '总预算' },
                  currency: { type: 'string', description: '货币类型' }
                },
                description: '预算信息'
              },
              preferences: {
                type: 'object',
                properties: {
                  travelStyle: { type: 'string', description: '旅行风格' },
                  interests: {
                    type: 'array',
                    items: { type: 'string', description: '兴趣爱好' },
                    description: '兴趣列表'
                  },
                  dietaryRestrictions: {
                    type: 'array',
                    items: { type: 'string', description: '饮食限制' },
                    description: '饮食限制列表'
                  },
                  mobilityRequirements: {
                    type: 'array',
                    items: { type: 'string', description: '行动要求' },
                    description: '行动要求列表'
                  },
                  language: {
                    type: 'array',
                    items: { type: 'string', description: '语言' },
                    description: '语言列表'
                  }
                },
                description: '旅行偏好'
              }
            }
          },
          activity_data: {
            type: 'object',
            description: '活动数据（add_activity时使用）',
            properties: {
              dayNumber: { type: 'number', description: '天数' },
              time: { type: 'string', description: '时间 (HH:MM)' },
              title: { type: 'string', description: '活动标题' },
              type: { type: 'string', description: '活动类型' },
              location: { type: 'string', description: '地点' },
              duration: { type: 'number', description: '持续时间（分钟）' },
              cost: { type: 'number', description: '费用' }
            }
          },
          plan_updates: {
            type: 'object',
            description: '计划更新数据（update_travel_plan时使用）'
          }
        },
        required: ['action']
      }
    };

    super('travel_planner', definition);
  }

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const { action } = params;

    try {
      switch (action) {
        case 'create_travel_plan':
          return await this.createTravelPlan(params, context);
        case 'get_travel_plan':
          return await this.getTravelPlan(params, context);
        case 'update_travel_plan':
          return await this.updateTravelPlan(params, context);
        case 'add_activity':
          return await this.addActivity(params, context);
        case 'remove_activity':
          return await this.removeActivity(params, context);
        case 'estimate_costs':
          return await this.estimateCosts(params, context);
        case 'get_recommendations':
          return await this.getRecommendations(params, context);
        default:
          return this.createErrorResult(`不支持的操作: ${action}`);
      }
    } catch (error) {
      return this.createErrorResult(`执行旅游规划操作失败: ${error}`);
    }
  }

  /**
   * 创建旅游计划
   */
  private async createTravelPlan(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const requestData = params.request_data as TravelPlanningRequest;

    if (!requestData) {
      return this.createErrorResult('创建旅游计划需要提供请求数据');
    }

    // 验证必要字段
    if (!requestData.destination || !requestData.startDate || !requestData.endDate) {
      return this.createErrorResult('缺少必要字段：目的地、开始日期和结束日期');
    }

    // 计算旅行天数
    const startDate = new Date(requestData.startDate);
    const endDate = new Date(requestData.endDate);
    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (duration <= 0) {
      return this.createErrorResult('结束日期必须晚于开始日期');
    }

    // 创建目的地信息
    const destination: TravelDestination = {
      name: requestData.destination,
      country: this.extractCountry(requestData.destination),
      region: this.extractRegion(requestData.destination) || undefined,
      bestSeasons: this.getBestSeasons(requestData.destination),
      averageCost: this.getAverageCost(requestData.destination, requestData.preferences.travelStyle) || undefined
    };

    // 创建旅游计划
    this.currentPlan = {
      id: randomUUID(),
      title: `${requestData.destination} ${duration}日游`,
      destination,
      startDate: requestData.startDate,
      endDate: requestData.endDate,
      duration,
      travelers: requestData.travelers,
      budget: {
        total: requestData.budget.total,
        currency: requestData.budget.currency,
        breakdown: {
          accommodation: 0,
          transportation: 0,
          food: 0,
          activities: 0,
          shopping: 0,
          miscellaneous: 0
        }
      },
      preferences: requestData.preferences,
      itinerary: this.generateItinerary(requestData, duration),
      transportation: [],
      totalCost: 0,
      currency: requestData.budget.currency,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft'
    };

    // 估算总费用
    if (this.currentPlan) {
      const estimatedCost = await this.calculateTotalCost(this.currentPlan);
      this.currentPlan.totalCost = estimatedCost.total;
      // 为请求添加预算分解
      (requestData as any).budget.breakdown = estimatedCost.breakdown;
    }

    return this.createSuccessResult({
      message: '旅游计划创建成功',
      plan: {
        id: this.currentPlan?.id,
        title: this.currentPlan?.title,
        destination: this.currentPlan?.destination.name,
        duration: this.currentPlan?.duration,
        totalCost: this.currentPlan?.totalCost,
        currency: this.currentPlan?.currency,
        status: this.currentPlan?.status,
        created_at: this.currentPlan?.createdAt
      }
    });
  }

  /**
   * 获取当前旅游计划
   */
  private async getTravelPlan(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的旅游计划');
    }

    return this.createSuccessResult({
      plan: {
        id: this.currentPlan.id,
        title: this.currentPlan.title,
        destination: this.currentPlan.destination,
        startDate: this.currentPlan.startDate,
        endDate: this.currentPlan.endDate,
        duration: this.currentPlan.duration,
        travelers: this.currentPlan.travelers,
        totalCost: this.currentPlan.totalCost,
        currency: this.currentPlan.currency,
        status: this.currentPlan.status,
        itinerary: this.currentPlan.itinerary,
        budget: this.currentPlan.budget,
        preferences: this.currentPlan.preferences
      }
    });
  }

  /**
   * 更新旅游计划
   */
  private async updateTravelPlan(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的旅游计划');
    }

    const updates = params.plan_updates as Partial<TravelPlan>;
    if (!updates) {
      return this.createErrorResult('缺少更新数据');
    }

    // 更新计划
    Object.assign(this.currentPlan, updates);
    this.currentPlan.updatedAt = new Date();

    return this.createSuccessResult({
      message: '旅游计划更新成功',
      plan: {
        id: this.currentPlan.id,
        title: this.currentPlan.title,
        updated_at: this.currentPlan.updatedAt
      }
    });
  }

  /**
   * 添加活动
   */
  private async addActivity(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的旅游计划');
    }

    const activityData = params.activity_data as any;
    if (!activityData || !activityData.dayNumber || !activityData.time) {
      return this.createErrorResult('缺少活动数据：天数和时间');
    }

    const activity: TravelActivity = {
      id: randomUUID(),
      time: activityData.time,
      duration: activityData.duration || 60,
      title: activityData.title,
      type: activityData.type || 'attraction',
      location: activityData.location,
      description: activityData.description || '',
      cost: activityData.cost ? { amount: activityData.cost, currency: this.currentPlan.currency } : undefined,
      priority: activityData.priority || 'medium',
      weatherDependent: activityData.weatherDependent || false
    };

    // 找到对应的天数并添加活动
    const dayIndex = activityData.dayNumber - 1;
    if (dayIndex < 0 || dayIndex >= this.currentPlan.itinerary.length) {
      return this.createErrorResult(`无效的天数：${activityData.dayNumber}`);
    }

    this.currentPlan.itinerary[dayIndex].activities.push(activity);
    this.currentPlan.itinerary[dayIndex].activities.sort((a, b) => a.time.localeCompare(b.time));

    return this.createSuccessResult({
      message: '活动添加成功',
      activity: {
        id: activity.id,
        title: activity.title,
        day: activityData.dayNumber,
        time: activity.time
      }
    });
  }

  /**
   * 移除活动
   */
  private async removeActivity(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的旅游计划');
    }

    const { activityId, dayNumber } = params as { activityId: string; dayNumber: number };

    if (!activityId || !dayNumber) {
      return this.createErrorResult('缺少活动ID或天数');
    }

    const dayIndex = dayNumber - 1;
    if (dayIndex < 0 || dayIndex >= this.currentPlan.itinerary.length) {
      return this.createErrorResult(`无效的天数：${dayNumber}`);
    }

    const activities = this.currentPlan.itinerary[dayIndex].activities;
    const initialLength = activities.length;
    this.currentPlan.itinerary[dayIndex].activities = activities.filter(a => a.id !== activityId);

    if (activities.length === initialLength) {
      return this.createErrorResult(`未找到活动：${activityId}`);
    }

    return this.createSuccessResult({
      message: '活动移除成功',
      activityId,
      dayNumber
    });
  }

  /**
   * 估算费用
   */
  private async estimateCosts(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的旅游计划');
    }

    const costBreakdown = await this.calculateTotalCost(this.currentPlan);

    return this.createSuccessResult({
      message: '费用估算完成',
      costs: {
        total: costBreakdown.total,
        currency: this.currentPlan.currency,
        breakdown: costBreakdown.breakdown,
        perPerson: Math.round(costBreakdown.total / this.currentPlan.travelers.adults)
      }
    });
  }

  /**
   * 获取推荐
   */
  private async getRecommendations(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!this.currentPlan) {
      return this.createErrorResult('没有活动的旅游计划');
    }

    const recommendations = this.generateRecommendations(this.currentPlan);

    return this.createSuccessResult({
      message: '推荐生成成功',
      recommendations
    });
  }

  // 辅助方法
  private extractCountry(destination: string): string {
    const parts = destination.split(',').map(p => p.trim());
    return parts.length > 1 ? parts[parts.length - 1] : 'Unknown';
  }

  private extractRegion(destination: string): string | undefined {
    const parts = destination.split(',').map(p => p.trim());
    return parts.length > 2 ? parts[parts.length - 2] : undefined;
  }

  private getBestSeasons(destination: string): string[] {
    // 简化的季节推荐逻辑
    const seasonMap: Record<string, string[]> = {
      'paris': ['春季', '秋季'],
      'tokyo': ['春季', '秋季'],
      'bali': ['旱季', '4月-10月'],
      'new york': ['春季', '秋季'],
      'london': ['夏季', '5月-9月']
    };

    const dest = destination.toLowerCase();
    for (const [key, seasons] of Object.entries(seasonMap)) {
      if (dest.includes(key)) {
        return seasons;
      }
    }
    return ['全年'];
  }

  private getAverageCost(destination: string, travelStyle: 'budget' | 'mid' | 'luxury'): { budget: number; mid: number; luxury: number } {
    // 简化的费用估算
    const baseCost = {
      'paris': { budget: 50, mid: 100, luxury: 200 },
      'tokyo': { budget: 40, mid: 80, luxury: 150 },
      'bali': { budget: 20, mid: 50, luxury: 100 },
      'new york': { budget: 60, mid: 120, luxury: 250 },
      'london': { budget: 55, mid: 110, luxury: 220 }
    };

    const dest = destination.toLowerCase();
    for (const [key, costs] of Object.entries(baseCost)) {
      if (dest.includes(key)) {
        return costs;
      }
    }
    return { budget: 30, mid: 60, luxury: 120 };
  }

  private generateItinerary(request: TravelPlanningRequest, duration: number): TravelDay[] {
    const itinerary: TravelDay[] = [];
    const startDate = new Date(request.startDate);

    for (let i = 0; i < duration; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      const day: TravelDay = {
        date: currentDate.toISOString().split('T')[0],
        dayNumber: i + 1,
        theme: this.getDayTheme(i, duration, request.preferences.interests),
        activities: [],
        totalEstimatedCost: 0,
        currency: request.budget.currency
      };

      // 添加默认活动
      day.activities = this.generateDefaultActivities(day, request);
      itinerary.push(day);
    }

    return itinerary;
  }

  private getDayTheme(dayIndex: number, totalDays: number, interests: string[]): string {
    const themes = ['抵达与适应', '城市探索', '文化体验', '自然风光', '美食之旅', '购物娱乐', '休闲放松'];

    if (dayIndex === 0) return '抵达与适应';
    if (dayIndex === totalDays - 1) return '离开准备';

    if (interests.includes('culture') && dayIndex === 1) return '文化体验';
    if (interests.includes('nature') && dayIndex === Math.floor(totalDays / 2)) return '自然风光';
    if (interests.includes('food')) return '美食之旅';

    return themes[Math.min(dayIndex, themes.length - 1)];
  }

  private generateDefaultActivities(day: TravelDay, request: TravelPlanningRequest): TravelActivity[] {
    const activities: TravelActivity[] = [];

    if (day.dayNumber === 1) {
      // 第一天：抵达
      activities.push({
        id: randomUUID(),
        time: '14:00',
        duration: 120,
        title: '酒店入住',
        type: 'accommodation',
        location: '酒店',
        description: '办理入住手续，休息调整',
        priority: 'high'
      });

      activities.push({
        id: randomUUID(),
        time: '17:00',
        duration: 180,
        title: '周边探索',
        type: 'attraction',
        location: '酒店周边',
        description: '熟悉周边环境，寻找晚餐地点',
        priority: 'medium'
      });
    } else if (day.dayNumber === Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24))) {
      // 最后一天：离开
      activities.push({
        id: randomUUID(),
        time: '10:00',
        duration: 120,
        title: '最后购物',
        type: 'shopping',
        location: '当地商店',
        description: '购买纪念品和礼品',
        priority: 'low'
      });
    } else {
      // 中间的日子：根据主题安排活动
      activities.push({
        id: randomUUID(),
        time: '09:00',
        duration: 240,
        title: day.theme + '活动',
        type: 'attraction',
        location: '主要景点',
        description: `体验${day.theme}`,
        priority: 'high'
      });

      activities.push({
        id: randomUUID(),
        time: '13:00',
        duration: 90,
        title: '午餐',
        type: 'meal',
        location: '当地餐厅',
        description: '品尝当地美食',
        priority: 'medium'
      });

      activities.push({
        id: randomUUID(),
        time: '15:00',
        duration: 180,
        title: '下午活动',
        type: 'attraction',
        location: '景点或博物馆',
        description: '继续探索当地文化',
        priority: 'medium'
      });
    }

    return activities;
  }

  private async calculateTotalCost(plan: TravelPlan): Promise<{ total: number; breakdown: any }> {
    // 简化的费用计算
    const breakdown = {
      accommodation: plan.budget.total * 0.35,
      transportation: plan.budget.total * 0.25,
      food: plan.budget.total * 0.25,
      activities: plan.budget.total * 0.10,
      shopping: plan.budget.total * 0.03,
      miscellaneous: plan.budget.total * 0.02
    };

    const total = Object.values(breakdown).reduce((sum, cost) => sum + cost, 0);

    return { total, breakdown };
  }

  private generateRecommendations(plan: TravelPlan): string[] {
    const recommendations: string[] = [];

    // 基于预算的推荐
    if (plan.preferences.travelStyle === 'budget') {
      recommendations.push('建议选择公共交通工具，可以节省交通费用');
      recommendations.push('可以考虑当地小吃街，体验地道美食同时节省开支');
    } else if (plan.preferences.travelStyle === 'luxury') {
      recommendations.push('推荐预订高端酒店，享受优质服务');
      recommendations.push('可以考虑私人导游服务，获得更深入的体验');
    }

    // 基于兴趣的推荐
    if (plan.preferences.interests.includes('culture')) {
      recommendations.push('建议提前预订博物馆门票，避免排队');
      recommendations.push('可以考虑参加当地文化体验活动');
    }

    if (plan.preferences.interests.includes('food')) {
      recommendations.push('推荐尝试当地特色餐厅和街头小吃');
      recommendations.push('可以考虑参加美食之旅或烹饪课程');
    }

    // 基于时长的推荐
    if (plan.duration > 7) {
      recommendations.push('建议安排一些自由活动时间，避免行程过于紧张');
      recommendations.push('可以考虑一日游到周边城市或景点');
    }

    return recommendations;
  }
}