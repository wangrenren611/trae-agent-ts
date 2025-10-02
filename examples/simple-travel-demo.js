/**
 * 简单的旅游Agent演示
 * 使用模拟数据展示核心功能
 */

const { TravelAgent } = require('../dist/agent/travel-agent.js');

async function simpleTravelDemo() {
  console.log('🌍 简单旅游Agent演示\n');

  try {
    // 创建模拟的Logger和LLM客户端
    const mockLogger = {
      info: (msg) => console.log(`[INFO] ${msg}`),
      debug: (msg) => console.log(`[DEBUG] ${msg}`),
      warn: (msg) => console.log(`[WARN] ${msg}`),
      error: (msg) => console.log(`[ERROR] ${msg}`)
    };

    const mockLLMClient = {
      chat: async (messages, tools) => {
        console.log(`[LLM] 收到请求，工具数量: ${tools?.length || 0}`);
        return {
          content: '我已经收到您的旅游需求，正在为您制定详细计划...',
          model: 'mock-model',
          tool_calls: []
        };
      }
    };

    // 创建模拟工具
    const mockTools = [
      {
        name: 'travel_planner',
        definition: {
          name: 'travel_planner',
          description: '旅游规划工具',
          parameters: { type: 'object', properties: {}, required: [] }
        },
        execute: async (params) => {
          console.log(`[TOOL] travel_planner 执行: ${params.action}`);
          return {
            success: true,
            result: {
              message: '旅游计划创建成功',
              plan: {
                id: 'plan-123',
                title: '巴黎5日游',
                destination: { name: 'Paris, France', country: 'France' },
                startDate: '2024-06-01',
                endDate: '2024-06-05',
                duration: 5,
                totalCost: 2500,
                currency: 'EUR',
                status: 'draft'
              }
            }
          };
        }
      },
      {
        name: 'complete_task',
        definition: {
          name: 'complete_task',
          description: '完成任务工具',
          parameters: { type: 'object', properties: {}, required: [] }
        },
        execute: async (params) => {
          console.log(`[TOOL] complete_task 执行`);
          return {
            success: true,
            result: {
              task_completed: true,
              result: '旅游规划任务完成',
              summary: '已成功创建5日巴黎旅游计划，包含详细的行程安排和预算分配',
              completion_time: new Date().toISOString()
            }
          };
        }
      }
    ];

    // 创建配置
    const config = {
      llm: { name: 'mock', model: 'mock-model' },
      logging: { level: 'info' }
    };

    // 创建TravelAgent
    const travelAgent = new TravelAgent(
      'demo-travel-agent',
      mockLLMClient,
      mockTools,
      config,
      mockLogger,
      './demo-workspace'
    );

    console.log('✅ TravelAgent 创建成功');

    // 验证配置
    const validation = travelAgent.validateTravelAgentSetup();
    console.log('配置验证:', validation.valid ? '✅ 通过' : '❌ 失败');
    if (!validation.valid) {
      console.log('问题:', validation.issues);
    }

    // 定义旅游需求
    const travelRequest = {
      destination: 'Paris, France',
      startDate: '2024-06-01',
      endDate: '2024-06-05',
      travelers: { adults: 2, children: 0, infants: 0 },
      budget: { total: 3000, currency: 'EUR' },
      preferences: {
        travelStyle: 'mid',
        interests: ['culture', 'art', 'food'],
        dietaryRestrictions: [],
        mobilityRequirements: [],
        language: ['zh', 'en']
      }
    };

    console.log('\n📋 旅游需求:');
    console.log(`目的地: ${travelRequest.destination}`);
    console.log(`日期: ${travelRequest.startDate} 至 ${travelRequest.endDate}`);
    console.log(`预算: ${travelRequest.budget.total} ${travelRequest.budget.currency}`);
    console.log(`兴趣: ${travelRequest.preferences.interests.join(', ')}`);

    // 执行规划
    console.log('\n🚀 开始旅游规划...');
    const travelPlan = await travelAgent.executeTravelPlanning(travelRequest);

    // 显示结果
    console.log('\n✅ 规划完成!');
    console.log('计划详情:');
    console.log(`- 标题: ${travelPlan.title}`);
    console.log(`- 目的地: ${travelPlan.destination.name}`);
    console.log(`- 天数: ${travelPlan.duration}`);
    console.log(`- 费用: ${travelPlan.totalCost} ${travelPlan.currency}`);
    console.log(`- 状态: ${travelPlan.status}`);

    // 显示Agent状态
    const summary = travelAgent.getPlanSummary();
    const phase = travelAgent.getCurrentPhase();

    console.log('\n🤖 Agent状态:');
    console.log(`- 阶段: ${phase}`);
    console.log(`- 计划ID: ${summary?.id}`);

    console.log('\n🎉 演示完成!');

  } catch (error) {
    console.error('❌ 演示失败:', error.message);
    console.error(error.stack);
  }
}

// 运行演示
simpleTravelDemo();