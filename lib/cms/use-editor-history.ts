"use client";

/**
 * lib/cms/use-editor-history.ts
 *
 * In-session undo / redo for the CMS visual editor.
 *
 * Design principles:
 *   - Uses refs for the past/future stacks so snapshot operations are O(1)
 *     for stack management and do not cause extra renders on their own.
 *   - canUndo / canRedo are tracked as proper React state so that components
 *     reading them trigger a re-render when the stack depth changes.
 *   - Maximum stack depth: MAX_HISTORY snapshots (oldest discarded first).
 *   - Does not persist to localStorage or the server — purely in-memory for
 *     the current browser session while a section is open in the editor.
 *   - The caller decides when to push a snapshot (typically on every
 *     meaningful config mutation), and when to apply undo/redo (Ctrl+Z / Y).
 */

import { useRef, useCallback, useState } from "react";

const MAX_HISTORY = 50;

export type EditorHistory<T> = {
  /** Push the current value onto the undo stack before applying a mutation. */
  pushSnapshot: (snapshot: T) => void;
  /**
   * Undo: restores the previous snapshot.
   * Returns the previous value, or null if the stack is empty.
   * The caller receives current and must pass it for the redo stack.
   */
  undo: (current: T) => T | null;
  /**
   * Redo: re-applies the next snapshot.
   * Returns the next value, or null if the redo stack is empty.
   * The caller receives current and must pass it for the undo stack.
   */
  redo: (current: T) => T | null;
  /** Clear both stacks (e.g. when loading a different section). */
  reset: () => void;
  /** True when there is at least one snapshot to undo. */
  canUndo: boolean;
  /** True when there is at least one snapshot to redo. */
  canRedo: boolean;
};

export function useEditorHistory<T>(): EditorHistory<T> {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  // Track stack depths as state so components reading canUndo/canRedo re-render.
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushSnapshot = useCallback((snapshot: T) => {
    past.current = [...past.current.slice(-(MAX_HISTORY - 1)), snapshot];
    future.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback((current: T): T | null => {
    if (past.current.length === 0) return null;
    const previous = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [current, ...future.current.slice(0, MAX_HISTORY - 1)];
    setCanUndo(past.current.length > 0);
    setCanRedo(true);
    return previous;
  }, []);

  const redo = useCallback((current: T): T | null => {
    if (future.current.length === 0) return null;
    const next = future.current[0];
    future.current = future.current.slice(1);
    past.current = [...past.current.slice(-(MAX_HISTORY - 1)), current];
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
    return next;
  }, []);

  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return {
    pushSnapshot,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
  };
}
