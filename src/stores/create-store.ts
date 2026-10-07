import { useSyncExternalStore } from 'react';

/**
 * Tiny external store (no dependency). Selectors must return existing
 * objects — derive arrays/objects in the component, not in the selector,
 * or every render sees a "new" value.
 */
export function createStore<S>(initial: S) {
  let state = initial;
  const listeners = new Set<() => void>();

  const get = () => state;
  const set = (next: S) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };

  function useStore<T>(selector: (s: S) => T): T {
    return useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state),
    );
  }

  return { get, set, subscribe, useStore };
}

let idCounter = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(idCounter++).toString(36)}`;
