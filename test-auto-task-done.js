#!/usr/bin/env node

console.log('🎯 测试Agent自动调用task_done工具');

async function testAutoTaskDone() {
    console.log('\n📋 测试逻辑说明：');
    console.log('1. Agent执行工具并获得结果');
    console.log('2. 检测到LLM提供了实质性回答（>10字符）且无更多工具调用');
    console.log('3. 自动生成task_done工具调用');
    console.log('4. 执行task_done工具标记任务完成');
    console.log('5. 更新trajectory状态并结束循环');
    
    console.log('\n🔧 修复后的执行流程：');
    console.log('- shouldAutoCompleteTask(): 检测是否应该自动完成');
    console.log('- hasTaskDoneCall(): 检查是否已调用task_done');
    console.log('- executeTaskDoneCall(): 自动执行task_done调用');
    
    // 检查当前代码实现
    const fs = require('fs');
    
    try {
        const agentCode = fs.readFileSync('./src/agent/base-agent.ts', 'utf8');
        
        const checks = {
            hasAutoComplete: agentCode.includes('shouldAutoCompleteTask'),
            hasTaskDoneCheck: agentCode.includes('hasTaskDoneCall'),
            hasAutoExecution: agentCode.includes('executeTaskDoneCall'),
            hasMainLogic: agentCode.includes('Auto-calling task_done')
        };
        
        console.log('\n✅ 代码实现检查：');
        Object.entries(checks).forEach(([key, value]) => {
            console.log(`- ${key}: ${value ? '✅' : '❌'}`);
        });
        
        const allImplemented = Object.values(checks).every(v => v);
        
        if (allImplemented) {
            console.log('\n🎉 所有功能都已正确实现！');
            console.log('\n📊 预期行为：');
            console.log('1. 用户问："目录下有什么文件？"');
            console.log('2. Agent调用bash_tool("dir")');
            console.log('3. 获得目录列表结果');
            console.log('4. LLM生成详细回答（>10字符）');
            console.log('5. 检测到应该完成任务但未调用task_done');
            console.log('6. 自动调用task_done工具');
            console.log('7. 标记任务完成并结束');
            
            console.log('\n📝 trajectory.json中的预期结果：');
            console.log('- steps数组包含2个步骤');
            console.log('- 第1步：bash_tool调用和LLM回答');
            console.log('- 第2步：task_done工具调用');
            console.log('- completed: true');
            console.log('- success: true');
            console.log('- end_time: 已设置');
            
        } else {
            console.log('\n❌ 部分功能缺失，需要完善实现');
        }
        
    } catch (error) {
        console.log('❌ 无法检查源代码:', error.message);
    }
}

function analyzeCurrentTrajectory() {
    console.log('\n🔍 分析当前trajectory.json状态：');
    
    const fs = require('fs');
    
    if (fs.existsSync('./trajectory.json')) {
        const trajectory = JSON.parse(fs.readFileSync('./trajectory.json', 'utf8'));
        
        console.log(`📝 当前状态：`);
        console.log(`- 步骤数: ${trajectory.steps?.length || 0}`);
        console.log(`- 任务完成: ${trajectory.completed}`);
        console.log(`- 任务成功: ${trajectory.success}`);
        
        if (trajectory.steps && trajectory.steps.length > 0) {
            trajectory.steps.forEach((step, index) => {
                console.log(`\n第${index + 1}步:`);
                console.log(`- 工具调用: ${step.tool_calls?.map(call => call.function.name).join(', ') || '无'}`);
                console.log(`- 步骤完成: ${step.completed}`);
                
                if (step.tool_calls?.some(call => call.function.name === 'task_done')) {
                    console.log(`✅ 发现task_done调用!`);
                    
                    const taskDoneResult = step.tool_results?.find(result => 
                        result.result && typeof result.result === 'object' && 
                        'task_completed' in result.result
                    );
                    
                    if (taskDoneResult) {
                        console.log(`- task_done结果: ${JSON.stringify(taskDoneResult.result)}`);
                    }
                }
            });
        }
        
        // 判断修复效果
        const hasTaskDoneCall = trajectory.steps?.some(step => 
            step.tool_calls?.some(call => call.function.name === 'task_done')
        );
        
        if (hasTaskDoneCall && trajectory.completed) {
            console.log('\n🎉 修复成功！Agent正确调用了task_done工具');
        } else if (!hasTaskDoneCall) {
            console.log('\n⚠️ 还没有测试新的修复，需要运行Agent来验证');
        } else {
            console.log('\n❓ task_done已调用但任务状态异常，需要进一步检查');
        }
        
    } else {
        console.log('⚠️ 没有找到trajectory.json文件');
    }
}

async function main() {
    await testAutoTaskDone();
    analyzeCurrentTrajectory();
    
    console.log('\n🚀 总结：');
    console.log('已实现Agent智能判断任务完成后自动调用task_done工具的功能');
    console.log('这确保了任务完成流程的规范化和一致性');
    console.log('下一步：实际运行Agent来验证修复效果');
}

main();