"use client";

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type SetStateAction,
} from "react";

const LOCAL_STORAGE_EVENT = "kidcexcellence:local-storage-change";

export function useLocalStorageState<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T
) {
  const fallbackSnapshot = JSON.stringify(fallback);
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === key) onStoreChange();
      };
      const handleLocalChange = (event: Event) => {
        if ((event as CustomEvent<string>).detail === key) onStoreChange();
      };
      window.addEventListener("storage", handleStorage);
      window.addEventListener(LOCAL_STORAGE_EVENT, handleLocalChange);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(LOCAL_STORAGE_EVENT, handleLocalChange);
      };
    },
    [key]
  );
  const getSnapshot = useCallback(
    () => window.localStorage.getItem(key) ?? fallbackSnapshot,
    [fallbackSnapshot, key]
  );
  const getServerSnapshot = useCallback(() => fallbackSnapshot, [fallbackSnapshot]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const value = useMemo(() => {
    try {
      const parsed = JSON.parse(snapshot);
      if (validate && !validate(parsed)) return fallback;
      return parsed as T;
    } catch {
      return fallback;
    }
  }, [fallback, snapshot, validate]);
  const setValue = useCallback(
    (nextValue: SetStateAction<T>) => {
      const currentSnapshot = window.localStorage.getItem(key) ?? fallbackSnapshot;
      let currentValue = fallback;
      try {
        const parsed = JSON.parse(currentSnapshot);
        if (!validate || validate(parsed)) currentValue = parsed as T;
      } catch {
        currentValue = fallback;
      }
      const resolvedValue =
        typeof nextValue === "function"
          ? (nextValue as (current: T) => T)(currentValue)
          : nextValue;
      window.localStorage.setItem(key, JSON.stringify(resolvedValue));
      window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_EVENT, { detail: key }));
    },
    [fallback, fallbackSnapshot, key, validate]
  );

  return [value, setValue] as const;
}
