"use client";

/**
 * lib/cms/use-editor-history.ts
 *
 * CMS V3 — Editor Session History
 *
 * Generic immutable undo/redo stack for the Visual Builder editing session.
 * Snapshots are stored in memory only — never persisted to the database.
 * History resets on unmount (page switch, section close).
 *
 * Usage:
 *   const { present, canUndo, canRedo, push, undo, redo, reset } =
 *     useEditorHistory(() => initialState);
 */

import { useReducer, useCallback } from "react";

export const MAX_HISTORY = 50;

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type HistoryAction<T> =
  | { type: "PUSH"; next: T }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET"; next: T };

// ---------------------------------------------------------------------------
// Pure reducer
// ---------------------------------------------------------------------------

function historyReducer<T>(
  state: HistoryState<T>,
  action: HistoryAction<T>,
): HistoryState<T> {
  switch (action.type) {
    case "PUSH": {
      const newPast = [...state.past, state.present];
      if (newPast.length > MAX_HISTORY) newPast.shift();
      return { past: newPast, present: action.next, future: [] };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
      };
    }
    case "RESET": {
      return { past: [], present: action.next, future: [] };
    }
  }
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface EditorHistoryReturn<T> {
  /** Full past stack (oldest first). Read-only. */
  readonly past: readonly T[];
  /** Current editor state. */
  readonly present: T;
  /** Full future stack (most-recent-undone first). Read-only. */
  readonly future: readonly T[];
  /** True when there is at least one past snapshot to restore. */
  readonly canUndo: boolean;
  /** True when there is at least one future snapshot to restore. */
  readonly canRedo: boolean;
  /** Push a new snapshot onto the stack, clearing future. */
  push: (next: T) => void;
  /** Restore the previous snapshot. No-op when canUndo is false. */
  undo: () => void;
  /** Restore the next snapshot. No-op when canRedo is false. */
  redo: () => void;
  /** Reset the entire history to a new initial state. */
  reset: (next: T) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param getInitial  Lazy initializer called exactly once on mount.
 *                    Accepts a function so callers can avoid repeated
 *                    object creation on every render.
 */
export function useEditorHistory<T>(getInitial: () => T): EditorHistoryReturn<T> {
  const [state, dispatch] = useReducer(
    (s: HistoryState<T>, a: HistoryAction<T>) => historyReducer(s, a),
    undefined as unknown as HistoryState<T>,
    (): HistoryState<T> => ({ past: [], present: getInitial(), future: [] }),
  );

  const push = useCallback((next: T) => dispatch({ type: "PUSH", next }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const reset = useCallback((next: T) => dispatch({ type: "RESET", next }), []);

  return {
    past: state.past,
    present: state.present,
    future: state.future,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    push,
    undo,
    redo,
    reset,
  };
}
