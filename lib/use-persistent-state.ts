"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "wt:persistent-state";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // Private mode / storage disabled: behave as not persisted.
  }
}

/**
 * UI preference (tab, range…) remembered on this device via localStorage.
 * Only values in `allowed` are accepted, so a renamed option falls back to
 * `initial` instead of breaking. The server render always uses `initial`.
 */
export function usePersistentState<T extends string>(
  key: string,
  initial: T,
  allowed: readonly T[],
): [T, (value: T) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const value = stored != null && (allowed as readonly string[]).includes(stored) ? (stored as T) : initial;
  const setValue = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Ignore: the value just won't survive a reload.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, setValue];
}
