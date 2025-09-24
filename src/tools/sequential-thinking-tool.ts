import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext } from '../types/index.js';

interface ThoughtData {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  nextThoughtNeeded: boolean;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
}

export class SequentialThinkingTool extends ToolExecutor {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, ThoughtData[]> = {};

  constructor() {
    super('sequentialthinking', {
      name: 'sequentialthinking',
      description: `A detailed tool for dynamic and reflective problem-solving through thoughts.
This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding deepens.

When to use this tool:
- Breaking down complex problems into steps
- Planning and design with room for revision
- Analysis that might need course correction
- Problems where the full scope might not be clear initially
- Problems that require a multi-step solution
- Tasks that need to maintain context over multiple steps
- Situations where irrelevant information needs to be filtered out

Key features:
- You can adjust total_thoughts up or down as you progress
- You can question or revise previous thoughts
- You can add more thoughts even after reaching what seemed like the end
- You can express uncertainty and explore alternative approaches
- Not every thought needs to build linearly - you can branch or backtrack
- Generates a solution hypothesis
- Verifies the hypothesis based on the Chain of Thought steps
- Repeats the process until satisfied
- Provides a correct answer

Parameters explained:
- thought: Your current thinking step, which can include:
* Regular analytical steps
* Revisions of previous thoughts
* Questions about previous decisions
* Realizations about needing more analysis
* Changes in approach
* Hypothesis generation
* Hypothesis verification
- next_thought_needed: True if you need more thinking, even if at what seemed like the end
- thought_number: Current number in sequence (can go beyond initial total if needed)
- total_thoughts: Current estimate of thoughts needed (can be adjusted up/down)
- is_revision: A boolean indicating if this thought revises previous thinking
- revises_thought: If is_revision is true, which thought number is being reconsidered
- branch_from_thought: If branching, which thought number is the branching point
- branch_id: Identifier for the current branch (if any)
- needs_more_thoughts: If reaching end but realizing more thoughts needed

You should:
1. Start with an initial estimate of needed thoughts, but be ready to adjust
2. Feel free to question or revise previous thoughts
3. Don't hesitate to add more thoughts if needed, even at the "end"
4. Express uncertainty when present
5. Mark thoughts that revise previous thinking or branch into new paths
6. Ignore information that is irrelevant to the current step
7. Generate a solution hypothesis when appropriate
8. Verify the hypothesis based on the Chain of Thought steps
9. Repeat the process until satisfied with the solution
10. Provide a single, ideally correct answer as the final output
11. Only set next_thought_needed to false when truly done and a satisfactory answer is reached`,
      parameters: {
        type: 'object',
        properties: {
          thought: {
            type: 'string',
            description: 'Your current thinking step',
          },
          next_thought_needed: {
            type: 'boolean',
            description: 'Whether another thought step is needed',
          },
          thought_number: {
            type: 'integer',
            description: 'Current thought number. Minimum value is 1.',
          },
          total_thoughts: {
            type: 'integer',
            description: 'Estimated total thoughts needed. Minimum value is 1.',
          },
          is_revision: {
            type: 'boolean',
            description: 'Whether this revises previous thinking',
          },
          revises_thought: {
            type: 'integer',
            description: 'Which thought is being reconsidered. Minimum value is 1.',
          },
          branch_from_thought: {
            type: 'integer',
            description: 'Branching point thought number. Minimum value is 1.',
          },
          branch_id: {
            type: 'string',
            description: 'Branch identifier',
          },
          needs_more_thoughts: {
            type: 'boolean',
            description: 'If more thoughts are needed',
          },
        },
        required: ['thought', 'next_thought_needed', 'thought_number', 'total_thoughts'],
      },
    });
  }

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      // Validate and extract thought data
      const validatedInput = this.validateThoughtData(params);

      // Adjust total thoughts if current thought number exceeds it
      if (validatedInput.thoughtNumber > validatedInput.totalThoughts) {
        validatedInput.totalThoughts = validatedInput.thoughtNumber;
      }

      // Add to thought history
      this.thoughtHistory.push(validatedInput);

      // Handle branching
      if (validatedInput.branchFromThought && validatedInput.branchId) {
        if (!this.branches[validatedInput.branchId]) {
          this.branches[validatedInput.branchId] = [];
        }
        this.branches[validatedInput.branchId].push(validatedInput);
      }

      // Prepare response
      const responseData = {
        thought_number: validatedInput.thoughtNumber,
        total_thoughts: validatedInput.totalThoughts,
        next_thought_needed: validatedInput.nextThoughtNeeded,
        branches: Object.keys(this.branches),
        thought_history_length: this.thoughtHistory.length,
      };

      return this.createSuccessResult({
        message: 'Sequential thinking step completed.',
        status: responseData,
      });
    } catch (error) {
      const errorData = { 
        error: error instanceof Error ? error.message : String(error), 
        status: 'failed' 
      };
      
      return this.createErrorResult(
        `Sequential thinking failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        JSON.stringify(errorData, null, 2)
      );
    }
  }

  private validateThoughtData(params: Record<string, unknown>): ThoughtData {
    // Validate required fields
    if (!params.thought || typeof params.thought !== 'string') {
      throw new Error('Invalid thought: must be a string');
    }

    if (params.thought_number === undefined || typeof params.thought_number !== 'number') {
      throw new Error('Invalid thought_number: must be a number');
    }

    if (params.total_thoughts === undefined || typeof params.total_thoughts !== 'number') {
      throw new Error('Invalid total_thoughts: must be a number');
    }

    if (params.next_thought_needed === undefined || typeof params.next_thought_needed !== 'boolean') {
      throw new Error('Invalid next_thought_needed: must be a boolean');
    }

    // Validate minimum values
    if (params.thought_number < 1) {
      throw new Error('thought_number must be at least 1');
    }

    if (params.total_thoughts < 1) {
      throw new Error('total_thoughts must be at least 1');
    }

    // Validate optional revision fields
    let revisesThought: number | undefined = undefined;
    if (params.revises_thought !== undefined && params.revises_thought !== null && params.revises_thought !== 0) {
      if (typeof params.revises_thought !== 'number' || params.revises_thought < 1) {
        throw new Error('revises_thought must be a positive integer');
      }
      revisesThought = Math.floor(params.revises_thought);
    }

    let branchFromThought: number | undefined = undefined;
    if (params.branch_from_thought !== undefined && params.branch_from_thought !== null && params.branch_from_thought !== 0) {
      if (typeof params.branch_from_thought !== 'number' || params.branch_from_thought < 1) {
        throw new Error('branch_from_thought must be a positive integer');
      }
      branchFromThought = Math.floor(params.branch_from_thought);
    }

    // Extract and cast the validated values
    const thought = String(params.thought);
    const thoughtNumber = Math.floor(params.thought_number as number);
    const totalThoughts = Math.floor(params.total_thoughts as number);
    const nextThoughtNeeded = Boolean(params.next_thought_needed);

    // Handle optional fields
    const isRevision = params.is_revision !== undefined ? Boolean(params.is_revision) : undefined;
    const branchId = params.branch_id !== undefined ? String(params.branch_id) : undefined;
    const needsMoreThoughts = params.needs_more_thoughts !== undefined ? Boolean(params.needs_more_thoughts) : undefined;

    return {
      thought,
      thoughtNumber,
      totalThoughts,
      nextThoughtNeeded,
      isRevision,
      revisesThought,
      branchFromThought,
      branchId,
      needsMoreThoughts,
    };
  }
}

// Register the tool
import { globalToolRegistry } from './base.js';
globalToolRegistry.register(new SequentialThinkingTool());