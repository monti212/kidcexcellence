"use client";

import { useEffect } from "react";

export function ProviderAnalyticsTracker({ providerId }: { providerId: string }) {
  useEffect(() => {
    fetch(`/api/providers/${encodeURIComponent(providerId)}/analytics`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "profile-view" }),
      keepalive: true,
    }).catch(() => undefined);
  }, [providerId]);

  return null;
}
