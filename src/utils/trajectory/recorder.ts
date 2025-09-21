import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { AgentTrajectory, Config } from '../../types/index.js';
import { Logger } from '../logging/logger.js';

export class TrajectoryRecorder {
  private readonly enabled: boolean;
  private readonly outputDir: string;
  private readonly logger: Logger;

  constructor(config: Config, logger: Logger) {
    this.enabled = config.agent.enable_trajectory_recording ?? true;
    this.outputDir = './trajectories'; // Default output directory
    this.logger = logger.child({ component: 'TrajectoryRecorder' });
  }

  async recordTrajectory(trajectory: AgentTrajectory): Promise<string | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      // Ensure output directory exists
      await mkdir(this.outputDir, { recursive: true });

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `trajectory_${trajectory.agent_id}_${timestamp}.json`;
      const filepath = join(this.outputDir, filename);

      // Write trajectory to file
      const trajectoryData = {
        ...trajectory,
        metadata: {
          version: '1.0.0',
          recorded_at: new Date().toISOString(),
          file_format: 'trae-agent-trajectory',
        },
      };

      await writeFile(filepath, JSON.stringify(trajectoryData, null, 2), 'utf-8');

      this.logger.info(`Trajectory recorded to ${filepath}`, {
        agent_id: trajectory.agent_id,
        steps: trajectory.steps.length,
        success: trajectory.success,
      });

      return filepath;
    } catch (error) {
      this.logger.error('Failed to record trajectory', { error });
      return null;
    }
  }

  async recordStep(agentId: string, stepIndex: number, stepData: any): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      // This could be used for real-time step recording
      // For now, we'll just log it
      this.logger.debug(`Step ${stepIndex} recorded for agent ${agentId}`, stepData);
    } catch (error) {
      this.logger.error('Failed to record step', { error, agentId, stepIndex });
    }
  }

  getTrajectorySummary(trajectory: AgentTrajectory): string {
    const duration = trajectory.end_time && trajectory.start_time
      ? new Date(trajectory.end_time).getTime() - new Date(trajectory.start_time).getTime()
      : 0;

    const toolsUsed = new Set<string>();
    for (const step of trajectory.steps) {
      for (const call of step.tool_calls) {
        toolsUsed.add(call.function.name);
      }
    }

    return `Agent ${trajectory.agent_id} completed task "${trajectory.task}" in ${trajectory.steps.length} steps. ` +
           `Success: ${trajectory.success}. Duration: ${duration}ms. Tools used: ${Array.from(toolsUsed).join(', ')}`;
  }
}

export class Lakeview {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: 'Lakeview' });
  }

  generateSummary(trajectory: AgentTrajectory): string {
    // Generate a concise summary of the trajectory
    const keySteps = this.extractKeySteps(trajectory);
    const toolsUsed = this.extractToolsUsed(trajectory);
    const outcome = trajectory.success ? 'completed successfully' : 'failed';

    return `Task "${trajectory.task}" ${outcome} after ${trajectory.steps.length} steps. ` +
           `Key actions: ${keySteps.join(', ')}. ` +
           `Tools used: ${toolsUsed.join(', ')}.`;
  }

  private extractKeySteps(trajectory: AgentTrajectory): string[] {
    const keySteps: string[] = [];

    for (const step of trajectory.steps) {
      // Look for significant tool usage
      for (const call of step.tool_calls) {
        if (call.function.name === 'task_done_tool') {
          keySteps.push('task completion');
        } else if (call.function.name === 'edit_tool') {
          const args = JSON.parse(call.function.arguments);
          keySteps.push(`file ${args.command}`);
        } else if (call.function.name === 'bash_tool') {
          keySteps.push('command execution');
        }
      }
    }

    // Remove duplicates and limit to 3 most important
    return [...new Set(keySteps)].slice(0, 3);
  }

  private extractToolsUsed(trajectory: AgentTrajectory): string[] {
    const tools = new Set<string>();

    for (const step of trajectory.steps) {
      for (const call of step.tool_calls) {
        tools.add(call.function.name);
      }
    }

    return Array.from(tools);
  }

  formatForDisplay(trajectory: AgentTrajectory): string {
    const summary = this.generateSummary(trajectory);
    const stepCount = trajectory.steps.length;
    const success = trajectory.success;
    const duration = this.calculateDuration(trajectory);

    return [
      '🎯 ' + summary,
      `📊 Steps: ${stepCount} | ⏱️ Duration: ${duration} | ✅ Success: ${success}`,
      '',
      '🔧 Tool Usage:',
      ...this.formatToolUsage(trajectory),
    ].join('\n');
  }

  private calculateDuration(trajectory: AgentTrajectory): string {
    if (!trajectory.start_time || !trajectory.end_time) {
      return 'unknown';
    }

    const duration = new Date(trajectory.end_time).getTime() - new Date(trajectory.start_time).getTime();

    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(1)}s`;
    } else {
      return `${(duration / 60000).toFixed(1)}m`;
    }
  }

  private formatToolUsage(trajectory: AgentTrajectory): string[] {
    const toolUsage = new Map<string, number>();

    for (const step of trajectory.steps) {
      for (const call of step.tool_calls) {
        toolUsage.set(call.function.name, (toolUsage.get(call.function.name) || 0) + 1);
      }
    }

    return Array.from(toolUsage.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([tool, count]) => `  • ${tool}: ${count} time${count === 1 ? '' : 's'}`);
  }
}

