import { useCallback, useRef, useState } from 'react';

/** Undo/redo with live (uncommitted) updates for drags. */
export function useHistory<T>(initial: T) {
  const [present, setPresent] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const pending = useRef<T | null>(null);
  const [, force] = useState(0);
  const cur = useRef(initial);
  cur.current = present;

  const commit = useCallback((next: T | ((p: T) => T)) => {
    const value = typeof next === 'function' ? (next as (p: T) => T)(cur.current) : next;
    past.current.push(pending.current ?? cur.current);
    if (past.current.length > 200) past.current.shift();
    pending.current = null;
    future.current = [];
    cur.current = value;
    setPresent(value);
  }, []);
  /** Start a gesture: remember the state before it */
  const begin = useCallback(() => { pending.current = cur.current; }, []);
  /** Update during a gesture without creating history entries */
  const live = useCallback((value: T) => { cur.current = value; setPresent(value); }, []);
  /** End a gesture: push the pre-gesture state once */
  const end = useCallback(() => {
    if (pending.current && pending.current !== cur.current) { past.current.push(pending.current); future.current = []; force((x) => x + 1); }
    pending.current = null;
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return false;
    future.current.push(cur.current);
    cur.current = prev;
    setPresent(prev);
    return true;
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return false;
    past.current.push(cur.current);
    cur.current = next;
    setPresent(next);
    return true;
  }, []);
  const reset = useCallback((v: T) => { past.current = []; future.current = []; cur.current = v; setPresent(v); }, []);
  return { present, commit, begin, live, end, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
