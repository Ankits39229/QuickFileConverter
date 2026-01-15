/**
 * Undo/History management utilities for state restoration
 */

import * as React from 'react';

export interface HistoryState<T> {
  state: T;
  timestamp: number;
  operation?: string;
}

export class StateHistory<T> {
  private history: HistoryState<T>[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 10) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Save current state to history
   */
  push(state: T, operation?: string): void {
    // Remove any states after current index (if user undid and then made new changes)
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Add new state
    this.history.push({
      state: JSON.parse(JSON.stringify(state)), // Deep clone
      timestamp: Date.now(),
      operation,
    });

    // Trim history if it exceeds max size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  /**
   * Undo - go back to previous state
   */
  undo(): T | null {
    if (!this.canUndo()) {
      return null;
    }

    this.currentIndex--;
    return this.getCurrentState();
  }

  /**
   * Redo - go forward to next state
   */
  redo(): T | null {
    if (!this.canRedo()) {
      return null;
    }

    this.currentIndex++;
    return this.getCurrentState();
  }

  /**
   * Get current state
   */
  getCurrentState(): T | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return JSON.parse(JSON.stringify(this.history[this.currentIndex].state));
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get undo operation description
   */
  getUndoOperation(): string | undefined {
    if (!this.canUndo()) return undefined;
    return this.history[this.currentIndex]?.operation;
  }

  /**
   * Get redo operation description
   */
  getRedoOperation(): string | undefined {
    if (!this.canRedo()) return undefined;
    return this.history[this.currentIndex + 1]?.operation;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Get history size
   */
  size(): number {
    return this.history.length;
  }
}

/**
 * React hook for using state history
 */
export function useStateHistory<T>(initialState: T, maxHistorySize: number = 10) {
  const historyRef = React.useRef(new StateHistory<T>(maxHistorySize));
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);

  const updateHistoryFlags = React.useCallback(() => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }, []);

  const saveState = React.useCallback((state: T, operation?: string) => {
    historyRef.current.push(state, operation);
    updateHistoryFlags();
  }, [updateHistoryFlags]);

  const undo = React.useCallback(() => {
    const prevState = historyRef.current.undo();
    updateHistoryFlags();
    return prevState;
  }, [updateHistoryFlags]);

  const redo = React.useCallback(() => {
    const nextState = historyRef.current.redo();
    updateHistoryFlags();
    return nextState;
  }, [updateHistoryFlags]);

  const clearHistory = React.useCallback(() => {
    historyRef.current.clear();
    updateHistoryFlags();
  }, [updateHistoryFlags]);

  return {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    getUndoOperation: () => historyRef.current.getUndoOperation(),
    getRedoOperation: () => historyRef.current.getRedoOperation(),
  };
}
