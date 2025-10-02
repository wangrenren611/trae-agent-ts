export type StateValueType = string | number | boolean | object | null;

export interface StateSnapshot {
  timestamp: string;
  state: Record<string, StateValueType>;
}

export class StateManager {
  private state: Record<string, StateValueType> = {};
  private registeredKeys: Set<string> = new Set();
  private history: StateSnapshot[] = [];
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 50) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Register a state key for tracking
   */
  register(key: string, initialValue?: StateValueType): void {
    this.registeredKeys.add(key);
    if (initialValue !== undefined) {
      this.state[key] = initialValue;
    }
  }

  /**
   * Unregister a state key
   */
  unregister(key: string): void {
    this.registeredKeys.delete(key);
    delete this.state[key];
  }

  /**
   * Set a state value
   */
  set(key: string, value: StateValueType): void {
    if (!this.registeredKeys.has(key)) {
      console.warn(`State key '${key}' is not registered. Registering it automatically.`);
      this.register(key);
    }

    this.state[key] = value;
  }

  /**
   * Get a state value
   */
  get(key: string): StateValueType {
    return this.state[key];
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return key in this.state;
  }

  /**
   * Get all registered state
   */
  getAll(): Record<string, StateValueType> {
    const result: Record<string, StateValueType> = {};
    for (const key of this.registeredKeys) {
      result[key] = this.state[key];
    }
    return result;
  }

  /**
   * Get a snapshot of the current state
   */
  getSnapshot(): StateSnapshot {
    return {
      timestamp: new Date().toISOString(),
      state: this.getAll()
    };
  }

  /**
   * Save current state to history
   */
  saveSnapshot(): void {
    const snapshot = this.getSnapshot();
    this.history.push(snapshot);

    // Maintain history size limit
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Get state history
   */
  getHistory(): StateSnapshot[] {
    return [...this.history];
  }

  /**
   * Restore state from a snapshot
   */
  restoreSnapshot(snapshot: StateSnapshot): void {
    this.state = { ...snapshot.state };
    // Update registered keys to match snapshot
    this.registeredKeys.clear();
    Object.keys(snapshot.state).forEach(key => this.registeredKeys.add(key));
  }

  /**
   * Clear all state and history
   */
  clear(): void {
    this.state = {};
    this.registeredKeys.clear();
    this.history = [];
  }

  /**
   * Merge another state manager's state
   */
  merge(other: StateManager): void {
    const otherState = other.getAll();
    Object.entries(otherState).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  /**
   * Get state difference between current and a snapshot
   */
  diff(snapshot: StateSnapshot): Record<string, { old: StateValueType; new: StateValueType }> {
    const diff: Record<string, { old: StateValueType; new: StateValueType }> = {};
    const currentState = this.getAll();

    for (const key of this.registeredKeys) {
      if (currentState[key] !== snapshot.state[key]) {
        diff[key] = {
          old: snapshot.state[key],
          new: currentState[key]
        };
      }
    }

    return diff;
  }

  /**
   * Watch for state changes
   */
  watch(key: string, callback: (newValue: StateValueType, oldValue: StateValueType) => void): () => void {
    let lastValue = this.get(key);

    const interval = setInterval(() => {
      const currentValue = this.get(key);
      if (currentValue !== lastValue) {
        callback(currentValue, lastValue);
        lastValue = currentValue;
      }
    }, 100); // Check every 100ms

    // Return unsubscribe function
    return () => clearInterval(interval);
  }
}