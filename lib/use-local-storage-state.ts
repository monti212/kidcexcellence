"use client";

import { useEffect, useState } from "react";

export function useLocalStorageState<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T
) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return fallback;

    const saved = window.localStorage.getItem(key);
    if (!saved) return fallback;

    try {
      const parsed = JSON.parse(saved);
      if (validate && !validate(parsed)) return fallback;
      return parsed as T;
    } catch {
      window.localStorage.removeItem(key);
      return fallback;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
