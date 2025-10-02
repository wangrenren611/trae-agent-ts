# Agent System Optimization Guide

This guide documents the optimizations implemented in the TREA agent system, inspired by AgentScope patterns.

## Overview

The enhanced agent system includes four major improvements:

1. **Hook System Architecture** - Extensible event-driven architecture
2. **State Management** - Centralized state tracking with history
3. **Async Interruption Handling** - Proper cancellation and interruption support
4. **Error Handling & Resilience** - Retry logic, circuit breakers, and fault tolerance

## 1. Hook System Architecture

### Features
- **Pre/Post Hooks**: Execute code before/after major operations
- **Extensible**: Easy to add custom behavior without modifying core logic
- **Composable**: Multiple hooks can be chained together
- **Type Safe**: Full TypeScript support with proper typing

### Hook Types
- `pre_reply` / `post_reply`: Around the main execution
- `pre_reasoning` / `post_reasoning`: Around LLM reasoning
- `pre_acting` / `post_acting`: Around tool execution
- `pre_observation` / `post_observation`: Around result processing
- `pre_print` / `post_print`: Around output formatting

### Usage Example
```typescript
// Add a custom hook
agent.addHook('pre_reasoning', 'my-logger', async (context, messages) => {
  console.log(`Starting reasoning for step ${context.stepNumber}`);
});

// Remove a hook
agent.removeHook('pre_reasoning', 'my-logger');
```

## 2. State Management

### Features
- **Centralized State**: All agent state in one place
- **State History**: Automatic snapshots with configurable retention
- **State Watching**: Reactive updates when state changes
- **State Diff**: Track what changed between snapshots

### State Variables
- `agentId`: Unique identifier
- `workingDirectory`: Current working directory
- `isRunning`: Execution status
- `stepCount`: Current step number
- `startTime`: Execution start time
- `lastActivity`: Last activity timestamp

### Usage Example
```typescript
// Register a custom state variable
agent.state.register('customMetric', 0);

// Update state
agent.state.set('customMetric', 42);

// Watch for changes
const unsubscribe = agent.state.watch('customMetric', (newValue, oldValue) => {
  console.log(`Custom metric changed from ${oldValue} to ${newValue}`);
});

// Get state history
const history = agent.state.getHistory();
```

## 3. Async Interruption Handling

### Features
- **Graceful Interruption**: Proper cleanup when execution is stopped
- **Task Tracking**: Monitor active operations
- **Interrupt Handlers**: Custom cleanup logic
- **Cancellable Operations**: Wrap promises with cancellation support

### Usage Example
```typescript
// Interrupt execution
await agent.interrupt('User requested stop');

// Register custom interrupt handler
agent.interruption.registerHandler(async (reason) => {
  await cleanupResources();
  console.log(`Interrupted: ${reason}`);
});

// Create cancellable operation
const result = await agent.interruption.createCancellablePromise(
  longRunningOperation(),
  'task-123'
);
```

## 4. Error Handling & Resilience

### Features
- **Retry Logic**: Exponential backoff with configurable conditions
- **Circuit Breakers**: Prevent cascade failures
- **Timeout Protection**: Automatic timeouts for long operations
- **Error Isolation**: Continue execution when possible

### Resilience Patterns

#### Retry with Exponential Backoff
```typescript
await agent.resilience.withRetry(async () => {
  return await unreliableOperation();
}, {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryCondition: (error) => error.message.includes('timeout')
});
```

#### Circuit Breaker Protection
```typescript
await agent.resilience.withCircuitBreaker('api-service', async () => {
  return await callExternalAPI();
}, {
  failureThreshold: 5,
  recoveryTimeoutMs: 30000,
  monitoringPeriodMs: 60000
});
```

#### Combined Resilience
```typescript
const resilientFunction = agent.resilience.createResilientFunction(
  'database-query',
  async (query) => await database.query(query),
  { maxAttempts: 3 }, // Retry config
  { failureThreshold: 3 } // Circuit breaker config
);
```

## Migration Guide

### From BaseAgent to EnhancedBaseAgent

1. **Update Imports**:
```typescript
// Before
import { BaseAgent } from './base-agent.js';

// After
import { EnhancedBaseAgent } from './enhanced-base-agent.js';
```

2. **Update Class Definition**:
```typescript
// Before
export class MyAgent extends BaseAgent {

// After
export class MyAgent extends EnhancedBaseAgent {
```

3. **Update Constructor**:
```typescript
// No changes needed - the constructor signature is the same
```

4. **Add Hook Support (Optional)**:
```typescript
constructor(...args) {
  super(...args);

  // Add custom hooks
  this.addHook('pre_reasoning', 'logger', this.logReasoningStart);
  this.addHook('post_reasoning', 'metrics', this.trackReasoningMetrics);
}
```

## Performance Considerations

### Hook Performance
- Hooks are executed sequentially - keep them fast
- Use async hooks only when necessary
- Remove unused hooks to prevent memory leaks

### State Management
- State history is limited to prevent memory issues
- Watching state changes uses polling - use sparingly
- Large state objects should be carefully managed

### Resilience Features
- Circuit breakers add minimal overhead
- Retry logic increases execution time during failures
- Timeout protection prevents hanging operations

## Best Practices

1. **Use Hooks for Cross-Cutting Concerns**: Logging, metrics, validation
2. **Leverage State Management**: Track important metrics and agent state
3. **Implement Proper Interruption Handling**: Always clean up resources
4. **Apply Resilience Patterns**: Especially for external API calls
5. **Monitor Performance**: Use the built-in metrics and state tracking

## Example: Complete Enhanced Agent

```typescript
export class MyEnhancedAgent extends EnhancedBaseAgent {
  constructor(...) {
    super(...args);

    // Setup hooks
    this.setupHooks();

    // Setup state
    this.setupCustomState();
  }

  private setupHooks() {
    this.addHook('pre_reasoning', 'logger', async (context, messages) => {
      this.logger.info(`Starting reasoning step ${context.stepNumber}`);
    });

    this.addHook('post_acting', 'tool-tracker', async (context, results) => {
      this.state.set('lastToolResults', results.length);
    });
  }

  private setupCustomState() {
    this.state.register('customMetric', 0);
    this.state.register('lastToolResults', 0);
  }

  protected async getSystemPrompt(): Promise<string> {
    return `You are an enhanced agent with hook support, state management, and resilience features.`;
  }

  protected async onInterruption(reason?: string): Promise<void> {
    await this.cleanupResources();
    this.logger.warn(`Agent interrupted: ${reason}`);
  }

  private async cleanupResources(): Promise<void> {
    // Custom cleanup logic
  }
}
```

This optimization provides a solid foundation for building robust, extensible, and resilient agents that can handle complex scenarios while maintaining clean separation of concerns.