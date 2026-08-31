"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const VISITOR_STORAGE_KEY = "kidcellence.visitor-id";

function visitorId() {
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;

    const next =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VISITOR_STORAGE_KEY, next);
    return next;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function SiteAnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const controller = new AbortController();

    fetch("/api/analytics", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: visitorId(), pathname }),
      signal: controller.signal,
    }).catch(() => undefined);

    return () => controller.abort();
  }, [pathname]);

  return null;
}
