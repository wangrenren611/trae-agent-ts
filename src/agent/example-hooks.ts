import { HookContext } from './hooks.js';
import { AgentStep } from '../types/index.js';

/**
 * Example hook that logs execution progress
 */
export const progressLoggerHook = async (context: HookContext, ...args: any[]): Promise<void> => {
  console.log(`[${context.agentId}] Progress - Step ${context.stepNumber}/${context.maxSteps}`);
};

/**
 * Example hook that validates task completion
 */
export const taskValidatorHook = async (context: HookContext, trajectory: any): Promise<any> => {
  // Validate trajectory structure
  if (!trajectory.steps || trajectory.steps.length === 0) {
    console.warn(`[${context.agentId}] No steps recorded in trajectory`);
  }

  return trajectory;
};

/**
 * Example hook that adds performance monitoring
 */
export const performanceMonitorHook = async (context: HookContext, step: AgentStep): Promise<AgentStep> => {
  const now = Date.now();
  (step as any).performance_metrics = {
    execution_time: now - step.timestamp,
    memory_usage: process.memoryUsage(),
    step_number: context.stepNumber
  };

  return step;
};

/**
 * Example hook that tracks tool usage
 */
export const toolUsageTrackerHook = async (context: HookContext, toolCalls: any[]): Promise<void> => {
  const toolNames = toolCalls.map(call => call.function.name);
  console.log(`[${context.agentId}] Tools used in step ${context.stepNumber}: ${toolNames.join(', ')}`);
};

/**
 * Example hook that saves state snapshots at key points
 */
export const stateSnapshotHook = async (context: HookContext, stateManager: any): Promise<void> => {
  if (context.stepNumber && context.stepNumber % 5 === 0) {
    stateManager.saveSnapshot();
    console.log(`[${context.agentId}] State snapshot saved at step ${context.stepNumber}`);
  }
};

/**
 * Example hook that implements custom retry logic for specific operations
 */
export const customRetryHook = async (context: HookContext, error: Error): Promise<boolean> => {
  // Custom logic to determine if we should retry
  if (error.message.includes('temporary')) {
    console.log(`[${context.agentId}] Retrying due to temporary error: ${error.message}`);
    return true;
  }
  return false;
};