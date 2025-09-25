#!/usr/bin/env node

const { TraeAgent } = require('./dist/agent/trae-agent.js');
const { DeepSeekClient } = require('./dist/utils/llm_clients/deepseek-client.js');
const { BashTool } = require('./dist/tools/bash-tool.js');
const { EditTool } = require('./dist/tools/edit-tool.js');
const { Config } = require('./dist/utils/config/config.js');
const { Logger } = require('./dist/utils/logging/logger.js');
const fs = require('fs');

async function testAgentLoop() {
    console.log('🔄 测试Agent循环修复...');
    
    try {
        // 配置
        const config = await Config.fromFile('./trae_config.yaml');
        const logger = new Logger('test', 'info');
        
        // LLM客户端
        const llmClient = new DeepSeekClient(config);
        
        // 工具
        const bashTool = new BashTool();
        const editTool = new EditTool();
        const tools = [bashTool, editTool];
        
        // 创建Agent
        const agent = new TraeAgent(
            'test-agent-loop',
            llmClient,
            tools,
            config,
            logger,
            process.cwd()
        );
        
        console.log('🎯 执行简单任务：目录下有什么文件？');
        
        // 执行任务，限制最多3步来避免真正的无限循环
        const result = await agent.execute('目录下有什么文件？', 3);
        
        console.log('\n📊 执行结果：');
        console.log(`- 完成状态: ${result.completed}`);
        console.log(`- 成功状态: ${result.success}`);
        console.log(`- 执行步数: ${result.steps.length}`);
        
        // 分析每一步
        result.steps.forEach((step, index) => {
            console.log(`\n📝 第${index + 1}步：`);
            console.log(`- 工具调用数: ${step.tool_calls.length}`);
            console.log(`- 工具结果数: ${step.tool_results.length}`);
            console.log(`- 已完成: ${step.completed}`);
            console.log(`- LLM响应长度: ${step.llm_response_content?.length || 0}`);
            
            if (step.tool_calls.length > 0) {
                step.tool_calls.forEach(call => {
                    console.log(`  🔧 调用工具: ${call.function.name}`);
                });
            }
        });
        
        // 检查是否有循环问题
        if (result.steps.length >= 3 && !result.completed) {
            console.log('\n❌ 检测到可能的循环问题！');
        } else if (result.completed) {
            console.log('\n✅ 任务成功完成，没有循环问题！');
        }
        
        // 保存轨迹用于分析
        fs.writeFileSync('./test-trajectory.json', JSON.stringify(result, null, 2));
        console.log('\n💾 轨迹已保存到 test-trajectory.json');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        process.exit(1);
    }
}

testAgentLoop();