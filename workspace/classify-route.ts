import { NextRequest, NextResponse } from "next/server";

// 类型定义 - 由于依赖文件缺失，添加必要的类型定义
type MCPConfig = {
  command?: string;
  args?: string[];
  transport?: string;
  url?: string;
  env?: Record<string, string>;
};

type ReActConfig = {
  apiKey: string;
  apiUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  maxIterations: number;
  thinking: { type: "disabled" | "enabled" };
  systemPrompt: string;
  mcpServers: Record<string, MCPConfig>;
};

type ReActAgent = {
  new (config: ReActConfig): ReActAgent;
  execute(params: { userInput: string }): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }>;
};

// 请求和响应类型定义
interface ClassifyRequest {
  userInput: string;
}

interface ClassifyResponse {
  code: number;
  message: string;
  data?: any;
  testQuery?: string;
}

interface AgentResult {
  success: boolean;
  data?: any;
  message?: string;
}

// 环境变量验证和默认值
const validateEnvironment = (): void => {
  const requiredEnvVars = ['GLM_API_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`缺少必要的环境变量: ${missingVars.join(', ')}`);
  }
};

// MCP工具配置
const MCP_SERVER_CONFIG: Record<string, MCPConfig> = {
  "filesystem": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", process.env.WORK_PATH || "./work"],
    transport: "stdio"
  },
  "context7": {
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"]
  },
  "sequential-thinking": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"]
  },
  "AISearch": {
    url: `http://appbuilder.baidu.com/v2/ai_search/mcp/sse?api_key=${process.env.BAIDU_MCP_API_KEY || ''}`
  },
  "playwright": {
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"]
  },
  "mcp-tavily-search": {
    command: "npx",
    args: ["-y", "mcp-tavily-search"],
    env: {
      TAVILY_API_KEY: process.env.TAVILY_API_KEY || ''
    }
  },
  "shell-mcp-server": {
    command: "npx",
    args: ["-y", "shell-mcp-server"]
  },
};

// 响应创建函数
const createSuccessResponse = (data: any, message: string = "操作成功", testQuery?: string): ClassifyResponse => {
  const response: ClassifyResponse = {
    code: 0,
    message,
    data
  };
  
  if (testQuery) {
    response.testQuery = testQuery;
  }
  
  return response;
};

const createErrorResponse = (message: string, data?: any): ClassifyResponse => ({
  code: 1,
  message,
  data
});

// 创建ReAct Agent配置
const createReActConfig = ({
  maxTokens = 2000,
  maxIterations = 5,
  temperature = 0.1,
  thinking = { type: "disabled" as const },
  systemPrompt
}: {
  maxTokens?: number;
  maxIterations?: number;
  temperature?: number;
  thinking?: { type?: "disabled" | "enabled" };
  systemPrompt: string;
}): ReActConfig => {
  validateEnvironment();
  
  return {
    apiKey: process.env.GLM_API_KEY!,
    apiUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4.5-flash",
    temperature,
    maxTokens,
    maxIterations,
    thinking: thinking.type ? { type: thinking.type } : { type: "disabled" },
    systemPrompt,
    mcpServers: MCP_SERVER_CONFIG,
  };
};

// 查询分类函数 - 提取重复逻辑
const classifyQuery = async (userInput: string, isTest: boolean = false): Promise<AgentResult> => {
  // 由于依赖文件缺失，这里使用占位符提示
  const queryClassifierPrompt = "请分析用户查询，判断是需要制定计划还是可以直接回答";
  
  try {
    // 创建查询分类器Agent
    const classifierAgent = new ReActAgent(createReActConfig({
      systemPrompt: queryClassifierPrompt,
      thinking: { type: "enabled" },
      maxIterations: 3,
      temperature: 0.1,
      maxTokens: 2000,
    }));

    // 执行分类任务
    const result = await classifierAgent.execute({ 
      userInput: `请分析以下用户查询，判断是需要制定计划还是可以直接回答：

用户查询：${userInput}

请按照指定的JSON格式输出分析结果。`
    });

    return result;
  } catch (error: any) {
    console.error(`${isTest ? '测试' : ''}查询分类错误:`, error);
    return {
      success: false,
      message: error?.message || "分类处理失败",
      data: error
    };
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ClassifyRequest;
    const { userInput } = body;

    if (!userInput?.trim()) {
      return NextResponse.json(createErrorResponse("用户输入不能为空"));
    }

    // 执行分类任务
    const result = await classifyQuery(userInput);

    if (result.success) {
      return NextResponse.json(createSuccessResponse(result.data, "查询分类完成"));
    } else {
      return NextResponse.json(createErrorResponse(result.message || "查询分类失败", result.data));
    }

  } catch (error: any) {
    console.error('查询分类API错误:', error);
    return NextResponse.json(createErrorResponse(
      error?.response?.data?.message || error.message || "请求失败"
    ));
  }
}

// GET方法用于测试
export async function GET() {
  try {
    const testQuery = "帮我开发一个留学支付网站，需要5个页面";
    
    // 使用统一的分类函数
    const result = await classifyQuery(testQuery, true);

    if (result.success) {
      return NextResponse.json(createSuccessResponse(
        result.data, 
        "测试查询分类完成", 
        testQuery
      ));
    } else {
      return NextResponse.json(createErrorResponse(
        result.message || "测试查询分类失败", 
        result.data
      ));
    }

  } catch (error: any) {
    console.error('测试查询分类API错误:', error);
    return NextResponse.json(createErrorResponse(
      error?.response?.data?.message || error.message || "请求失败"
    ));
  }
}
