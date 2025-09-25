#!/usr/bin/env node

const fs = require('fs');

async function testAgentWithExistingTools() {
    console.log('🔄 测试Agent循环修复（使用现有模拟）...');
    
    try {
        // 模拟一个简单的Agent执行
        console.log('🎯 模拟任务：目录下有什么文件？');
        
        // 直接运行dir命令来获取结果
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const result = await execAsync('dir', { cwd: process.cwd() });
        
        console.log('📁 目录内容：');
        console.log(result.stdout);
        
        // 检查当前trajectory.json是否显示成功
        if (fs.existsSync('./trajectory.json')) {
            const trajectory = JSON.parse(fs.readFileSync('./trajectory.json', 'utf8'));
            console.log('\n📊 当前轨迹状态：');
            console.log(`- 任务: ${trajectory.task}`);
            console.log(`- 完成状态: ${trajectory.completed}`);
            console.log(`- 成功状态: ${trajectory.success}`);
            console.log(`- 执行步数: ${trajectory.steps?.length || 0}`);
            
            if (trajectory.steps && trajectory.steps.length > 0) {
                const lastStep = trajectory.steps[trajectory.steps.length - 1];
                console.log(`- 最后一步完成: ${lastStep.completed}`);
                console.log(`- 最后一步LLM响应长度: ${(lastStep.llm_response_content || '').length}`);
                console.log(`- 最后一步LLM响应预览: ${(lastStep.llm_response_content || '').substring(0, 100)}...`);
            }
            
            // 分析是否存在循环
            if (trajectory.steps && trajectory.steps.length >= 3) {
                console.log('⚠️ 检测到多步执行，可能存在循环问题');
                
                // 检查工具调用模式
                const toolCallCounts = trajectory.steps.map(step => step.tool_calls?.length || 0);
                console.log(`- 工具调用模式: [${toolCallCounts.join(', ')}]`);
                
                // 检查响应内容模式
                const responseLengths = trajectory.steps.map(step => (step.llm_response_content || '').trim().length);
                console.log(`- 响应长度模式: [${responseLengths.join(', ')}]`);
                
                if (responseLengths.some(len => len > 50)) {
                    console.log('✅ 发现有意义的LLM响应，循环问题可能已修复');
                } else {
                    console.log('❌ 仍然缺少有意义的LLM响应');
                }
            }
        } else {
            console.log('⚠️ 没有找到trajectory.json文件');
        }
        
        console.log('\n✅ 模拟测试完成');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

testAgentWithExistingTools();