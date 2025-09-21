import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext } from '../types/index.js';

export class SequentialThinkingTool extends ToolExecutor {
  constructor() {
    super('sequential_thinking_tool', {
      name: 'sequential_thinking_tool',
      description: 'Structured thinking process for complex problem solving',
      parameters: {
        type: 'object',
        properties: {
          thoughts: {
            type: 'array',
            description: 'Array of thoughts or reasoning steps',
          },
          problem: {
            type: 'string',
            description: 'The problem being solved',
          },
          approach: {
            type: 'string',
            description: 'Overall approach to solving the problem',
          },
          conclusion: {
            type: 'string',
            description: 'Final conclusion or decision',
          },
        },
        required: ['thoughts'],
      },
    });
  }

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParams(params);

      const { thoughts, problem, approach, conclusion } = params;

      // Validate thoughts array
      const thoughtsArray = thoughts as Array<Record<string, unknown>>;
      if (!Array.isArray(thoughtsArray) || thoughtsArray.length === 0) {
        return this.createErrorResult('Thoughts must be a non-empty array');
      }

      // Validate each thought
      for (const thought of thoughtsArray) {
        if (typeof thought.step !== 'number' || typeof thought.thought !== 'string') {
          return this.createErrorResult('Each thought must have step (number) and thought (string)');
        }
        if (thought.confidence !== undefined &&
            (typeof thought.confidence !== 'number' || thought.confidence < 0 || thought.confidence > 1)) {
          return this.createErrorResult('Confidence must be a number between 0 and 1');
        }
      }

      // Sort thoughts by step number
      const sortedThoughts = thoughtsArray.sort((a, b) => (a.step as number) - (b.step as number));

      // Create thinking summary
      const thinkingSummary = {
        problem,
        approach,
        thoughts: sortedThoughts,
        conclusion,
        total_steps: sortedThoughts.length,
        average_confidence: this.calculateAverageConfidence(sortedThoughts),
      };

      return this.createSuccessResult(thinkingSummary);
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private calculateAverageConfidence(thoughts: Array<Record<string, unknown>>): number {
    const confidences = thoughts
      .map(t => t.confidence as number)
      .filter(conf => typeof conf === 'number');

    if (confidences.length === 0) {
      return 0;
    }

    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }
}

// Register the tool
import { globalToolRegistry } from './base.js';
globalToolRegistry.register(new SequentialThinkingTool());