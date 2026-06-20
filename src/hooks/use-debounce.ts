import { useEffect, useRef, useState, useCallback } from "react";

/** Returns a debounced copy of `value` that only updates after `delay` ms of stability. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Returns a stable debounced callback. The latest args win; previous pending
 * calls are dropped. Useful for click handlers that hit the API.
 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void | Promise<void>,
  delay = 300,
) {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void fnRef.current(...args);
      }, delay);
    },
    [delay],
  );
}

/**
 * Throttle that drops calls happening more often than `delay` ms.
 * Use for action buttons to block double-clicks without losing the first hit.
 */
export function useThrottledCallback<A extends unknown[]>(
  fn: (...args: A) => void | Promise<void>,
  delay = 500,
) {
  const fnRef = useRef(fn);
  const last = useRef(0);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  return useCallback(
    (...args: A) => {
      const now = Date.now();
      if (now - last.current < delay) return;
      last.current = now;
      void fnRef.current(...args);
    },
    [delay],
  );
}
