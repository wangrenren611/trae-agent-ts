# 智能旅游计划Agent

这是一个专门用于旅游规划和执行的人工智能Agent，能够根据用户需求自动创建详细的旅游计划，并按照计划执行具体的旅行任务。

## 🌟 核心功能

### 📋 规划阶段
- **智能行程规划**：根据目的地、时间、预算和兴趣创建个性化旅游计划
- **详细日程安排**：为每一天生成具体的活动安排和时间表
- **预算管理**：精确估算各项费用，合理分配预算
- **住宿交通**：推荐合适的住宿和交通方案
- **个性化推荐**：基于用户偏好提供定制化建议

### 🚀 执行阶段
- **活动执行**：按计划依次执行各项活动
- **预订管理**：自动处理住宿、交通、门票预订
- **实时监控**：跟踪预算使用情况和进度
- **问题处理**：智能应对突发情况，提供解决方案
- **状态更新**：实时更新执行状态和进度

## 🏗️ 系统架构

```
TravelAgent
├── TravelPlannerTool (规划工具)
│   ├── create_travel_plan (创建计划)
│   ├── get_travel_plan (获取计划)
│   ├── update_travel_plan (更新计划)
│   ├── add_activity (添加活动)
│   ├── remove_activity (移除活动)
│   ├── estimate_costs (费用估算)
│   └── get_recommendations (获取推荐)
│
└── TravelExecutorTool (执行工具)
    ├── load_plan (加载计划)
    ├── execute_activity (执行活动)
    ├── book_accommodation (预订住宿)
    ├── book_transportation (预订交通)
    ├── book_activity (预订活动)
    ├── check_weather (检查天气)
    ├── get_next_activity (获取下一个活动)
    ├── update_execution_status (更新状态)
    └── handle_issues (处理问题)
```

## 📊 数据结构

### 旅游计划 (TravelPlan)
- 基本信息：目的地、日期、旅行者
- 预算信息：总预算、分类预算
- 偏好设置：旅行风格、兴趣、特殊要求
- 详细行程：每日活动安排
- 费用明细：各项费用分解

### 活动安排 (TravelActivity)
- 时间和地点
- 活动类型和描述
- 预估费用
- 优先级和依赖关系
- 天气和预订要求

## 🚀 使用方法

### 基本用法

```javascript
const { TravelAgent } = require('./dist/agent/travel-agent.js');
const { createLLMClient } = require('./dist/utils/llm_clients/factory.js');
const { createTravelTools } = require('./dist/tools/factory.js');
const { Logger } = require('./dist/utils/logging/logger.js');

// 创建配置
const config = {
  llm: {
    name: 'glm',
    model: 'glm-4.6',
    api_key: 'your-api-key'
  },
  logging: { level: 'info' }
};

// 创建Agent
const tools = await createTravelTools(config, logger);
const travelAgent = new TravelAgent(
  'travel-agent-id',
  llmClient,
  tools,
  config,
  logger,
  './workspace'
);

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
    dietaryRestrictions: ['vegetarian'],
    mobilityRequirements: [],
    language: ['zh', 'en']
  }
};

// 执行旅游规划
const travelPlan = await travelAgent.executeTravelPlanning(travelRequest);
console.log('旅游计划:', travelPlan);
```

### 示例输出

```json
{
  "id": "plan-123",
  "title": "巴黎5日游",
  "destination": {
    "name": "Paris, France",
    "country": "France",
    "bestSeasons": ["春季", "秋季"]
  },
  "startDate": "2024-06-01",
  "endDate": "2024-06-05",
  "duration": 5,
  "totalCost": 2500,
  "currency": "EUR",
  "itinerary": [
    {
      "dayNumber": 1,
      "date": "2024-06-01",
      "theme": "抵达与适应",
      "activities": [
        {
          "time": "14:00",
          "title": "酒店入住",
          "type": "accommodation",
          "location": "巴黎市中心酒店",
          "duration": 120
        },
        {
          "time": "17:00",
          "title": "周边探索",
          "type": "attraction",
          "location": "酒店周边",
          "duration": 180
        }
      ]
    }
  ]
}
```

## 🛠️ 配置选项

### LLM配置
```javascript
llm: {
  name: 'glm',           // LLM提供商
  model: 'glm-4.6',      // 模型名称
  api_key: 'your-key',   // API密钥
  max_tokens: 4000,      // 最大token数
  temperature: 0.7       // 生成温度
}
```

### 工具配置
- `travel_planner`: 旅游规划工具
- `travel_executor`: 旅游执行工具
- `sequential_thinking`: 深度分析工具
- `complete_task`: 任务完成工具

## 📝 支持的目的地

目前系统支持以下热门旅游目的地，并提供针对性的推荐：
- **欧洲**：巴黎、伦敦、罗马、巴塞罗那
- **亚洲**：东京、京都、新加坡、曼谷
- **美洲**：纽约、洛杉矶、多伦多
- **其他**：悉尼、迪拜等

## 💡 特色功能

### 智能推荐
- 基于用户兴趣的个性化推荐
- 季节性最佳旅行时间建议
- 预算友好的替代方案

### 灵活调整
- 动态修改行程安排
- 实时预算控制
- 突发情况应对

### 多语言支持
- 支持中文、英文等多种语言
- 本地化服务推荐

## 🔧 开发和扩展

### 添加新工具
```javascript
// 创建自定义工具
class CustomTravelTool extends ToolExecutor {
  constructor() {
    super('custom_tool', definition);
  }

  async execute(params, context) {
    // 实现自定义逻辑
  }
}
```

### 扩展目的地数据
```javascript
// 在工具中添加新的目的地信息
const destinationData = {
  'new-city': {
    bestSeasons: ['夏季', '秋季'],
    averageCost: { budget: 30, mid: 60, luxury: 120 },
    attractions: [...]
  }
};
```

## 📚 文件结构

```
src/
├── agent/
│   └── travel-agent.ts          # 主要Agent类
├── tools/
│   ├── travel-planner-tool.ts   # 规划工具
│   ├── travel-executor-tool.ts  # 执行工具
│   └── factory.ts              # 工具工厂
├── types/
│   └── travel-planning.ts       # 类型定义
└── examples/
    ├── travel-agent-example.js  # 完整示例
    └── simple-travel-demo.js    # 简单演示
```

## 🧪 测试

运行简单演示：
```bash
node examples/simple-travel-demo.js
```

运行完整示例：
```bash
node examples/travel-agent-example.js
```

## 🚧 注意事项

1. **API密钥**：需要配置有效的LLM API密钥
2. **数据验证**：输入的日期和预算数据会被验证
3. **工具依赖**：确保所有必要的工具都已正确加载
4. **错误处理**：系统会优雅地处理各种错误情况

## 🔄 未来计划

- [ ] 集成真实的预订API
- [ ] 添加更多目的地数据
- [ ] 支持多城市连续旅行
- [ ] 增加用户偏好学习功能
- [ ] 集成地图和导航服务
- [ ] 添加社交分享功能

## 📄 许可证

本项目采用 MIT 许可证。详见 LICENSE 文件。

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！