"use client";

import { useCallback, useEffect, useState } from "react";

export const PLATFORM_SESSION_EVENT = "kidcexcellence:session-change";

export interface PlatformSessionUser {
  id: string;
  role: "parent" | "provider" | "admin";
  name: string;
  email: string;
  phone?: string;
  location?: string;
  category?: string;
}

export interface PlatformSessionSummary {
  userId: string;
  role: PlatformSessionUser["role"];
  createdAt: string;
  expiresAt: string;
}

export function notifyPlatformSessionChanged() {
  window.dispatchEvent(new Event(PLATFORM_SESSION_EVENT));
}

export function clearLegacyPlatformSession() {
  window.localStorage.removeItem("kidcexcellence.session");
}

export function usePlatformSession() {
  const [user, setUser] = useState<PlatformSessionUser | null>(null);
  const [session, setSession] = useState<PlatformSessionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => null);

    if (!response?.ok) {
      setUser(null);
      setSession(null);
      setLoading(false);
      return null;
    }

    const payload = await response.json();
    setUser(payload.user ?? null);
    setSession(payload.session ?? null);
    setLoading(false);
    return payload;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth", {
      method: "DELETE",
      credentials: "same-origin",
    }).catch(() => null);
    clearLegacyPlatformSession();
    setUser(null);
    setSession(null);
    notifyPlatformSessionChanged();
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      refresh();
    }, 0);
    window.addEventListener(PLATFORM_SESSION_EVENT, refresh);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener(PLATFORM_SESSION_EVENT, refresh);
    };
  }, [refresh]);

  return { user, session, loading, refresh, logout };
}
