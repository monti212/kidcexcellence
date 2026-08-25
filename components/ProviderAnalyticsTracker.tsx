"use client";

import { useEffect } from "react";

export function ProviderAnalyticsTracker({ providerId }: { providerId: string }) {
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/providers/${encodeURIComponent(providerId)}/analytics`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "profile-view" }),
      signal: controller.signal,
    }).catch(() => undefined);

    return () => controller.abort();
  }, [providerId]);

  return null;
}

