# PlannerAgent - 基于高级智能体的任务规划器

PlannerAgent是一个专门设计用于处理复杂多步骤规划任务的高级智能体，实现了"规划-执行"模式，能够将复杂问题分解为可管理的子任务，支持动态调整任务执行策略。

## 🌟 核心特性

### 🧠 智能任务分解
- **深度分析**：利用LLM的强大推理能力进行任务分解
- **结构化规划**：将复杂目标分解为具体、可执行的子任务
- **依赖关系识别**：自动识别和管理任务之间的依赖关系
- **优先级管理**：基于重要性和紧急性合理安排任务优先级

### ⚡ 执行优化
- **并行执行**：识别可并行执行的任务，提高执行效率
- **动态调整**：根据执行反馈实时调整计划和策略
- **失败处理**：智能的错误处理和重试机制
- **进度跟踪**：实时监控执行进度和状态

### 🔄 ReAct模式集成
- **推理阶段**：深度分析当前状况，制定最优策略
- **行动阶段**：执行具体的工具调用和操作
- **观察阶段**：评估执行结果，决定下一步行动

### 🛠️ 丰富的工具生态
- **规划工具**：专门的任务规划和管理工具
- **执行工具**：文件编辑、命令执行、代码分析等
- **思考工具**：sequential-thinking用于复杂问题分析
- **完成工具**：complete-task用于标记任务完成

## 📋 主要组件

### PlannerAgent类
```typescript
export class PlannerAgent extends BaseAgent {
  // 继承BaseAgent的所有ReAct能力
  // 增加专门的规划和执行功能
}
```

### 任务管理数据结构
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[];
  estimatedDuration?: number;
  // ... 更多属性
}

interface ExecutionPlan {
  id: string;
  title: string;
  objective: string;
  tasks: Task[];
  strategy: ExecutionStrategy;
  progress: number;
  // ... 更多属性
}
```

### PlannerTool工具
```typescript
export class PlannerTool extends ToolExecutor {
  // 支持的操作：
  // - create_plan: 创建执行计划
  // - add_task: 添加任务
  // - update_task: 更新任务状态
  // - get_plan: 获取当前计划
  // - analyze_plan: 分析计划复杂度和风险
  // - get_next_task: 获取下一个可执行任务
}
```

## 🚀 使用方法

### 基本使用
```javascript
const { PlannerAgent, ConfigManager, Logger, createLLMClient, createTools } = require('trae-agent-ts');
const { randomUUID } = require('crypto');

async function usePlannerAgent() {
  // 1. 加载配置
  const configManager = await ConfigManager.getInstance();
  const config = configManager.getConfig();
  
  // 2. 创建必要组件
  const logger = Logger.create({ level: 'info', format: 'pretty' });
  const llmClient = createLLMClient({
    name: config.llm.provider,
    api_key: config.llm.api_key,
    model: config.llm.model
  });
  const tools = await createTools(config, logger);
  
  // 3. 创建PlannerAgent
  const plannerAgent = new PlannerAgent(
    randomUUID(),
    llmClient,
    tools,
    config,
    logger,
    process.cwd(),
    {
      maxDecompositionDepth: 4,
      optimizeParallel: true,
      autoEstimateTime: true,
      strategy: 'balanced',
      granularity: 'medium'
    }
  );
  
  // 4. 执行复杂任务
  const complexObjective = `
    创建一个完整的Node.js Web应用程序，包括：
    - 用户认证系统
    - RESTful API
    - 数据库集成
    - 前端界面
    - 单元测试
    - 部署配置
  `;
  
  const trajectory = await plannerAgent.execute(complexObjective, 50);
  
  // 5. 检查结果
  console.log('执行结果:', trajectory.success);
  console.log('执行步骤:', trajectory.steps.length);
  
  const currentPlan = plannerAgent.getCurrentPlan();
  if (currentPlan) {
    console.log('计划状态:', currentPlan.status);
    console.log('任务总数:', currentPlan.tasks.length);
    console.log('执行进度:', `${(currentPlan.progress * 100).toFixed(1)}%`);
  }
}
```

### 配置选项
```typescript
interface PlanningOptions {
  maxDecompositionDepth: number;    // 最大任务分解深度
  optimizeParallel: boolean;        // 是否优化并行执行
  autoEstimateTime: boolean;        // 是否自动估算时间
  strategy: 'comprehensive' | 'minimal' | 'balanced';  // 规划策略
  granularity: 'fine' | 'medium' | 'coarse';          // 任务细粒度
  constraints?: Record<string, any>; // 额外约束
}
```

### 执行策略
```typescript
interface ExecutionStrategy {
  allowParallel: boolean;           // 是否支持并行执行
  maxParallelTasks: number;        // 最大并行任务数
  failureHandling: 'stop' | 'continue' | 'retry' | 'skip';  // 失败处理策略
  autoRetry: boolean;              // 是否自动重试
  maxRetries: number;              // 最大重试次数
  retryInterval: number;           // 重试间隔（秒）
  timeout?: number;                // 超时时间（分钟）
}
```

## 🎯 适用场景

### 复杂项目开发
- **软件开发项目**：从需求分析到部署的全流程规划
- **系统集成**：多系统集成的步骤规划和执行
- **数据迁移**：大规模数据迁移的分阶段执行

### 自动化流程
- **CI/CD流水线**：构建、测试、部署的自动化规划
- **运维任务**：系统维护和更新的标准化流程
- **监控告警**：故障处理的自动化响应流程

### 研究和分析
- **市场调研**：多维度市场分析的系统化规划
- **技术评估**：新技术引入的评估和试点计划
- **性能优化**：系统性能优化的分步骤执行

## 📊 执行流程

```
1. 任务接收
   ↓
2. 深度分析（使用sequential-thinking）
   ↓
3. 任务分解（生成子任务列表）
   ↓
4. 依赖分析（建立任务依赖图）
   ↓
5. 执行规划（制定执行策略）
   ↓
6. 逐步执行（ReAct循环）
   ↓
7. 进度监控（实时状态跟踪）
   ↓
8. 动态调整（基于反馈优化）
   ↓
9. 完成确认（调用complete_task）
```

## 🔧 配置要求

### 必需工具
```yaml
agent:
  tools:
    - sequential_thinking_tool  # 深度思考分析
    - planner_tool             # 任务规划管理
    - edit_tool                # 文件编辑
    - bash_tool                # 命令执行
    - complete_task_tool       # 任务完成标记
```

### 推荐配置
```yaml
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20241022
  max_tokens: 4096
  temperature: 0.7

agent:
  max_steps: 50
  enable_trajectory_recording: true
  tools:
    - sequential_thinking_tool
    - planner_tool
    - edit_tool
    - bash_tool
    - json_edit_tool
    - complete_task_tool
```

## 📈 性能特点

### 优势
- **智能分解**：基于LLM的深度任务分析能力
- **系统化管理**：结构化的任务管理和执行跟踪
- **自适应执行**：根据执行情况动态调整策略
- **并行优化**：最大化利用并行执行机会
- **可观测性**：完整的执行轨迹和状态监控

### 适用性
- **复杂度高**：适合处理多步骤、有依赖关系的复杂任务
- **规模大**：支持大型项目的系统化规划和执行
- **动态性强**：能够处理需求变化和执行中的调整
- **质量要求高**：通过系统化流程保证执行质量

## 🚀 快速开始

1. **安装依赖**
```bash
npm install trae-agent-ts
```

2. **配置环境**
```bash
export ANTHROPIC_API_KEY=your_api_key
# 或者创建 trae_config.yaml 配置文件
```

3. **运行示例**
```bash
node examples/planner-agent-example.js
```

4. **查看结果**
观察PlannerAgent如何分解复杂任务并逐步执行。

## 📚 相关文档

- [BaseAgent文档](./base-agent.md) - 了解基础Agent架构
- [工具系统文档](./tools.md) - 了解可用工具和扩展方法
- [配置指南](./configuration.md) - 详细配置说明
- [最佳实践](./best-practices.md) - 使用建议和优化技巧

---

**PlannerAgent** - 让复杂任务规划变得简单而智能！