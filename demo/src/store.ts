import { useEffect, useState } from "preact/hooks";

/** A tiny observable value with a hook. */
export function createStore<T>(initial: T) {
  let value = initial;
  const subs = new Set<(v: T) => void>();
  return {
    get: () => value,
    set(next: T) { value = next; subs.forEach((f) => f(value)); },
    subscribe(f: (v: T) => void) { subs.add(f); return () => { subs.delete(f); }; },
    use(): T {
      const [v, setV] = useState(value);
      useEffect(() => { setV(value); return this.subscribe(setV); }, []);
      return v;
    },
  };
}
