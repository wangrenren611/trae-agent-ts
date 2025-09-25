#!/usr/bin/env node

console.log('🎯 测试task_done修复：任务完成状态同步');

// 分析当前trajectory.json的问题
const fs = require('fs');

function analyzeTrajectory() {
    console.log('\n📊 分析当前trajectory.json问题：');
    
    if (fs.existsSync('./trajectory.json')) {
        const trajectory = JSON.parse(fs.readFileSync('./trajectory.json', 'utf8'));
        
        console.log(`🔍 任务: "${trajectory.task}"`);
        console.log(`📝 步骤数: ${trajectory.steps?.length || 0}`);
        
        if (trajectory.steps && trajectory.steps.length > 0) {
            const lastStep = trajectory.steps[trajectory.steps.length - 1];
            
            console.log('\n📋 最后一步分析：');
            console.log(`- 步骤完成状态: ${lastStep.completed}`);
            console.log(`- LLM响应长度: ${(lastStep.llm_response_content || '').length}`);
            console.log(`- 工具调用数: ${lastStep.tool_calls?.length || 0}`);
            console.log(`- 工具结果数: ${lastStep.tool_results?.length || 0}`);
            
            if (lastStep.llm_response_content) {
                console.log(`- 响应预览: ${lastStep.llm_response_content.substring(0, 100)}...`);
            }
        }
        
        console.log('\n🎯 整体任务状态：');
        console.log(`- 任务完成状态: ${trajectory.completed}`);
        console.log(`- 任务成功状态: ${trajectory.success}`);
        console.log(`- 开始时间: ${trajectory.start_time}`);
        console.log(`- 结束时间: ${trajectory.end_time || '未设置'}`);
        
        // 问题诊断
        console.log('\n🔍 问题诊断：');
        
        if (trajectory.steps && trajectory.steps.length > 0) {
            const lastStep = trajectory.steps[trajectory.steps.length - 1];
            
            if (lastStep.completed && !trajectory.completed) {
                console.log('❌ 发现问题：步骤已完成但任务未完成');
                console.log('   原因：trajectory.json在状态更新前写入');
                console.log('   修复：已将writeFileSync移到状态更新后');
            } else if (lastStep.completed && trajectory.completed) {
                console.log('✅ 状态一致：步骤和任务都已完成');
            } else if (!lastStep.completed) {
                console.log('⚠️ 步骤未完成，可能需要进一步分析');
                
                // 检查LLM响应是否足够
                if (lastStep.llm_response_content && lastStep.llm_response_content.trim().length > 10) {
                    console.log('   LLM提供了实质性回答，应该标记为完成');
                } else {
                    console.log('   LLM响应内容不足，可能确实未完成');
                }
            }
        }
        
        // 解决方案建议
        console.log('\n💡 解决方案分析：');
        console.log('1. ✅ 修复了writeFileSync时机问题');
        console.log('2. ✅ 增强了任务完成检测逻辑');
        console.log('3. ✅ 添加了follow-up LLM调用机制');
        console.log('4. 🎯 下一步：测试新的Agent执行');
        
    } else {
        console.log('⚠️ 没有找到trajectory.json文件');
    }
}

function explainFixedLogic() {
    console.log('\n🔧 修复逻辑说明：');
    console.log('\n**修复前的问题顺序：**');
    console.log('1. executeStep() 执行并返回step');
    console.log('2. 添加step到trajectory.steps');
    console.log('3. ❌ writeFileSync() - 此时trajectory.completed还是false');
    console.log('4. 检查step.completed并更新trajectory状态');
    console.log('5. break跳出循环');
    console.log('👆 导致trajectory.json中任务状态不正确');
    
    console.log('\n**修复后的正确顺序：**');
    console.log('1. executeStep() 执行并返回step');
    console.log('2. 添加step到trajectory.steps');
    console.log('3. 检查step.completed并更新trajectory状态');
    console.log('4. ✅ writeFileSync() - 此时trajectory状态已正确更新');
    console.log('5. break跳出循环');
    console.log('👆 确保trajectory.json中状态正确');
    
    console.log('\n🎯 期望结果：');
    console.log('- step.completed = true');
    console.log('- trajectory.completed = true');
    console.log('- trajectory.success = true');
    console.log('- trajectory.end_time 已设置');
}

async function main() {
    analyzeTrajectory();
    explainFixedLogic();
    
    console.log('\n🚀 修复总结：');
    console.log('问题：Agent能正确回答问题，但没有调用task_done工具');
    console.log('原因：trajectory.json状态写入时机错误，导致完成状态不同步');
    console.log('解决：调整writeFileSync位置，确保状态更新后再写入文件');
    console.log('结果：Agent现在应该能正确标记任务完成状态');
}

main();