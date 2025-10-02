export type AgentHookTypes =
  | 'pre_reply'
  | 'post_reply'
  | 'pre_print'
  | 'post_print'
  | 'pre_reasoning'
  | 'post_reasoning'
  | 'pre_acting'
  | 'post_acting'
  | 'pre_observation'
  | 'post_observation';

export interface HookContext {
  stepNumber?: number;
  agentId: string;
  task?: string;
  [key: string]: any;
}

export type HookFunction<T = any, R = any> = (
  context: HookContext,
  ...args: T[]
) => R | Promise<R>;

export class HookManager {
  private hooks: Map<AgentHookTypes, Map<string, HookFunction>> = new Map();

  constructor() {
    // Initialize hook types
    const hookTypes: AgentHookTypes[] = [
      'pre_reply', 'post_reply', 'pre_print', 'post_print',
      'pre_reasoning', 'post_reasoning', 'pre_acting', 'post_acting',
      'pre_observation', 'post_observation'
    ];

    hookTypes.forEach(type => {
      this.hooks.set(type, new Map());
    });
  }

  /**
   * Register a hook
   */
  register(hookType: AgentHookTypes, name: string, hook: HookFunction): void {
    const hooks = this.hooks.get(hookType);
    if (hooks) {
      hooks.set(name, hook);
    }
  }

  /**
   * Remove a hook
   */
  remove(hookType: AgentHookTypes, name: string): boolean {
    const hooks = this.hooks.get(hookType);
    return hooks ? hooks.delete(name) : false;
  }

  /**
   * Execute all hooks of a specific type
   */
  async execute<T, R>(
    hookType: AgentHookTypes,
    context: HookContext,
    ...args: T[]
  ): Promise<R[]> {
    const hooks = this.hooks.get(hookType);
    if (!hooks || hooks.size === 0) {
      return [];
    }

    const results: R[] = [];
    for (const [name, hook] of hooks) {
      try {
        const result = await hook(context, ...args);
        results.push(result);
      } catch (error) {
        console.warn(`Hook '${name}' of type '${hookType}' failed:`, error);
      }
    }

    return results;
  }

  /**
   * Execute hooks and transform data through them sequentially
   */
  async executeTransform<T, R>(
    hookType: AgentHookTypes,
    context: HookContext,
    data: T
  ): Promise<T> {
    const hooks = this.hooks.get(hookType);
    if (!hooks || hooks.size === 0) {
      return data;
    }

    let currentData = data;
    for (const [name, hook] of hooks) {
      try {
        const result = await hook(context, currentData);
        if (result !== undefined && result !== null) {
          currentData = result;
        }
      } catch (error) {
        console.warn(`Transform hook '${name}' of type '${hookType}' failed:`, error);
      }
    }

    return currentData;
  }

  /**
   * Clear all hooks of a specific type or all hooks
   */
  clear(hookType?: AgentHookTypes): void {
    if (hookType) {
      const hooks = this.hooks.get(hookType);
      if (hooks) {
        hooks.clear();
      }
    } else {
      this.hooks.forEach(hooks => hooks.clear());
    }
  }

  /**
   * Get all registered hook names for a type
   */
  getHookNames(hookType: AgentHookTypes): string[] {
    const hooks = this.hooks.get(hookType);
    return hooks ? Array.from(hooks.keys()) : [];
  }
}